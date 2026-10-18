import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { listAudit } from "@/lib/services/admin";
import { PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { AdminDataTable, FilterBar } from "@/components/admin/table";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; entite?: string; page?: string }> }) {
  await requirePermission("audit.read");
  const sp = await searchParams;
  const { t, dateTime } = await getI18n();
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await listAudit({ action: sp.action?.slice(0, 60), entityType: sp.entite?.slice(0, 60), page });
  return (
    <>
      <PageHeader title={t("admin.auditTitle")} description={t("common.results", { count: res.total })} />
      <FilterBar>
        <label className="grid gap-1 text-sm font-medium">{t("admin.actionCol")}<Input name="action" defaultValue={sp.action} placeholder="verification." /></label>
        <label className="grid gap-1 text-sm font-medium">{t("admin.entity")}<Input name="entite" defaultValue={sp.entite} placeholder="booking" /></label>
        <Button type="submit" variant="outline">{t("common.applyFilters")}</Button>
      </FilterBar>
      <AdminDataTable
        rows={res.rows}
        rowKey={(r) => r.log.id}
        empty={t("states.emptyTitle")}
        columns={[
          { header: t("common.date"), cell: (r) => dateTime(r.log.createdAt) },
          { header: t("admin.actor"), cell: (r) => r.actorName ?? t("admin.system") },
          { header: t("admin.actionCol"), cell: (r) => <code className="rounded bg-bg px-1.5 py-0.5 text-xs">{r.log.action}</code> },
          { header: t("admin.entity"), cell: (r) => <span className="text-xs">{r.log.entityType} <span className="text-muted ltr-nums">{r.log.entityId?.slice(0, 8)}</span></span> },
          { header: t("common.reason"), cell: (r) => <span className="text-xs text-muted">{r.log.reason}</span> },
          { header: "", cell: (r) => (r.log.safeMetadata ? <code className="block max-w-xs truncate text-[11px] text-muted">{JSON.stringify(r.log.safeMetadata)}</code> : null) },
        ]}
      />
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/admin/audit?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.entite ? { entite: sp.entite } : {}), page: String(p) })}`} t={t} />
    </>
  );
}
