import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { randomToken, sha256 } from "@/lib/crypto";
import type { Role } from "./permissions";

export const SESSION_COOKIE = "kh_session";
const SESSION_DAYS = 30;

export interface CurrentUser {
  id: string;
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  fullName: string;
  displayName: string;
  firstName: string;
  preferredLocale: "fr-DZ" | "ar-DZ";
  avatarFileId: string | null;
  roles: Role[];
  sessionId: string;
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const h = await headers();
  await db.insert(schema.sessions).values({
    id,
    userId,
    expiresAt,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(eq(schema.sessions.id, sha256(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function revokeAllSessions(userId: string) {
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
}

/**
 * Resolves the authenticated user for this request. Returns null for missing,
 * expired or revoked sessions, and for any account that is not active — so a
 * suspension takes effect immediately, including on existing sessions.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  if (!process.env.DATABASE_URL) return null;
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const sid = sha256(token);
  const now = new Date();

  const rows = await db
    .select({
      sessionId: schema.sessions.id,
      lastSeenAt: schema.sessions.lastSeenAt,
      userId: schema.users.id,
      email: schema.users.email,
      phone: schema.users.phone,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      phoneVerifiedAt: schema.users.phoneVerifiedAt,
      fullName: schema.profiles.fullName,
      displayName: schema.profiles.displayName,
      preferredLocale: schema.profiles.preferredLocale,
      avatarFileId: schema.profiles.avatarFileId,
      accountStatus: schema.profiles.accountStatus,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(and(eq(schema.sessions.id, sid), isNull(schema.sessions.revokedAt), gt(schema.sessions.expiresAt, now)))
    .limit(1);

  const row = rows[0];
  if (!row || row.accountStatus !== "active") return null;

  const roleRows = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, row.userId));

  // Throttled "last seen" update (at most every 10 minutes)
  if (now.getTime() - row.lastSeenAt.getTime() > 10 * 60_000) {
    await db.update(schema.sessions).set({ lastSeenAt: now }).where(eq(schema.sessions.id, sid));
  }

  return {
    id: row.userId,
    email: row.email,
    phone: row.phone,
    emailVerified: Boolean(row.emailVerifiedAt),
    phoneVerified: Boolean(row.phoneVerifiedAt),
    fullName: row.fullName,
    displayName: row.displayName,
    firstName: row.displayName.split(/\s+/)[0] ?? row.displayName,
    preferredLocale: row.preferredLocale,
    avatarFileId: row.avatarFileId,
    roles: roleRows.map((r) => r.role),
    sessionId: sid,
  };
});
