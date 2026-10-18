import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { getTechnicianWorkspace } from "@/lib/services/technicians";
import { getActiveCategories, getActiveWilayas } from "@/lib/services/discovery";
import { areasValue } from "@/lib/services/tech-forms";
import { PageHeader, Card, CardBody } from "@/components/ui/card";
import { AreasForm } from "@/components/tech/areas-form";

export default async function ZonesPage() {
  const { tp } = await requireTechContext();
  const { t } = await getI18n();
  const [ws, categories, wilayas] = await Promise.all([getTechnicianWorkspace(tp), getActiveCategories(), getActiveWilayas()]);
  return (
    <>
      <PageHeader title={t("tech.stepAreas")} />
      <Card>
        <CardBody className="p-5 md:p-6">
          <AreasForm categories={categories.map((c) => ({ id: c.id, nameFr: c.nameFr, nameAr: c.nameAr }))} wilayas={wilayas} initial={areasValue(tp, ws)} />
        </CardBody>
      </Card>
    </>
  );
}
