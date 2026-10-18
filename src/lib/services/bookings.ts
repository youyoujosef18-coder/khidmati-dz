import "server-only";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type Tx } from "@/db";
import { AppError } from "@/lib/errors";
import { makeReference } from "@/lib/crypto";
import { addHours, addMinutes, algeriaLocalToUtc } from "@/lib/time";
import { daToMinor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatDateTime, formatMoney } from "@/lib/i18n/format";
import { hasPermission } from "@/lib/auth/permissions";
import { notify, scheduleDispatch, type NotificationType } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { attachFiles } from "@/lib/storage";
import {
  assertBookingTransition,
  assertRequestTransition,
  clientCanCancelConfirmed,
  type Actor as MachineActor,
  type BookingStatus,
  type RequestStatus,
} from "@/lib/domain/state-machines";
import { lockAndCheckSlot, mapSlotConflict } from "./scheduling";
import { ensureConversation } from "./messaging";
import type { Actor } from "./types";

export type Booking = typeof schema.bookings.$inferSelect;

/* ------------------------------ Loading ------------------------------ */

export async function lockBooking(tx: Tx, bookingId: string) {
  const [b] = await tx.select().from(schema.bookings).where(eq(schema.bookings.id, bookingId)).for("update");
  if (!b) throw new AppError("not_found", 404);
  const [tp] = await tx.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, b.technicianId));
  return { booking: b, technician: tp! };
}

/** Which side of the booking is the actor on? Throws when unrelated. */
function sideOf(actor: Actor, booking: Booking, techUserId: string): "client" | "technician" | "staff" {
  if (booking.clientId === actor.id) return "client";
  if (techUserId === actor.id) return "technician";
  if (hasPermission(actor.roles, "bookings.intervene")) return "staff";
  throw new AppError("not_found", 404);
}

async function recordTransition(
  tx: Tx,
  booking: Booking,
  to: BookingStatus,
  actorId: string | null,
  reason: string | null,
  patch: Partial<typeof schema.bookings.$inferInsert> = {},
  metadata?: Record<string, unknown>,
) {
  const updated = await tx
    .update(schema.bookings)
    .set({ status: to, version: booking.version + 1, ...patch })
    .where(and(eq(schema.bookings.id, booking.id), eq(schema.bookings.version, booking.version)))
    .returning({ id: schema.bookings.id });
  if (!updated.length) throw new AppError("stale_state", 409);
  await tx.insert(schema.bookingStatusHistory).values({
    bookingId: booking.id,
    previousStatus: booking.status,
    newStatus: to,
    actorId,
    reason,
    metadata: metadata ?? null,
  });
}

async function closeRequestWithBooking(tx: Tx, booking: Booking, to: "cancelled" | "expired") {
  if (!booking.requestId) return;
  const [req] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, booking.requestId)).for("update");
  if (req?.status === "booked") {
    assertRequestTransition(req.status as RequestStatus, to, "system");
    await tx.update(schema.serviceRequests).set({ status: to }).where(eq(schema.serviceRequests.id, req.id));
  }
}

function link(side: "client" | "technician", bookingId: string) {
  return side === "client" ? `/client/reservations/${bookingId}` : `/technicien/reservations/${bookingId}`;
}

async function notifyParty(
  tx: Tx,
  booking: Booking,
  techUserId: string,
  to: "client" | "technician",
  type: NotificationType,
  params: Record<string, string | number> = {},
  withDate?: Date,
) {
  await notify(
    {
      userId: to === "client" ? booking.clientId : techUserId,
      type,
      params: { ref: booking.reference, title: booking.title, ...params },
      localized: withDate ? (l) => ({ date: formatDateTime(withDate, l) }) : undefined,
      link: link(to, booking.id),
    },
    tx,
  );
}

/* ------------------------ Fixed-price booking ------------------------ */

export const fixedBookingSchema = z.object({
  idempotencyKey: z.string().min(8).max(64),
  serviceId: z.string().uuid(),
  addressId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  description: z.string().trim().min(10).max(2000),
  customerNotes: z.string().trim().max(1000).optional().default(""),
  photoIds: z.array(z.string().uuid()).max(5).optional().default([]),
  confirm: z.literal("on", { message: "validation.terms" }),
});

/**
 * Workflow 2: the slot is reserved immediately (status `requested`) and held
 * until the technician confirms or the hold expires.
 */
export async function createFixedPriceBooking(actor: Actor, input: z.infer<typeof fixedBookingSchema>) {
  const settings = await getSettings();
  const [dup] = await db
    .select({ id: schema.bookings.id, reference: schema.bookings.reference })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.clientId, actor.id), eq(schema.bookings.idempotencyKey, input.idempotencyKey)));
  if (dup) return dup;

  const result = await db
    .transaction(async (tx) => {
      const [svc] = await tx
        .select()
        .from(schema.technicianServices)
        .where(
          and(
            eq(schema.technicianServices.id, input.serviceId),
            eq(schema.technicianServices.approvalStatus, "approved"),
            eq(schema.technicianServices.isActive, true),
            eq(schema.technicianServices.pricingModel, "fixed"),
          ),
        );
      if (!svc || svc.startingPriceMinor == null) throw new AppError("service_not_available");
      const [address] = await tx
        .select()
        .from(schema.clientAddresses)
        .where(and(eq(schema.clientAddresses.id, input.addressId), eq(schema.clientAddresses.clientId, actor.id), isNull(schema.clientAddresses.archivedAt)));
      if (!address) throw new AppError("not_found", 404);

      const start = algeriaLocalToUtc(input.date, input.time);
      if (start.getTime() < Date.now() + 60 * 60_000) throw new AppError("validation", 400);
      if (start.getTime() > Date.now() + 90 * 86400_000) throw new AppError("validation", 400);
      const end = addMinutes(start, svc.estimatedDurationMinutes);

      const tp = await lockAndCheckSlot(tx, svc.technicianId, start, end);
      if (tp.userId === actor.id) throw new AppError("self_action");

      // The technician must serve the address
      const [served] = await tx.execute(sql`
        SELECT 1 FROM service_areas WHERE technician_id = ${tp.id} AND wilaya_code = ${address.wilayaCode}
          AND (commune_id IS NULL OR commune_id = ${address.communeId}) LIMIT 1`);
      if (!served) throw new AppError("not_eligible");

      const now = new Date();
      const [req] = await tx
        .insert(schema.serviceRequests)
        .values({
          reference: makeReference("KR"),
          clientId: actor.id,
          categoryId: svc.categoryId,
          serviceId: svc.id,
          targetTechnicianId: tp.id,
          title: svc.title,
          description: input.description,
          urgency: "normal",
          addressId: address.id,
          wilayaCode: address.wilayaCode,
          communeId: address.communeId,
          preferredDate: input.date,
          timeWindow: "flexible",
          preferredStartAt: start,
          preferredEndAt: end,
          customerNotes: input.customerNotes || null,
          status: "booked",
          idempotencyKey: input.idempotencyKey,
          expiresAt: start,
        })
        .returning();
      await tx.insert(schema.requestMatches).values({ requestId: req!.id, technicianId: tp.id, matchReason: { fixedPrice: true } });
      if (input.photoIds.length) {
        await attachFiles(tx, actor.id, input.photoIds, "service-request-media", "service_request", req!.id);
        await tx.insert(schema.serviceRequestMedia).values(input.photoIds.map((fileId) => ({ requestId: req!.id, fileId, uploadedBy: actor.id })));
      }

      const holdUntil = new Date(Math.min(addHours(now, settings.fixed_price_hold_hours).getTime(), start.getTime() - 30 * 60_000));
      const [booking] = await tx
        .insert(schema.bookings)
        .values({
          reference: makeReference("KB"),
          requestId: req!.id,
          clientId: actor.id,
          technicianId: tp.id,
          serviceId: svc.id,
          categoryId: svc.categoryId,
          addressId: address.id,
          wilayaCode: address.wilayaCode,
          communeId: address.communeId,
          title: svc.title,
          scheduledStartAt: start,
          scheduledEndAt: end,
          status: "requested",
          pricingModel: "fixed",
          currency: svc.currency,
          agreedTotalMinor: svc.startingPriceMinor,
          holdExpiresAt: holdUntil,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();
      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking!.id,
        previousStatus: null,
        newStatus: "requested",
        actorId: actor.id,
        reason: "fixed_price_booking",
        metadata: { serviceId: svc.id },
      });
      await ensureConversation(tx, { requestId: req!.id, clientId: actor.id, technicianId: tp.id, technicianUserId: tp.userId, bookingId: booking!.id });
      await notify(
        {
          userId: tp.userId,
          type: "booking_requested",
          params: { title: svc.title },
          localized: (l) => ({ date: formatDateTime(start, l) }),
          link: `/technicien/reservations/${booking!.id}`,
        },
        tx,
      );
      await writeAudit({ actorId: actor.id, action: "booking.fixed_requested", entityType: "booking", entityId: booking!.id }, tx);
      return { id: booking!.id, reference: booking!.reference };
    })
    .catch(mapSlotConflict);
  await scheduleDispatch();
  return result;
}

/* ------------------------- Status transitions ------------------------ */

export type BookingAction =
  | "confirm"
  | "decline"
  | "en_route"
  | "start"
  | "request_completion"
  | "confirm_completion"
  | "cancel";

export async function performBookingAction(actor: Actor, bookingId: string, action: BookingAction, reason = "") {
  const settings = await getSettings();
  await db.transaction(async (tx) => {
    const { booking, technician } = await lockBooking(tx, bookingId);
    const side = sideOf(actor, booking, technician.userId);
    const machineActor: MachineActor = side;
    const now = new Date();
    const from = booking.status as BookingStatus;

    switch (action) {
      case "confirm": {
        if (side !== "technician") throw new AppError("forbidden", 403);
        assertBookingTransition(from, "confirmed", "technician");
        if (booking.holdExpiresAt && booking.holdExpiresAt <= now) throw new AppError("invalid_transition", 409);
        await recordTransition(tx, booking, "confirmed", actor.id, null, { holdExpiresAt: null });
        await notifyParty(tx, booking, technician.userId, "client", "booking_confirmed", {}, booking.scheduledStartAt);
        break;
      }
      case "decline": {
        if (side !== "technician" || from !== "requested") throw new AppError("invalid_transition", 409);
        assertBookingTransition(from, "cancelled", "technician");
        await recordTransition(tx, booking, "cancelled", actor.id, reason || "declined", {
          cancellationReason: reason || "declined",
          cancelledBy: actor.id,
          holdExpiresAt: null,
        });
        await closeRequestWithBooking(tx, booking, "cancelled");
        await notifyParty(tx, booking, technician.userId, "client", "booking_declined");
        break;
      }
      case "en_route": {
        if (side !== "technician") throw new AppError("forbidden", 403);
        assertBookingTransition(from, "technician_en_route", "technician");
        await recordTransition(tx, booking, "technician_en_route", actor.id, null);
        await notifyParty(tx, booking, technician.userId, "client", "technician_en_route", { name: technician.publicName });
        break;
      }
      case "start": {
        if (side !== "technician") throw new AppError("forbidden", 403);
        assertBookingTransition(from, "in_progress", "technician");
        await recordTransition(tx, booking, "in_progress", actor.id, null);
        await notifyParty(tx, booking, technician.userId, "client", "job_started");
        break;
      }
      case "request_completion": {
        if (side !== "technician") throw new AppError("forbidden", 403);
        assertBookingTransition(from, "awaiting_completion_confirmation", "technician");
        const autoAt = addHours(now, settings.completion_review_hours);
        await recordTransition(tx, booking, "awaiting_completion_confirmation", actor.id, null, {
          completionRequestedAt: now,
          autoCompleteAt: autoAt,
        });
        await notifyParty(tx, booking, technician.userId, "client", "completion_requested", { name: technician.publicName });
        break;
      }
      case "confirm_completion": {
        if (side !== "client") throw new AppError("forbidden", 403);
        assertBookingTransition(from, "completed", "client");
        await recordTransition(tx, booking, "completed", actor.id, null, { completedAt: now, autoCompleteAt: null });
        await notifyParty(tx, booking, technician.userId, "technician", "job_completed");
        break;
      }
      case "cancel": {
        if (!reason.trim()) throw new AppError("validation", 400);
        assertBookingTransition(from, "cancelled", machineActor);
        if (side === "client" && from === "confirmed") {
          if (!clientCanCancelConfirmed(booking.scheduledStartAt, now, settings.cancellation_policy.clientFreeCancellationHours)) {
            throw new AppError("cancellation_window", 409);
          }
        }
        await recordTransition(tx, booking, "cancelled", actor.id, reason, {
          cancellationReason: reason,
          cancelledBy: actor.id,
          holdExpiresAt: null,
        });
        await tx
          .update(schema.bookingChangeRequests)
          .set({ status: "cancelled" })
          .where(and(eq(schema.bookingChangeRequests.bookingId, booking.id), eq(schema.bookingChangeRequests.status, "pending")));
        await closeRequestWithBooking(tx, booking, "cancelled");
        const targets: ("client" | "technician")[] = side === "client" ? ["technician"] : side === "technician" ? ["client"] : ["client", "technician"];
        for (const tgt of targets) await notifyParty(tx, booking, technician.userId, tgt, "booking_cancelled", { reason });
        if (side === "staff") {
          await writeAudit({ actorId: actor.id, action: "booking.staff_cancelled", entityType: "booking", entityId: booking.id, reason }, tx);
        }
        break;
      }
    }
  });
  await scheduleDispatch();
}

/* ----------------------------- Reschedule ---------------------------- */

export const rescheduleSchema = z.object({
  bookingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  reason: z.string().trim().max(500).optional().default(""),
});

export async function proposeReschedule(actor: Actor, input: z.infer<typeof rescheduleSchema>) {
  await db.transaction(async (tx) => {
    const { booking, technician } = await lockBooking(tx, input.bookingId);
    const side = sideOf(actor, booking, technician.userId);
    if (side === "staff") throw new AppError("forbidden", 403);
    if (booking.status !== "confirmed") throw new AppError("invalid_transition", 409);
    const start = algeriaLocalToUtc(input.date, input.time);
    if (start.getTime() < Date.now() + 60 * 60_000) throw new AppError("validation", 400);
    const end = new Date(start.getTime() + (booking.scheduledEndAt.getTime() - booking.scheduledStartAt.getTime()));
    // Validate now for fast feedback; re-validated on acceptance.
    await lockAndCheckSlot(tx, booking.technicianId, start, end, { excludeBookingId: booking.id });
    await tx
      .update(schema.bookingChangeRequests)
      .set({ status: "cancelled" })
      .where(and(eq(schema.bookingChangeRequests.bookingId, booking.id), eq(schema.bookingChangeRequests.status, "pending")));
    await tx.insert(schema.bookingChangeRequests).values({
      bookingId: booking.id,
      requestedBy: actor.id,
      proposedStartAt: start,
      proposedEndAt: end,
      reason: input.reason || null,
    });
    await notifyParty(tx, booking, technician.userId, side === "client" ? "technician" : "client", "appointment_change_proposed", {}, start);
  });
  await scheduleDispatch();
}

export async function respondReschedule(actor: Actor, changeRequestId: string, accept: boolean) {
  await db
    .transaction(async (tx) => {
      const [cr] = await tx.select().from(schema.bookingChangeRequests).where(eq(schema.bookingChangeRequests.id, changeRequestId)).for("update");
      if (!cr || cr.status !== "pending") throw new AppError("invalid_transition", 409);
      const { booking, technician } = await lockBooking(tx, cr.bookingId);
      const side = sideOf(actor, booking, technician.userId);
      if (side === "staff" || cr.requestedBy === actor.id) throw new AppError("forbidden", 403);
      const proposerSide = side === "client" ? "technician" : "client";
      const now = new Date();
      if (!accept) {
        await tx.update(schema.bookingChangeRequests).set({ status: "rejected", respondedBy: actor.id, respondedAt: now }).where(eq(schema.bookingChangeRequests.id, cr.id));
        await notifyParty(tx, booking, technician.userId, proposerSide, "appointment_change_rejected");
        return;
      }
      if (booking.status !== "confirmed") throw new AppError("invalid_transition", 409);
      await lockAndCheckSlot(tx, booking.technicianId, cr.proposedStartAt, cr.proposedEndAt, { excludeBookingId: booking.id });
      const updated = await tx
        .update(schema.bookings)
        .set({ scheduledStartAt: cr.proposedStartAt, scheduledEndAt: cr.proposedEndAt, version: booking.version + 1 })
        .where(and(eq(schema.bookings.id, booking.id), eq(schema.bookings.version, booking.version)))
        .returning({ id: schema.bookings.id });
      if (!updated.length) throw new AppError("stale_state", 409);
      await tx.update(schema.bookingChangeRequests).set({ status: "accepted", respondedBy: actor.id, respondedAt: now }).where(eq(schema.bookingChangeRequests.id, cr.id));
      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking.id,
        previousStatus: booking.status,
        newStatus: booking.status,
        actorId: actor.id,
        reason: "rescheduled",
        metadata: { from: booking.scheduledStartAt.toISOString(), to: cr.proposedStartAt.toISOString(), changeRequestId: cr.id },
      });
      for (const tgt of ["client", "technician"] as const) {
        await notifyParty(tx, booking, technician.userId, tgt, "appointment_changed", {}, cr.proposedStartAt);
      }
    })
    .catch(mapSlotConflict);
  await scheduleDispatch();
}

/* ------------------------------- Cash -------------------------------- */

export async function recordCashPayment(actor: Actor, bookingId: string, amountDa: number, note: string) {
  await db.transaction(async (tx) => {
    const { booking, technician } = await lockBooking(tx, bookingId);
    if (technician.userId !== actor.id) throw new AppError("forbidden", 403);
    if (!["in_progress", "awaiting_completion_confirmation", "completed"].includes(booking.status)) throw new AppError("invalid_transition", 409);
    if (booking.paymentStatus !== "unpaid") throw new AppError("payment_exists", 409);
    const amountMinor = daToMinor(amountDa);
    if (amountMinor <= 0) throw new AppError("validation", 400);
    await tx.insert(schema.payments).values({
      bookingId: booking.id,
      provider: "cash",
      providerReference: booking.id, // unique per booking → recorded once
      amountMinor,
      currency: booking.currency,
      paymentStatus: "cash_recorded",
      recordedBy: actor.id,
      note: note || null,
    });
    await tx.insert(schema.ledgerEntries).values({
      bookingId: booking.id,
      technicianId: technician.id,
      entryType: "cash_collected",
      amountMinor,
      currency: booking.currency,
      actorId: actor.id,
      reason: note || null,
    });
    await tx
      .update(schema.bookings)
      .set({ paymentStatus: "cash_recorded", version: booking.version + 1 })
      .where(eq(schema.bookings.id, booking.id));
    await notify(
      {
        userId: booking.clientId,
        type: "payment_recorded",
        params: { ref: booking.reference },
        localized: (l) => ({ amount: formatMoney(amountMinor, l) }),
        link: `/client/reservations/${booking.id}`,
      },
      tx,
    );
  });
}

/* ------------------------------ Readers ------------------------------ */

export async function getBookingDetail(actor: Actor, bookingId: string) {
  const [row] = await db
    .select({
      booking: schema.bookings,
      techName: schema.technicianProfiles.publicName,
      techSlug: schema.technicianProfiles.slug,
      techAvatar: schema.technicianProfiles.avatarFileId,
      techUserId: schema.technicianProfiles.userId,
      techTerms: schema.technicianProfiles.serviceTerms,
      clientName: schema.profiles.fullName,
      clientDisplay: schema.profiles.displayName,
      categoryFr: schema.serviceCategories.nameFr,
      categoryAr: schema.serviceCategories.nameAr,
      communeFr: schema.communes.nameFr,
      communeAr: schema.communes.nameAr,
      wilayaFr: schema.wilayas.nameFr,
      wilayaAr: schema.wilayas.nameAr,
    })
    .from(schema.bookings)
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.bookings.clientId))
    .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.bookings.categoryId))
    .innerJoin(schema.communes, eq(schema.communes.id, schema.bookings.communeId))
    .innerJoin(schema.wilayas, eq(schema.wilayas.code, schema.bookings.wilayaCode))
    .where(eq(schema.bookings.id, bookingId));
  if (!row) return null;
  const isClient = row.booking.clientId === actor.id;
  const isTech = row.techUserId === actor.id;
  const isStaff = hasPermission(actor.roles, "bookings.read_all");
  if (!isClient && !isTech && !isStaff) return null;

  // Exact address only for participants once the booking is confirmed (or for the client/staff always)
  const revealAddress = isClient || isStaff || (isTech && row.booking.status !== "requested");
  const [address] = revealAddress
    ? await db.select().from(schema.clientAddresses).where(eq(schema.clientAddresses.id, row.booking.addressId))
    : [];
  const [history, changes, quote, quoteItems, payments, review, dispute, conversation, phones] = await Promise.all([
    db
      .select()
      .from(schema.bookingStatusHistory)
      .where(eq(schema.bookingStatusHistory.bookingId, bookingId))
      .orderBy(asc(schema.bookingStatusHistory.createdAt)),
    db
      .select()
      .from(schema.bookingChangeRequests)
      .where(eq(schema.bookingChangeRequests.bookingId, bookingId))
      .orderBy(desc(schema.bookingChangeRequests.createdAt)),
    row.booking.acceptedQuoteId
      ? db.select().from(schema.quotes).where(eq(schema.quotes.id, row.booking.acceptedQuoteId)).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    row.booking.acceptedQuoteId
      ? db.select().from(schema.quoteItems).where(eq(schema.quoteItems.quoteId, row.booking.acceptedQuoteId))
      : Promise.resolve([]),
    db.select().from(schema.payments).where(eq(schema.payments.bookingId, bookingId)),
    db.select().from(schema.reviews).where(eq(schema.reviews.bookingId, bookingId)).then((r) => r[0] ?? null),
    db
      .select()
      .from(schema.disputes)
      .where(eq(schema.disputes.bookingId, bookingId))
      .orderBy(desc(schema.disputes.createdAt))
      .then((r) => r[0] ?? null),
    db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(and(eq(schema.conversations.requestId, row.booking.requestId ?? sql`NULL`), eq(schema.conversations.technicianId, row.booking.technicianId)))
      .then((r) => r[0] ?? null),
    // Phone numbers are exchanged only within an active, confirmed booking
    ["confirmed", "technician_en_route", "in_progress", "awaiting_completion_confirmation"].includes(row.booking.status)
      ? db
          .select({ id: schema.users.id, phone: schema.users.phone })
          .from(schema.users)
          .where(inArray(schema.users.id, [row.booking.clientId, row.techUserId]))
      : Promise.resolve([]),
  ]);
  return {
    ...row,
    address: address ?? null,
    history,
    changes,
    quote,
    quoteItems,
    payments,
    review,
    dispute,
    conversationId: conversation?.id ?? null,
    clientPhone: phones.find((p) => p.id === row.booking.clientId)?.phone ?? null,
    techPhone: phones.find((p) => p.id === row.techUserId)?.phone ?? null,
    viewer: isClient ? ("client" as const) : isTech ? ("technician" as const) : ("staff" as const),
  };
}

export async function listBookings(
  filter: { clientId?: string; technicianId?: string },
  view: "upcoming" | "past" | "all" | "to_confirm",
  page = 1,
  pageSize = 10,
) {
  const conds = [
    filter.clientId ? eq(schema.bookings.clientId, filter.clientId) : undefined,
    filter.technicianId ? eq(schema.bookings.technicianId, filter.technicianId) : undefined,
    view === "upcoming"
      ? and(
          inArray(schema.bookings.status, ["requested", "confirmed", "technician_en_route", "in_progress", "awaiting_completion_confirmation", "disputed"]),
        )
      : undefined,
    view === "past" ? inArray(schema.bookings.status, ["completed", "cancelled", "expired"]) : undefined,
    view === "to_confirm" ? eq(schema.bookings.status, "requested") : undefined,
  ].filter(Boolean);
  const where = and(...conds);
  const order = view === "upcoming" || view === "to_confirm" ? asc(schema.bookings.scheduledStartAt) : desc(schema.bookings.scheduledStartAt);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: schema.bookings.id,
        reference: schema.bookings.reference,
        title: schema.bookings.title,
        status: schema.bookings.status,
        scheduledStartAt: schema.bookings.scheduledStartAt,
        agreedTotalMinor: schema.bookings.agreedTotalMinor,
        currency: schema.bookings.currency,
        paymentStatus: schema.bookings.paymentStatus,
        pricingModel: schema.bookings.pricingModel,
        techName: schema.technicianProfiles.publicName,
        techAvatar: schema.technicianProfiles.avatarFileId,
        clientName: schema.profiles.displayName,
        communeFr: schema.communes.nameFr,
        communeAr: schema.communes.nameAr,
        holdExpiresAt: schema.bookings.holdExpiresAt,
      })
      .from(schema.bookings)
      .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.bookings.clientId))
      .innerJoin(schema.communes, eq(schema.communes.id, schema.bookings.communeId))
      .where(where)
      .orderBy(order)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.bookings).where(where),
  ]);
  return { rows, total, page, pageSize };
}

/* -------------------------- Scheduled jobs --------------------------- */

/** Releases fixed-price holds that were not confirmed in time. */
export async function expireBookingHolds(now = new Date()) {
  const due = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.status, "requested"), lte(schema.bookings.holdExpiresAt, now)))
    .limit(200);
  let n = 0;
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const { booking, technician } = await lockBooking(tx, id);
      if (booking.status !== "requested" || !booking.holdExpiresAt || booking.holdExpiresAt > now) return;
      assertBookingTransition("requested", "expired", "system");
      await recordTransition(tx, booking, "expired", null, "hold_expired", { holdExpiresAt: null });
      await closeRequestWithBooking(tx, booking, "expired");
      for (const tgt of ["client", "technician"] as const) await notifyParty(tx, booking, technician.userId, tgt, "booking_expired");
      n++;
    });
  }
  return n;
}

/** Completes jobs whose completion was requested and not contested within the review period. */
export async function autoCompleteBookings(now = new Date()) {
  const due = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.status, "awaiting_completion_confirmation"), lte(schema.bookings.autoCompleteAt, now)))
    .limit(200);
  let n = 0;
  for (const { id } of due) {
    await db.transaction(async (tx) => {
      const { booking, technician } = await lockBooking(tx, id);
      if (booking.status !== "awaiting_completion_confirmation" || !booking.autoCompleteAt || booking.autoCompleteAt > now) return;
      await recordTransition(tx, booking, "completed", null, "auto_completed_after_review_period", { completedAt: now, autoCompleteAt: null });
      for (const tgt of ["client", "technician"] as const) await notifyParty(tx, booking, technician.userId, tgt, "job_completed");
      n++;
    });
  }
  return n;
}

/** Sends a reminder ~24h before confirmed appointments (deduplicated). */
export async function sendAppointmentReminders(now = new Date()) {
  const rows = await db
    .select({ booking: schema.bookings, techUserId: schema.technicianProfiles.userId })
    .from(schema.bookings)
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
    .where(
      and(
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.scheduledStartAt, now),
        lt(schema.bookings.scheduledStartAt, addHours(now, 24)),
      ),
    )
    .limit(500);
  let n = 0;
  for (const r of rows) {
    for (const userId of [r.booking.clientId, r.techUserId]) {
      n += await notify({
        userId,
        type: "appointment_reminder",
        params: { ref: r.booking.reference },
        localized: (l) => ({ date: formatDateTime(r.booking.scheduledStartAt, l) }),
        link: userId === r.booking.clientId ? `/client/reservations/${r.booking.id}` : `/technicien/reservations/${r.booking.id}`,
        dedupeKey: `reminder:${r.booking.id}:${r.booking.scheduledStartAt.toISOString()}`,
      });
    }
  }
  return n;
}

export async function expireRequestsAndQuotes(now = new Date()) {
  const quotes = await db
    .update(schema.quotes)
    .set({ status: "expired" })
    .where(and(eq(schema.quotes.status, "sent"), lte(schema.quotes.expiresAt, now)))
    .returning({ requestId: schema.quotes.requestId });
  // Requests whose last live quote expired go back to awaiting_quote
  for (const requestId of Array.from(new Set(quotes.map((q) => q.requestId)))) {
    await db.execute(sql`UPDATE service_requests SET status = 'awaiting_quote'
      WHERE id = ${requestId} AND status = 'quote_received'
      AND NOT EXISTS (SELECT 1 FROM quotes WHERE request_id = ${requestId} AND status = 'sent')`);
  }
  const expired = await db
    .update(schema.serviceRequests)
    .set({ status: "expired" })
    .where(and(inArray(schema.serviceRequests.status, ["awaiting_quote", "quote_received"]), lte(schema.serviceRequests.expiresAt, now)))
    .returning({ id: schema.serviceRequests.id, clientId: schema.serviceRequests.clientId, title: schema.serviceRequests.title });
  for (const r of expired) {
    await db.update(schema.quotes).set({ status: "expired" }).where(and(eq(schema.quotes.requestId, r.id), eq(schema.quotes.status, "sent")));
    await notify({ userId: r.clientId, type: "request_expired", params: { title: r.title }, link: `/client/demandes/${r.id}`, dedupeKey: `reqexp:${r.id}` });
  }
  return { quotes: quotes.length, requests: expired.length };
}

