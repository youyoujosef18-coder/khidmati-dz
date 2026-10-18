import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { AppError } from "@/lib/errors";
import { numericCode, randomToken, sha256 } from "@/lib/crypto";
import { emailAdapter } from "@/lib/notify/adapters";
import { tFor } from "@/lib/i18n/server";
import { writeAudit } from "@/lib/audit";

/**
 * E-mail verification codes for sign-up and for sign-in on a new device.
 *
 * - Active only while an e-mail provider is configured (otherwise nobody could receive a code
 *   and every account — administrators included — would be locked out).
 * - The pending challenge is bound to the browser by a random cookie token (only its SHA-256 is
 *   stored); the 6-digit code is stored hashed, expires after 10 minutes and burns after 5 wrong
 *   attempts; resends are limited (60 s cooldown, 5 sends per challenge).
 * - A browser that completes a code becomes a trusted device for 30 days (random cookie token,
 *   SHA-256 stored). Password changes/resets forget every trusted device.
 */
export const CHALLENGE_COOKIE = "kh_challenge";
export const DEVICE_COOKIE = "kh_device";
export const CODE_TTL_MINUTES = 10;
export const CHALLENGE_COOKIE_SECONDS = 20 * 60;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_SENDS = 5;
export const TRUST_DAYS = 30;

export type ChallengePurpose = "signup" | "login";

export function emailCodesEnabled() {
  return emailAdapter() !== null;
}

const codeHash = (challengeId: string, code: string) => sha256(`${challengeId}:${code}`);

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(1, Math.min(6, local.length - shown.length)))}@${domain}`;
}

async function recipient(userId: string) {
  const [u] = await db
    .select({ email: schema.users.email, locale: schema.profiles.preferredLocale, status: schema.profiles.accountStatus })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(eq(schema.users.id, userId));
  return u ?? null;
}

async function deliver(email: string, locale: "fr-DZ" | "ar-DZ", code: string) {
  const adapter = emailAdapter();
  if (!adapter) throw new AppError("provider_unavailable", 503);
  const t = tFor(locale);
  const res = await adapter.send(
    email,
    t("emailCode.subject", { code }),
    t("emailCode.body", { code, minutes: CODE_TTL_MINUTES }),
  );
  if (!res.ok) {
    console.error("[email-code] delivery failed:", res.error);
    throw new AppError("delivery_failed", 502);
  }
}

/* ---------------------------- Trusted devices ---------------------------- */

export async function isTrustedDevice(userId: string, deviceToken: string | undefined | null) {
  if (!deviceToken) return false;
  const id = sha256(deviceToken);
  const [row] = await db
    .select({ id: schema.trustedDevices.id })
    .from(schema.trustedDevices)
    .where(and(eq(schema.trustedDevices.id, id), eq(schema.trustedDevices.userId, userId), gt(schema.trustedDevices.expiresAt, new Date())))
    .limit(1);
  if (!row) return false;
  await db.update(schema.trustedDevices).set({ lastUsedAt: new Date() }).where(eq(schema.trustedDevices.id, id));
  return true;
}

/** Returns the new device cookie token. */
export async function trustDevice(userId: string, userAgent: string | null) {
  const token = randomToken(32);
  await db.insert(schema.trustedDevices).values({
    id: sha256(token),
    userId,
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt: new Date(Date.now() + TRUST_DAYS * 86400_000),
  });
  return token;
}

export async function forgetTrustedDevices(userId: string) {
  await db.delete(schema.trustedDevices).where(eq(schema.trustedDevices.userId, userId));
}

/** Whether this sign-in must be confirmed by an e-mail code (provider on, account has an e-mail, new device). */
export async function needsEmailCode(userId: string, deviceToken: string | undefined | null) {
  if (!emailCodesEnabled()) return false;
  const u = await recipient(userId);
  if (!u?.email) return false; // legacy accounts without e-mail: password only (cannot receive a code)
  return !(await isTrustedDevice(userId, deviceToken));
}

/* ------------------------------ Challenges ------------------------------- */

/** Creates a challenge, e-mails the code and returns the challenge cookie token. */
export async function startChallenge(userId: string, purpose: ChallengePurpose, nextUrl: string | null) {
  const u = await recipient(userId);
  if (!u?.email) throw new AppError("email_required", 400);
  // One live challenge per account: older pending codes stop working.
  await db
    .update(schema.loginChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.loginChallenges.userId, userId), isNull(schema.loginChallenges.consumedAt)));
  const token = randomToken(32);
  const id = sha256(token);
  const code = numericCode(6);
  await db.insert(schema.loginChallenges).values({
    id,
    userId,
    purpose,
    codeHash: codeHash(id, code),
    nextUrl,
    expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
  });
  try {
    await deliver(u.email, u.locale, code);
  } catch (err) {
    await db.delete(schema.loginChallenges).where(eq(schema.loginChallenges.id, id));
    throw err;
  }
  return token;
}

async function liveChallenge(token: string | undefined | null) {
  if (!token) return null;
  const [c] = await db
    .select()
    .from(schema.loginChallenges)
    .where(and(eq(schema.loginChallenges.id, sha256(token)), isNull(schema.loginChallenges.consumedAt)))
    .limit(1);
  return c ?? null;
}

/** What the code page shows. Null when there is no pending challenge for this browser. */
export async function pendingChallenge(token: string | undefined | null) {
  const c = await liveChallenge(token);
  if (!c) return null;
  const u = await recipient(c.userId);
  if (!u?.email) return null;
  const resendAt = new Date(c.lastSentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000);
  return {
    purpose: c.purpose as ChallengePurpose,
    email: maskEmail(u.email),
    expired: c.expiresAt.getTime() <= Date.now(),
    resendAt,
    canResend: c.sendCount < MAX_SENDS,
  };
}

export async function resendChallenge(token: string | undefined | null) {
  const c = await liveChallenge(token);
  if (!c) throw new AppError("challenge_missing", 400);
  const wait = Math.ceil((c.lastSentAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000);
  if (wait > 0) throw new AppError("resend_wait", 429, { seconds: wait });
  if (c.sendCount >= MAX_SENDS) throw new AppError("code_locked", 429);
  const u = await recipient(c.userId);
  if (!u?.email) throw new AppError("challenge_missing", 400);
  const code = numericCode(6);
  await db
    .update(schema.loginChallenges)
    .set({
      codeHash: codeHash(c.id, code),
      attempts: 0,
      sendCount: c.sendCount + 1,
      lastSentAt: new Date(),
      expiresAt: new Date(Date.now() + CODE_TTL_MINUTES * 60_000),
    })
    .where(eq(schema.loginChallenges.id, c.id));
  await deliver(u.email, u.locale, code);
}

/** Checks the code; on success the challenge is consumed and the e-mail marked verified. */
export async function verifyChallenge(token: string | undefined | null, rawCode: string) {
  const c = await liveChallenge(token);
  if (!c) throw new AppError("challenge_missing", 400);
  if (c.expiresAt.getTime() <= Date.now()) throw new AppError("code_expired", 400);
  if (c.attempts >= MAX_CODE_ATTEMPTS) throw new AppError("code_locked", 429);
  const code = rawCode.replace(/\D/g, "");
  if (code.length !== 6 || codeHash(c.id, code) !== c.codeHash) {
    const attempts = c.attempts + 1;
    await db
      .update(schema.loginChallenges)
      .set({ attempts, consumedAt: attempts >= MAX_CODE_ATTEMPTS ? new Date() : null })
      .where(eq(schema.loginChallenges.id, c.id));
    throw new AppError(attempts >= MAX_CODE_ATTEMPTS ? "code_locked" : "invalid_code", 400);
  }
  // Consume atomically: a concurrent second submission of the same code gets nothing.
  const consumed = await db
    .update(schema.loginChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(schema.loginChallenges.id, c.id), isNull(schema.loginChallenges.consumedAt)))
    .returning({ id: schema.loginChallenges.id });
  if (!consumed.length) throw new AppError("challenge_missing", 400);

  const u = await recipient(c.userId);
  if (!u || u.status === "suspended") throw new AppError("account_suspended", 403);
  if (u.status !== "active") throw new AppError("invalid_credentials", 401);
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(and(eq(schema.users.id, c.userId), isNull(schema.users.emailVerifiedAt)));
  await writeAudit({ actorId: c.userId, action: c.purpose === "signup" ? "auth.signup_email_verified" : "auth.new_device_verified", entityType: "user", entityId: c.userId });
  return { userId: c.userId, purpose: c.purpose as ChallengePurpose, nextUrl: c.nextUrl };
}
