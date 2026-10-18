import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/db";
import { AppError, pgCode, pgConstraint } from "@/lib/errors";
import { makeReference } from "@/lib/crypto";
import { addDays, algeriaLocalToUtc, todayInAlgeria, TIME_WINDOWS } from "@/lib/time";
import { daToMinor } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { notify, scheduleDispatch } from "@/lib/notify";
import { attachFiles } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { assertRequestTransition, type RequestStatus } from "@/lib/domain/state-machines";
import type { Actor } from "./types";

export const createRequestSchema = z.object({
  idempotencyKey: z.string().min(8).max(64),
  categoryId: z.string().uuid(),
  targetTechnicianSlug: z.string().max(80).optional().default(""),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(20).max(3000),
  urgency: z.enum(["normal", "urgent", "emergency"]).default("normal"),
  addressId: z.string().uuid(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  timeWindow: z.enum(["morning", "afternoon", "evening", "flexible"]).default("flexible"),
  budgetDa: z.string().trim().regex(/^\d{0,7}$/, "validation.amount").optional().default(""),
  customerNotes: z.string().trim().max(1000).optional().default(""),
  photoIds: z.array(z.string().uuid()).max(5).optional().default([]),
  confirm: z.literal("on", { message: "validation.terms" }),
});

/** Eligible = approved + active account + available + approved category + serves the commune. */
export async function findEligibleTechnicians(
  tx: DbOrTx,
  params: { categoryId: string; wilayaCode: string; communeId: number; excludeUserId: string; onlyTechnicianId?: string; emergency?: boolean },
) {
  const rows = await tx.execute<{ id: string; user_id: string; scope: string }>(sql`
    SELECT tp.id, tp.user_id,
      CASE WHEN bool_or(sa.commune_id = ${params.communeId}) THEN 'commune' ELSE 'wilaya' END AS scope
    FROM technician_profiles tp
    JOIN profiles p ON p.id = tp.user_id AND p.account_status = 'active'
    JOIN technician_categories tc ON tc.technician_id = tp.id AND tc.category_id = ${params.categoryId} AND tc.approval_status = 'approved'
    JOIN service_areas sa ON sa.technician_id = tp.id AND sa.wilaya_code = ${params.wilayaCode}
      AND (sa.commune_id IS NULL OR sa.commune_id = ${params.communeId})
    WHERE tp.verification_status = 'approved'
      AND tp.availability_status = 'available'
      AND tp.user_id <> ${params.excludeUserId}
      ${params.onlyTechnicianId ? sql`AND tp.id = ${params.onlyTechnicianId}` : sql``}
      ${params.emergency ? sql`AND tp.emergency_available = true` : sql``}
    GROUP BY tp.id, tp.user_id
    LIMIT 200`);
  return rows.map((r) => ({ id: r.id, userId: r.user_id, scope: r.scope }));
}

export async function createServiceRequest(actor: Actor, input: z.infer<typeof createRequestSchema>) {
  const settings = await getSettings();
  if (input.urgency === "emergency" && !settings.feature_flags.emergencyRequests) throw new AppError("validation", 400);
  if (input.preferredDate) {
    if (input.preferredDate < todayInAlgeria()) throw new AppError("validation", 400);
  }

  // Idempotency: the same key from the same client returns the original request.
  const [existing] = await db
    .select({ id: schema.serviceRequests.id, reference: schema.serviceRequests.reference })
    .from(schema.serviceRequests)
    .where(and(eq(schema.serviceRequests.clientId, actor.id), eq(schema.serviceRequests.idempotencyKey, input.idempotencyKey)))
    .limit(1);
  if (existing) return { ...existing, matched: -1 };

  try {
    const result = await db.transaction(async (tx) => {
      const [address] = await tx
        .select()
        .from(schema.clientAddresses)
        .where(and(eq(schema.clientAddresses.id, input.addressId), eq(schema.clientAddresses.clientId, actor.id), isNull(schema.clientAddresses.archivedAt)));
      if (!address) throw new AppError("not_found", 404);

      const [category] = await tx
        .select()
        .from(schema.serviceCategories)
        .where(and(eq(schema.serviceCategories.id, input.categoryId), eq(schema.serviceCategories.isActive, true)));
      if (!category) throw new AppError("service_not_available");

      const [wilaya] = await tx.select().from(schema.wilayas).where(eq(schema.wilayas.code, address.wilayaCode));
      if (!wilaya?.isActive) throw new AppError("service_not_available");

      let targetTechnicianId: string | undefined;
      if (input.targetTechnicianSlug) {
        const [tp] = await tx
          .select({ id: schema.technicianProfiles.id, status: schema.technicianProfiles.verificationStatus })
          .from(schema.technicianProfiles)
          .where(eq(schema.technicianProfiles.slug, input.targetTechnicianSlug));
        if (!tp || tp.status !== "approved") throw new AppError("technician_unavailable");
        targetTechnicianId = tp.id;
      }
      if (input.serviceId) {
        const [svc] = await tx
          .select()
          .from(schema.technicianServices)
          .where(
            and(
              eq(schema.technicianServices.id, input.serviceId),
              eq(schema.technicianServices.approvalStatus, "approved"),
              eq(schema.technicianServices.isActive, true),
              eq(schema.technicianServices.categoryId, input.categoryId),
            ),
          );
        if (!svc || (targetTechnicianId && svc.technicianId !== targetTechnicianId)) throw new AppError("service_not_available");
        targetTechnicianId ??= svc.technicianId;
      }

      let preferredStartAt: Date | null = null;
      let preferredEndAt: Date | null = null;
      if (input.preferredDate) {
        const w = TIME_WINDOWS[input.timeWindow];
        preferredStartAt = algeriaLocalToUtc(input.preferredDate, w.start);
        preferredEndAt = algeriaLocalToUtc(input.preferredDate, w.end);
      }

      const now = new Date();
      const [req] = await tx
        .insert(schema.serviceRequests)
        .values({
          reference: makeReference("KR"),
          clientId: actor.id,
          categoryId: category.id,
          serviceId: input.serviceId || null,
          targetTechnicianId: targetTechnicianId ?? null,
          title: input.title,
          description: input.description,
          urgency: input.urgency,
          addressId: address.id,
          wilayaCode: address.wilayaCode,
          communeId: address.communeId,
          preferredDate: input.preferredDate || null,
          timeWindow: input.timeWindow,
          preferredStartAt,
          preferredEndAt,
          budgetMaxMinor: input.budgetDa ? daToMinor(Number(input.budgetDa)) : null,
          customerNotes: input.customerNotes || null,
          paymentMethod: "cash",
          idempotencyKey: input.idempotencyKey,
          expiresAt: addDays(now, settings.request_expiry_days),
        })
        .returning();

      if (input.photoIds.length) {
        await attachFiles(tx, actor.id, input.photoIds, "service-request-media", "service_request", req!.id);
        await tx.insert(schema.serviceRequestMedia).values(
          input.photoIds.map((fileId) => ({ requestId: req!.id, fileId, uploadedBy: actor.id })),
        );
      }

      const eligible = await findEligibleTechnicians(tx, {
        categoryId: category.id,
        wilayaCode: address.wilayaCode,
        communeId: address.communeId,
        excludeUserId: actor.id,
        onlyTechnicianId: targetTechnicianId,
        emergency: input.urgency === "emergency",
      });

      if (eligible.length) {
        await tx.insert(schema.requestMatches).values(
          eligible.map((e) => ({
            requestId: req!.id,
            technicianId: e.id,
            matchReason: { category: category.slug, scope: e.scope, targeted: Boolean(targetTechnicianId) },
          })),
        );
        const [commune] = await tx.select().from(schema.communes).where(eq(schema.communes.id, address.communeId));
        for (const e of eligible) {
          // Bulk notifications carry no personal data: category, commune and title only.
          await notify(
            {
              userId: e.userId,
              type: "new_job_request",
              params: { title: req!.title },
              localized: (l) => ({
                category: l === "ar-DZ" ? category.nameAr : category.nameFr,
                commune: (l === "ar-DZ" ? commune?.nameAr : commune?.nameFr) ?? "",
              }),
              link: `/technicien/demandes/${req!.id}`,
              dedupeKey: `req:${req!.id}`,
            },
            tx,
          );
        }
      }
      return { id: req!.id, reference: req!.reference, matched: eligible.length };
    });
    await scheduleDispatch();
    return result;
  } catch (err) {
    if (pgCode(err) === "23505" && pgConstraint(err) === "service_requests_idem_uq") {
      const [dup] = await db
        .select({ id: schema.serviceRequests.id, reference: schema.serviceRequests.reference })
        .from(schema.serviceRequests)
        .where(and(eq(schema.serviceRequests.clientId, actor.id), eq(schema.serviceRequests.idempotencyKey, input.idempotencyKey)));
      if (dup) return { ...dup, matched: -1 };
    }
    throw err;
  }
}

export async function cancelServiceRequest(actor: Actor, requestId: string, reason: string) {
  await db.transaction(async (tx) => {
    const [req] = await tx.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, requestId)).for("update");
    if (!req || req.clientId !== actor.id) throw new AppError("not_found", 404);
    assertRequestTransition(req.status as RequestStatus, "cancelled", "client");
    await tx
      .update(schema.serviceRequests)
      .set({ status: "cancelled", cancellationReason: reason || null })
      .where(eq(schema.serviceRequests.id, req.id));
    const open = await tx
      .update(schema.quotes)
      .set({ status: "rejected" })
      .where(and(eq(schema.quotes.requestId, req.id), eq(schema.quotes.status, "sent")))
      .returning({ technicianId: schema.quotes.technicianId });
    const techIds = Array.from(
      new Set([
        ...open.map((q) => q.technicianId),
        ...(await tx.select({ id: schema.requestMatches.technicianId }).from(schema.requestMatches).where(eq(schema.requestMatches.requestId, req.id))).map((m) => m.id),
      ]),
    );
    if (techIds.length) {
      const users = await tx
        .select({ userId: schema.technicianProfiles.userId })
        .from(schema.technicianProfiles)
        .where(inArray(schema.technicianProfiles.id, techIds));
      for (const u of users) {
        await notify({ userId: u.userId, type: "request_cancelled", params: { title: req.title }, link: "/technicien/demandes" }, tx);
      }
    }
    await writeAudit({ actorId: actor.id, action: "request.cancelled", entityType: "service_request", entityId: req.id, reason }, tx);
  });
}

export async function declineMatch(actor: Actor, requestId: string, reason: string) {
  const [tp] = await db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.userId, actor.id));
  if (!tp) throw new AppError("forbidden", 403);
  const res = await db
    .update(schema.requestMatches)
    .set({ declinedAt: new Date(), declineReason: reason || null })
    .where(and(eq(schema.requestMatches.requestId, requestId), eq(schema.requestMatches.technicianId, tp.id)))
    .returning();
  if (!res.length) throw new AppError("not_found", 404);
}

/** Is this technician allowed to see / quote this request? */
export async function technicianCanAccessRequest(tx: DbOrTx, technicianId: string, requestId: string) {
  const [m] = await tx
    .select({ declinedAt: schema.requestMatches.declinedAt })
    .from(schema.requestMatches)
    .where(and(eq(schema.requestMatches.requestId, requestId), eq(schema.requestMatches.technicianId, technicianId)));
  if (m) return true;
  const [q] = await tx
    .select({ id: schema.quotes.id })
    .from(schema.quotes)
    .where(and(eq(schema.quotes.requestId, requestId), eq(schema.quotes.technicianId, technicianId)))
    .limit(1);
  return Boolean(q);
}

export async function listClientRequests(clientId: string, page = 1, pageSize = 10) {
  const where = eq(schema.serviceRequests.clientId, clientId);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: schema.serviceRequests.id,
        reference: schema.serviceRequests.reference,
        title: schema.serviceRequests.title,
        status: schema.serviceRequests.status,
        urgency: schema.serviceRequests.urgency,
        createdAt: schema.serviceRequests.createdAt,
        expiresAt: schema.serviceRequests.expiresAt,
        categoryFr: schema.serviceCategories.nameFr,
        categoryAr: schema.serviceCategories.nameAr,
        communeFr: schema.communes.nameFr,
        communeAr: schema.communes.nameAr,
        quoteCount: sql<number>`(SELECT count(*)::int FROM quotes q WHERE q.request_id = "service_requests"."id" AND q.status IN ('sent','accepted'))`,
      })
      .from(schema.serviceRequests)
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.serviceRequests.categoryId))
      .innerJoin(schema.communes, eq(schema.communes.id, schema.serviceRequests.communeId))
      .where(where)
      .orderBy(desc(schema.serviceRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.serviceRequests).where(where),
  ]);
  return { rows, total, page, pageSize };
}

export async function listEligibleRequests(technicianId: string, page = 1, pageSize = 10) {
  const base = and(
    eq(schema.requestMatches.technicianId, technicianId),
    isNull(schema.requestMatches.declinedAt),
    inArray(schema.serviceRequests.status, ["awaiting_quote", "quote_received"]),
    sql`${schema.serviceRequests.expiresAt} > now()`,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: schema.serviceRequests.id,
        reference: schema.serviceRequests.reference,
        title: schema.serviceRequests.title,
        description: schema.serviceRequests.description,
        urgency: schema.serviceRequests.urgency,
        preferredDate: schema.serviceRequests.preferredDate,
        timeWindow: schema.serviceRequests.timeWindow,
        createdAt: schema.serviceRequests.createdAt,
        budgetMaxMinor: schema.serviceRequests.budgetMaxMinor,
        categoryFr: schema.serviceCategories.nameFr,
        categoryAr: schema.serviceCategories.nameAr,
        communeFr: schema.communes.nameFr,
        communeAr: schema.communes.nameAr,
        wilayaFr: schema.wilayas.nameFr,
        wilayaAr: schema.wilayas.nameAr,
        targeted: sql<boolean>`"service_requests"."target_technician_id" IS NOT NULL`,
        myQuoteStatus: sql<string | null>`(SELECT q.status FROM quotes q WHERE q.request_id = "service_requests"."id" AND q.technician_id = ${technicianId} ORDER BY q.revision_number DESC LIMIT 1)`,
      })
      .from(schema.requestMatches)
      .innerJoin(schema.serviceRequests, eq(schema.serviceRequests.id, schema.requestMatches.requestId))
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.serviceRequests.categoryId))
      .innerJoin(schema.communes, eq(schema.communes.id, schema.serviceRequests.communeId))
      .innerJoin(schema.wilayas, eq(schema.wilayas.code, schema.serviceRequests.wilayaCode))
      .where(base)
      .orderBy(sql`CASE "service_requests"."urgency" WHEN 'emergency' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END`, desc(schema.serviceRequests.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.requestMatches)
      .innerJoin(schema.serviceRequests, eq(schema.serviceRequests.id, schema.requestMatches.requestId))
      .where(base),
  ]);
  return { rows, total, page, pageSize };
}

/** Shared loader returning the request, its media and the viewer's relation. */
export async function loadRequestDetail(requestId: string) {
  const [req] = await db
    .select({
      request: schema.serviceRequests,
      categoryFr: schema.serviceCategories.nameFr,
      categoryAr: schema.serviceCategories.nameAr,
      communeFr: schema.communes.nameFr,
      communeAr: schema.communes.nameAr,
      wilayaFr: schema.wilayas.nameFr,
      wilayaAr: schema.wilayas.nameAr,
      clientFirstName: schema.profiles.displayName,
    })
    .from(schema.serviceRequests)
    .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.serviceRequests.categoryId))
    .innerJoin(schema.communes, eq(schema.communes.id, schema.serviceRequests.communeId))
    .innerJoin(schema.wilayas, eq(schema.wilayas.code, schema.serviceRequests.wilayaCode))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.serviceRequests.clientId))
    .where(eq(schema.serviceRequests.id, requestId));
  if (!req) return null;
  const media = await db
    .select({ fileId: schema.serviceRequestMedia.fileId })
    .from(schema.serviceRequestMedia)
    .where(eq(schema.serviceRequestMedia.requestId, requestId));
  return { ...req, media: media.map((m) => m.fileId) };
}

export async function getMatchCount(requestId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.requestMatches)
    .where(and(eq(schema.requestMatches.requestId, requestId), or(isNull(schema.requestMatches.declinedAt), sql`true`)));
  return r?.n ?? 0;
}
