import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AppError } from "@/lib/errors";
import { sha256 } from "@/lib/crypto";

export async function clientIpHash() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return sha256(`ip:${ip}`).slice(0, 24);
}

/**
 * Fixed-window rate limit stored in Postgres (works across serverless instances).
 * Throws AppError("rate_limited") when the limit is exceeded.
 */
export async function rateLimit(bucket: string, identifier: string, limit: number, windowSeconds: number) {
  const key = `${bucket}:${identifier}`;
  const rows = await db.execute<{ count: number }>(sql`
    INSERT INTO rate_limits (key, count, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN now() ELSE rate_limits.window_start END
    RETURNING count
  `);
  const count = Number(rows[0]?.count ?? 0);
  if (count > limit) throw new AppError("rate_limited", 429);
}

export async function rateLimitByIp(bucket: string, limit: number, windowSeconds: number) {
  await rateLimit(bucket, await clientIpHash(), limit, windowSeconds);
}
