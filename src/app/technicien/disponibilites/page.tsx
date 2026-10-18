import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { getTechnicianWorkspace } from "@/lib/services/technicians";
import { availabilityValue } from "@/lib/services/tech-forms";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { AvailabilityEditor, ExceptionsEditor } from "@/components/tech/availability-editor";

export default async function AvailabilityPage() {
  const { tp } = await requireTechContext();
  const { t } = await getI18n();
  const ws = await getTechnicianWorkspace(tp);
  return (
    <>
      <PageHeader title={t("tech.nav.availability")} />
      <div className="space-y-6">
        <Card>
          <CardBody className="p-5 md:p-6">
            <AvailabilityEditor initial={availabilityValue(tp, ws)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("tech.exceptions")} />
          <CardBody>
            <ExceptionsEditor exceptions={ws.exceptions.map((x) => ({ id: x.id, startsAt: x.startsAt.toISOString(), endsAt: x.endsAt.toISOString(), exceptionType: x.exceptionType, reason: x.reason }))} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
