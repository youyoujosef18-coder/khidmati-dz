import "server-only";
import { cache } from "react";
import { db, schema } from "@/db";
import { DEFAULT_SETTINGS, type PlatformSettings } from "./settings-defaults";

export const getSettings = cache(async (): Promise<PlatformSettings> => {
  if (!process.env.DATABASE_URL) return DEFAULT_SETTINGS;
  const rows = await db.select().from(schema.platformSettings);
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const def = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[row.key];
    if (def && typeof def === "object" && !Array.isArray(def) && row.value && typeof row.value === "object") {
      merged[row.key] = { ...(def as object), ...(row.value as object) };
    } else if (def !== undefined) {
      merged[row.key] = row.value;
    }
  }
  return merged as unknown as PlatformSettings;
});
