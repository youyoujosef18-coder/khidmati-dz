import Link from "next/link";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { getActiveCategories, getActiveWilayas } from "@/lib/services/discovery";
import { BOOKING_STATUSES } from "@/lib/domain/state-machines";
import { PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { Notice } from "@/components/ui/states";
import { AdminDataTable, FilterBar } from "@/components/admin/table";
import { Money, StatusBadge } from "@/components/shared/display";

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("bookings.read_all");
  const sp = await searchParams;
  const { t, dateTime, pick } = await getI18n();
  const page = Math.max(1, Number(sp.page) || 1);
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const where = and(
    BOOKING_STATUSES.includes(sp.statut as never) ? eq(schema.bookings.status, sp.statut as "confirmed") : undefined,
    sp.categorie ? eq(schema.serviceCategories.slug, sp.categorie) : undefined,
    sp.wilaya && /^\d{2}$/.test(sp.wilaya) ? eq(schema.bookings.wilayaCode, sp.wilaya) : undefined,
    sp.du && re.test(sp.du) ? gte(schema.bookings.scheduledStartAt, new Date(`${sp.du}T00:00:00+01:00`)) : undefined,
    sp.au && re.test(sp.au) ? lte(schema.bookings.scheduledStartAt, new Date(`${sp.au}T23:59:59+01:00`)) : undefined,
    sp.q ? or(ilike(schema.bookings.reference, `%${sp.q}%`), ilike(schema.technicianProfiles.publicName, `%${sp.q}%`), ilike(schema.bookings.title, `%${sp.q}%`)) : undefined,
  );
  const base = db
    .select({ b: schema.bookings, tech: schema.technicianProfiles.publicName, cat: schema.serviceCategories, client: schema.profiles.fullName })
    .from(schema.bookings)
    .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
    .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.bookings.categoryId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.bookings.clientId))
    .where(where);
  const [rows, [{ total }], categories, wilayas] = await Promise.all([
    base.orderBy(desc(schema.bookings.scheduledStartAt)).limit(25).offset((page - 1) * 25),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.bookings)
      .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.bookings.categoryId))
      .where(where),
    getActiveCategories(),
    getActiveWilayas(),
  ]);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    for (const k of ["q", "statut", "categorie", "wilaya", "du", "au"]) if (sp[k]) u.set(k, sp[k]!);
    u.set("page", String(p));
    return `/admin/reservations?${u}`;
  };
  return (
    <>
      <PageHeader title={t("admin.nav.bookings")} description={t("common.results", { count: total })} />
      <FilterBar>
        <label className="grid min-w-48 flex-1 gap-1 text-sm font-medium">{t("common.search")}<Input name="q" defaultValue={sp.q} /></label>
        <label className="grid gap-1 text-sm font-medium">{t("common.status")}
          <Select name="statut" defaultValue={sp.statut ?? ""}><option value="">{t("common.all")}</option>{BOOKING_STATUSES.map((s) => <option key={s} value={s}>{t(`status.booking.${s}`)}</option>)}</Select>
        </label>
        <label className="grid gap-1 text-sm font-medium">{t("discovery.category")}
          <Select name="categorie" defaultValue={sp.categorie ?? ""}><option value="">{t("common.all")}</option>{categories.map((c) => <option key={c.slug} value={c.slug}>{pick(c, "name")}</option>)}</Select>
        </label>
        <label className="grid gap-1 text-sm font-medium">{t("home.searchWilaya")}
          <Select name="wilaya" defaultValue={sp.wilaya ?? ""}><option value="">{t("common.all")}</option>{wilayas.map((w) => <option key={w.code} value={w.code}>{w.code} · {pick(w, "name")}</option>)}</Select>
        </label>
        <label className="grid gap-1 text-sm font-medium">{t("common.from")}<Input type="date" name="du" defaultValue={sp.du} /></label>
        <label className="grid gap-1 text-sm font-medium">{t("common.to")}<Input type="date" name="au" defaultValue={sp.au} /></label>
        <Button type="submit" variant="outline">{t("common.applyFilters")}</Button>
      </FilterBar>
      <Notice tone="neutral" className="mb-4">{t("admin.noConflicts")}</Notice>
      <AdminDataTable
        rows={rows}
        rowKey={(r) => r.b.id}
        empty={t("booking.listEmpty")}
        columns={[
          { header: t("common.reference"), cell: (r) => <Link href={`/admin/reservations/${r.b.id}`} className="font-medium text-primary hover:underline ltr-nums">{r.b.reference}</Link> },
          { header: t("booking.service"), cell: (r) => <span dir="auto">{r.b.title}<span className="block text-xs text-muted">{pick(r.cat, "name")}</span></span> },
          { header: t("booking.appointment"), cell: (r) => dateTime(r.b.scheduledStartAt) },
          { header: t("booking.technician"), cell: (r) => r.tech },
          { header: t("booking.client"), cell: (r) => r.client },
          { header: t("common.status"), cell: (r) => <StatusBadge kind="booking" status={r.b.status} /> },
          { header: t("common.amount"), cell: (r) => <Money minor={r.b.agreedTotalMinor} />, align: "end" },
        ]}
      />
      <Pagination page={page} total={total} pageSize={25} hrefFor={qs} t={t} />
    </>
  );
}
