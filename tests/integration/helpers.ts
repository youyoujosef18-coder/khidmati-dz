import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { registerUser } from "@/lib/services/auth";
import type { Actor } from "@/lib/services/types";
import { addDocument, decideApplication, ensureTechnicianProfile, setAvailability, setCategoriesAndAreas, submitApplication, updateTechnicianProfile, upsertService } from "@/lib/services/technicians";
import { storeUpload } from "@/lib/storage";
import sharp from "sharp";

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function roles(userId: string) {
  return (await db.select({ role: schema.userRoles.role }).from(schema.userRoles).where(eq(schema.userRoles.userId, userId))).map((r) => r.role);
}
export async function actor(userId: string): Promise<Actor> {
  return { id: userId, roles: await roles(userId) };
}

export async function makeClient(name = "Client Test"): Promise<Actor> {
  const n = uniq();
  const phone = `+21355${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  const { userId } = await registerUser({ fullName: name, email: `c${n}@test.khidmati`, phone, password: "Password1", preferredLocale: "fr-DZ", acceptTerms: "on" });
  return actor(userId);
}

export async function makeStaff(role: "support_agent" | "administrator" | "super_administrator"): Promise<Actor> {
  const c = await makeClient(`Staff ${role}`);
  await db.insert(schema.userRoles).values({ userId: c.id, role });
  return actor(c.id);
}

export async function category(slug = "plomberie") {
  const [c] = await db.select().from(schema.serviceCategories).where(eq(schema.serviceCategories.slug, slug));
  return c!;
}
export async function commune(wilaya = "16", name = "Bab Ezzouar") {
  const [c] = await db.select().from(schema.communes).where(and(eq(schema.communes.wilayaCode, wilaya), eq(schema.communes.nameFr, name)));
  return c!;
}

export async function pngBuffer() {
  return sharp({ create: { width: 40, height: 40, channels: 3, background: "#146B52" } }).png().toBuffer();
}

/** Full technician journey up to approval by an administrator. */
export async function makeApprovedTechnician(admin: Actor, opts: { slug?: string; wilaya?: string; communeName?: string; fixedPriceDa?: number } = {}) {
  const base = await makeClient("Tech Test");
  await ensureTechnicianProfile(base, "Tech Test");
  const tech = await actor(base.id);
  const avatar = await storeUpload({ ownerId: tech.id, bucket: "public-avatars", data: await pngBuffer() });
  await updateTechnicianProfile(tech, {
    legalName: "Tech Test Légal",
    publicName: `Tech ${uniq()}`,
    bio: "Plombier expérimenté, interventions rapides et soignées à domicile.",
    experienceYears: 7,
    workingLanguages: ["fr", "ar"],
    serviceTerms: "",
    avatarFileId: avatar.id,
  });
  const cat = await category(opts.slug ?? "plomberie");
  const com = await commune(opts.wilaya ?? "16", opts.communeName ?? "Bab Ezzouar");
  await setCategoriesAndAreas(tech, {
    primaryCategoryId: cat.id,
    additionalCategoryIds: [],
    baseWilayaCode: com.wilayaCode,
    baseCommuneId: com.id,
    travelRadiusKm: 15,
    zones: [{ wilayaCode: com.wilayaCode, communeIds: [] }],
  });
  await upsertService(tech, {
    categoryId: cat.id,
    title: "Réparation de fuite",
    description: "",
    pricingModel: opts.fixedPriceDa ? "fixed" : "starting_at",
    priceDa: String(opts.fixedPriceDa ?? 2000),
    estimatedDurationMinutes: 60,
  });
  await setAvailability(tech, {
    slots: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "07:00", endTime: "21:00" })),
    defaultDurationMinutes: 60,
    travelBufferMinutes: 0,
    maxDailyJobs: 10,
    availabilityStatus: "available",
  });
  const doc = await storeUpload({ ownerId: tech.id, bucket: "technician-verification", data: await pngBuffer() });
  await addDocument(tech, "identity_card", doc.id);
  await submitApplication(tech);
  const [tp] = await db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.userId, tech.id));
  await decideApplication(admin, { technicianId: tp!.id, decision: "approved", reason: "", approveCategoryIds: [] });
  const [approved] = await db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, tp!.id));
  const [svc] = await db.select().from(schema.technicianServices).where(eq(schema.technicianServices.technicianId, tp!.id));
  return { tech, tp: approved!, service: svc!, commune: com, category: cat };
}

export async function makeAddress(client: Actor, wilaya = "16", communeName = "Bab Ezzouar") {
  const com = await commune(wilaya, communeName);
  const [a] = await db
    .insert(schema.clientAddresses)
    .values({ clientId: client.id, label: "Maison", wilayaCode: com.wilayaCode, communeId: com.id, addressLine: "12 rue des Oliviers, Bât B", isDefault: true })
    .returning();
  return a!;
}

/** A future local date string (YYYY-MM-DD) N days ahead in Algeria time. */
export function futureDate(days: number) {
  return new Date(Date.now() + 3600_000 + days * 86400_000).toISOString().slice(0, 10);
}
export const key = () => `idem-${uniq()}-${Math.random().toString(36).slice(2)}`;
