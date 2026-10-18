import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listMessages } from "@/lib/services/messaging";
import { AppError } from "@/lib/errors";

/** Polling endpoint for the chat window (reliable fallback when no realtime service is configured). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "errors.unauthenticated" }, { status: 401 });
  const { id } = await ctx.params;
  const afterRaw = new URL(req.url).searchParams.get("after");
  const after = afterRaw && !Number.isNaN(Date.parse(afterRaw)) ? new Date(afterRaw) : undefined;
  try {
    const { messages } = await listMessages(user, id, after);
    return NextResponse.json(
      { messages: messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, attachmentFileId: m.attachmentFileId, readAt: m.readAt, createdAt: m.createdAt })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: `errors.${err.code}` }, { status: err.status });
    return NextResponse.json({ error: "errors.unexpected" }, { status: 500 });
  }
}
