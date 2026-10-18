import "server-only";
import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { AppError, pgCode, pgConstraint } from "@/lib/errors";
import { hashPassword, verifyPassword, burnPasswordCheck } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { normalizeAlgerianMobile } from "@/lib/phone";
import { numericCode, randomToken, sha256 } from "@/lib/crypto";
import { emailAdapter, smsAdapter } from "@/lib/notify/adapters";
import { tFor } from "@/lib/i18n/server";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "./types";

export const passwordSchema = z
  .string()
  .min(8, "validation.password")
  .max(128, "validation.tooLong")
  .refine((v) => /[A-Za-z؀-ۿ]/.test(v) && /\d/.test(v), "validation.password");

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3).max(80),
    phone: z.string().trim().max(20).optional().default(""),
    email: z.string().trim().toLowerCase().max(160).optional().default(""),
    password: passwordSchema,
    preferredLocale: z.enum(["fr-DZ", "ar-DZ"]).default("fr-DZ"),
    acceptTerms: z.literal("on", { message: "validation.terms" }),
  })
  .superRefine((v, ctx) => {
    if (!v.phone && !v.email) ctx.addIssue({ code: "custom", path: ["phone"], message: "validation.emailOrPhone" });
    if (v.phone && !normalizeAlgerianMobile(v.phone))
      ctx.addIssue({ code: "custom", path: ["phone"], message: "validation.phone" });
    if (v.email && !z.email().safeParse(v.email).success)
      ctx.addIssue({ code: "custom", path: ["email"], message: "validation.email" });
  });

export async function registerUser(input: z.infer<typeof registerSchema>) {
  const phone = input.phone ? normalizeAlgerianMobile(input.phone) : null;
  const email = input.email || null;
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({ email, phone, passwordHash })
        .returning({ id: schema.users.id });
      await tx.insert(schema.profiles).values({
        id: user!.id,
        fullName: input.fullName,
        displayName: input.fullName.split(/\s+/)[0] ?? input.fullName,
        email,
        phone,
        preferredLocale: input.preferredLocale,
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
      });
      await tx.insert(schema.userRoles).values({ userId: user!.id, role: "client" });
      return { userId: user!.id };
    });
  } catch (err) {
    if (pgCode(err) === "23505") {
      const c = pgConstraint(err);
      if (c === "users_email_uq") throw new AppError("email_taken");
      if (c === "users_phone_uq") throw new AppError("phone_taken");
    }
    throw err;
  }
}

/** Resolves an identifier (email or Algerian mobile) and checks the password. */
export async function authenticate(identifier: string, password: string) {
  const id = identifier.trim().toLowerCase();
  const phone = normalizeAlgerianMobile(id);
  const [user] = await db
    .select({
      id: schema.users.id,
      passwordHash: schema.users.passwordHash,
      status: schema.profiles.accountStatus,
      locale: schema.profiles.preferredLocale,
    })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(phone ? eq(schema.users.phone, phone) : eq(schema.users.email, id))
    .limit(1);

  if (!user) {
    await burnPasswordCheck(password);
    throw new AppError("invalid_credentials", 401);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw new AppError("invalid_credentials", 401);
  if (user.status === "suspended") throw new AppError("account_suspended", 403);
  if (user.status !== "active") throw new AppError("invalid_credentials", 401);

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  const roles = await db
    .select({ role: schema.userRoles.role })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.userId, user.id));
  return { userId: user.id, locale: user.locale, roles: roles.map((r) => r.role) };
}

export async function changePassword(actor: Actor, currentPassword: string, newPassword: string, keepSessionId: string) {
  const [u] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, actor.id));
  if (!u || !(await verifyPassword(currentPassword, u.hash))) throw new AppError("wrong_password");
  await db.update(schema.users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(schema.users.id, actor.id));
  // Revoke every other session
  await db
    .update(schema.sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.sessions.userId, actor.id),
        isNull(schema.sessions.revokedAt),
        sql`${schema.sessions.id} <> ${keepSessionId}`,
      ),
    );
  await writeAudit({ actorId: actor.id, action: "auth.password_changed", entityType: "user", entityId: actor.id });
}

/* --------------------------- Email tokens --------------------------- */

async function issueToken(userId: string, type: "email_verify" | "password_reset", ttlMinutes: number) {
  const token = randomToken(32);
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.userId, userId), eq(schema.authTokens.type, type), isNull(schema.authTokens.usedAt)));
  await db.insert(schema.authTokens).values({
    userId,
    type,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
  });
  return token;
}

async function consumeToken(token: string, type: "email_verify" | "password_reset") {
  const [row] = await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.authTokens.tokenHash, sha256(token)),
        eq(schema.authTokens.type, type),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.authTokens.userId });
  return row?.userId ?? null;
}

export function emailFlowsAvailable() {
  return emailAdapter() !== null;
}
export function smsFlowsAvailable() {
  return smsAdapter() !== null;
}

/** Always resolves the same way whether or not the account exists (no enumeration). */
export async function requestPasswordReset(email: string) {
  const adapter = emailAdapter();
  if (!adapter) throw new AppError("provider_unavailable", 503);
  const [u] = await db
    .select({ id: schema.users.id, locale: schema.profiles.preferredLocale, status: schema.profiles.accountStatus })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(eq(schema.users.email, email.trim().toLowerCase()))
    .limit(1);
  if (!u || u.status !== "active") return;
  const token = await issueToken(u.id, "password_reset", 30);
  const t = tFor(u.locale);
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/mot-de-passe-oublie?token=${token}`;
  const res = await adapter.send(email, `Khidmati — ${t("auth.resetTitle")}`, `${t("auth.forgotSubtitle")}\n\n${url}`);
  if (!res.ok) throw new AppError("delivery_failed", 502);
}

export async function resetPassword(token: string, newPassword: string) {
  const userId = await consumeToken(token, "password_reset");
  if (!userId) throw new AppError("invalid_code");
  await db.update(schema.users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(schema.users.id, userId));
  await revokeAllSessions(userId);
  await writeAudit({ actorId: userId, action: "auth.password_reset", entityType: "user", entityId: userId });
}

export async function sendEmailVerification(actor: Actor) {
  const adapter = emailAdapter();
  if (!adapter) throw new AppError("provider_unavailable", 503);
  const [u] = await db
    .select({ email: schema.users.email, verified: schema.users.emailVerifiedAt, locale: schema.profiles.preferredLocale })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(eq(schema.users.id, actor.id));
  if (!u?.email || u.verified) return;
  const token = await issueToken(actor.id, "email_verify", 24 * 60);
  const t = tFor(u.locale);
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/verifier-email?token=${token}`;
  const res = await adapter.send(u.email, `Khidmati — ${t("auth.sendVerification")}`, url);
  if (!res.ok) throw new AppError("delivery_failed", 502);
}

export async function verifyEmailToken(token: string) {
  const userId = await consumeToken(token, "email_verify");
  if (!userId) return false;
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));
  return true;
}

/* ------------------------------ SMS OTP ----------------------------- */

export async function sendPhoneOtp(actor: Actor) {
  const adapter = smsAdapter();
  if (!adapter) throw new AppError("provider_unavailable", 503);
  const [u] = await db.select({ phone: schema.users.phone, verified: schema.users.phoneVerifiedAt }).from(schema.users).where(eq(schema.users.id, actor.id));
  if (!u?.phone || u.verified) return;
  // Resend cooldown: 60 seconds
  const [recent] = await db
    .select({ id: schema.authTokens.id })
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.userId, actor.id),
        eq(schema.authTokens.type, "phone_otp"),
        gt(schema.authTokens.createdAt, new Date(Date.now() - 60_000)),
      ),
    )
    .limit(1);
  if (recent) throw new AppError("rate_limited", 429);
  const code = numericCode(6);
  await db
    .update(schema.authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.authTokens.userId, actor.id), eq(schema.authTokens.type, "phone_otp"), isNull(schema.authTokens.usedAt)));
  await db.insert(schema.authTokens).values({
    userId: actor.id,
    type: "phone_otp",
    tokenHash: sha256(`${actor.id}:${code}`),
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  const res = await adapter.send(u.phone, `Khidmati : ${code}`);
  if (!res.ok) throw new AppError("delivery_failed", 502);
}

export async function verifyPhoneOtp(actor: Actor, code: string) {
  const [tok] = await db
    .select()
    .from(schema.authTokens)
    .where(
      and(
        eq(schema.authTokens.userId, actor.id),
        eq(schema.authTokens.type, "phone_otp"),
        isNull(schema.authTokens.usedAt),
        gt(schema.authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!tok || tok.attempts >= 5) throw new AppError("invalid_code");
  if (tok.tokenHash !== sha256(`${actor.id}:${code.trim()}`)) {
    await db.update(schema.authTokens).set({ attempts: tok.attempts + 1 }).where(eq(schema.authTokens.id, tok.id));
    throw new AppError("invalid_code");
  }
  await db.update(schema.authTokens).set({ usedAt: new Date() }).where(eq(schema.authTokens.id, tok.id));
  await db.update(schema.users).set({ phoneVerifiedAt: new Date() }).where(eq(schema.users.id, actor.id));
}

/* -------------------------- Account deletion ------------------------ */

const OPEN_BOOKING_STATUSES = ["requested", "confirmed", "technician_en_route", "in_progress", "awaiting_completion_confirmation", "disputed"] as const;

export async function requestAccountDeletion(actor: Actor) {
  const open = await db
    .select({ id: schema.bookings.id })
    .from(schema.bookings)
    .leftJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
    .where(
      and(
        inArray(schema.bookings.status, [...OPEN_BOOKING_STATUSES]),
        or(eq(schema.bookings.clientId, actor.id), eq(schema.technicianProfiles.userId, actor.id)),
      ),
    )
    .limit(1);
  if (open.length) throw new AppError("address_in_use");
  await db
    .update(schema.profiles)
    .set({ accountStatus: "deletion_requested", deletionRequestedAt: new Date() })
    .where(eq(schema.profiles.id, actor.id));
  await db
    .update(schema.technicianProfiles)
    .set({ availabilityStatus: "unavailable" })
    .where(eq(schema.technicianProfiles.userId, actor.id));
  await revokeAllSessions(actor.id);
  await writeAudit({ actorId: actor.id, action: "account.deletion_requested", entityType: "user", entityId: actor.id });
}

/**
 * Anonymizes personal data while preserving financial, booking and dispute
 * history (required records keep their foreign keys, but no longer identify anyone).
 */
export async function anonymizeUser(staff: Actor, userId: string) {
  if (staff.id === userId) throw new AppError("self_action");
  await db.transaction(async (tx) => {
    const placeholder = `deleted-${userId.slice(0, 8)}`;
    await tx
      .update(schema.users)
      .set({ email: null, phone: null, passwordHash: await hashPassword(randomToken(24)), emailVerifiedAt: null, phoneVerifiedAt: null })
      .where(eq(schema.users.id, userId));
    await tx
      .update(schema.profiles)
      .set({ fullName: placeholder, displayName: placeholder, email: null, phone: null, avatarFileId: null, accountStatus: "deleted", statusReason: "deleted_on_request" })
      .where(eq(schema.profiles.id, userId));
    await tx
      .update(schema.clientAddresses)
      .set({ addressLine: "—", accessNotes: null, latitude: null, longitude: null, neighborhood: null, archivedAt: new Date() })
      .where(eq(schema.clientAddresses.clientId, userId));
    await tx
      .update(schema.technicianProfiles)
      .set({ publicName: placeholder, legalName: placeholder, bio: "", avatarFileId: null, verificationStatus: "expired", availabilityStatus: "unavailable" })
      .where(eq(schema.technicianProfiles.userId, userId));
    // Verification documents & avatars are deleted outright (not needed for legal records)
    await tx.execute(sql`DELETE FROM technician_documents WHERE technician_id IN (SELECT id FROM technician_profiles WHERE user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM portfolio_items WHERE technician_id IN (SELECT id FROM technician_profiles WHERE user_id = ${userId})`);
    await tx.execute(sql`DELETE FROM files WHERE owner_id = ${userId} AND bucket IN ('public-avatars','portfolio','technician-verification')`);
    await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await tx.delete(schema.savedTechnicians).where(eq(schema.savedTechnicians.clientId, userId));
    await writeAudit({ actorId: staff.id, action: "account.anonymized", entityType: "user", entityId: userId }, tx);
  });
}

export async function exportUserData(actor: Actor) {
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, actor.id));
  const [user] = await db
    .select({ email: schema.users.email, phone: schema.users.phone, createdAt: schema.users.createdAt })
    .from(schema.users)
    .where(eq(schema.users.id, actor.id));
  const addresses = await db.select().from(schema.clientAddresses).where(eq(schema.clientAddresses.clientId, actor.id));
  const requests = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.clientId, actor.id));
  const bookings = await db.select().from(schema.bookings).where(eq(schema.bookings.clientId, actor.id));
  const reviews = await db.select().from(schema.reviews).where(eq(schema.reviews.clientId, actor.id));
  const [tech] = await db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.userId, actor.id));
  const techServices = tech
    ? await db.select().from(schema.technicianServices).where(eq(schema.technicianServices.technicianId, tech.id))
    : [];
  return {
    exportedAt: new Date().toISOString(),
    account: user,
    profile,
    addresses,
    serviceRequests: requests,
    bookings,
    reviews,
    technicianProfile: tech ?? null,
    technicianServices: techServices,
  };
}
