import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { AdminDataTable } from "@/components/admin/table";
import { StatusBadge } from "@/components/shared/display";
import { TabLinks } from "@/components/ui/pagination";

export default async function VerificationQueue({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  await requirePermission("verification.review");
  const { t, dateTime } = await getI18n();
  const view = (await searchParams).vue ?? "file";
  const statuses =
    view === "infos" ? (["additional_information_required"] as const) : view === "suspendus" ? (["suspended", "rejected"] as const) : (["submitted", "under_review"] as const);
  const rows = await db
    .select({ tp: schema.technicianProfiles, cat: schema.serviceCategories.nameFr })
    .from(schema.technicianProfiles)
    .leftJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.technicianProfiles.primaryCategoryId))
    .where(inArray(schema.technicianProfiles.verificationStatus, [...statuses]))
    .orderBy(asc(schema.technicianProfiles.submittedAt))
    .limit(200);
  return (
    <>
      <PageHeader title={t("admin.nav.verification")} />
      <TabLinks
        active={view}
        tabs={[
          { key: "file", label: t("admin.queue"), href: "/admin/verification" },
          { key: "infos", label: t("status.verification.additional_information_required"), href: "/admin/verification?vue=infos" },
          { key: "suspendus", label: `${t("status.verification.rejected")} / ${t("status.verification.suspended")}`, href: "/admin/verification?vue=suspendus" },
        ]}
      />
      <AdminDataTable
        rows={rows}
        rowKey={(r) => r.tp.id}
        empty={t("states.emptyTitle")}
        columns={[
          { header: t("tech.publicName"), cell: (r) => <Link href={`/admin/verification/${r.tp.id}`} className="font-medium text-primary hover:underline">{r.tp.publicName}</Link> },
          { header: t("tech.primaryCategory"), cell: (r) => r.cat ?? "—" },
          { header: t("common.status"), cell: (r) => <StatusBadge kind="verification" status={r.tp.verificationStatus} /> },
          { header: t("common.date"), cell: (r) => (r.tp.submittedAt ? dateTime(r.tp.submittedAt) : "—") },
        ]}
      />
    </>
  );
}
