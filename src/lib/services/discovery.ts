import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { MIN_REVIEWS_FOR_AVERAGE } from "./reviews";

export interface SearchFilters {
  q?: string;
  category?: string; // slug
  wilaya?: string;
  commune?: number;
  date?: string;
  budgetMin?: number; // DA
  budgetMax?: number; // DA
  minRating?: number;
  emergency?: boolean;
  sort?: "relevance" | "rating" | "reviews" | "price_asc" | "price_desc" | "experience";
  page?: number;
}

export interface TechnicianCard {
  id: string;
  slug: string;
  publicName: string;
  avatarFileId: string | null;
  experienceYears: number;
  rating: number | null;
  reviewCount: number;
  approvedAt: Date | null;
  categoryFr: string | null;
  categoryAr: string | null;
  wilayaFr: string | null;
  wilayaAr: string | null;
  communeFr: string | null;
  communeAr: string | null;
  minPriceMinor: number | null;
  minPriceModel: string | null;
  emergencyAvailable: boolean;
}

export const PAGE_SIZE = 12;

export async function searchTechnicians(f: SearchFilters): Promise<{ rows: TechnicianCard[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.min(f.page ?? 1, 500));
  const q = f.q?.trim().slice(0, 80);
  const like = q ? `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%` : null;
  const weekday = f.date && /^\d{4}-\d{2}-\d{2}$/.test(f.date) ? new Date(`${f.date}T12:00:00+01:00`).getUTCDay() : null;

  const where = sql`
    tp.verification_status = 'approved'
    AND p.account_status = 'active'
    AND tp.availability_status = 'available'
    ${f.category ? sql`AND EXISTS (SELECT 1 FROM technician_categories tc JOIN service_categories c ON c.id = tc.category_id
        WHERE tc.technician_id = tp.id AND tc.approval_status = 'approved' AND c.slug = ${f.category} AND c.is_active)` : sql``}
    ${f.wilaya ? sql`AND EXISTS (SELECT 1 FROM service_areas sa WHERE sa.technician_id = tp.id AND sa.wilaya_code = ${f.wilaya}
        ${f.commune ? sql`AND (sa.commune_id IS NULL OR sa.commune_id = ${f.commune})` : sql``})` : sql``}
    ${like ? sql`AND (tp.public_name ILIKE ${like} OR tp.bio ILIKE ${like}
        OR EXISTS (SELECT 1 FROM technician_services s WHERE s.technician_id = tp.id AND s.approval_status = 'approved' AND s.is_active
                   AND (s.title ILIKE ${like} OR s.description ILIKE ${like}))
        OR EXISTS (SELECT 1 FROM technician_categories tc JOIN service_categories c ON c.id = tc.category_id
                   WHERE tc.technician_id = tp.id AND tc.approval_status = 'approved'
                   AND (c.name_fr ILIKE ${like} OR c.name_ar ILIKE ${like} OR c.examples_fr::text ILIKE ${like} OR c.examples_ar::text ILIKE ${like})))` : sql``}
    ${weekday !== null ? sql`AND EXISTS (SELECT 1 FROM technician_availability a WHERE a.technician_id = tp.id AND a.is_active AND a.weekday = ${weekday})
        AND NOT EXISTS (SELECT 1 FROM availability_exceptions x WHERE x.technician_id = tp.id
            AND x.starts_at <= ${f.date + "T00:00:00+01:00"}::timestamptz AND x.ends_at >= (${f.date + "T00:00:00+01:00"}::timestamptz + interval '1 day'))` : sql``}
    ${f.minRating ? sql`AND tp.review_count_derived >= ${MIN_REVIEWS_FOR_AVERAGE} AND tp.average_rating_derived >= ${f.minRating}` : sql``}
    ${f.emergency ? sql`AND tp.emergency_available = true` : sql``}
  `;

  const priceExpr = sql`(SELECT min(s.starting_price_minor) FROM technician_services s
      ${f.category ? sql`JOIN service_categories c ON c.id = s.category_id AND c.slug = ${f.category}` : sql``}
      WHERE s.technician_id = tp.id AND s.approval_status = 'approved' AND s.is_active AND s.starting_price_minor IS NOT NULL)`;

  const budget = sql`
    ${f.budgetMin ? sql`AND ${priceExpr} >= ${f.budgetMin * 100}` : sql``}
    ${f.budgetMax ? sql`AND ${priceExpr} <= ${f.budgetMax * 100}` : sql``}`;

  const ratedScore = sql`CASE WHEN tp.review_count_derived >= ${MIN_REVIEWS_FOR_AVERAGE} THEN tp.average_rating_derived ELSE 0 END`;
  const exactCommune = f.commune
    ? sql`(CASE WHEN EXISTS (SELECT 1 FROM service_areas sa WHERE sa.technician_id = tp.id AND sa.commune_id = ${f.commune}) THEN 0 ELSE 1 END)`
    : sql`(0)::int`;
  const orderBy = (() => {
    switch (f.sort) {
      case "rating":
        return sql`${ratedScore} DESC NULLS LAST, tp.review_count_derived DESC, tp.id`;
      case "reviews":
        return sql`tp.review_count_derived DESC, ${ratedScore} DESC, tp.id`;
      case "price_asc":
        return sql`min_price ASC NULLS LAST, tp.id`;
      case "price_desc":
        return sql`min_price DESC NULLS LAST, tp.id`;
      case "experience":
        return sql`tp.experience_years DESC, tp.id`;
      default:
        return sql`${exactCommune} ASC, ${ratedScore} DESC, tp.review_count_derived DESC, tp.approved_at ASC, tp.id`;
    }
  })();

  const rows = await db.execute<Record<string, unknown>>(sql`
    SELECT tp.id, tp.slug, tp.public_name, tp.avatar_file_id, tp.experience_years,
      tp.average_rating_derived, tp.review_count_derived, tp.approved_at, tp.emergency_available,
      pc.name_fr AS category_fr, pc.name_ar AS category_ar,
      w.name_fr AS wilaya_fr, w.name_ar AS wilaya_ar, cm.name_fr AS commune_fr, cm.name_ar AS commune_ar,
      ${priceExpr} AS min_price,
      (SELECT s.pricing_model FROM technician_services s WHERE s.technician_id = tp.id AND s.approval_status = 'approved' AND s.is_active
        AND s.starting_price_minor IS NOT NULL ORDER BY s.starting_price_minor ASC LIMIT 1) AS min_price_model,
      count(*) OVER() AS total_count
    FROM technician_profiles tp
    JOIN profiles p ON p.id = tp.user_id
    LEFT JOIN service_categories pc ON pc.id = tp.primary_category_id
    LEFT JOIN wilayas w ON w.code = tp.base_wilaya_code
    LEFT JOIN communes cm ON cm.id = tp.base_commune_id
    WHERE ${where} ${budget}
    ORDER BY ${orderBy}
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `);

  const total = rows.length ? Number(rows[0]!.total_count) : 0;
  return {
    rows: rows.map((r) => {
      const count = Number(r.review_count_derived ?? 0);
      return {
        id: String(r.id),
        slug: String(r.slug),
        publicName: String(r.public_name),
        avatarFileId: (r.avatar_file_id as string) ?? null,
        experienceYears: Number(r.experience_years ?? 0),
        rating: count >= MIN_REVIEWS_FOR_AVERAGE && r.average_rating_derived != null ? Number(r.average_rating_derived) : null,
        reviewCount: count,
        approvedAt: r.approved_at ? new Date(String(r.approved_at)) : null,
        categoryFr: (r.category_fr as string) ?? null,
        categoryAr: (r.category_ar as string) ?? null,
        wilayaFr: (r.wilaya_fr as string) ?? null,
        wilayaAr: (r.wilaya_ar as string) ?? null,
        communeFr: (r.commune_fr as string) ?? null,
        communeAr: (r.commune_ar as string) ?? null,
        minPriceMinor: r.min_price != null ? Number(r.min_price) : null,
        minPriceModel: (r.min_price_model as string) ?? null,
        emergencyAvailable: Boolean(r.emergency_available),
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function getActiveCategories() {
  return db
    .select({
      id: schema.serviceCategories.id,
      slug: schema.serviceCategories.slug,
      nameFr: schema.serviceCategories.nameFr,
      nameAr: schema.serviceCategories.nameAr,
      descriptionFr: schema.serviceCategories.descriptionFr,
      descriptionAr: schema.serviceCategories.descriptionAr,
      examplesFr: schema.serviceCategories.examplesFr,
      examplesAr: schema.serviceCategories.examplesAr,
      iconKey: schema.serviceCategories.iconKey,
      techCount: sql<number>`(SELECT count(DISTINCT tc.technician_id)::int FROM technician_categories tc
        JOIN technician_profiles tp ON tp.id = tc.technician_id AND tp.verification_status = 'approved'
        JOIN profiles p ON p.id = tp.user_id AND p.account_status = 'active'
        WHERE tc.category_id = "service_categories"."id" AND tc.approval_status = 'approved')`,
    })
    .from(schema.serviceCategories)
    .where(eq(schema.serviceCategories.isActive, true))
    .orderBy(asc(schema.serviceCategories.sortOrder), asc(schema.serviceCategories.nameFr));
}

export async function getCategoryBySlug(slug: string) {
  const [c] = await db
    .select()
    .from(schema.serviceCategories)
    .where(and(eq(schema.serviceCategories.slug, slug), eq(schema.serviceCategories.isActive, true)));
  return c ?? null;
}

export async function getActiveWilayas() {
  return db
    .select({ code: schema.wilayas.code, nameFr: schema.wilayas.nameFr, nameAr: schema.wilayas.nameAr })
    .from(schema.wilayas)
    .where(eq(schema.wilayas.isActive, true))
    .orderBy(asc(schema.wilayas.code));
}

export async function getCommunes(wilayaCode: string) {
  if (!/^\d{2}$/.test(wilayaCode)) return [];
  return db
    .select({ id: schema.communes.id, nameFr: schema.communes.nameFr, nameAr: schema.communes.nameAr })
    .from(schema.communes)
    .where(eq(schema.communes.wilayaCode, wilayaCode))
    .orderBy(asc(schema.communes.nameFr));
}

/** Wilayas with at least one approved, active technician — never implies coverage elsewhere. */
export async function getCoverage() {
  const rows = await db.execute<{ code: string; name_fr: string; name_ar: string; n: number }>(sql`
    SELECT w.code, w.name_fr, w.name_ar, count(DISTINCT tp.id)::int AS n
    FROM service_areas sa
    JOIN technician_profiles tp ON tp.id = sa.technician_id AND tp.verification_status = 'approved'
    JOIN profiles p ON p.id = tp.user_id AND p.account_status = 'active'
    JOIN wilayas w ON w.code = sa.wilaya_code AND w.is_active
    GROUP BY w.code, w.name_fr, w.name_ar
    ORDER BY n DESC, w.code`);
  return rows.map((r) => ({ code: r.code, nameFr: r.name_fr, nameAr: r.name_ar, count: Number(r.n) }));
}

export async function getPublicProfile(slug: string) {
  const [row] = await db
    .select({
      tp: schema.technicianProfiles,
      accountStatus: schema.profiles.accountStatus,
      memberSince: schema.profiles.createdAt,
      wilayaFr: schema.wilayas.nameFr,
      wilayaAr: schema.wilayas.nameAr,
      communeFr: schema.communes.nameFr,
      communeAr: schema.communes.nameAr,
    })
    .from(schema.technicianProfiles)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.technicianProfiles.userId))
    .leftJoin(schema.wilayas, eq(schema.wilayas.code, schema.technicianProfiles.baseWilayaCode))
    .leftJoin(schema.communes, eq(schema.communes.id, schema.technicianProfiles.baseCommuneId))
    .where(eq(schema.technicianProfiles.slug, slug));
  if (!row || row.tp.verificationStatus !== "approved" || row.accountStatus !== "active") return null;
  const tpId = row.tp.id;
  const [categories, services, areas, weekly, portfolio] = await Promise.all([
    db
      .select({ id: schema.serviceCategories.id, slug: schema.serviceCategories.slug, nameFr: schema.serviceCategories.nameFr, nameAr: schema.serviceCategories.nameAr, isPrimary: schema.technicianCategories.isPrimary })
      .from(schema.technicianCategories)
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.technicianCategories.categoryId))
      .where(and(eq(schema.technicianCategories.technicianId, tpId), eq(schema.technicianCategories.approvalStatus, "approved"))),
    db
      .select()
      .from(schema.technicianServices)
      .where(
        and(
          eq(schema.technicianServices.technicianId, tpId),
          eq(schema.technicianServices.approvalStatus, "approved"),
          eq(schema.technicianServices.isActive, true),
        ),
      )
      .orderBy(asc(schema.technicianServices.startingPriceMinor)),
    db
      .select({
        wilayaCode: schema.serviceAreas.wilayaCode,
        wilayaFr: schema.wilayas.nameFr,
        wilayaAr: schema.wilayas.nameAr,
        communeFr: schema.communes.nameFr,
        communeAr: schema.communes.nameAr,
      })
      .from(schema.serviceAreas)
      .innerJoin(schema.wilayas, eq(schema.wilayas.code, schema.serviceAreas.wilayaCode))
      .leftJoin(schema.communes, eq(schema.communes.id, schema.serviceAreas.communeId))
      .where(eq(schema.serviceAreas.technicianId, tpId)),
    db
      .select()
      .from(schema.technicianAvailability)
      .where(and(eq(schema.technicianAvailability.technicianId, tpId), eq(schema.technicianAvailability.isActive, true)))
      .orderBy(asc(schema.technicianAvailability.weekday), asc(schema.technicianAvailability.startTime)),
    db
      .select()
      .from(schema.portfolioItems)
      .where(and(eq(schema.portfolioItems.technicianId, tpId), eq(schema.portfolioItems.moderationStatus, "published")))
      .orderBy(desc(schema.portfolioItems.createdAt))
      .limit(12),
  ]);
  return { ...row, categories, services, areas, weekly, portfolio };
}

export async function getFeaturedTechnicians(limit = 6) {
  const res = await searchTechnicians({ sort: "relevance" });
  return res.rows.slice(0, limit);
}
