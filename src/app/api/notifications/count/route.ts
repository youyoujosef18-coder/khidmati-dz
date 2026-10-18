import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { unreadNotificationCount } from "@/lib/services/support";
import { unreadMessageCount } from "@/lib/services/messaging";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifications: 0, messages: 0 }, { status: 401 });
  const [notifications, messages] = await Promise.all([unreadNotificationCount(user.id), unreadMessageCount(user)]);
  return NextResponse.json({ notifications, messages }, { headers: { "Cache-Control": "no-store" } });
}
