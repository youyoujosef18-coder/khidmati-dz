/**
 * DEVELOPMENT / DEMO ONLY. Creates clearly labelled fictional data:
 * users @demo.khidmati.test, technicians named "[DÉMO] …", no reviews.
 * Refuses to run when NODE_ENV=production unless ALLOW_DEMO_SEED=1 (dedicated demo env).
 * Safe to re-run (skips existing demo users).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo12345";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") throw new Error("Refusing to seed demo data in production");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });
  const hash = await bcrypt.hash(PASSWORD, 11);
  const now = new Date();
  const cats = await db.select().from(schema.serviceCategories);
  const cat = (slug: string) => cats.find((c) => c.slug === slug)!;

  async function user(email: string, name: string, phone: string | null, roles: (typeof schema.roleEnum.enumValues)[number][]) {
    const [ex] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    if (ex) return ex.id;
    const [u] = await db.insert(schema.users).values({ email, phone, passwordHash: hash }).returning();
    await db.insert(schema.profiles).values({ id: u!.id, fullName: name, displayName: name.split(" ")[0]!, email, phone, termsAcceptedAt: now, privacyAcceptedAt: now });
    for (const role of roles) await db.insert(schema.userRoles).values({ userId: u!.id, role }).onConflictDoNothing();
    return u!.id;
  }

  await user("admin@demo.khidmati.test", "[DÉMO] Admin", null, ["super_administrator"]);
  await user("support@demo.khidmati.test", "[DÉMO] Agent Support", null, ["support_agent"]);
  await user("client@demo.khidmati.test", "[DÉMO] Samia Client", "+213555000101", ["client"]);

  const techs = [
    { email: "tech1@demo.khidmati.test", name: "[DÉMO] Karim Plombier", phone: "+213555000201", slug: "demo-karim-plomberie", cat: "plomberie", wilaya: "16", commune: "Bab Ezzouar" },
    { email: "tech2@demo.khidmati.test", name: "[DÉMO] Nadia Électricité", phone: "+213555000202", slug: "demo-nadia-electricite", cat: "electricite", wilaya: "16", commune: "Kouba" },
    { email: "tech3@demo.khidmati.test", name: "[DÉMO] Yacine Clim", phone: "+213555000203", slug: "demo-yacine-clim", cat: "climatisation", wilaya: "31", commune: "Oran" },
  ];
  for (const t of techs) {
    const uid = await user(t.email, t.name, t.phone, ["client", "technician"]);
    const [existing] = await db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.userId, uid));
    if (existing) continue;
    const [commune] = await db.select().from(schema.communes).where(and(eq(schema.communes.wilayaCode, t.wilaya), eq(schema.communes.nameFr, t.commune)));
    const [tp] = await db
      .insert(schema.technicianProfiles)
      .values({
        userId: uid, slug: t.slug, publicName: t.name, legalName: t.name,
        bio: "Profil de démonstration fictif, créé pour tester la plateforme. Ne correspond à aucun professionnel réel.",
        experienceYears: 8, primaryCategoryId: cat(t.cat).id, workingLanguages: ["ar", "fr"], baseWilayaCode: t.wilaya, baseCommuneId: commune?.id ?? null,
        verificationStatus: "approved", approvedAt: now, submittedAt: now, emergencyAvailable: true,
      })
      .returning();
    await db.insert(schema.technicianCategories).values({ technicianId: tp!.id, categoryId: cat(t.cat).id, isPrimary: true, approvalStatus: "approved" });
    await db.insert(schema.serviceAreas).values({ technicianId: tp!.id, wilayaCode: t.wilaya, communeId: null });
    await db.insert(schema.technicianAvailability).values([0, 1, 2, 3, 4, 6].map((weekday) => ({ technicianId: tp!.id, weekday, startTime: "08:00", endTime: "18:00" })));
    await db.insert(schema.technicianServices).values([
      { technicianId: tp!.id, categoryId: cat(t.cat).id, title: "[DÉMO] Diagnostic à domicile", pricingModel: "fixed", startingPriceMinor: 150000, estimatedDurationMinutes: 60, approvalStatus: "approved" },
      { technicianId: tp!.id, categoryId: cat(t.cat).id, title: "[DÉMO] Intervention sur devis", pricingModel: "quote_only", startingPriceMinor: null, estimatedDurationMinutes: 120, approvalStatus: "approved" },
    ]);
    await db.insert(schema.verificationReviews).values({ technicianId: tp!.id, previousStatus: "submitted", newStatus: "approved", reason: "demo_seed" });
  }
  await client.end();
  console.log(`Demo data ready. Accounts *@demo.khidmati.test, password: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
