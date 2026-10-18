import { and, eq, sql } from "drizzle-orm";
import { Heart } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { TechnicianCard } from "@/components/marketplace/technician-card";
import { MIN_REVIEWS_FOR_AVERAGE } from "@/lib/services/reviews";

export default async function FavoritesPage() {
  const user = await requireRole("client");
  const { t } = await getI18n();
  const rows = await db
    .select({
      tp: schema.technicianProfiles,
      cat: schema.serviceCategories,
      w: schema.wilayas,
      c: schema.communes,
      minPrice: sql<number | null>`(SELECT min(s.starting_price_minor) FROM technician_services s WHERE s.technician_id = "technician_profiles"."id" AND s.approval_status = 'approved' AND s.is_active)`,
      minModel: sql<string | null>`(SELECT s.pricing_model FROM technician_services s WHERE s.technician_id = "technician_profiles"."id" AND s.approval_status = 'approved' AND s.is_active AND s.starting_price_minor IS NOT NULL ORDER BY s.starting_price_minor LIMIT 1)`,
    })
    .from(schema.savedTechnicians)
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.savedTechnicians.technicianId))
    .leftJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.technicianProfiles.primaryCategoryId))
    .leftJoin(schema.wilayas, eq(schema.wilayas.code, schema.technicianProfiles.baseWilayaCode))
    .leftJoin(schema.communes, eq(schema.communes.id, schema.technicianProfiles.baseCommuneId))
    .where(and(eq(schema.savedTechnicians.clientId, user.id), eq(schema.technicianProfiles.verificationStatus, "approved")));
  return (
    <>
      <PageHeader title={t("client.favoritesTitle")} />
      {rows.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ tp, cat, w, c, minPrice, minModel }) => (
            <TechnicianCard
              key={tp.id}
              tech={{
                id: tp.id,
                slug: tp.slug,
                publicName: tp.publicName,
                avatarFileId: tp.avatarFileId,
                experienceYears: tp.experienceYears,
                rating: tp.reviewCountDerived >= MIN_REVIEWS_FOR_AVERAGE && tp.averageRatingDerived ? Number(tp.averageRatingDerived) : null,
                reviewCount: tp.reviewCountDerived,
                approvedAt: tp.approvedAt,
                categoryFr: cat?.nameFr ?? null,
                categoryAr: cat?.nameAr ?? null,
                wilayaFr: w?.nameFr ?? null,
                wilayaAr: w?.nameAr ?? null,
                communeFr: c?.nameFr ?? null,
                communeAr: c?.nameAr ?? null,
                minPriceMinor: minPrice != null ? Number(minPrice) : null,
                minPriceModel: minModel,
                emergencyAvailable: tp.emergencyAvailable,
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Heart className="h-6 w-6" />} title={t("client.noSaved")} action={<ButtonLink href="/techniciens" variant="outline">{t("home.ctaFind")}</ButtonLink>} />
      )}
    </>
  );
}
