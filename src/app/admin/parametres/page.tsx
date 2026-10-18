import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { SettingsForms } from "@/components/admin/settings-forms";
import { WilayaToggles } from "@/components/admin/wilaya-toggles";

export default async function AdminSettingsPage() {
  const staff = await requirePermission("settings.manage");
  const { t } = await getI18n();
  const [settings, wilayas] = await Promise.all([getSettings(), db.select().from(schema.wilayas).orderBy(asc(schema.wilayas.code))]);
  return (
    <>
      <PageHeader title={t("admin.settingsTitle")} />
      <Notice tone="neutral" className="mb-6">{t("admin.paymentsStatus")}</Notice>
      <SettingsForms settings={settings} sensitive={hasPermission(staff.roles, "settings.sensitive")} />
      <Card className="mt-6">
        <CardHeader title={t("admin.wilayas")} description={t("admin.wilayasHint")} />
        <CardBody>
          <WilayaToggles wilayas={wilayas.map((w) => ({ code: w.code, nameFr: w.nameFr, nameAr: w.nameAr, isActive: w.isActive }))} />
        </CardBody>
      </Card>
    </>
  );
}
