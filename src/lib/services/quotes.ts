import "server-only";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type Tx } from "@/db";
import { AppError } from "@/lib/errors";
import { makeReference } from "@/lib/crypto";
import { addHours, addMinutes, algeriaLocalToUtc } from "@/lib/time";
import { computeLineTotal, computeQuoteTotal, daToMinor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { formatMoney, formatDateTime } from "@/lib/i18n/format";
import { notify, scheduleDispatch } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { assertQuoteTransition, assertRequestTransition, requestAcceptsQuotes, type QuoteStatus, type RequestStatus } from "@/lib/domain/state-machines";
import { lockAndCheckSlot, mapSlotConflict } from "./scheduling";
import { requireApprovedTechnician } from "./technicians";
import { technicianCanAccessRequest } from "./requests";
import { ensureConversation } from "./messaging";
import type { Actor } from "./types";

const da = z
  .string()
  .trim()
  .optional()
  .default("0")
  .transform((v) => v.replace(/[\s ]/g, "") || "0")
  .refine((v) => /^\d{1,7}$/.test(v), "validation.amount")
  .transform((v) => Number(v));

export const quoteSchema = z.object({
  requestId: z.string().uuid(),
  pricingModel: z.enum(["fixed", "starting_at", "hourly", "estimate"]).default("fixed"),
  laborDa: da,
  materialsDa: da,
  travelDa: da,
  otherDa: da,
  otherNote: z.string().trim().max(300).optional().default(""),
  taxDa: da,
  discountDa: da,
  durationMinutes: z.coerce.number().int().min(15).max(720),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proposedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  validityHours: z.coerce.number().int().min(2).max(24 * 14).optional(),
  terms: z.string().trim().max(2000).optional().default(""),
  message: z.string().trim().max(1000).optional().default(""),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(2).max(120),
        quantity: z.coerce.number().int().min(1).max(999),
        unitDa: z.coerce.number().int().min(0).max(9_999_999),
      }),
    )
    .max(20)
    .optional()
    .default([]),
});

/**
 * Creates a quote or a new revision. Totals are computed on the server from
 * the components; when item lines are supplied they define the materials amount.
 */
export async function sendQuote(actor: Actor, input: z.infer<typeof quoteSchema>) {
  const settings = await getSettings();
  const result = await db
    .transaction(async (tx) => {
      const tp = await requireApprovedTechnician(actor, tx);
      const [req] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, input.requestId)).for("update");
      if (!req) throw new AppError("not_found", 404);
      if (!(await technicianCanAccessRequest(tx, tp.id, req.id))) throw new AppError("not_eligible", 403);
      if (!requestAcceptsQuotes(req.status as RequestStatus) || req.expiresAt <= new Date()) throw new AppError("request_closed", 409);

      const start = algeriaLocalToUtc(input.proposedDate, input.proposedTime);
      if (start.getTime() < Date.now() + 30 * 60_000) throw new AppError("validation", 400);
      const end = addMinutes(start, input.durationMinutes);
      await lockAndCheckSlot(tx, tp.id, start, end);

      const items = input.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPriceMinor: daToMinor(i.unitDa),
        lineTotalMinor: computeLineTotal(i.quantity, daToMinor(i.unitDa)),
      }));
      const materialsMinor = items.length ? items.reduce((s, i) => s + i.lineTotalMinor, 0) : daToMinor(input.materialsDa);
      const amounts = {
        laborMinor: daToMinor(input.laborDa),
        materialsMinor,
        travelMinor: daToMinor(input.travelDa),
        otherChargesMinor: daToMinor(input.otherDa),
        taxMinor: daToMinor(input.taxDa),
        discountMinor: daToMinor(input.discountDa),
      };
      let totalMinor: number;
      try {
        totalMinor = computeQuoteTotal(amounts);
      } catch {
        throw new AppError("validation", 400);
      }
      if (totalMinor <= 0) throw new AppError("validation", 400);

      // Supersede the previous live revision from this technician
      const [prev] = await tx
        .select()
        .from(schema.quotes)
        .where(and(eq(schema.quotes.requestId, req.id), eq(schema.quotes.technicianId, tp.id)))
        .orderBy(desc(schema.quotes.revisionNumber))
        .limit(1);
      if (prev?.status === "accepted") throw new AppError("quote_not_available", 409);
      if (prev?.status === "sent") {
        assertQuoteTransition("sent", "superseded", "technician");
        await tx.update(schema.quotes).set({ status: "superseded" }).where(eq(schema.quotes.id, prev.id));
      }

      const validity = input.validityHours ?? settings.quote_default_validity_hours;
      const expiresAt = new Date(Math.min(addHours(new Date(), validity).getTime(), req.expiresAt.getTime(), start.getTime()));

      const [quote] = await tx
        .insert(schema.quotes)
        .values({
          requestId: req.id,
          technicianId: tp.id,
          revisionNumber: (prev?.revisionNumber ?? 0) + 1,
          pricingModel: input.pricingModel,
          ...amounts,
          otherChargesNote: input.otherNote || null,
          totalMinor,
          currency: "DZD",
          durationMinutes: input.durationMinutes,
          proposedStartAt: start,
          expiresAt,
          status: "sent",
          terms: input.terms || null,
          message: input.message || null,
        })
        .returning();
      if (items.length) await tx.insert(schema.quoteItems).values(items.map((i) => ({ ...i, quoteId: quote!.id })));

      if (req.status === "awaiting_quote") {
        assertRequestTransition("awaiting_quote", "quote_received", "system");
        await tx.update(schema.serviceRequests).set({ status: "quote_received" }).where(eq(schema.serviceRequests.id, req.id));
      }

      const conversationId = await ensureConversation(tx, { requestId: req.id, clientId: req.clientId, technicianId: tp.id, technicianUserId: tp.userId });
      if (input.message) {
        await tx.insert(schema.messages).values({ conversationId, senderId: actor.id, body: input.message });
        await tx.update(schema.conversations).set({ lastMessageAt: new Date() }).where(eq(schema.conversations.id, conversationId));
      }

      await notify(
        {
          userId: req.clientId,
          type: prev ? "quote_revised" : "quote_received",
          params: { name: tp.publicName, title: req.title },
          localized: (l) => ({ total: formatMoney(totalMinor, l) }),
          link: `/client/demandes/${req.id}`,
          dedupeKey: `quote:${quote!.id}`,
        },
        tx,
      );
      return { quoteId: quote!.id };
    })
    .catch(mapSlotConflict);
  await scheduleDispatch();
  return result;
}

export async function withdrawQuote(actor: Actor, quoteId: string) {
  await db.transaction(async (tx) => {
    const tp = await requireApprovedTechnician(actor, tx);
    const [q] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).for("update");
    if (!q || q.technicianId !== tp.id) throw new AppError("not_found", 404);
    assertQuoteTransition(q.status as QuoteStatus, "withdrawn", "technician");
    await tx.update(schema.quotes).set({ status: "withdrawn" }).where(eq(schema.quotes.id, q.id));
    await reopenRequestIfNoQuotes(tx, q.requestId);
  });
}

async function reopenRequestIfNoQuotes(tx: Tx, requestId: string) {
  const [req] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId)).for("update");
  if (req?.status !== "quote_received") return;
  const [live] = await tx
    .select({ id: schema.quotes.id })
    .from(schema.quotes)
    .where(and(eq(schema.quotes.requestId, requestId), eq(schema.quotes.status, "sent")))
    .limit(1);
  if (!live) await tx.update(schema.serviceRequests).set({ status: "awaiting_quote" }).where(eq(schema.serviceRequests.id, requestId));
}

export async function rejectQuote(actor: Actor, quoteId: string) {
  await db.transaction(async (tx) => {
    const [q] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).for("update");
    if (!q) throw new AppError("not_found", 404);
    const [req] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, q.requestId));
    if (!req || req.clientId !== actor.id) throw new AppError("not_found", 404);
    assertQuoteTransition(q.status as QuoteStatus, "rejected", "client");
    await tx.update(schema.quotes).set({ status: "rejected" }).where(eq(schema.quotes.id, q.id));
    await reopenRequestIfNoQuotes(tx, q.requestId);
    const [tp] = await tx.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, q.technicianId));
    await notify({ userId: tp!.userId, type: "quote_rejected", params: { title: req.title }, link: "/technicien/devis" }, tx);
  });
}

/**
 * Accepting a quote atomically: validates the quote and request, re-checks the
 * technician's calendar under a row lock, creates the confirmed booking (the
 * exclusion constraint prevents double booking), rejects competing quotes.
 */
export async function acceptQuote(actor: Actor, quoteId: string, idempotencyKey?: string) {
  const result = await db
    .transaction(async (tx) => {
      const [q0] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId));
      if (!q0) throw new AppError("not_found", 404);
      const [req] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, q0.requestId)).for("update");
      if (!req || req.clientId !== actor.id) throw new AppError("not_found", 404);

      if (idempotencyKey) {
        const [dup] = await tx
          .select({ id: schema.bookings.id, reference: schema.bookings.reference })
          .from(schema.bookings)
          .where(and(eq(schema.bookings.clientId, actor.id), eq(schema.bookings.idempotencyKey, idempotencyKey)));
        if (dup) return dup;
      }
      if (req.status === "booked") throw new AppError("request_already_booked", 409);
      if (!requestAcceptsQuotes(req.status as RequestStatus)) throw new AppError("request_closed", 409);

      const [q] = await tx.select().from(schema.quotes).where(eq(schema.quotes.id, quoteId)).for("update");
      if (q!.status === "sent" && q!.expiresAt <= new Date()) {
        await tx.update(schema.quotes).set({ status: "expired" }).where(eq(schema.quotes.id, q!.id));
        throw new AppError("quote_expired", 409);
      }
      assertQuoteTransition(q!.status as QuoteStatus, "accepted", "client");

      const start = q!.proposedStartAt;
      const end = addMinutes(start, q!.durationMinutes);
      if (start <= new Date()) throw new AppError("quote_expired", 409);
      const tp = await lockAndCheckSlot(tx, q!.technicianId, start, end);

      const [booking] = await tx
        .insert(schema.bookings)
        .values({
          reference: makeReference("KB"),
          requestId: req.id,
          clientId: req.clientId,
          technicianId: tp.id,
          serviceId: req.serviceId,
          categoryId: req.categoryId,
          acceptedQuoteId: q!.id,
          addressId: req.addressId,
          wilayaCode: req.wilayaCode,
          communeId: req.communeId,
          title: req.title,
          scheduledStartAt: start,
          scheduledEndAt: end,
          status: "confirmed",
          pricingModel: q!.pricingModel,
          currency: q!.currency,
          agreedTotalMinor: q!.totalMinor,
          paymentMethod: "cash",
          paymentStatus: "unpaid",
          idempotencyKey: idempotencyKey ?? null,
        })
        .returning();

      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking!.id,
        previousStatus: null,
        newStatus: "confirmed",
        actorId: actor.id,
        reason: "quote_accepted",
        metadata: { quoteId: q!.id, revision: q!.revisionNumber },
      });
      await tx.update(schema.quotes).set({ status: "accepted" }).where(eq(schema.quotes.id, q!.id));
      const others = await tx
        .update(schema.quotes)
        .set({ status: "rejected" })
        .where(and(eq(schema.quotes.requestId, req.id), eq(schema.quotes.status, "sent"), ne(schema.quotes.id, q!.id)))
        .returning({ technicianId: schema.quotes.technicianId });
      assertRequestTransition(req.status as RequestStatus, "booked", "system");
      await tx.update(schema.serviceRequests).set({ status: "booked" }).where(eq(schema.serviceRequests.id, req.id));
      await tx
        .update(schema.conversations)
        .set({ bookingId: booking!.id })
        .where(and(eq(schema.conversations.requestId, req.id), eq(schema.conversations.technicianId, tp.id)));

      await notify(
        { userId: tp.userId, type: "quote_accepted", params: { title: req.title, ref: booking!.reference }, link: `/technicien/reservations/${booking!.id}` },
        tx,
      );
      await notify(
        { userId: req.clientId, type: "booking_confirmed", params: { ref: booking!.reference }, localized: (l) => ({ date: formatDateTime(start, l) }), link: `/client/reservations/${booking!.id}` },
        tx,
      );
      for (const o of others) {
        const [otp] = await tx.select({ userId: schema.technicianProfiles.userId }).from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, o.technicianId));
        if (otp) await notify({ userId: otp.userId, type: "quote_rejected", params: { title: req.title }, link: "/technicien/devis" }, tx);
      }
      await writeAudit({ actorId: actor.id, action: "booking.created_from_quote", entityType: "booking", entityId: booking!.id, meta: { quoteId: q!.id } }, tx);
      return { id: booking!.id, reference: booking!.reference };
    })
    .catch(mapSlotConflict);
  await scheduleDispatch();
  return result;
}

export async function listQuotesForRequest(requestId: string) {
  const rows = await db
    .select({
      quote: schema.quotes,
      techName: schema.technicianProfiles.publicName,
      techSlug: schema.technicianProfiles.slug,
      techAvatar: schema.technicianProfiles.avatarFileId,
      techRating: schema.technicianProfiles.averageRatingDerived,
      techReviews: schema.technicianProfiles.reviewCountDerived,
    })
    .from(schema.quotes)
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.quotes.technicianId))
    .where(eq(schema.quotes.requestId, requestId))
    .orderBy(desc(schema.quotes.createdAt));
  const ids = rows.map((r) => r.quote.id);
  const items = ids.length
    ? await db.select().from(schema.quoteItems).where(sql`${schema.quoteItems.quoteId} IN ${ids}`)
    : [];
  return rows.map((r) => ({ ...r, items: items.filter((i) => i.quoteId === r.quote.id) }));
}

export async function listTechnicianQuotes(technicianId: string, page = 1, pageSize = 15) {
  const where = eq(schema.quotes.technicianId, technicianId);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        quote: schema.quotes,
        requestTitle: schema.serviceRequests.title,
        requestRef: schema.serviceRequests.reference,
        requestStatus: schema.serviceRequests.status,
      })
      .from(schema.quotes)
      .innerJoin(schema.serviceRequests, eq(schema.serviceRequests.id, schema.quotes.requestId))
      .where(where)
      .orderBy(desc(schema.quotes.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.quotes).where(where),
  ]);
  return { rows, total, page, pageSize };
}
