import { execSync } from "node:child_process";
import postgres from "postgres";

/** Recreates the test database schema from migrations + reference seed (no demo data). */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/khidmati_test";
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql.end();
  const env = { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url };
  execSync("npx tsx scripts/migrate.ts", { env, stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts", { env, stdio: "inherit" });
}
