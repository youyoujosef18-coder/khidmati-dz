import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { getTechnicianWorkspace } from "@/lib/services/technicians";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge, DateTime } from "@/components/shared/display";
import { DocumentsManager } from "@/components/tech/documents-manager";

export default async function VerificationPage({ searchParams }: { searchParams: Promise<{ envoye?: string }> }) {
  const { tp } = await requireTechContext();
  const sp = await searchParams;
  const { t } = await getI18n();
  const ws = await getTechnicianWorkspace(tp);
  const idDocs = ws.documents.filter((d) => ["identity_card", "passport", "driving_license"].includes(d.documentType));
  const qualDocs = ws.documents.filter((d) => ["artisan_card", "qualification", "business_registration", "insurance"].includes(d.documentType));
  const docStatus = (docs: typeof idDocs) => (docs.some((d) => d.reviewStatus === "approved") ? "approved" : docs.some((d) => d.reviewStatus === "pending") ? "pending" : docs.length ? "rejected" : null);
  const last = ws.history[0];
  return (
    <>
      <PageHeader title={t("tech.verificationTitle")} description={t("tech.verificationExplain")} actions={<StatusBadge kind="verification" status={tp.verificationStatus} />} />
      {sp.envoye && <Notice tone="success" className="mb-5">{t("tech.submitted")}</Notice>}
      {last?.reason && ["rejected", "additional_information_required", "suspended"].includes(tp.verificationStatus) && (
        <Notice tone="warning" title={t(`status.verification.${tp.verificationStatus}`)} className="mb-5">
          <p>{last.reason}</p>
          <ButtonLink href="/technicien/inscription?etape=6" size="sm" className="mt-3">{t("tech.resubmit")}</ButtonLink>
        </Notice>
      )}
      {tp.verificationStatus === "draft" && (
        <Notice className="mb-5">
          <ButtonLink href="/technicien/inscription" size="sm">{t("tech.completeOnboarding")}</ButtonLink>
        </Notice>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title={t("tech.documentsTitle")} />
          <CardBody>
            <DocumentsManager locked={tp.verificationStatus === "approved"} documents={ws.documents.map((d) => ({ ...d, createdAt: d.createdAt.toISOString() }))} />
          </CardBody>
        </Card>
        <aside className="space-y-4">
          <Card>
            <CardHeader title={t("tech.checklist")} as="h3" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span>{t("tech.identityCheck")}</span>
                {docStatus(idDocs) ? <StatusBadge kind="approval" status={docStatus(idDocs)!} /> : <span className="text-muted">—</span>}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>{t("tech.qualificationCheck")}</span>
                {docStatus(qualDocs) ? <StatusBadge kind="approval" status={docStatus(qualDocs)!} /> : <span className="text-muted">—</span>}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("tech.verificationHistory")} as="h3" />
            <CardBody>
              {ws.history.length ? (
                <ol className="space-y-3 text-sm">
                  {ws.history.map((h) => (
                    <li key={h.id}>
                      <StatusBadge kind="verification" status={h.newStatus} />
                      <p className="mt-1 text-xs text-muted"><DateTime value={h.createdAt} /></p>
                      {h.reason && h.reason !== "sensitive_profile_change" && <p className="text-xs text-text">{h.reason}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">{t("tech.noHistory")}</p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
