import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { getTechnicianWorkspace } from "@/lib/services/technicians";
import { profileValue } from "@/lib/services/tech-forms";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { TechProfileForm } from "@/components/tech/profile-form";
import { PortfolioManager } from "@/components/tech/documents-manager";

export default async function TechProfilePage() {
  const { tp } = await requireTechContext();
  const { t } = await getI18n();
  const ws = await getTechnicianWorkspace(tp);
  return (
    <>
      <PageHeader
        title={t("tech.nav.profile")}
        actions={tp.verificationStatus === "approved" ? <ButtonLink href={`/techniciens/${tp.slug}`} variant="outline">{t("tech.previewPublic")}</ButtonLink> : undefined}
      />
      <div className="space-y-6">
        <Card>
          <CardBody className="p-5 md:p-6">
            <TechProfileForm initial={profileValue(tp)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("tech.portfolio")} />
          <CardBody>
            <PortfolioManager items={ws.portfolio.map((p) => ({ id: p.id, fileId: p.fileId, caption: p.caption, moderationStatus: p.moderationStatus }))} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
