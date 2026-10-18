"use server";

import { z } from "zod";
import { runAction, parseInput, type ActionState } from "@/lib/action";
import { actionUser } from "@/lib/auth/guards";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import * as support from "@/lib/services/support";

export async function contactAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseInput(support.contactSchema, fd);
    await rateLimitByIp("contact", 5, 3600);
    await support.createContactMessage(input);
  }, "pages.contactSent");
}

export async function createTicketAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await rateLimit("ticket", user.id, 10, 3600);
    const ticket = await support.createTicket(user, parseInput(support.ticketSchema, fd));
    return { ok: true, message: "support.created", params: { ref: ticket.reference }, data: { id: ticket.id } };
  });
}

export async function replyTicketAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    const input = parseInput(
      z.object({ ticketId: z.string().uuid(), body: z.string().trim().min(1).max(4000), isInternal: z.string().optional() }),
      fd,
    );
    await rateLimit("ticket-reply", user.id, 30, 3600);
    await support.replyTicket(user, input.ticketId, input.body, input.isInternal === "on");
  }, "support.replySent");
}

export async function setTicketStatusAction(ticketId: string, status: "open" | "pending" | "resolved" | "closed"): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await support.setTicketStatus(user, ticketId, status);
  });
}

export async function markNotificationsReadAction(ids: string[] | "all"): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await support.markNotificationsRead(user, ids);
  });
}
