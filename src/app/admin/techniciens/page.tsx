import Link from "next/link";
import { desc, eq, ilike, or, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { AdminDataTable, FilterBar } from "@/components/admin/table";
import { StatusBadge } from "@/components/shared/display";
import { VERIFICATION_STATUSES } from "@/lib/domain/state-machines";

export default async function TechniciansAdminPage({ searchParams }: { searchParams: Promise<{ q?: string; statut?: string }> }) {
  await requirePermission("users.read");
  const sp = await searchParams;
  const { t, date } = await getI18n();
  const statusOk = VERIFICATION_STATUSES.includes(sp.statut as never);
  const rows = await db
    .select({ tp: schema.technicianProfiles, account: schema.profiles.accountStatus, wilaya: schema.wilayas.nameFr })
    .from(schema.technicianProfiles)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.technicianProfiles.userId))
    .leftJoin(schema.wilayas, eq(schema.wilayas.code, schema.technicianProfiles.baseWilayaCode))
    .where(
      and(
        statusOk ? eq(schema.technicianProfiles.verificationStatus, sp.statut as "approved") : undefined,
        sp.q ? or(ilike(schema.technicianProfiles.publicName, `%${sp.q}%`), ilike(schema.technicianProfiles.legalName, `%${sp.q}%`)) : undefined,
      ),
    )
    .orderBy(desc(schema.technicianProfiles.updatedAt))
    .limit(200);
  return (
    <>
      <PageHeader title={t("admin.nav.technicians")} description={t("common.results", { count: rows.length })} />
      <FilterBar>
        <label className="grid min-w-60 flex-1 gap-1 text-sm font-medium">{t("admin.search")}<Input name="q" defaultValue={sp.q} /></label>
        <label className="grid gap-1 text-sm font-medium">{t("common.status")}
          <Select name="statut" defaultValue={sp.statut ?? ""}>
            <option value="">{t("common.all")}</option>
            {VERIFICATION_STATUSES.map((s) => <option key={s} value={s}>{t(`status.verification.${s}`)}</option>)}
          </Select>
        </label>
        <Button type="submit" variant="outline">{t("common.search")}</Button>
      </FilterBar>
      <AdminDataTable
        rows={rows}
        rowKey={(r) => r.tp.id}
        empty={t("states.emptyTitle")}
        columns={[
          { header: t("tech.publicName"), cell: (r) => <Link href={`/admin/verification/${r.tp.id}`} className="font-medium text-primary hover:underline">{r.tp.publicName}</Link> },
          { header: t("tech.baseWilaya"), cell: (r) => r.wilaya ?? "—" },
          { header: t("tech.verificationStatus"), cell: (r) => <StatusBadge kind="verification" status={r.tp.verificationStatus} /> },
          { header: t("admin.accountStatus"), cell: (r) => <StatusBadge kind="account" status={r.account} /> },
          { header: t("discovery.reviewsCount", { count: "" }).trim(), cell: (r) => <span className="ltr-nums">{r.tp.reviewCountDerived}</span> },
          { header: t("common.updatedAt"), cell: (r) => date(r.tp.updatedAt) },
        ]}
      />
    </>
  );
}
