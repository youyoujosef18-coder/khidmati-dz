"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { runAction, parseInput, type ActionState } from "@/lib/action";
import { actionUser } from "@/lib/auth/guards";
import { destroyCurrentSession } from "@/lib/auth/session";
import { AppError, pgCode } from "@/lib/errors";
import { normalizeAlgerianMobile } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { attachFiles } from "@/lib/storage";
import * as auth from "@/lib/services/auth";

const profileSchema = z.object({
  fullName: z.string().trim().min(3).max(80),
  displayName: z.string().trim().min(2).max(40),
  phone: z.string().trim().max(20).optional().default(""),
  email: z.string().trim().toLowerCase().max(160).optional().default(""),
  preferredLocale: z.enum(["fr-DZ", "ar-DZ"]),
  avatarFileId: z.string().uuid().optional().or(z.literal("")),
});

export async function updateAccountProfileAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    const input = parseInput(profileSchema, fd);
    const phone = input.phone ? normalizeAlgerianMobile(input.phone) : null;
    if (input.phone && !phone) throw new AppError("validation");
    if (input.email && !z.email().safeParse(input.email).success) throw new AppError("validation");
    if (!phone && !input.email) throw new AppError("validation");
    try {
      await db.transaction(async (tx) => {
        const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id));
        await tx
          .update(schema.users)
          .set({
            phone,
            email: input.email || null,
            // A changed contact is no longer verified
            phoneVerifiedAt: phone === u!.phone ? u!.phoneVerifiedAt : null,
            emailVerifiedAt: (input.email || null) === u!.email ? u!.emailVerifiedAt : null,
          })
          .where(eq(schema.users.id, user.id));
        let avatarFileId: string | undefined;
        if (input.avatarFileId && input.avatarFileId !== user.avatarFileId) {
          await attachFiles(tx, user.id, [input.avatarFileId], "public-avatars", "profile_avatar", user.id);
          avatarFileId = input.avatarFileId;
        }
        await tx
          .update(schema.profiles)
          .set({
            fullName: input.fullName,
            displayName: input.displayName,
            phone,
            email: input.email || null,
            preferredLocale: input.preferredLocale,
            ...(avatarFileId ? { avatarFileId } : {}),
          })
          .where(eq(schema.profiles.id, user.id));
      });
    } catch (err) {
      if (pgCode(err) === "23505") throw new AppError(String(err).includes("phone") ? "phone_taken" : "email_taken");
      throw err;
    }
  });
}

export async function changePasswordAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await rateLimit("password-change", user.id, 5, 3600);
    const input = parseInput(
      z.object({ currentPassword: z.string().min(1), newPassword: auth.passwordSchema, confirm: z.string() }).refine((v) => v.newPassword === v.confirm, {
        path: ["confirm"],
        message: "validation.passwordMatch",
      }),
      fd,
    );
    await auth.changePassword(user, input.currentPassword, input.newPassword, user.sessionId);
  }, "account.passwordChanged");
}

export async function notificationPrefsAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await db
      .update(schema.profiles)
      .set({ notificationPrefs: { email: fd.get("email") === "on", sms: fd.get("sms") === "on", push: fd.get("push") === "on" } })
      .where(eq(schema.profiles.id, user.id));
  });
}

export async function logoutOtherSessionsAction(): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionUser();
    await db
      .update(schema.sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.sessions.userId, user.id), isNull(schema.sessions.revokedAt), ne(schema.sessions.id, user.sessionId)));
  }, "account.sessionsRevoked");
}

export async function requestDeletionAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  let done = false;
  const res = await runAction(async () => {
    const user = await actionUser();
    if (String(fd.get("confirmText") ?? "").trim().toUpperCase() !== "SUPPRIMER") throw new AppError("validation");
    try {
      await auth.requestAccountDeletion(user);
    } catch (e) {
      if (e instanceof AppError && e.code === "address_in_use") throw new AppError("open_bookings");
      throw e;
    }
    done = true;
  });
  if (done) {
    await destroyCurrentSession();
    redirect("/connexion?supprime=1");
  }
  return res;
}
