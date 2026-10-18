/**
 * Production-safe, idempotent reference-data seed.
 * - Algerian wilayas & communes (upsert, keeps admin "is_active" choices)
 * - Initial service categories (insert only if the slug does not exist)
 * - Default platform settings (insert only if missing)
 * Never creates users, reviews, bookings or verification claims.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { CATEGORY_SEED } from "../src/db/data/categories";
import { DEFAULT_SETTINGS } from "../src/lib/settings-defaults";

type Geo = {
  wilayas: { code: string; nameFr: string; nameAr: string }[];
  communes: { id: number; wilayaCode: string; nameFr: string; nameAr: string; dairaFr: string; dairaAr: string }[];
};

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });

  const geo = JSON.parse(
    readFileSync(path.join(process.cwd(), "src/db/data/algeria-geo.json"), "utf8"),
  ) as Geo;

  await db
    .insert(schema.wilayas)
    .values(geo.wilayas)
    .onConflictDoUpdate({
      target: schema.wilayas.code,
      set: { nameFr: sql`excluded.name_fr`, nameAr: sql`excluded.name_ar` },
    });

  for (let i = 0; i < geo.communes.length; i += 500) {
    await db
      .insert(schema.communes)
      .values(geo.communes.slice(i, i + 500))
      .onConflictDoUpdate({
        target: schema.communes.id,
        set: {
          nameFr: sql`excluded.name_fr`,
          nameAr: sql`excluded.name_ar`,
          dairaFr: sql`excluded.daira_fr`,
          dairaAr: sql`excluded.daira_ar`,
          wilayaCode: sql`excluded.wilaya_code`,
        },
      });
  }

  await db
    .insert(schema.serviceCategories)
    .values(CATEGORY_SEED.map((c, i) => ({ ...c, sortOrder: (i + 1) * 10 })))
    .onConflictDoNothing({ target: schema.serviceCategories.slug });

  await db
    .insert(schema.platformSettings)
    .values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })))
    .onConflictDoNothing({ target: schema.platformSettings.key });

  const [{ w }] = await client`select count(*)::int as w from wilayas`;
  const [{ c }] = await client`select count(*)::int as c from communes`;
  const [{ k }] = await client`select count(*)::int as k from service_categories`;
  console.log(`Seed complete: ${w} wilayas, ${c} communes, ${k} categories.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
