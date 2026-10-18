import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, isDatabaseConfigured } from "@/db";
import { channelStatus } from "@/lib/notify/adapters";

export async function GET() {
  const started = Date.now();
  let database: "ok" | "not_configured" | "error" = "not_configured";
  if (isDatabaseConfigured()) {
    try {
      await db.execute(sql`select 1`);
      database = "ok";
    } catch {
      database = "error";
    }
  }
  const channels = channelStatus();
  return NextResponse.json(
    {
      status: database === "ok" ? "ok" : "degraded",
      database,
      notifications: { in_app: true, email: Boolean(channels.email), sms: Boolean(channels.sms), push: false },
      payments: { online: false, cash: true },
      latencyMs: Date.now() - started,
    },
    { status: database === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
