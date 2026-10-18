import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { AppError } from "@/lib/errors";
import { makeReference } from "@/lib/crypto";
import { hasPermission } from "@/lib/auth/permissions";
import { notify, scheduleDispatch } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "./types";

/* ------------------------------ Tickets ------------------------------ */

export const ticketSchema = z.object({
  subject: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(4000),
  bookingId: z.string().uuid().optional().or(z.literal("")),
});

export async function createTicket(actor: Actor, input: z.infer<typeof ticketSchema>) {
  if (input.bookingId) {
    const [b] = await db
      .select({ clientId: schema.bookings.clientId, techUserId: schema.technicianProfiles.userId })
      .from(schema.bookings)
      .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
      .where(eq(schema.bookings.id, input.bookingId));
    if (!b || (b.clientId !== actor.id && b.techUserId !== actor.id)) throw new AppError("not_found", 404);
  }
  const [t] = await db
    .insert(schema.supportTickets)
    .values({
      reference: makeReference("KT"),
      userId: actor.id,
      bookingId: input.bookingId || null,
      subject: input.subject,
      description: input.description,
    })
    .returning();
  return t!;
}

export async function getTicketForUser(actor: Actor, ticketId: string) {
  const [t] = await db
    .select({ ticket: schema.supportTickets, userName: schema.profiles.fullName })
    .from(schema.supportTickets)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.supportTickets.userId))
    .where(eq(schema.supportTickets.id, ticketId));
  if (!t) return null;
  const isStaff = hasPermission(actor.roles, "support.handle");
  if (t.ticket.userId !== actor.id && !isStaff) return null;
  const messages = await db
    .select({
      id: schema.supportTicketMessages.id,
      body: schema.supportTicketMessages.body,
      isInternal: schema.supportTicketMessages.isInternal,
      createdAt: schema.supportTicketMessages.createdAt,
      authorId: schema.supportTicketMessages.authorId,
      authorName: schema.profiles.displayName,
    })
    .from(schema.supportTicketMessages)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.supportTicketMessages.authorId))
    .where(and(eq(schema.supportTicketMessages.ticketId, ticketId), isStaff ? undefined : eq(schema.supportTicketMessages.isInternal, false)))
    .orderBy(asc(schema.supportTicketMessages.createdAt));
  return { ...t, messages, isStaff };
}

export async function replyTicket(actor: Actor, ticketId: string, body: string, isInternal: boolean) {
  const t = await getTicketForUser(actor, ticketId);
  if (!t) throw new AppError("not_found", 404);
  if (isInternal && !t.isStaff) throw new AppError("forbidden", 403);
  if (!body.trim()) throw new AppError("validation", 400);
  if (t.ticket.status === "closed" && !t.isStaff) throw new AppError("invalid_transition", 409);
  await db.transaction(async (tx) => {
    await tx.insert(schema.supportTicketMessages).values({ ticketId, authorId: actor.id, body: body.trim().slice(0, 4000), isInternal });
    const staffReply = t.isStaff && t.ticket.userId !== actor.id;
    await tx
      .update(schema.supportTickets)
      .set({ status: staffReply ? (isInternal ? t.ticket.status : "pending") : "open", assignedTo: staffReply ? actor.id : t.ticket.assignedTo })
      .where(eq(schema.supportTickets.id, ticketId));
    if (staffReply && !isInternal) {
      await notify({ userId: t.ticket.userId, type: "ticket_update", params: { ref: t.ticket.reference }, link: `/client/support?ticket=${ticketId}` }, tx);
    }
  });
  await scheduleDispatch();
}

export async function setTicketStatus(actor: Actor, ticketId: string, status: "open" | "pending" | "resolved" | "closed") {
  const t = await getTicketForUser(actor, ticketId);
  if (!t) throw new AppError("not_found", 404);
  if (!t.isStaff && status !== "closed") throw new AppError("forbidden", 403);
  await db.update(schema.supportTickets).set({ status }).where(eq(schema.supportTickets.id, ticketId));
  if (t.isStaff) await writeAudit({ actorId: actor.id, action: `ticket.${status}`, entityType: "support_ticket", entityId: ticketId });
}

export async function listTickets(filter: { userId?: string; statuses?: string[] }) {
  return db
    .select({
      id: schema.supportTickets.id,
      reference: schema.supportTickets.reference,
      subject: schema.supportTickets.subject,
      status: schema.supportTickets.status,
      priority: schema.supportTickets.priority,
      createdAt: schema.supportTickets.createdAt,
      updatedAt: schema.supportTickets.updatedAt,
      userName: schema.profiles.fullName,
    })
    .from(schema.supportTickets)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.supportTickets.userId))
    .where(
      and(
        filter.userId ? eq(schema.supportTickets.userId, filter.userId) : undefined,
        filter.statuses?.length ? inArray(schema.supportTickets.status, filter.statuses as ("open" | "pending" | "resolved" | "closed")[]) : undefined,
      ),
    )
    .orderBy(desc(schema.supportTickets.updatedAt))
    .limit(200);
}

/* ------------------------------ Contact ------------------------------ */

export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().max(160).optional().default(""),
    phone: z.string().trim().max(20).optional().default(""),
    subject: z.string().trim().min(3).max(140),
    message: z.string().trim().min(10).max(4000),
    website: z.string().max(0).optional().default(""), // honeypot
  })
  .superRefine((v, ctx) => {
    if (!v.email && !v.phone) ctx.addIssue({ code: "custom", path: ["email"], message: "validation.emailOrPhone" });
    if (v.email && !z.email().safeParse(v.email).success) ctx.addIssue({ code: "custom", path: ["email"], message: "validation.email" });
  });

export async function createContactMessage(input: z.infer<typeof contactSchema>) {
  await db.insert(schema.contactMessages).values({
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    subject: input.subject,
    message: input.message,
  });
}

/* ------------------------------ Reports ------------------------------ */

export const REPORT_REASONS = ["fraud", "fake_profile", "inappropriate", "harassment", "safety", "spam", "other"] as const;

export const reportSchema = z.object({
  targetType: z.enum(["technician_profile", "user", "conversation", "review", "booking"]),
  targetId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  description: z.string().trim().max(2000).optional().default(""),
});

export async function createReport(actor: Actor, input: z.infer<typeof reportSchema>) {
  let reportedUserId: string | null = null;
  let bookingId: string | null = null;
  switch (input.targetType) {
    case "technician_profile": {
      const [tp] = await db.select({ userId: schema.technicianProfiles.userId }).from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, input.targetId));
      if (!tp) throw new AppError("not_found", 404);
      reportedUserId = tp.userId;
      break;
    }
    case "conversation": {
      const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, input.targetId));
      if (!c || (c.clientId !== actor.id && c.technicianUserId !== actor.id)) throw new AppError("not_found", 404);
      reportedUserId = c.clientId === actor.id ? c.technicianUserId : c.clientId;
      bookingId = c.bookingId;
      break;
    }
    case "review": {
      const [r] = await db.select().from(schema.reviews).where(eq(schema.reviews.id, input.targetId));
      if (!r) throw new AppError("not_found", 404);
      reportedUserId = r.clientId;
      bookingId = r.bookingId;
      break;
    }
    case "booking": {
      const [b] = await db
        .select({ clientId: schema.bookings.clientId, techUserId: schema.technicianProfiles.userId })
        .from(schema.bookings)
        .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
        .where(eq(schema.bookings.id, input.targetId));
      if (!b || (b.clientId !== actor.id && b.techUserId !== actor.id)) throw new AppError("not_found", 404);
      reportedUserId = b.clientId === actor.id ? b.techUserId : b.clientId;
      bookingId = input.targetId;
      break;
    }
    case "user":
      reportedUserId = input.targetId;
      break;
  }
  if (reportedUserId === actor.id) throw new AppError("self_action");
  await db.insert(schema.userReports).values({
    reporterId: actor.id,
    targetType: input.targetType,
    targetId: input.targetId,
    reportedUserId,
    bookingId,
    reason: input.reason,
    description: input.description || null,
  });
}

export async function handleReport(staff: Actor, reportId: string, status: "reviewing" | "actioned" | "dismissed", note: string) {
  await db.transaction(async (tx) => {
    const [r] = await tx
      .update(schema.userReports)
      .set({ status, resolutionNote: note || null, reviewedBy: staff.id })
      .where(eq(schema.userReports.id, reportId))
      .returning();
    if (!r) throw new AppError("not_found", 404);
    await writeAudit({ actorId: staff.id, action: `report.${status}`, entityType: "user_report", entityId: r.id, reason: note }, tx);
    if (status === "actioned" || status === "dismissed") {
      await notify({ userId: r.reporterId, type: "report_update", link: "/client/notifications" }, tx);
    }
  });
}

export async function listReports(statuses: string[]) {
  return db
    .select({
      report: schema.userReports,
      reporterName: schema.profiles.fullName,
    })
    .from(schema.userReports)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.userReports.reporterId))
    .where(statuses.length ? inArray(schema.userReports.status, statuses as ("open" | "reviewing" | "actioned" | "dismissed")[]) : undefined)
    .orderBy(desc(schema.userReports.createdAt))
    .limit(200);
}

/* ------------------------- Saved technicians ------------------------- */

export async function toggleSavedTechnician(actor: Actor, technicianId: string) {
  const [existing] = await db
    .select()
    .from(schema.savedTechnicians)
    .where(and(eq(schema.savedTechnicians.clientId, actor.id), eq(schema.savedTechnicians.technicianId, technicianId)));
  if (existing) {
    await db
      .delete(schema.savedTechnicians)
      .where(and(eq(schema.savedTechnicians.clientId, actor.id), eq(schema.savedTechnicians.technicianId, technicianId)));
    return false;
  }
  const [tp] = await db
    .select({ status: schema.technicianProfiles.verificationStatus })
    .from(schema.technicianProfiles)
    .where(eq(schema.technicianProfiles.id, technicianId));
  if (tp?.status !== "approved") throw new AppError("not_found", 404);
  await db.insert(schema.savedTechnicians).values({ clientId: actor.id, technicianId }).onConflictDoNothing();
  return true;
}

/* ---------------------------- Notifications --------------------------- */

export async function markNotificationsRead(actor: Actor, ids: string[] | "all") {
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, actor.id),
        sql`${schema.notifications.readAt} IS NULL`,
        ids === "all" ? undefined : inArray(schema.notifications.id, ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ),
    );
}

export async function unreadNotificationCount(userId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), sql`${schema.notifications.readAt} IS NULL`));
  return r?.n ?? 0;
}

export async function listNotifications(userId: string, unreadOnly: boolean, page = 1, pageSize = 20) {
  const where = and(eq(schema.notifications.userId, userId), unreadOnly ? sql`${schema.notifications.readAt} IS NULL` : undefined);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(schema.notifications)
      .where(where)
      .orderBy(desc(schema.notifications.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.notifications).where(where),
  ]);
  return { rows, total, page, pageSize };
}

