import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema, type DbOrTx } from "@/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

/**
 * One-time provisioning of the first super administrator from the web (/installation).
 *
 * Safety model:
 *  - only works while NO super_administrator exists (checked under an advisory lock, so two
 *    simultaneous claims cannot both succeed); afterwards the page answers 404 forever;
 *  - requires SETUP_TOKEN (≥ 32 chars) set by the owner in the hosting environment, compared in
 *    constant time; the caller must be signed in, and attempts are rate-limited by the action;
 *  - the grant is written to the append-only audit log.
 */
export const MIN_SETUP_TOKEN_LENGTH = 32;

export function setupTokenConfigured() {
  return (process.env.SETUP_TOKEN ?? "").trim().length >= MIN_SETUP_TOKEN_LENGTH;
}

export async function hasSuperAdmin(tx: DbOrTx = db) {
  const rows = await tx.execute(sql`SELECT 1 FROM user_roles WHERE role = 'super_administrator' LIMIT 1`);
  return rows.length > 0;
}

function tokenMatches(candidate: string) {
  const expected = createHash("sha256").update((process.env.SETUP_TOKEN ?? "").trim()).digest();
  const given = createHash("sha256").update(candidate.trim()).digest();
  return timingSafeEqual(expected, given);
}

export async function claimFirstAdmin(user: { id: string }, token: string) {
  if (!setupTokenConfigured()) throw new AppError("setup_disabled", 403);
  if (!tokenMatches(token)) throw new AppError("setup_invalid_token", 403);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('khidmati:first-super-admin'))`);
    if (await hasSuperAdmin(tx)) throw new AppError("setup_done", 409);
    await tx
      .insert(schema.userRoles)
      .values({ userId: user.id, role: "super_administrator", grantedBy: user.id })
      .onConflictDoNothing();
    await writeAudit(
      { actorId: user.id, action: "admin.bootstrap", entityType: "user", entityId: user.id, reason: "First super administrator (/installation)" },
      tx,
    );
  });
}
