import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/db";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { daToMinor } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
import { notify, scheduleDispatch } from "@/lib/notify";
import { getSettings } from "@/lib/settings";
import { assertVerificationTransition, type VerificationStatus } from "@/lib/domain/state-machines";
import { randomToken } from "@/lib/crypto";
import { attachFiles } from "@/lib/storage";
import type { Actor } from "./types";

export type TechnicianProfile = typeof schema.technicianProfiles.$inferSelect;

export async function getTechnicianForUser(userId: string, tx: DbOrTx = db) {
  const [tp] = await tx.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.userId, userId)).limit(1);
  return tp ?? null;
}

export async function requireTechnician(actor: Actor, tx: DbOrTx = db) {
  const tp = await getTechnicianForUser(actor.id, tx);
  if (!tp) throw new AppError("forbidden", 403);
  return tp;
}

export async function requireApprovedTechnician(actor: Actor, tx: DbOrTx = db) {
  const tp = await requireTechnician(actor, tx);
  if (tp.verificationStatus !== "approved") throw new AppError("technician_not_approved", 403);
  return tp;
}

async function uniqueSlug(base: string, tx: DbOrTx) {
  const root = slugify(base) || "technicien";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? root : `${root}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const [hit] = await tx
      .select({ id: schema.technicianProfiles.id })
      .from(schema.technicianProfiles)
      .where(eq(schema.technicianProfiles.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Starts the technician journey for an existing account (no duplicate identity). */
export async function ensureTechnicianProfile(actor: Actor, fullName: string) {
  const existing = await getTechnicianForUser(actor.id);
  if (existing) return existing;
  return db.transaction(async (tx) => {
    const slug = await uniqueSlug(fullName, tx);
    const [tp] = await tx
      .insert(schema.technicianProfiles)
      .values({ userId: actor.id, slug, publicName: fullName, legalName: fullName })
      .onConflictDoNothing({ target: schema.technicianProfiles.userId })
      .returning();
    await tx
      .insert(schema.userRoles)
      .values({ userId: actor.id, role: "technician" })
      .onConflictDoNothing();
    // Default weekly hours: Sunday–Thursday 08:00–17:00 (editable)
    if (tp) {
      await tx.insert(schema.technicianAvailability).values(
        [0, 1, 2, 3, 4].map((weekday) => ({ technicianId: tp.id, weekday, startTime: "08:00", endTime: "17:00" })),
      );
      await writeAudit({ actorId: actor.id, action: "technician.profile_created", entityType: "technician_profile", entityId: tp.id }, tx);
    }
    return tp ?? (await getTechnicianForUser(actor.id, tx))!;
  });
}

/* ------------------------------ Profile ------------------------------ */

export const profileSchema = z.object({
  legalName: z.string().trim().min(3).max(100),
  publicName: z.string().trim().min(2).max(60),
  bio: z.string().trim().min(30).max(2000),
  experienceYears: z.coerce.number().int().min(0).max(70),
  workingLanguages: z.array(z.enum(["fr", "ar", "kab", "en"])).min(1).max(4),
  serviceTerms: z.string().trim().max(1500).optional().default(""),
  avatarFileId: z.string().uuid().optional().or(z.literal("")),
});

/** Fields whose change on an approved profile triggers re-verification. */
const SENSITIVE_FIELDS = ["legalName"] as const;

export async function updateTechnicianProfile(actor: Actor, input: z.infer<typeof profileSchema>) {
  const tp = await requireTechnician(actor);
  await db.transaction(async (tx) => {
    let avatarFileId = tp.avatarFileId;
    if (input.avatarFileId && input.avatarFileId !== tp.avatarFileId) {
      await attachFiles(tx, actor.id, [input.avatarFileId], "public-avatars", "technician_avatar", tp.id);
      avatarFileId = input.avatarFileId;
    }
    const sensitiveChanged = SENSITIVE_FIELDS.some((f) => input[f] !== tp[f]);
    const needsReverification = tp.verificationStatus === "approved" && sensitiveChanged;
    await tx
      .update(schema.technicianProfiles)
      .set({
        legalName: input.legalName,
        publicName: input.publicName,
        bio: input.bio,
        experienceYears: input.experienceYears,
        workingLanguages: input.workingLanguages,
        serviceTerms: input.serviceTerms ?? "",
        avatarFileId,
        ...(needsReverification ? { verificationStatus: "submitted" as const, submittedAt: new Date() } : {}),
      })
      .where(eq(schema.technicianProfiles.id, tp.id));
    if (needsReverification) {
      await tx.insert(schema.verificationReviews).values({
        technicianId: tp.id,
        previousStatus: "approved",
        newStatus: "submitted",
        actorId: actor.id,
        reason: "sensitive_profile_change",
      });
    }
  });
}

/* ------------------------- Categories & areas ------------------------ */

export const areasSchema = z.object({
  primaryCategoryId: z.string().uuid(),
  additionalCategoryIds: z.array(z.string().uuid()).max(5).optional().default([]),
  baseWilayaCode: z.string().regex(/^\d{2}$/),
  baseCommuneId: z.coerce.number().int().positive(),
  travelRadiusKm: z.coerce.number().int().min(0).max(200),
  emergencyAvailable: z.union([z.literal("on"), z.literal("")]).optional(),
  zones: z
    .array(z.object({ wilayaCode: z.string().regex(/^\d{2}$/), communeIds: z.array(z.coerce.number().int().positive()).max(60) }))
    .min(1)
    .max(10),
});

export async function setCategoriesAndAreas(actor: Actor, input: z.infer<typeof areasSchema>) {
  const tp = await requireTechnician(actor);
  const categoryIds = Array.from(new Set([input.primaryCategoryId, ...input.additionalCategoryIds]));
  await db.transaction(async (tx) => {
    const cats = await tx
      .select({ id: schema.serviceCategories.id })
      .from(schema.serviceCategories)
      .where(and(inArray(schema.serviceCategories.id, categoryIds), eq(schema.serviceCategories.isActive, true)));
    if (cats.length !== categoryIds.length) throw new AppError("validation");

    // Validate geography: commune belongs to wilaya
    const allCommunes = [input.baseCommuneId, ...input.zones.flatMap((z) => z.communeIds)];
    const communeRows = allCommunes.length
      ? await tx
          .select({ id: schema.communes.id, wilayaCode: schema.communes.wilayaCode })
          .from(schema.communes)
          .where(inArray(schema.communes.id, allCommunes))
      : [];
    const byId = new Map(communeRows.map((c) => [c.id, c.wilayaCode]));
    if (byId.get(input.baseCommuneId) !== input.baseWilayaCode) throw new AppError("not_found");
    for (const z of input.zones) for (const c of z.communeIds) if (byId.get(c) !== z.wilayaCode) throw new AppError("not_found");

    const existing = await tx
      .select()
      .from(schema.technicianCategories)
      .where(eq(schema.technicianCategories.technicianId, tp.id));
    const existingMap = new Map(existing.map((e) => [e.categoryId, e]));
    // Remove categories no longer selected
    const removed = existing.filter((e) => !categoryIds.includes(e.categoryId)).map((e) => e.categoryId);
    if (removed.length) {
      await tx
        .delete(schema.technicianCategories)
        .where(and(eq(schema.technicianCategories.technicianId, tp.id), inArray(schema.technicianCategories.categoryId, removed)));
    }
    for (const categoryId of categoryIds) {
      const isPrimary = categoryId === input.primaryCategoryId;
      const prev = existingMap.get(categoryId);
      if (prev) {
        await tx
          .update(schema.technicianCategories)
          .set({ isPrimary })
          .where(and(eq(schema.technicianCategories.technicianId, tp.id), eq(schema.technicianCategories.categoryId, categoryId)));
      } else {
        // New categories need validation; before first approval, they are reviewed with the application.
        await tx.insert(schema.technicianCategories).values({ technicianId: tp.id, categoryId, isPrimary, approvalStatus: "pending" });
      }
    }

    await tx.delete(schema.serviceAreas).where(eq(schema.serviceAreas.technicianId, tp.id));
    const areaRows: (typeof schema.serviceAreas.$inferInsert)[] = input.zones.flatMap((z): (typeof schema.serviceAreas.$inferInsert)[] =>
      z.communeIds.length
        ? z.communeIds.map((communeId) => ({ technicianId: tp.id, wilayaCode: z.wilayaCode, communeId }))
        : [{ technicianId: tp.id, wilayaCode: z.wilayaCode, communeId: null }],
    );
    await tx.insert(schema.serviceAreas).values(areaRows);

    await tx
      .update(schema.technicianProfiles)
      .set({
        primaryCategoryId: input.primaryCategoryId,
        baseWilayaCode: input.baseWilayaCode,
        baseCommuneId: input.baseCommuneId,
        travelRadiusKm: input.travelRadiusKm,
        emergencyAvailable: input.emergencyAvailable === "on",
      })
      .where(eq(schema.technicianProfiles.id, tp.id));
  });
}

/* ------------------------------ Services ----------------------------- */

export const serviceSchema = z
  .object({
    id: z.string().uuid().optional().or(z.literal("")),
    categoryId: z.string().uuid(),
    title: z.string().trim().min(4).max(100),
    description: z.string().trim().max(1000).optional().default(""),
    pricingModel: z.enum(["fixed", "starting_at", "hourly", "estimate", "quote_only"]),
    priceDa: z.string().trim().optional().default(""),
    estimatedDurationMinutes: z.coerce.number().int().min(15).max(600),
  })
  .superRefine((v, ctx) => {
    if (v.pricingModel !== "quote_only") {
      if (!/^\d{1,7}$/.test(v.priceDa.replace(/\s/g, "")))
        ctx.addIssue({ code: "custom", path: ["priceDa"], message: "validation.amount" });
    }
  });

export async function upsertService(actor: Actor, input: z.infer<typeof serviceSchema>) {
  const tp = await requireTechnician(actor);
  const [cat] = await db
    .select()
    .from(schema.technicianCategories)
    .where(and(eq(schema.technicianCategories.technicianId, tp.id), eq(schema.technicianCategories.categoryId, input.categoryId)));
  if (!cat) throw new AppError("service_not_available");
  const priceMinor = input.pricingModel === "quote_only" ? null : daToMinor(Number(input.priceDa.replace(/\s/g, "")));
  const values = {
    categoryId: input.categoryId,
    title: input.title,
    description: input.description ?? "",
    pricingModel: input.pricingModel,
    startingPriceMinor: priceMinor,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
  };
  if (input.id) {
    const [svc] = await db
      .select()
      .from(schema.technicianServices)
      .where(and(eq(schema.technicianServices.id, input.id), eq(schema.technicianServices.technicianId, tp.id)));
    if (!svc) throw new AppError("not_found", 404);
    // Any change to a service requires renewed approval once the profile is public.
    await db
      .update(schema.technicianServices)
      .set({ ...values, approvalStatus: tp.verificationStatus === "approved" ? "pending" : svc.approvalStatus, moderationReason: null })
      .where(eq(schema.technicianServices.id, svc.id));
    return svc.id;
  }
  const [row] = await db
    .insert(schema.technicianServices)
    .values({ ...values, technicianId: tp.id, approvalStatus: "pending" })
    .returning({ id: schema.technicianServices.id });
  return row!.id;
}

export async function setServiceActive(actor: Actor, serviceId: string, active: boolean) {
  const tp = await requireTechnician(actor);
  const res = await db
    .update(schema.technicianServices)
    .set({ isActive: active })
    .where(and(eq(schema.technicianServices.id, serviceId), eq(schema.technicianServices.technicianId, tp.id)))
    .returning({ id: schema.technicianServices.id });
  if (!res.length) throw new AppError("not_found", 404);
}

export async function deleteService(actor: Actor, serviceId: string) {
  const tp = await requireTechnician(actor);
  const [used] = await db.select({ id: schema.bookings.id }).from(schema.bookings).where(eq(schema.bookings.serviceId, serviceId)).limit(1);
  const [usedReq] = await db
    .select({ id: schema.serviceRequests.id })
    .from(schema.serviceRequests)
    .where(eq(schema.serviceRequests.serviceId, serviceId))
    .limit(1);
  if (used || usedReq) {
    await setServiceActive(actor, serviceId, false);
    return;
  }
  const res = await db
    .delete(schema.technicianServices)
    .where(and(eq(schema.technicianServices.id, serviceId), eq(schema.technicianServices.technicianId, tp.id)))
    .returning({ id: schema.technicianServices.id });
  if (!res.length) throw new AppError("not_found", 404);
}

/* ---------------------------- Availability --------------------------- */

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const availabilitySchema = z.object({
  slots: z
    .array(z.object({ weekday: z.coerce.number().int().min(0).max(6), startTime: hhmm, endTime: hhmm }))
    .max(21)
    .superRefine((slots, ctx) => {
      slots.forEach((s, i) => {
        if (s.endTime <= s.startTime) ctx.addIssue({ code: "custom", path: [i, "endTime"], message: "validation.timeRange" });
      });
    }),
  defaultDurationMinutes: z.coerce.number().int().min(15).max(600),
  travelBufferMinutes: z.coerce.number().int().min(0).max(240),
  maxDailyJobs: z.coerce.number().int().min(1).max(20),
  availabilityStatus: z.enum(["available", "unavailable", "vacation"]),
});

export async function setAvailability(actor: Actor, input: z.infer<typeof availabilitySchema>) {
  const tp = await requireTechnician(actor);
  await db.transaction(async (tx) => {
    await tx.delete(schema.technicianAvailability).where(eq(schema.technicianAvailability.technicianId, tp.id));
    if (input.slots.length) {
      await tx.insert(schema.technicianAvailability).values(input.slots.map((s) => ({ ...s, technicianId: tp.id })));
    }
    await tx
      .update(schema.technicianProfiles)
      .set({
        defaultDurationMinutes: input.defaultDurationMinutes,
        travelBufferMinutes: input.travelBufferMinutes,
        maxDailyJobs: input.maxDailyJobs,
        availabilityStatus: input.availabilityStatus,
      })
      .where(eq(schema.technicianProfiles.id, tp.id));
  });
}

export const exceptionSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    exceptionType: z.enum(["blocked", "vacation", "break"]),
    reason: z.string().trim().max(200).optional().default(""),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "validation.timeRange" });

export async function addException(actor: Actor, input: z.infer<typeof exceptionSchema>) {
  const tp = await requireTechnician(actor);
  const startsAt = new Date(`${input.startDate}T00:00:00+01:00`);
  const endsAt = new Date(new Date(`${input.endDate}T00:00:00+01:00`).getTime() + 86400_000);
  await db.insert(schema.availabilityExceptions).values({
    technicianId: tp.id,
    startsAt,
    endsAt,
    exceptionType: input.exceptionType,
    reason: input.reason || null,
  });
}

export async function removeException(actor: Actor, id: string) {
  const tp = await requireTechnician(actor);
  await db
    .delete(schema.availabilityExceptions)
    .where(and(eq(schema.availabilityExceptions.id, id), eq(schema.availabilityExceptions.technicianId, tp.id)));
}

/* ------------------------------ Documents ---------------------------- */

export async function addDocument(actor: Actor, documentType: (typeof schema.documentTypeEnum.enumValues)[number], fileId: string) {
  const tp = await requireTechnician(actor);
  await db.transaction(async (tx) => {
    await attachFiles(tx, actor.id, [fileId], "technician-verification", "technician_document", tp.id);
    await tx.insert(schema.technicianDocuments).values({ technicianId: tp.id, documentType, fileId });
  });
}

export async function removeDocument(actor: Actor, documentId: string) {
  const tp = await requireTechnician(actor);
  await db.transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(schema.technicianDocuments)
      .where(and(eq(schema.technicianDocuments.id, documentId), eq(schema.technicianDocuments.technicianId, tp.id)));
    if (!doc) throw new AppError("not_found", 404);
    if (doc.reviewStatus === "approved" && tp.verificationStatus === "approved") throw new AppError("forbidden", 403);
    await tx.delete(schema.technicianDocuments).where(eq(schema.technicianDocuments.id, doc.id));
    await tx.delete(schema.files).where(eq(schema.files.id, doc.fileId));
  });
}

export async function addPortfolioItem(actor: Actor, fileId: string, caption: string) {
  const tp = await requireTechnician(actor);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.portfolioItems)
    .where(eq(schema.portfolioItems.technicianId, tp.id));
  if (count >= 12) throw new AppError("too_many_files");
  await db.transaction(async (tx) => {
    await attachFiles(tx, actor.id, [fileId], "portfolio", "portfolio", tp.id);
    await tx.insert(schema.portfolioItems).values({ technicianId: tp.id, fileId, caption: caption.slice(0, 140) || null });
  });
}

export async function removePortfolioItem(actor: Actor, itemId: string) {
  const tp = await requireTechnician(actor);
  const [item] = await db
    .delete(schema.portfolioItems)
    .where(and(eq(schema.portfolioItems.id, itemId), eq(schema.portfolioItems.technicianId, tp.id)))
    .returning();
  if (item) await db.delete(schema.files).where(eq(schema.files.id, item.fileId));
}

/* ----------------------------- Completeness -------------------------- */

export interface Completeness {
  missing: string[];
  percent: number;
}

export async function getCompleteness(tp: TechnicianProfile): Promise<Completeness> {
  const settings = await getSettings();
  const [areas, services, slots, docs, user] = await Promise.all([
    db.select({ id: schema.serviceAreas.id }).from(schema.serviceAreas).where(eq(schema.serviceAreas.technicianId, tp.id)).limit(1),
    db
      .select({ id: schema.technicianServices.id })
      .from(schema.technicianServices)
      .where(and(eq(schema.technicianServices.technicianId, tp.id), eq(schema.technicianServices.isActive, true)))
      .limit(1),
    db.select({ id: schema.technicianAvailability.id }).from(schema.technicianAvailability).where(eq(schema.technicianAvailability.technicianId, tp.id)).limit(1),
    db.select({ type: schema.technicianDocuments.documentType }).from(schema.technicianDocuments).where(eq(schema.technicianDocuments.technicianId, tp.id)),
    db.select({ phone: schema.users.phone }).from(schema.users).where(eq(schema.users.id, tp.userId)),
  ]);
  const checks: [string, boolean][] = [
    ["photo", Boolean(tp.avatarFileId)],
    ["bio", tp.bio.trim().length >= 30],
    ["category", Boolean(tp.primaryCategoryId)],
    ["zones", areas.length > 0],
    ["services", services.length > 0],
    ["availability", slots.length > 0],
    ["phone", Boolean(user[0]?.phone)],
  ];
  if (settings.verification_requirements.requireIdentityDocument)
    checks.push(["identity", docs.some((d) => ["identity_card", "passport", "driving_license"].includes(d.type))]);
  if (settings.verification_requirements.requireQualificationDocument)
    checks.push(["qualification", docs.some((d) => ["artisan_card", "qualification", "business_registration"].includes(d.type))]);
  const missing = checks.filter(([, ok]) => !ok).map(([k]) => k);
  return { missing, percent: Math.round(((checks.length - missing.length) / checks.length) * 100) };
}

/* ------------------------- Application workflow ---------------------- */

async function staffRecipients(tx: DbOrTx, roles: ("administrator" | "super_administrator" | "support_agent")[]) {
  const rows = await tx
    .selectDistinct({ userId: schema.userRoles.userId })
    .from(schema.userRoles)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.userRoles.userId))
    .where(and(inArray(schema.userRoles.role, roles), eq(schema.profiles.accountStatus, "active")));
  return rows.map((r) => r.userId);
}
export { staffRecipients };

export async function submitApplication(actor: Actor) {
  const tp = await requireTechnician(actor);
  const completeness = await getCompleteness(tp);
  if (completeness.missing.length) {
    throw new AppError("profile_incomplete", 400, { missing: completeness.missing.join(", ") });
  }
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(schema.technicianProfiles)
      .where(eq(schema.technicianProfiles.id, tp.id))
      .for("update");
    const from = locked!.verificationStatus as VerificationStatus;
    if (from === "submitted" || from === "under_review") return; // idempotent
    assertVerificationTransition(from, "submitted", "technician");
    await tx
      .update(schema.technicianProfiles)
      .set({ verificationStatus: "submitted", submittedAt: new Date() })
      .where(eq(schema.technicianProfiles.id, tp.id));
    await tx.insert(schema.verificationReviews).values({
      technicianId: tp.id,
      previousStatus: from,
      newStatus: "submitted",
      actorId: actor.id,
    });
    for (const uid of await staffRecipients(tx, ["administrator", "super_administrator"])) {
      await notify(
        { userId: uid, type: "application_submitted", params: { name: locked!.publicName }, link: `/admin/verification/${tp.id}`, dedupeKey: `app:${tp.id}:${Date.now()}` },
        tx,
      );
    }
  });
  await scheduleDispatch();
}

export const decisionSchema = z.object({
  technicianId: z.string().uuid(),
  decision: z.enum(["under_review", "approved", "rejected", "additional_information_required", "suspended"]),
  reason: z.string().trim().max(1000).optional().default(""),
  checklist: z.record(z.string(), z.string()).optional(),
  approveCategoryIds: z.array(z.string().uuid()).optional().default([]),
});

/** Administrator decision on a technician application (audited, notified). */
export async function decideApplication(staff: Actor, input: z.infer<typeof decisionSchema>) {
  if (["rejected", "additional_information_required", "suspended"].includes(input.decision) && !input.reason) {
    throw new AppError("validation", 400);
  }
  await db.transaction(async (tx) => {
    const [tp] = await tx
      .select()
      .from(schema.technicianProfiles)
      .where(eq(schema.technicianProfiles.id, input.technicianId))
      .for("update");
    if (!tp) throw new AppError("not_found", 404);
    if (tp.userId === staff.id) throw new AppError("self_action");
    const from = tp.verificationStatus as VerificationStatus;
    assertVerificationTransition(from, input.decision, "staff");

    const now = new Date();
    await tx
      .update(schema.technicianProfiles)
      .set({
        verificationStatus: input.decision,
        ...(input.decision === "approved" ? { approvedAt: now } : {}),
      })
      .where(eq(schema.technicianProfiles.id, tp.id));

    const checklist = input.checklist
      ? Object.fromEntries(Object.entries(input.checklist).map(([k, v]) => [k, v === "on"]))
      : null;
    await tx.insert(schema.verificationReviews).values({
      technicianId: tp.id,
      previousStatus: from,
      newStatus: input.decision,
      actorId: staff.id,
      reason: input.reason || null,
      checklist,
    });

    if (input.decision === "approved") {
      // Approve the selected categories (the primary category is always approved with the profile)
      const ids = Array.from(new Set([...(input.approveCategoryIds ?? []), ...(tp.primaryCategoryId ? [tp.primaryCategoryId] : [])]));
      if (ids.length) {
        await tx
          .update(schema.technicianCategories)
          .set({ approvalStatus: "approved" })
          .where(and(eq(schema.technicianCategories.technicianId, tp.id), inArray(schema.technicianCategories.categoryId, ids)));
      }
      // Pending services in approved categories become visible
      await tx.execute(sql`
        UPDATE technician_services s SET approval_status = 'approved'
        WHERE s.technician_id = ${tp.id} AND s.approval_status = 'pending'
          AND EXISTS (SELECT 1 FROM technician_categories c WHERE c.technician_id = s.technician_id
                      AND c.category_id = s.category_id AND c.approval_status = 'approved')`);
      await tx
        .update(schema.technicianDocuments)
        .set({ reviewStatus: "approved", reviewedBy: staff.id, reviewedAt: now })
        .where(and(eq(schema.technicianDocuments.technicianId, tp.id), eq(schema.technicianDocuments.reviewStatus, "pending")));
    }
    if (input.decision === "rejected") {
      await tx
        .update(schema.technicianDocuments)
        .set({ reviewStatus: "rejected", reviewReason: input.reason, reviewedBy: staff.id, reviewedAt: now })
        .where(and(eq(schema.technicianDocuments.technicianId, tp.id), eq(schema.technicianDocuments.reviewStatus, "pending")));
    }

    await writeAudit(
      {
        actorId: staff.id,
        action: `verification.${input.decision}`,
        entityType: "technician_profile",
        entityId: tp.id,
        reason: input.reason || null,
        meta: { from, to: input.decision },
      },
      tx,
    );

    const typeMap = {
      approved: "verification_approved",
      rejected: "verification_rejected",
      additional_information_required: "verification_info_required",
      suspended: "verification_suspended",
    } as const;
    if (input.decision !== "under_review") {
      await notify(
        {
          userId: tp.userId,
          type: typeMap[input.decision],
          params: { reason: input.reason || "—" },
          link: "/technicien/verification",
        },
        tx,
      );
    }
  });
  await scheduleDispatch();
}

export async function setCategoryApproval(staff: Actor, technicianId: string, categoryId: string, status: "approved" | "rejected") {
  await db
    .update(schema.technicianCategories)
    .set({ approvalStatus: status })
    .where(and(eq(schema.technicianCategories.technicianId, technicianId), eq(schema.technicianCategories.categoryId, categoryId)));
  if (status === "approved") {
    await db.execute(sql`UPDATE technician_services SET approval_status = 'approved'
      WHERE technician_id = ${technicianId} AND category_id = ${categoryId} AND approval_status = 'pending'`);
  }
  await writeAudit({ actorId: staff.id, action: `verification.category_${status}`, entityType: "technician_profile", entityId: technicianId, meta: { categoryId } });
}

export async function moderateService(staff: Actor, serviceId: string, status: "approved" | "rejected", reason: string) {
  if (status === "rejected" && !reason) throw new AppError("validation", 400);
  await db.transaction(async (tx) => {
    const [svc] = await tx
      .update(schema.technicianServices)
      .set({ approvalStatus: status, moderationReason: status === "rejected" ? reason : null })
      .where(eq(schema.technicianServices.id, serviceId))
      .returning();
    if (!svc) throw new AppError("not_found", 404);
    const [tp] = await tx.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, svc.technicianId));
    if (status === "approved") {
      // Approving a service also approves its category for this technician
      await tx
        .update(schema.technicianCategories)
        .set({ approvalStatus: "approved" })
        .where(and(eq(schema.technicianCategories.technicianId, svc.technicianId), eq(schema.technicianCategories.categoryId, svc.categoryId)));
    }
    await writeAudit({ actorId: staff.id, action: `service.${status}`, entityType: "technician_service", entityId: svc.id, reason }, tx);
    await notify(
      {
        userId: tp!.userId,
        type: status === "approved" ? "service_approved" : "service_rejected",
        params: { title: svc.title, reason: reason || "—" },
        link: "/technicien/services",
      },
      tx,
    );
  });
}

export async function moderatePortfolio(staff: Actor, itemId: string, status: "published" | "hidden", reason: string) {
  await db.update(schema.portfolioItems).set({ moderationStatus: status }).where(eq(schema.portfolioItems.id, itemId));
  await writeAudit({ actorId: staff.id, action: `portfolio.${status}`, entityType: "portfolio_item", entityId: itemId, reason });
}

/* ------------------------------ Reads -------------------------------- */

export async function getTechnicianWorkspace(tp: TechnicianProfile) {
  const [categories, areas, services, weekly, exceptions, documents, portfolio, history] = await Promise.all([
    db
      .select({
        categoryId: schema.technicianCategories.categoryId,
        isPrimary: schema.technicianCategories.isPrimary,
        approvalStatus: schema.technicianCategories.approvalStatus,
        nameFr: schema.serviceCategories.nameFr,
        nameAr: schema.serviceCategories.nameAr,
      })
      .from(schema.technicianCategories)
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.technicianCategories.categoryId))
      .where(eq(schema.technicianCategories.technicianId, tp.id)),
    db
      .select({
        id: schema.serviceAreas.id,
        wilayaCode: schema.serviceAreas.wilayaCode,
        communeId: schema.serviceAreas.communeId,
        wilayaFr: schema.wilayas.nameFr,
        wilayaAr: schema.wilayas.nameAr,
        communeFr: schema.communes.nameFr,
        communeAr: schema.communes.nameAr,
      })
      .from(schema.serviceAreas)
      .innerJoin(schema.wilayas, eq(schema.wilayas.code, schema.serviceAreas.wilayaCode))
      .leftJoin(schema.communes, eq(schema.communes.id, schema.serviceAreas.communeId))
      .where(eq(schema.serviceAreas.technicianId, tp.id))
      .orderBy(asc(schema.serviceAreas.wilayaCode)),
    db
      .select()
      .from(schema.technicianServices)
      .where(eq(schema.technicianServices.technicianId, tp.id))
      .orderBy(desc(schema.technicianServices.createdAt)),
    db
      .select()
      .from(schema.technicianAvailability)
      .where(eq(schema.technicianAvailability.technicianId, tp.id))
      .orderBy(asc(schema.technicianAvailability.weekday), asc(schema.technicianAvailability.startTime)),
    db
      .select()
      .from(schema.availabilityExceptions)
      .where(and(eq(schema.availabilityExceptions.technicianId, tp.id), sql`${schema.availabilityExceptions.endsAt} > now()`))
      .orderBy(asc(schema.availabilityExceptions.startsAt)),
    db
      .select({
        id: schema.technicianDocuments.id,
        documentType: schema.technicianDocuments.documentType,
        reviewStatus: schema.technicianDocuments.reviewStatus,
        reviewReason: schema.technicianDocuments.reviewReason,
        fileId: schema.technicianDocuments.fileId,
        createdAt: schema.technicianDocuments.createdAt,
      })
      .from(schema.technicianDocuments)
      .where(eq(schema.technicianDocuments.technicianId, tp.id))
      .orderBy(desc(schema.technicianDocuments.createdAt)),
    db
      .select()
      .from(schema.portfolioItems)
      .where(eq(schema.portfolioItems.technicianId, tp.id))
      .orderBy(desc(schema.portfolioItems.createdAt)),
    db
      .select()
      .from(schema.verificationReviews)
      .where(eq(schema.verificationReviews.technicianId, tp.id))
      .orderBy(desc(schema.verificationReviews.createdAt)),
  ]);
  return { categories, areas, services, weekly, exceptions, documents, portfolio, history };
}
