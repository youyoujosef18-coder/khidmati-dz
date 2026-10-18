import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { CategoryEditor } from "@/components/admin/category-editor";

export default async function CategoriesAdmin() {
  await requirePermission("catalog.manage");
  const { t } = await getI18n();
  const rows = await db
    .select({
      id: schema.serviceCategories.id, slug: schema.serviceCategories.slug, nameFr: schema.serviceCategories.nameFr, nameAr: schema.serviceCategories.nameAr,
      descriptionFr: schema.serviceCategories.descriptionFr, descriptionAr: schema.serviceCategories.descriptionAr,
      examplesFr: schema.serviceCategories.examplesFr, examplesAr: schema.serviceCategories.examplesAr, iconKey: schema.serviceCategories.iconKey,
      isActive: schema.serviceCategories.isActive, sortOrder: schema.serviceCategories.sortOrder,
      techCount: sql<number>`(SELECT count(*)::int FROM technician_categories tc WHERE tc.category_id = "service_categories"."id" AND tc.approval_status = 'approved')`,
    })
    .from(schema.serviceCategories)
    .orderBy(asc(schema.serviceCategories.sortOrder));
  return (
    <>
      <PageHeader title={t("admin.nav.categories")} />
      <CategoryEditor rows={rows} />
    </>
  );
}
