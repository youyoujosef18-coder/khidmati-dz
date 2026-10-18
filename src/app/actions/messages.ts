"use server";

import { runAction, type ActionState } from "@/lib/action";
import { actionUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import * as messaging from "@/lib/services/messaging";

export async function sendMessageAction(conversationId: string, body: string, attachmentFileId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await rateLimit("message", user.id, 30, 60);
    const input = messaging.messageSchema.parse({ conversationId, body, attachmentFileId });
    const m = await messaging.sendMessage(user, input);
    return {
      ok: true,
      data: { id: m.id, senderId: m.senderId, body: m.body, attachmentFileId: m.attachmentFileId, readAt: null, createdAt: m.createdAt.toISOString() },
    };
  });
}

export async function blockConversationAction(conversationId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await messaging.blockConversation(user, conversationId);
  });
}
