import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema, type DbOrTx } from "@/db";
import { tFor } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/translate";
import { getSettings } from "@/lib/settings";
import { emailAdapter, smsAdapter } from "./adapters";

export type NotificationType =
  | "verification_approved"
  | "verification_rejected"
  | "verification_info_required"
  | "verification_suspended"
  | "application_submitted"
  | "new_job_request"
  | "quote_received"
  | "quote_revised"
  | "quote_accepted"
  | "quote_rejected"
  | "booking_requested"
  | "booking_confirmed"
  | "booking_declined"
  | "booking_expired"
  | "appointment_change_proposed"
  | "appointment_changed"
  | "appointment_change_rejected"
  | "appointment_reminder"
  | "technician_en_route"
  | "job_started"
  | "completion_requested"
  | "job_completed"
  | "booking_cancelled"
  | "request_cancelled"
  | "request_expired"
  | "new_message"
  | "dispute_opened"
  | "dispute_update"
  | "dispute_resolved"
  | "review_received"
  | "payment_recorded"
  | "ticket_update"
  | "service_approved"
  | "service_rejected"
  | "report_update"
  | "account_notice";

/** Events important enough to also go out by email/SMS when configured. */
const OUT_OF_APP: Partial<Record<NotificationType, ("email" | "sms")[]>> = {
  verification_approved: ["email", "sms"],
  verification_rejected: ["email"],
  verification_info_required: ["email", "sms"],
  verification_suspended: ["email"],
  new_job_request: ["sms"],
  quote_received: ["email", "sms"],
  quote_accepted: ["email", "sms"],
  booking_requested: ["email", "sms"],
  booking_confirmed: ["email", "sms"],
  booking_declined: ["email", "sms"],
  booking_expired: ["email"],
  appointment_change_proposed: ["email", "sms"],
  appointment_changed: ["email", "sms"],
  appointment_reminder: ["sms"],
  technician_en_route: ["sms"],
  completion_requested: ["email", "sms"],
  booking_cancelled: ["email", "sms"],
  dispute_opened: ["email"],
  dispute_resolved: ["email"],
  ticket_update: ["email"],
};

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  params?: Record<string, string | number>;
  /** Params computed in the recipient's locale (dates, amounts). */
  localized?: (locale: "fr-DZ" | "ar-DZ") => Record<string, string | number>;
  link?: string;
  dedupeKey?: string;
  payload?: Record<string, unknown>;
}

/**
 * Persists an in-app notification (always) and queues out-of-app deliveries.
 * Safe to call inside a transaction: external sends happen later in `dispatchPendingDeliveries`.
 * Returns the number of notifications created (0 when deduplicated).
 */
export async function notify(input: NotifyInput, tx: DbOrTx = db): Promise<number> {
  const [recipient] = await tx
    .select({
      locale: schema.profiles.preferredLocale,
      prefs: schema.profiles.notificationPrefs,
      status: schema.profiles.accountStatus,
      email: schema.users.email,
      phone: schema.users.phone,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      phoneVerifiedAt: schema.users.phoneVerifiedAt,
    })
    .from(schema.profiles)
    .innerJoin(schema.users, eq(schema.users.id, schema.profiles.id))
    .where(eq(schema.profiles.id, input.userId))
    .limit(1);
  if (!recipient || recipient.status === "deleted") return 0;

  const t = tFor(recipient.locale);
  const params = { ...(input.params ?? {}), ...(input.localized?.(recipient.locale) ?? {}) };
  const settings = await getSettings();
  const override = settings.notification_overrides?.[input.type];
  const isAr = recipient.locale === "ar-DZ";
  const titleTpl = (isAr ? override?.titleAr : override?.titleFr) || undefined;
  const bodyTpl = (isAr ? override?.bodyAr : override?.bodyFr) || undefined;
  const title = titleTpl ? interpolate(titleTpl, params) : t(`notifications.types.${input.type}.title`, params);
  const body = bodyTpl ? interpolate(bodyTpl, params) : t(`notifications.types.${input.type}.body`, params);

  const inserted = await tx
    .insert(schema.notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title,
      body: body.slice(0, 500),
      link: input.link ?? null,
      payload: input.payload ?? null,
      dedupeKey: input.dedupeKey ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: schema.notifications.id });
  const notification = inserted[0];
  if (!notification) return 0;

  const deliveries: (typeof schema.notificationDeliveries.$inferInsert)[] = [
    {
      notificationId: notification.id,
      channel: "in_app",
      provider: "database",
      deliveryStatus: "delivered",
      attemptCount: 1,
      sentAt: new Date(),
    },
  ];

  for (const channel of OUT_OF_APP[input.type] ?? []) {
    if (channel === "email") {
      const adapter = emailAdapter();
      if (!recipient.email) continue;
      deliveries.push({
        notificationId: notification.id,
        channel: "email",
        provider: adapter?.name ?? "none",
        deliveryStatus: !adapter ? "skipped_not_configured" : recipient.prefs.email ? "queued" : "skipped_preference",
      });
    } else if (channel === "sms") {
      const adapter = smsAdapter();
      if (!recipient.phone) continue;
      deliveries.push({
        notificationId: notification.id,
        channel: "sms",
        provider: adapter?.name ?? "none",
        deliveryStatus: !adapter ? "skipped_not_configured" : recipient.prefs.sms ? "queued" : "skipped_preference",
      });
    }
  }
  await tx.insert(schema.notificationDeliveries).values(deliveries);
  return 1;
}

export async function notifyMany(inputs: NotifyInput[], tx: DbOrTx = db) {
  let n = 0;
  for (const i of inputs) n += await notify(i, tx);
  return n;
}

const MAX_ATTEMPTS = 4;

/**
 * Sends queued email/SMS deliveries. A delivery is marked `sent` only when the
 * provider accepted it; failures are retried with a bounded attempt count.
 */
export async function dispatchPendingDeliveries(limit = 50): Promise<number> {
  const pending = await db
    .select({
      id: schema.notificationDeliveries.id,
      channel: schema.notificationDeliveries.channel,
      attemptCount: schema.notificationDeliveries.attemptCount,
      title: schema.notifications.title,
      body: schema.notifications.body,
      link: schema.notifications.link,
      email: schema.users.email,
      phone: schema.users.phone,
    })
    .from(schema.notificationDeliveries)
    .innerJoin(schema.notifications, eq(schema.notifications.id, schema.notificationDeliveries.notificationId))
    .innerJoin(schema.users, eq(schema.users.id, schema.notifications.userId))
    .where(
      and(
        inArray(schema.notificationDeliveries.deliveryStatus, ["queued", "failed"]),
        lt(schema.notificationDeliveries.attemptCount, MAX_ATTEMPTS),
      ),
    )
    .limit(limit);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  let processed = 0;
  for (const d of pending) {
    // Claim the row to avoid double sending from concurrent dispatchers
    const claimed = await db
      .update(schema.notificationDeliveries)
      .set({ attemptCount: sql`${schema.notificationDeliveries.attemptCount} + 1` })
      .where(
        and(
          eq(schema.notificationDeliveries.id, d.id),
          eq(schema.notificationDeliveries.attemptCount, d.attemptCount),
        ),
      )
      .returning({ id: schema.notificationDeliveries.id });
    if (!claimed.length) continue;

    let result: { ok: boolean; providerReference?: string; error?: string } = { ok: false, error: "no adapter" };
    const text = `${d.body}${d.link ? `\n\n${appUrl}${d.link}` : ""}`;
    if (d.channel === "email") {
      const adapter = emailAdapter();
      if (adapter && d.email) result = await adapter.send(d.email, `Khidmati — ${d.title}`, text);
    } else if (d.channel === "sms") {
      const adapter = smsAdapter();
      if (adapter && d.phone) result = await adapter.send(d.phone, `Khidmati: ${d.body}`.slice(0, 300));
    }
    await db
      .update(schema.notificationDeliveries)
      .set(
        result.ok
          ? { deliveryStatus: "sent", providerReference: result.providerReference ?? null, sentAt: new Date(), lastError: null }
          : { deliveryStatus: "failed", lastError: result.error ?? "unknown" },
      )
      .where(eq(schema.notificationDeliveries.id, d.id));
    processed++;
  }
  return processed;
}

/** Schedule delivery dispatch after the response is sent (no-op outside a request scope). */
export async function scheduleDispatch() {
  if (!emailAdapter() && !smsAdapter()) return;
  try {
    const { after } = await import("next/server");
    after(async () => {
      try {
        await dispatchPendingDeliveries();
      } catch (e) {
        console.error("[notify] dispatch failed", (e as Error).message);
      }
    });
  } catch {
    // Outside of a Next.js request (tests/scripts): cron will pick it up.
  }
}
