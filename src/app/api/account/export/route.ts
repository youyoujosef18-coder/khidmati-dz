import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { exportUserData } from "@/lib/services/auth";
import { rateLimit } from "@/lib/rate-limit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  await rateLimit("export", user.id, 5, 3600);
  const data = await exportUserData(user);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="khidmati-donnees-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
