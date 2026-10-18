import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { getActiveCategories, getActiveWilayas } from "@/lib/services/discovery";
import { listAddresses } from "@/lib/services/addresses";
import { PageHeader, Card } from "@/components/ui/card";
import { RequestForm } from "@/components/forms/request-form";

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireRole("client");
  const sp = await searchParams;
  const { t } = await getI18n();
  const [categories, wilayas, addresses, settings] = await Promise.all([getActiveCategories(), getActiveWilayas(), listAddresses(user.id), getSettings()]);

  let target: { slug: string; name: string } | undefined;
  let services: { id: string; categoryId: string; title: string; pricingModel: string; startingPriceMinor: number | null }[] = [];
  let allowedCategories = categories;
  if (sp.technicien) {
    const [tp] = await db
      .select()
      .from(schema.technicianProfiles)
      .where(and(eq(schema.technicianProfiles.slug, sp.technicien), eq(schema.technicianProfiles.verificationStatus, "approved")));
    if (tp && tp.userId !== user.id) {
      target = { slug: tp.slug, name: tp.publicName };
      services = await db
        .select({
          id: schema.technicianServices.id,
          categoryId: schema.technicianServices.categoryId,
          title: schema.technicianServices.title,
          pricingModel: schema.technicianServices.pricingModel,
          startingPriceMinor: schema.technicianServices.startingPriceMinor,
        })
        .from(schema.technicianServices)
        .where(
          and(
            eq(schema.technicianServices.technicianId, tp.id),
            eq(schema.technicianServices.approvalStatus, "approved"),
            eq(schema.technicianServices.isActive, true),
          ),
        );
      const techCats = await db
        .select({ id: schema.technicianCategories.categoryId })
        .from(schema.technicianCategories)
        .where(and(eq(schema.technicianCategories.technicianId, tp.id), eq(schema.technicianCategories.approvalStatus, "approved")));
      const ids = new Set(techCats.map((c) => c.id));
      allowedCategories = categories.filter((c) => ids.has(c.id));
    }
  }
  const defaultCategoryId =
    (sp.categorie && allowedCategories.find((c) => c.slug === sp.categorie)?.id) ||
    (sp.service && services.find((s) => s.id === sp.service)?.categoryId) ||
    (allowedCategories.length === 1 ? allowedCategories[0]!.id : undefined);

  return (
    <>
      <PageHeader title={t("request.newTitle")} description={t("request.newSubtitle")} backHref="/client/demandes" backLabel={t("client.requestsTitle")} />
      <Card className="max-w-3xl p-5 md:p-7">
        <RequestForm
          categories={allowedCategories.map((c) => ({ id: c.id, slug: c.slug, nameFr: c.nameFr, nameAr: c.nameAr }))}
          addresses={addresses}
          wilayas={wilayas}
          target={target}
          services={services}
          defaultCategoryId={defaultCategoryId || undefined}
          defaultServiceId={sp.service && services.some((s) => s.id === sp.service) ? sp.service : undefined}
          emergencyEnabled={settings.feature_flags.emergencyRequests}
        />
      </Card>
    </>
  );
}
