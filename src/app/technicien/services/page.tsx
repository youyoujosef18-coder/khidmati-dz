import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { getTechnicianWorkspace } from "@/lib/services/technicians";
import { servicesValue } from "@/lib/services/tech-forms";
import { PageHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ServicesEditor } from "@/components/tech/services-editor";

export default async function TechServicesPage() {
  const { tp } = await requireTechContext();
  const { t, pick } = await getI18n();
  const ws = await getTechnicianWorkspace(tp);
  const cats = ws.categories.map((c) => ({ id: c.categoryId, name: pick(c, "name") }));
  return (
    <>
      <PageHeader title={t("tech.nav.services")} />
      {!cats.length && <Notice tone="warning" className="mb-4">{t("tech.missing.category")}</Notice>}
      <ServicesEditor services={servicesValue(ws)} categories={cats} approved={tp.verificationStatus === "approved"} />
    </>
  );
}
