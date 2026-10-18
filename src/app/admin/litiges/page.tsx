import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { listDisputes } from "@/lib/services/disputes";
import { PageHeader } from "@/components/ui/card";
import { TabLinks } from "@/components/ui/pagination";
import { AdminDataTable } from "@/components/admin/table";
import { StatusBadge } from "@/components/shared/display";
import { Badge } from "@/components/ui/badge";

export default async function DisputesPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  await requirePermission("disputes.handle");
  const { t, dateTime } = await getI18n();
  const view = (await searchParams).vue === "resolus" ? "resolus" : "ouverts";
  const rows = await listDisputes(view === "resolus" ? ["resolved", "closed"] : ["open", "under_review", "awaiting_information"]);
  return (
    <>
      <PageHeader title={t("admin.disputesQueue")} />
      <TabLinks active={view} tabs={[{ key: "ouverts", label: t("status.dispute.open"), href: "/admin/litiges" }, { key: "resolus", label: t("status.dispute.resolved"), href: "/admin/litiges?vue=resolus" }]} />
      <AdminDataTable
        rows={rows}
        rowKey={(r) => r.id}
        empty={t("states.emptyTitle")}
        columns={[
          { header: t("common.reference"), cell: (r) => <Link href={`/admin/litiges/${r.id}`} className="font-medium text-primary hover:underline ltr-nums">{r.reference}</Link> },
          { header: t("booking.service"), cell: (r) => <span>{r.bookingTitle} <span className="text-xs text-muted ltr-nums">{r.bookingRef}</span></span> },
          { header: t("dispute.category"), cell: (r) => t(`enums.disputeCategory.${r.category}`) },
          { header: t("common.status"), cell: (r) => <StatusBadge kind="dispute" status={r.status} /> },
          { header: "", cell: (r) => <Badge tone={r.priority === "high" || r.priority === "urgent" ? "error" : "neutral"}>{t(`enums.priority.${r.priority}`)}</Badge> },
          { header: t("common.createdAt"), cell: (r) => dateTime(r.createdAt) },
          { header: "", cell: (r) => (r.assignedTo ? "●" : t("dispute.unassigned")) },
        ]}
      />
    </>
  );
}
