import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { autoCompleteBookings, expireBookingHolds, expireRequestsAndQuotes, sendAppointmentReminders } from "@/lib/services/bookings";
import { dispatchPendingDeliveries } from "@/lib/notify";

/**
 * Scheduled maintenance, protected by CRON_SECRET (Vercel Cron sends it as a Bearer token).
 * Jobs are idempotent and safe to re-run.
 */
export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { job } = await ctx.params;
  const result: Record<string, unknown> = {};
  try {
    if (job === "minute" || job === "all") {
      result.holdsExpired = await expireBookingHolds();
      result.autoCompleted = await autoCompleteBookings();
      result.expired = await expireRequestsAndQuotes();
      result.dispatched = await dispatchPendingDeliveries(100);
    }
    if (job === "hourly" || job === "all") {
      result.reminders = await sendAppointmentReminders();
    }
    if (job === "daily" || job === "all") {
      await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
      await db.execute(sql`DELETE FROM sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '30 days'`);
      await db.execute(sql`DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days'`);
      // Uploaded files never attached to anything after 24h are orphans
      const orphans = await db.execute(sql`DELETE FROM files WHERE entity_type IS NULL AND created_at < now() - interval '24 hours'
        AND id NOT IN (SELECT avatar_file_id FROM profiles WHERE avatar_file_id IS NOT NULL) RETURNING id`);
      result.orphansDeleted = orphans.length;
    }
    if (!Object.keys(result).length) return NextResponse.json({ error: "unknown job" }, { status: 404 });
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    console.error("[cron] job failed", job, (err as Error).message);
    return NextResponse.json({ ok: false, job }, { status: 500 });
  }
}
