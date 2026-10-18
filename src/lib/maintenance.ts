import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { autoCompleteBookings, expireBookingHolds, expireRequestsAndQuotes } from "@/lib/services/bookings";
import { dispatchPendingDeliveries } from "@/lib/notify";

const INTERVAL_SECONDS = 300;

/**
 * Time-based transitions (hold expiry, auto-completion, request/quote expiry,
 * delivery retries) run from the daily cron AND opportunistically at most every
 * 5 minutes after a request, so they stay timely on hosting plans with limited cron.
 */
export async function maybeRunMaintenance() {
  if (!process.env.DATABASE_URL) return;
  const rows = await db.execute<{ ran: boolean }>(sql`
    INSERT INTO rate_limits (key, count, window_start) VALUES ('maintenance:tick', 1, now())
    ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1, window_start = now()
      WHERE rate_limits.window_start < now() - make_interval(secs => ${INTERVAL_SECONDS})
    RETURNING true AS ran`);
  if (!rows.length) return;
  await expireBookingHolds();
  await autoCompleteBookings();
  await expireRequestsAndQuotes();
  await dispatchPendingDeliveries(50);
}
