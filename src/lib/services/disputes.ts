import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { AppError, pgCode } from "@/lib/errors";
import { makeReference } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { hasPermission } from "@/lib/auth/permissions";
import { attachFiles } from "@/lib/storage";
import { notify, scheduleDispatch } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import {
  assertBookingTransition,
  assertDisputeTransition,
  canOpenDispute,
  type BookingStatus,
  type DisputeStatus,
} from "@/lib/domain/state-machines";
import { lockBooking } from "./bookings";
import { staffRecipients } from "./technicians";
import type { Actor } from "./types";

export const DISPUTE_CATEGORIES = ["quality", "no_show", "price", "damage", "behavior", "other"] as const;

export const openDisputeSchema = z.object({
  bookingId: z.string().uuid(),
  category: z.enum(DISPUTE_CATEGORIES),
  description: z.string().trim().min(20).max(3000),
  evidenceIds: z.array(z.string().uuid()).max(5).optional().default([]),
});

export async function openDispute(actor: Actor, input: z.infer<typeof openDisputeSchema>) {
  const settings = await getSettings();
  try {
    const result = await db.transaction(async (tx) => {
      const { booking, technician } = await lockBooking(tx, input.bookingId);
      const side = booking.clientId === actor.id ? "client" : technician.userId === actor.id ? "technician" : null;
      if (!side) throw new AppError("not_found", 404);
      const from = booking.status as BookingStatus;
      if (!canOpenDispute({ bookingStatus: from, completedAt: booking.completedAt, now: new Date(), windowDays: settings.dispute_window_days })) {
        throw new AppError("dispute_not_allowed", 409);
      }
      assertBookingTransition(from, "disputed", side);
      const [d] = await tx
        .insert(schema.disputes)
        .values({
          reference: makeReference("KL"),
          bookingId: booking.id,
          openedBy: actor.id,
          previousBookingStatus: from,
          category: input.category,
          description: input.description,
          priority: input.category === "damage" || input.category === "behavior" ? "high" : "normal",
        })
        .returning();
      if (input.evidenceIds.length) {
        await attachFiles(tx, actor.id, input.evidenceIds, "dispute-evidence", "dispute", d!.id);
        await tx.insert(schema.disputeEvidence).values(input.evidenceIds.map((fileId) => ({ disputeId: d!.id, uploadedBy: actor.id, fileId })));
      }
      await tx.update(schema.bookings).set({ status: "disputed", version: booking.version + 1, autoCompleteAt: null }).where(eq(schema.bookings.id, booking.id));
      await tx.insert(schema.bookingStatusHistory).values({
        bookingId: booking.id,
        previousStatus: from,
        newStatus: "disputed",
        actorId: actor.id,
        reason: input.category,
        metadata: { disputeId: d!.id },
      });
      const other = side === "client" ? technician.userId : booking.clientId;
      const otherLink = side === "client" ? `/technicien/reservations/${booking.id}` : `/client/reservations/${booking.id}`;
      await notify({ userId: other, type: "dispute_opened", params: { ref: booking.reference }, link: otherLink }, tx);
      for (const uid of await staffRecipients(tx, ["support_agent", "administrator", "super_administrator"])) {
        await notify({ userId: uid, type: "dispute_opened", params: { ref: booking.reference }, link: `/admin/litiges/${d!.id}` }, tx);
      }
      await writeAudit({ actorId: actor.id, action: "dispute.opened", entityType: "dispute", entityId: d!.id, meta: { bookingId: booking.id } }, tx);
      return { id: d!.id, reference: d!.reference };
    });
    await scheduleDispatch();
    return result;
  } catch (err) {
    if (pgCode(err) === "23505") throw new AppError("dispute_exists", 409);
    throw err;
  }
}

export async function getDisputeForUser(actor: Actor, disputeId: string) {
  const [row] = await db
    .select({
      dispute: schema.disputes,
      booking: schema.bookings,
      techUserId: schema.technicianProfiles.userId,
      techName: schema.technicianProfiles.publicName,
      clientName: schema.profiles.displayName,
    })
    .from(schema.disputes)
    .innerJoin(schema.bookings, eq(schema.bookings.id, schema.disputes.bookingId))
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.bookings.clientId))
    .where(eq(schema.disputes.id, disputeId));
  if (!row) return null;
  const isStaff = hasPermission(actor.roles, "disputes.handle");
  const isParty = row.booking.clientId === actor.id || row.techUserId === actor.id;
  if (!isStaff && !isParty) return null;
  const [messages, evidence] = await Promise.all([
    db
      .select({
        id: schema.disputeMessages.id,
        body: schema.disputeMessages.body,
        isInternal: schema.disputeMessages.isInternal,
        createdAt: schema.disputeMessages.createdAt,
        authorId: schema.disputeMessages.authorId,
        authorName: schema.profiles.displayName,
      })
      .from(schema.disputeMessages)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.disputeMessages.authorId))
      .where(and(eq(schema.disputeMessages.disputeId, disputeId), isStaff ? undefined : eq(schema.disputeMessages.isInternal, false)))
      .orderBy(asc(schema.disputeMessages.createdAt)),
    db.select().from(schema.disputeEvidence).where(eq(schema.disputeEvidence.disputeId, disputeId)),
  ]);
  return { ...row, messages, evidence, isStaff, isParty };
}

export async function addDisputeMessage(actor: Actor, disputeId: string, body: string, isInternal: boolean, evidenceIds: string[] = []) {
  const d = await getDisputeForUser(actor, disputeId);
  if (!d) throw new AppError("not_found", 404);
  if (isInternal && !d.isStaff) throw new AppError("forbidden", 403);
  if (["resolved", "closed"].includes(d.dispute.status) && !d.isStaff) throw new AppError("invalid_transition", 409);
  if (!body.trim() && !evidenceIds.length) throw new AppError("validation", 400);
  await db.transaction(async (tx) => {
    if (body.trim()) {
      await tx.insert(schema.disputeMessages).values({ disputeId, authorId: actor.id, body: body.trim().slice(0, 3000), isInternal });
    }
    if (evidenceIds.length) {
      await attachFiles(tx, actor.id, evidenceIds, "dispute-evidence", "dispute", disputeId);
      await tx.insert(schema.disputeEvidence).values(evidenceIds.map((fileId) => ({ disputeId, uploadedBy: actor.id, fileId })));
    }
    // A party answering an information request moves the case back under review
    if (!d.isStaff && d.dispute.status === "awaiting_information") {
      await tx.update(schema.disputes).set({ status: "under_review" }).where(eq(schema.disputes.id, disputeId));
    }
    if (!isInternal) {
      const recipients = d.isStaff && !d.isParty ? [d.booking.clientId, d.techUserId] : d.dispute.assignedTo ? [d.dispute.assignedTo] : [];
      for (const uid of recipients.filter((u) => u !== actor.id)) {
        const linkFor = uid === d.booking.clientId ? `/client/reservations/${d.booking.id}` : uid === d.techUserId ? `/technicien/reservations/${d.booking.id}` : `/admin/litiges/${disputeId}`;
        await notify({ userId: uid, type: "dispute_update", params: { ref: d.dispute.reference }, link: linkFor }, tx);
      }
    }
  });
}

export async function assignDispute(staff: Actor, disputeId: string, assigneeId: string | null) {
  if (!hasPermission(staff.roles, "disputes.handle")) throw new AppError("forbidden", 403);
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(schema.disputes).where(eq(schema.disputes.id, disputeId)).for("update");
    if (!d) throw new AppError("not_found", 404);
    await tx
      .update(schema.disputes)
      .set({ assignedTo: assigneeId, status: d.status === "open" ? "under_review" : d.status })
      .where(eq(schema.disputes.id, d.id));
    await writeAudit({ actorId: staff.id, action: "dispute.assigned", entityType: "dispute", entityId: d.id, meta: { assigneeId } }, tx);
  });
}

export async function requestDisputeInfo(staff: Actor, disputeId: string, message: string) {
  if (!hasPermission(staff.roles, "disputes.handle")) throw new AppError("forbidden", 403);
  if (!message.trim()) throw new AppError("validation", 400);
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(schema.disputes).where(eq(schema.disputes.id, disputeId)).for("update");
    if (!d) throw new AppError("not_found", 404);
    assertDisputeTransition(d.status as DisputeStatus, "awaiting_information", "staff");
    await tx.update(schema.disputes).set({ status: "awaiting_information" }).where(eq(schema.disputes.id, d.id));
    await tx.insert(schema.disputeMessages).values({ disputeId, authorId: staff.id, body: message.trim(), isInternal: false });
    const [b] = await tx
      .select({ clientId: schema.bookings.clientId, bookingId: schema.bookings.id, techUserId: schema.technicianProfiles.userId })
      .from(schema.bookings)
      .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
      .where(eq(schema.bookings.id, d.bookingId));
    await notify({ userId: b!.clientId, type: "dispute_update", params: { ref: d.reference }, link: `/client/reservations/${b!.bookingId}` }, tx);
    await notify({ userId: b!.techUserId, type: "dispute_update", params: { ref: d.reference }, link: `/technicien/reservations/${b!.bookingId}` }, tx);
    await writeAudit({ actorId: staff.id, action: "dispute.info_requested", entityType: "dispute", entityId: d.id }, tx);
  });
  await scheduleDispatch();
}

export const resolveSchema = z.object({
  disputeId: z.string().uuid(),
  outcome: z.enum(["completed", "cancelled"]),
  resolution: z.string().trim().min(10).max(3000),
});

/** Records an authorized, explained decision and applies it to the booking. */
export async function resolveDispute(staff: Actor, input: z.infer<typeof resolveSchema>) {
  if (!hasPermission(staff.roles, "disputes.handle")) throw new AppError("forbidden", 403);
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(schema.disputes).where(eq(schema.disputes.id, input.disputeId)).for("update");
    if (!d) throw new AppError("not_found", 404);
    assertDisputeTransition(d.status as DisputeStatus, "resolved", "staff");
    const { booking, technician } = await lockBooking(tx, d.bookingId);
    if (booking.clientId === staff.id || technician.userId === staff.id) throw new AppError("self_action");
    assertBookingTransition(booking.status as BookingStatus, input.outcome, "staff");
    const now = new Date();
    await tx
      .update(schema.bookings)
      .set({
        status: input.outcome,
        version: booking.version + 1,
        ...(input.outcome === "completed" ? { completedAt: booking.completedAt ?? now } : { cancellationReason: "dispute_resolution", cancelledBy: staff.id }),
      })
      .where(eq(schema.bookings.id, booking.id));
    await tx.insert(schema.bookingStatusHistory).values({
      bookingId: booking.id,
      previousStatus: booking.status,
      newStatus: input.outcome,
      actorId: staff.id,
      reason: "dispute_resolution",
      metadata: { disputeId: d.id },
    });
    await tx
      .update(schema.disputes)
      .set({ status: "resolved", outcome: input.outcome, resolution: input.resolution, resolvedBy: staff.id, resolvedAt: now })
      .where(eq(schema.disputes.id, d.id));
    await writeAudit(
      { actorId: staff.id, action: "dispute.resolved", entityType: "dispute", entityId: d.id, reason: input.resolution, meta: { outcome: input.outcome, bookingId: booking.id } },
      tx,
    );
    await notify({ userId: booking.clientId, type: "dispute_resolved", params: { ref: d.reference }, link: `/client/reservations/${booking.id}` }, tx);
    await notify({ userId: technician.userId, type: "dispute_resolved", params: { ref: d.reference }, link: `/technicien/reservations/${booking.id}` }, tx);
  });
  await scheduleDispatch();
}

export async function listDisputes(statuses: DisputeStatus[]) {
  return db
    .select({
      id: schema.disputes.id,
      reference: schema.disputes.reference,
      status: schema.disputes.status,
      priority: schema.disputes.priority,
      category: schema.disputes.category,
      createdAt: schema.disputes.createdAt,
      assignedTo: schema.disputes.assignedTo,
      bookingRef: schema.bookings.reference,
      bookingTitle: schema.bookings.title,
    })
    .from(schema.disputes)
    .innerJoin(schema.bookings, eq(schema.bookings.id, schema.disputes.bookingId))
    .where(statuses.length ? inArray(schema.disputes.status, statuses) : undefined)
    .orderBy(asc(schema.disputes.createdAt))
    .limit(200);
}
