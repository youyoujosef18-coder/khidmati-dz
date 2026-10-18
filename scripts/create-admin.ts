/**
 * Controlled provisioning of the first super administrator (no public admin signup).
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Prénom Nom" npm run admin:create
 *
 * - If the account does not exist it is created with a strong random one-time
 *   password printed ONCE to this terminal (never logged elsewhere). Change it
 *   at first login (Paramètres → Sécurité).
 * - If it exists, the super_administrator role is granted.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? process.argv[2] ?? "").trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? process.argv[3] ?? "Administrateur Khidmati").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Provide ADMIN_EMAIL=<email>");
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  let userId = existing?.id;
  let password: string | null = null;
  if (!userId) {
    password = randomBytes(12).toString("base64url") + "9a";
    const now = new Date();
    userId = await db.transaction(async (tx) => {
      const [u] = await tx.insert(schema.users).values({ email, passwordHash: await bcrypt.hash(password!, 11) }).returning({ id: schema.users.id });
      await tx.insert(schema.profiles).values({ id: u!.id, fullName: name, displayName: name.split(/\s+/)[0]!, email, termsAcceptedAt: now, privacyAcceptedAt: now });
      return u!.id;
    });
  }
  await db.insert(schema.userRoles).values({ userId, role: "super_administrator" }).onConflictDoNothing();
  await db.insert(schema.auditLogs).values({ actorId: null, action: "role.granted", entityType: "user", entityId: userId, reason: "cli_provisioning", safeMetadata: { role: "super_administrator" } });
  await client.end();
  console.log(`Super administrator ready: ${email}`);
  if (password) console.log(`One-time password (shown once, change it immediately): ${password}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
