import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { searchUsers } from "@/lib/services/admin";
import { ROLES } from "@/lib/auth/permissions";
import { formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { AdminDataTable, FilterBar } from "@/components/admin/table";
import { StatusBadge } from "@/components/shared/display";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("users.read");
  const sp = await searchParams;
  const { t, date } = await getI18n();
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await searchUsers({ q: sp.q, role: ROLES.includes(sp.role as never) ? sp.role : undefined, status: ["active", "suspended", "deletion_requested", "deleted"].includes(sp.statut ?? "") ? sp.statut : undefined, page });
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const k of ["q", "role", "statut"]) if (sp[k]) u.set(k, sp[k]!);
    u.set("page", String(p));
    return `/admin/utilisateurs?${u}`;
  };
  return (
    <>
      <PageHeader title={t("admin.nav.users")} description={t("common.results", { count: res.total })} />
      <FilterBar>
        <label className="grid min-w-60 flex-1 gap-1 text-sm font-medium">{t("admin.search")}<Input name="q" defaultValue={sp.q} /></label>
        <label className="grid gap-1 text-sm font-medium">{t("admin.role")}
          <Select name="role" defaultValue={sp.role ?? ""}>
            <option value="">{t("common.all")}</option>
            {ROLES.map((r) => <option key={r} value={r}>{t(`enums.role.${r}`)}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-sm font-medium">{t("admin.accountStatus")}
          <Select name="statut" defaultValue={sp.statut ?? ""}>
            <option value="">{t("common.all")}</option>
            {["active", "suspended", "deletion_requested", "deleted"].map((s) => <option key={s} value={s}>{t(`status.account.${s}`)}</option>)}
          </Select>
        </label>
        <Button type="submit" variant="outline">{t("common.search")}</Button>
      </FilterBar>
      <AdminDataTable
        rows={res.rows}
        rowKey={(r) => r.id}
        empty={t("states.emptyTitle")}
        columns={[
          { header: t("account.fullName"), cell: (r) => <Link href={`/admin/utilisateurs/${r.id}`} className="font-medium text-primary hover:underline">{r.fullName}</Link> },
          { header: t("account.contact"), cell: (r) => <span className="ltr-nums text-muted">{[r.email, r.phone ? formatPhone(r.phone) : null].filter(Boolean).join(" · ")}</span> },
          { header: t("admin.roles"), cell: (r) => (r.roles ?? []).map((x) => t(`enums.role.${x}`)).join(", ") },
          { header: t("common.status"), cell: (r) => <StatusBadge kind="account" status={r.status} /> },
          { header: t("common.createdAt"), cell: (r) => date(r.createdAt) },
        ]}
      />
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={qs} t={t} />
    </>
  );
}
