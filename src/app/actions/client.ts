"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { runAction, parseInput, type ActionState } from "@/lib/action";
import { actionRole, actionUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import * as requests from "@/lib/services/requests";
import * as quotes from "@/lib/services/quotes";
import * as bookings from "@/lib/services/bookings";
import * as reviews from "@/lib/services/reviews";
import * as disputes from "@/lib/services/disputes";
import * as support from "@/lib/services/support";
import * as messaging from "@/lib/services/messaging";

/* ------------------------------ Addresses ---------------------------- */

const addressSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  label: z.string().trim().min(2).max(40),
  wilaya: z.string().regex(/^\d{2}$/, "validation.required"),
  commune: z.coerce.number({ message: "validation.required" }).int().positive("validation.required"),
  neighborhood: z.string().trim().max(80).optional().default(""),
  addressLine: z.string().trim().min(5).max(200),
  accessNotes: z.string().trim().max(300).optional().default(""),
  latitude: z.string().optional().default(""),
  longitude: z.string().optional().default(""),
  isDefault: z.string().optional(),
});

export async function saveAddressAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    const input = parseInput(addressSchema, fd);
    const [commune] = await db.select().from(schema.communes).where(eq(schema.communes.id, input.commune));
    if (!commune || commune.wilayaCode !== input.wilaya) throw new AppError("validation");
    const lat = /^-?\d{1,2}\.\d{1,6}$/.test(input.latitude) ? input.latitude : null;
    const lng = /^-?\d{1,3}\.\d{1,6}$/.test(input.longitude) ? input.longitude : null;
    const values = {
      label: input.label,
      wilayaCode: input.wilaya,
      communeId: input.commune,
      neighborhood: input.neighborhood || null,
      addressLine: input.addressLine,
      accessNotes: input.accessNotes || null,
      latitude: lat,
      longitude: lng,
      isDefault: input.isDefault === "on",
    };
    let id = input.id || "";
    await db.transaction(async (tx) => {
      const existing = await tx
        .select({ id: schema.clientAddresses.id })
        .from(schema.clientAddresses)
        .where(and(eq(schema.clientAddresses.clientId, user.id), isNull(schema.clientAddresses.archivedAt)));
      if (values.isDefault || existing.length === 0) {
        values.isDefault = true;
        await tx.update(schema.clientAddresses).set({ isDefault: false }).where(eq(schema.clientAddresses.clientId, user.id));
      }
      if (id) {
        const res = await tx
          .update(schema.clientAddresses)
          .set(values)
          .where(and(eq(schema.clientAddresses.id, id), eq(schema.clientAddresses.clientId, user.id)))
          .returning({ id: schema.clientAddresses.id });
        if (!res.length) throw new AppError("not_found", 404);
      } else {
        const [row] = await tx.insert(schema.clientAddresses).values({ ...values, clientId: user.id }).returning({ id: schema.clientAddresses.id });
        id = row!.id;
      }
    });
    return { ok: true, message: "common.saved", data: { id } };
  });
}

export async function archiveAddressAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    const [inUse] = await db.execute(
      sql`SELECT 1 FROM bookings WHERE address_id = ${id} AND status IN ('requested','confirmed','technician_en_route','in_progress','awaiting_completion_confirmation','disputed') LIMIT 1`,
    );
    if (inUse) throw new AppError("address_in_use");
    await db
      .update(schema.clientAddresses)
      .set({ archivedAt: new Date(), isDefault: false })
      .where(and(eq(schema.clientAddresses.id, id), eq(schema.clientAddresses.clientId, user.id)));
  });
}

/* ------------------------------ Requests ----------------------------- */

export async function createRequestAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  let target = "";
  const res = await runAction(async () => {
    const user = await actionRole("client");
    await rateLimit("create-request", user.id, 10, 3600);
    const input = parseInput(requests.createRequestSchema, fd);
    const r = await requests.createServiceRequest(user, input);
    target = `/client/demandes/${r.id}?cree=1`;
  });
  if (res.ok && target) redirect(target);
  return res;
}

export async function cancelRequestAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("client");
    const { requestId, reason } = parseInput(z.object({ requestId: z.string().uuid(), reason: z.string().trim().max(500).optional().default("") }), fd);
    await requests.cancelServiceRequest(user, requestId, reason);
  }, "request.cancelled");
}

/* ------------------------------- Quotes ------------------------------ */

export async function acceptQuoteAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  let target = "";
  const res = await runAction(async () => {
    const user = await actionRole("client");
    const { quoteId, idempotencyKey } = parseInput(z.object({ quoteId: z.string().uuid(), idempotencyKey: z.string().min(8).max(64) }), fd);
    const b = await quotes.acceptQuote(user, quoteId, idempotencyKey);
    target = `/client/reservations/${b.id}?confirmee=1`;
  }, "quote.accepted");
  if (res.ok && target) redirect(target);
  return res;
}

export async function rejectQuoteAction(quoteId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("client");
    await quotes.rejectQuote(user, quoteId);
  }, "quote.rejected");
}

export async function askQuestionAction(requestId: string, technicianId: string): Promise<ActionState<{ conversationId: string }>> {
  let target = "";
  const res = await runAction(async () => {
    const user = await actionRole("client");
    const conversationId = await messaging.openConversationForRequest(user, requestId, technicianId);
    target = `/client/messages/${conversationId}`;
  });
  if (res.ok && target) redirect(target);
  return res as ActionState<{ conversationId: string }>;
}

/* ------------------------------ Bookings ----------------------------- */

export async function createFixedBookingAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  let target = "";
  const res = await runAction(async () => {
    const user = await actionRole("client");
    await rateLimit("fixed-booking", user.id, 10, 3600);
    const input = parseInput(bookings.fixedBookingSchema, fd);
    const b = await bookings.createFixedPriceBooking(user, input);
    target = `/client/reservations/${b.id}?envoyee=1`;
  });
  if (res.ok && target) redirect(target);
  return res;
}

const bookingActionSchema = z.object({
  bookingId: z.string().uuid(),
  action: z.enum(["confirm", "decline", "en_route", "start", "request_completion", "confirm_completion", "cancel"]),
  reason: z.string().trim().max(500).optional().default(""),
});

/** Shared by clients and technicians: the service decides what each side may do. */
export async function bookingAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    const input = parseInput(bookingActionSchema, fd);
    await bookings.performBookingAction(user, input.bookingId, input.action, input.reason);
  }, "booking.statusUpdated");
}

export async function proposeRescheduleAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await bookings.proposeReschedule(user, parseInput(bookings.rescheduleSchema, fd));
  }, "booking.rescheduleSent");
}

export async function respondRescheduleAction(changeId: string, accept: boolean): Promise<ActionState> {
  return runAction(
    async () => {
      const user = await actionUser();
      await bookings.respondReschedule(user, changeId, accept);
    },
    accept ? "booking.rescheduleAccepted" : "booking.rescheduleRejected",
  );
}

export async function reviewAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("client");
    await rateLimit("review", user.id, 20, 3600);
    await reviews.createReview(user, parseInput(reviews.reviewSchema, fd));
  }, "booking.reviewDone");
}

export async function openDisputeAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await rateLimit("dispute", user.id, 5, 3600);
    await disputes.openDispute(user, parseInput(disputes.openDisputeSchema, fd));
  }, "dispute.opened");
}

export async function disputeMessageAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    const input = parseInput(
      z.object({
        disputeId: z.string().uuid(),
        body: z.string().trim().max(3000).optional().default(""),
        isInternal: z.string().optional(),
        evidenceIds: z.array(z.string().uuid()).max(5).optional().default([]),
      }),
      fd,
    );
    await disputes.addDisputeMessage(user, input.disputeId, input.body, input.isInternal === "on", input.evidenceIds);
  }, "support.replySent");
}

/* ----------------------------- Favorites ----------------------------- */

export async function toggleSavedAction(technicianId: string): Promise<ActionState<{ saved: boolean }>> {
  return runAction(async () => {
    const user = await actionUser();
    const saved = await support.toggleSavedTechnician(user, technicianId);
    return { ok: true, message: saved ? "profile.saved" : "common.saved", data: { saved } };
  });
}

/* ------------------------------ Reports ------------------------------ */

export async function reportAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await rateLimit("report", user.id, 10, 3600);
    await support.createReport(user, parseInput(support.reportSchema, fd));
  }, "report.sent");
}
