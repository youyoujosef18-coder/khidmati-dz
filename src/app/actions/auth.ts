"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { runAction, parseInput, type ActionState } from "@/lib/action";
import { createSession, destroyCurrentSession, getCurrentUser } from "@/lib/auth/session";
import { homeForRoles } from "@/lib/auth/permissions";
import { actionUser } from "@/lib/auth/guards";
import { rateLimit, rateLimitByIp } from "@/lib/rate-limit";
import { LOCALE_COOKIE } from "@/lib/i18n/config";
import { safeReturnUrl } from "@/lib/utils";
import { sha256 } from "@/lib/crypto";
import * as auth from "@/lib/services/auth";

async function setLocaleCookie(locale: string) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(160),
  password: z.string().min(1).max(128),
  next: z.string().optional(),
});

export async function loginAction(_prev: ActionState | null, fd: FormData): Promise<ActionState> {
  let target = "/";
  const res = await runAction(async () => {
    const input = parseInput(loginSchema, fd);
    await rateLimitByIp("login", 20, 600);
    await rateLimit("login-id", sha256(input.identifier.toLowerCase()).slice(0, 24), 8, 600);
    const { userId, locale, roles } = await auth.authenticate(input.identifier, input.password);
    await createSession(userId);
    await setLocaleCookie(locale);
    target = safeReturnUrl(input.next, homeForRoles(roles));
  });
  if (res.ok) redirect(target);
  return res;
}

export async function registerAction(_prev: ActionState | null, fd: FormData): Promise<ActionState> {
  let target = "/bienvenue";
  const res = await runAction(async () => {
    const input = parseInput(auth.registerSchema, fd);
    await rateLimitByIp("register", 8, 3600);
    const { userId } = await auth.registerUser(input);
    await createSession(userId);
    await setLocaleCookie(input.preferredLocale);
    const next = safeReturnUrl(fd.get("next"), "");
    target = next ? `/bienvenue?next=${encodeURIComponent(next)}` : "/bienvenue";
  });
  if (res.ok) redirect(target);
  return res;
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/connexion?deconnecte=1");
}

export async function forgotPasswordAction(_prev: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { email } = parseInput(z.object({ email: z.email() }), fd);
    await rateLimitByIp("forgot", 5, 3600);
    await rateLimit("forgot-id", sha256(email).slice(0, 24), 3, 3600);
    await auth.requestPasswordReset(email);
  }, "auth.forgotSent");
}

export async function resetPasswordAction(_prev: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = parseInput(
      z
        .object({ token: z.string().min(20).max(200), password: auth.passwordSchema, confirm: z.string() })
        .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "validation.passwordMatch" }),
      fd,
    );
    await rateLimitByIp("reset", 10, 3600);
    await auth.resetPassword(input.token, input.password);
  }, "auth.resetDone");
}

export async function sendEmailVerificationAction(): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await rateLimit("verify-email", user.id, 3, 3600);
    await auth.sendEmailVerification(user);
  }, "auth.verificationSent");
}

export async function sendPhoneOtpAction(): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await rateLimit("otp-send", user.id, 5, 3600);
    await auth.sendPhoneOtp(user);
  }, "auth.codeSent");
}

export async function verifyPhoneOtpAction(_prev: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    const { code } = parseInput(z.object({ code: z.string().regex(/^\d{6}$/, "validation.format") }), fd);
    await rateLimit("otp-verify", user.id, 10, 3600);
    await auth.verifyPhoneOtp(user, code);
  }, "auth.phoneVerified");
}

export async function currentUserHome() {
  const u = await getCurrentUser();
  return u ? homeForRoles(u.roles) : "/";
}
