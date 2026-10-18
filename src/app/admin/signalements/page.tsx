import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { listReports } from "@/lib/services/support";
import { PageHeader } from "@/components/ui/card";
import { TabLinks } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/shared/display";
import { InlineActionForm } from "@/components/admin/forms";
import type { FormAction } from "@/components/forms/action-form";
import { handleReportAction } from "@/app/actions/admin";

const LINKS: Record<string, (id: string) => string> = {
  technician_profile: (id) => `/admin/verification/${id}`,
  user: (id) => `/admin/utilisateurs/${id}`,
  booking: (id) => `/admin/reservations/${id}`,
  review: () => `/admin/avis`,
  conversation: () => "",
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  await requirePermission("reports.handle");
  const { t, dateTime } = await getI18n();
  const view = (await searchParams).vue === "traites" ? "traites" : "ouverts";
  const rows = await listReports(view === "traites" ? ["actioned", "dismissed"] : ["open", "reviewing"]);
  return (
    <>
      <PageHeader title={t("admin.reportsQueue")} />
      <TabLinks active={view} tabs={[{ key: "ouverts", label: t("status.report.open"), href: "/admin/signalements" }, { key: "traites", label: t("status.report.actioned"), href: "/admin/signalements?vue=traites" }]} />
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map(({ report: r, reporterName }) => {
            const href = LINKS[r.targetType]?.(r.targetId);
            return (
              <li key={r.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-ink">{t(`enums.reportReason.${r.reason}`)} · <span className="text-sm text-muted">{r.targetType}</span></p>
                  <StatusBadge kind="report" status={r.status} />
                </div>
                <p className="text-xs text-muted">{reporterName} · {dateTime(r.createdAt)} {href && <a href={href} className="ms-2 text-primary underline">{t("common.view")}</a>}</p>
                {r.description && <p className="mt-2 text-sm" dir="auto">{r.description}</p>}
                {r.resolutionNote && <p className="mt-2 text-sm text-muted">{r.resolutionNote}</p>}
                {["open", "reviewing"].includes(r.status) && (
                  <div className="mt-3 flex flex-wrap gap-4">
                    <InlineActionForm action={handleReportAction as FormAction} hidden={{ reportId: r.id, status: "actioned", note: "" }} submitLabel={t("admin.action")} reason={{ label: t("admin.resolutionNote") }} className="min-w-64 flex-1 space-y-2" />
                    <InlineActionForm action={handleReportAction as FormAction} hidden={{ reportId: r.id, status: "dismissed", note: "" }} submitLabel={t("admin.dismiss")} variant="outline" reason={{ label: t("admin.resolutionNote") }} className="min-w-64 flex-1 space-y-2" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title={t("states.emptyTitle")} />
      )}
    </>
  );
}
