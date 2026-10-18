"use server";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";

export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return { ok: false };
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) {
    await db.update(schema.profiles).set({ preferredLocale: locale }).where(eq(schema.profiles.id, user.id));
  }
  return { ok: true };
}
