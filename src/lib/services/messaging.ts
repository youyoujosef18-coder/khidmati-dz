import "server-only";
import { and, asc, desc, eq, gt, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/db";
import { AppError } from "@/lib/errors";
import { hasPermission } from "@/lib/auth/permissions";
import { attachFiles } from "@/lib/storage";
import { notify, scheduleDispatch } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "./types";

export async function ensureConversation(
  tx: DbOrTx,
  p: { requestId: string; clientId: string; technicianId: string; technicianUserId: string; bookingId?: string },
): Promise<string> {
  const [existing] = await tx
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(and(eq(schema.conversations.requestId, p.requestId), eq(schema.conversations.technicianId, p.technicianId)));
  if (existing) return existing.id;
  const [row] = await tx
    .insert(schema.conversations)
    .values({
      requestId: p.requestId,
      clientId: p.clientId,
      technicianId: p.technicianId,
      technicianUserId: p.technicianUserId,
      bookingId: p.bookingId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: schema.conversations.id });
  if (row) return row.id;
  const [again] = await tx
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(and(eq(schema.conversations.requestId, p.requestId), eq(schema.conversations.technicianId, p.technicianId)));
  return again!.id;
}

/** Opens (or returns) a conversation between a client and a technician about a request. */
export async function openConversationForRequest(actor: Actor, requestId: string, technicianId?: string) {
  return db.transaction(async (tx) => {
    const [req] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId));
    if (!req) throw new AppError("not_found", 404);
    let tp: typeof schema.technicianProfiles.$inferSelect | undefined;
    if (req.clientId === actor.id) {
      if (!technicianId) throw new AppError("not_found", 404);
      [tp] = await tx.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, technicianId));
      // Client can only message a technician who quoted or was matched/targeted
      const [link] = await tx.execute(sql`
        SELECT 1 FROM request_matches WHERE request_id = ${requestId} AND technician_id = ${technicianId}
        UNION SELECT 1 FROM quotes WHERE request_id = ${requestId} AND technician_id = ${technicianId} LIMIT 1`);
      if (!tp || !link) throw new AppError("forbidden", 403);
    } else {
      [tp] = await tx.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.userId, actor.id));
      if (!tp || tp.verificationStatus !== "approved") throw new AppError("forbidden", 403);
      const [link] = await tx.execute(sql`
        SELECT 1 FROM request_matches WHERE request_id = ${requestId} AND technician_id = ${tp.id}
        UNION SELECT 1 FROM quotes WHERE request_id = ${requestId} AND technician_id = ${tp.id} LIMIT 1`);
      if (!link) throw new AppError("forbidden", 403);
    }
    return ensureConversation(tx, { requestId, clientId: req.clientId, technicianId: tp.id, technicianUserId: tp.userId });
  });
}

export async function getConversationForUser(actor: Actor, conversationId: string) {
  const [c] = await db
    .select({
      conversation: schema.conversations,
      requestTitle: schema.serviceRequests.title,
      requestRef: schema.serviceRequests.reference,
      techName: schema.technicianProfiles.publicName,
      techSlug: schema.technicianProfiles.slug,
      techAvatar: schema.technicianProfiles.avatarFileId,
      clientName: schema.profiles.displayName,
    })
    .from(schema.conversations)
    .innerJoin(schema.serviceRequests, eq(schema.serviceRequests.id, schema.conversations.requestId))
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.conversations.technicianId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.conversations.clientId))
    .where(eq(schema.conversations.id, conversationId));
  if (!c) return null;
  const isParticipant = c.conversation.clientId === actor.id || c.conversation.technicianUserId === actor.id;
  if (!isParticipant && !hasPermission(actor.roles, "disputes.handle")) return null;
  return { ...c, isParticipant, role: c.conversation.clientId === actor.id ? ("client" as const) : ("technician" as const) };
}

export const messageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().max(2000).optional().default(""),
  attachmentFileId: z.string().uuid().optional().or(z.literal("")),
});

export async function sendMessage(actor: Actor, input: z.infer<typeof messageSchema>) {
  if (!input.body && !input.attachmentFileId) throw new AppError("validation", 400);
  const result = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(schema.conversations).where(eq(schema.conversations.id, input.conversationId)).for("update");
    if (!c) throw new AppError("not_found", 404);
    const isClient = c.clientId === actor.id;
    const isTech = c.technicianUserId === actor.id;
    if (!isClient && !isTech) throw new AppError("forbidden", 403);
    if (c.blockedAt) throw new AppError("conversation_blocked", 409);

    if (input.attachmentFileId) {
      await attachFiles(tx, actor.id, [input.attachmentFileId], "conversation-attachments", "conversation", c.id);
    }
    const [msg] = await tx
      .insert(schema.messages)
      .values({ conversationId: c.id, senderId: actor.id, body: input.body ?? "", attachmentFileId: input.attachmentFileId || null })
      .returning();
    await tx.update(schema.conversations).set({ lastMessageAt: msg!.createdAt }).where(eq(schema.conversations.id, c.id));

    const recipient = isClient ? c.technicianUserId : c.clientId;
    // One unread "new message" notification per conversation at a time
    const [pending] = await tx
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.userId, recipient),
          eq(schema.notifications.type, "new_message"),
          isNull(schema.notifications.readAt),
          sql`${schema.notifications.payload}->>'conversationId' = ${c.id}`,
        ),
      )
      .limit(1);
    if (!pending) {
      const [sender] = await tx.select({ name: schema.profiles.displayName }).from(schema.profiles).where(eq(schema.profiles.id, actor.id));
      const senderName = isTech
        ? (await tx.select({ n: schema.technicianProfiles.publicName }).from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, c.technicianId)))[0]?.n ?? sender?.name ?? ""
        : sender?.name ?? "";
      await notify(
        {
          userId: recipient,
          type: "new_message",
          params: { name: senderName, preview: (input.body || "📷").slice(0, 80) },
          link: `${isClient ? "/technicien" : "/client"}/messages/${c.id}`,
          payload: { conversationId: c.id },
        },
        tx,
      );
    }
    return msg!;
  });
  await scheduleDispatch();
  return result;
}

export async function listMessages(actor: Actor, conversationId: string, after?: Date) {
  const conv = await getConversationForUser(actor, conversationId);
  if (!conv) throw new AppError("not_found", 404);
  const rows = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.conversationId, conversationId), after ? gt(schema.messages.createdAt, after) : sql`true`))
    .orderBy(asc(schema.messages.createdAt))
    .limit(after ? 100 : 200);
  if (conv.isParticipant) {
    // Mark the other party's messages as read
    await db
      .update(schema.messages)
      .set({ readAt: new Date() })
      .where(and(eq(schema.messages.conversationId, conversationId), ne(schema.messages.senderId, actor.id), isNull(schema.messages.readAt)));
    await db
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(schema.notifications.userId, actor.id),
          eq(schema.notifications.type, "new_message"),
          isNull(schema.notifications.readAt),
          sql`${schema.notifications.payload}->>'conversationId' = ${conversationId}`,
        ),
      );
  }
  return { conversation: conv, messages: rows };
}

export async function listConversations(actor: Actor, side: "client" | "technician") {
  const cond = side === "client" ? eq(schema.conversations.clientId, actor.id) : eq(schema.conversations.technicianUserId, actor.id);
  return db
    .select({
      id: schema.conversations.id,
      lastMessageAt: schema.conversations.lastMessageAt,
      createdAt: schema.conversations.createdAt,
      blockedAt: schema.conversations.blockedAt,
      requestTitle: schema.serviceRequests.title,
      techName: schema.technicianProfiles.publicName,
      techAvatar: schema.technicianProfiles.avatarFileId,
      clientName: schema.profiles.displayName,
      unread: sql<number>`(SELECT count(*)::int FROM messages m WHERE m.conversation_id = "conversations"."id" AND m.sender_id <> ${actor.id} AND m.read_at IS NULL)`,
      lastBody: sql<string | null>`(SELECT m.body FROM messages m WHERE m.conversation_id = "conversations"."id" ORDER BY m.created_at DESC LIMIT 1)`,
    })
    .from(schema.conversations)
    .innerJoin(schema.serviceRequests, eq(schema.serviceRequests.id, schema.conversations.requestId))
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.conversations.technicianId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.conversations.clientId))
    .where(cond)
    .orderBy(desc(sql`coalesce("conversations"."last_message_at", "conversations"."created_at")`))
    .limit(100);
}

export async function blockConversation(actor: Actor, conversationId: string) {
  const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  if (!c || (c.clientId !== actor.id && c.technicianUserId !== actor.id)) throw new AppError("not_found", 404);
  await db.update(schema.conversations).set({ blockedAt: new Date(), blockedBy: actor.id }).where(eq(schema.conversations.id, c.id));
  await writeAudit({ actorId: actor.id, action: "conversation.blocked", entityType: "conversation", entityId: c.id });
}

export async function unreadMessageCount(actor: Actor) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.conversations.id, schema.messages.conversationId))
    .where(
      and(
        or(eq(schema.conversations.clientId, actor.id), eq(schema.conversations.technicianUserId, actor.id)),
        ne(schema.messages.senderId, actor.id),
        isNull(schema.messages.readAt),
      ),
    );
  return r?.n ?? 0;
}
