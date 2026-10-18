import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

// Capture outgoing e-mails instead of sending them.
const sent: { to: string; subject: string; text: string }[] = [];
const mailer = { enabled: true, fail: false };
vi.mock("@/lib/notify/adapters", () => ({
  emailAdapter: () =>
    mailer.enabled
      ? {
          name: "test",
          configured: true,
          send: async (to: string, subject: string, text: string) => {
            if (mailer.fail) return { ok: false, error: "SMTP down" };
            sent.push({ to, subject, text });
            return { ok: true, providerReference: "test" };
          },
        }
      : null,
  smsAdapter: () => null,
  channelStatus: () => ({ in_app: true, email: mailer.enabled ? "test" : null, sms: null, push: null }),
}));

const svc = await import("@/lib/services/email-code");
const { registerSchema, resetPassword } = await import("@/lib/services/auth");
const { makeClient } = await import("./helpers");

const lastCode = () => /(\d{6})/.exec(sent.at(-1)!.subject)![1]!;

beforeEach(() => {
  sent.length = 0;
  mailer.enabled = true;
  mailer.fail = false;
});

describe("e-mail verification codes", () => {
  it("requires an e-mail address at sign-up", () => {
    const base = { fullName: "Sans Mail", phone: "0555123456", password: "Password1", acceptTerms: "on" };
    expect(registerSchema.safeParse({ ...base, email: "" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: "ok@example.test" }).success).toBe(true);
  });

  it("is off while no e-mail provider is configured (no lock-out)", async () => {
    const u = await makeClient();
    mailer.enabled = false;
    expect(svc.emailCodesEnabled()).toBe(false);
    expect(await svc.needsEmailCode(u.id, null)).toBe(false);
  });

  it("sends a 6-digit code, rejects wrong codes and opens once with the right one", async () => {
    const u = await makeClient();
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(await svc.needsEmailCode(u.id, null)).toBe(true);

    const token = await svc.startChallenge(u.id, "login", "/client");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(user!.email);
    expect(sent[0]!.text).toContain(lastCode());
    const code = lastCode();

    const pending = await svc.pendingChallenge(token);
    expect(pending?.purpose).toBe("login");
    expect(pending?.email).not.toContain(user!.email!.split("@")[0]); // masked

    const wrong = code === "000000" ? "111111" : "000000";
    await expect(svc.verifyChallenge(token, wrong)).rejects.toMatchObject({ code: "invalid_code" });
    await expect(svc.verifyChallenge("not-my-browser", code)).rejects.toMatchObject({ code: "challenge_missing" });

    const ok = await svc.verifyChallenge(token, ` ${code.slice(0, 3)} ${code.slice(3)} `);
    expect(ok).toMatchObject({ userId: u.id, purpose: "login", nextUrl: "/client" });
    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(after!.emailVerifiedAt).not.toBeNull();
    // single use
    await expect(svc.verifyChallenge(token, code)).rejects.toMatchObject({ code: "challenge_missing" });
    const audit = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.entityId, u.id));
    expect(audit.map((a) => a.action)).toContain("auth.new_device_verified");
  });

  it("burns the code after 5 wrong attempts", async () => {
    const u = await makeClient();
    const token = await svc.startChallenge(u.id, "signup", "/bienvenue");
    const code = lastCode();
    const wrong = code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) await expect(svc.verifyChallenge(token, wrong)).rejects.toMatchObject({ code: "invalid_code" });
    await expect(svc.verifyChallenge(token, wrong)).rejects.toMatchObject({ code: "code_locked" });
    await expect(svc.verifyChallenge(token, code)).rejects.toMatchObject({ code: "challenge_missing" });
  });

  it("expires codes and enforces the resend cooldown; a resent code replaces the old one", async () => {
    const u = await makeClient();
    const token = await svc.startChallenge(u.id, "login", null);
    const first = lastCode();
    await expect(svc.resendChallenge(token)).rejects.toMatchObject({ code: "resend_wait" });

    const id = (await import("@/lib/crypto")).sha256(token);
    await db
      .update(schema.loginChallenges)
      .set({ lastSentAt: new Date(Date.now() - 61_000) })
      .where(eq(schema.loginChallenges.id, id));
    await svc.resendChallenge(token);
    const second = lastCode();
    if (first !== second) await expect(svc.verifyChallenge(token, first)).rejects.toMatchObject({ code: "invalid_code" });

    await db.update(schema.loginChallenges).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.loginChallenges.id, id));
    await expect(svc.verifyChallenge(token, second)).rejects.toMatchObject({ code: "code_expired" });
  });

  it("does not leave a usable challenge when the e-mail cannot be sent", async () => {
    const u = await makeClient();
    mailer.fail = true;
    await expect(svc.startChallenge(u.id, "login", null)).rejects.toMatchObject({ code: "delivery_failed" });
    const rows = await db.select().from(schema.loginChallenges).where(eq(schema.loginChallenges.userId, u.id));
    expect(rows).toHaveLength(0);
  });

  it("trusts a verified device for its own account only, and forgets devices on password reset", async () => {
    const u = await makeClient();
    const other = await makeClient();
    const device = await svc.trustDevice(u.id, "Test UA");
    expect(await svc.isTrustedDevice(u.id, device)).toBe(true);
    expect(await svc.needsEmailCode(u.id, device)).toBe(false);
    expect(await svc.isTrustedDevice(other.id, device)).toBe(false);
    expect(await svc.needsEmailCode(u.id, "forged-token")).toBe(true);

    // Password reset through a valid reset token forgets every trusted device.
    const { randomToken, sha256 } = await import("@/lib/crypto");
    const resetTok = randomToken(32);
    await db.insert(schema.authTokens).values({
      userId: u.id,
      type: "password_reset",
      tokenHash: sha256(resetTok),
      expiresAt: new Date(Date.now() + 600_000),
    });
    await resetPassword(resetTok, "NewPassword2");
    expect(await svc.isTrustedDevice(u.id, device)).toBe(false);
  });
});
