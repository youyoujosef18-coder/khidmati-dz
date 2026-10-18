import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, schema } from "@/db";
import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader, Stat } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";

function parseRange(sp: { du?: string; au?: string }) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const from = sp.du && re.test(sp.du) ? new Date(`${sp.du}T00:00:00+01:00`) : new Date(Date.now() - 30 * 86400_000);
  const to = sp.au && re.test(sp.au) ? new Date(new Date(`${sp.au}T00:00:00+01:00`).getTime() + 86400_000 - 1) : new Date();
  return { from, to };
}

export default async function EarningsPage({ searchParams }: { searchParams: Promise<{ du?: string; au?: string }> }) {
  const { tp } = await requireTechContext();
  const sp = await searchParams;
  const { t, money, date } = await getI18n();
  const { from, to } = parseRange(sp);
  const [entries, [agg], [jobs]] = await Promise.all([
    db
      .select({ e: schema.ledgerEntries, ref: schema.bookings.reference, title: schema.bookings.title })
      .from(schema.ledgerEntries)
      .leftJoin(schema.bookings, eq(schema.bookings.id, schema.ledgerEntries.bookingId))
      .where(and(eq(schema.ledgerEntries.technicianId, tp.id), gte(schema.ledgerEntries.createdAt, from), lte(schema.ledgerEntries.createdAt, to)))
      .orderBy(desc(schema.ledgerEntries.createdAt))
      .limit(500),
    db
      .select({
        cash: sql<number>`coalesce(sum(CASE WHEN entry_type = 'cash_collected' THEN amount_minor ELSE 0 END),0)::bigint`,
        fees: sql<number>`coalesce(sum(CASE WHEN entry_type = 'platform_fee' THEN amount_minor ELSE 0 END),0)::bigint`,
        refunds: sql<number>`coalesce(sum(CASE WHEN entry_type = 'refund' THEN amount_minor ELSE 0 END),0)::bigint`,
        adjustments: sql<number>`coalesce(sum(CASE WHEN entry_type = 'adjustment' THEN amount_minor ELSE 0 END),0)::bigint`,
      })
      .from(schema.ledgerEntries)
      .where(and(eq(schema.ledgerEntries.technicianId, tp.id), gte(schema.ledgerEntries.createdAt, from), lte(schema.ledgerEntries.createdAt, to))),
    db
      .select({ value: sql<number>`coalesce(sum(agreed_total_minor),0)::bigint` })
      .from(schema.bookings)
      .where(and(eq(schema.bookings.technicianId, tp.id), eq(schema.bookings.status, "completed"), gte(schema.bookings.completedAt, from), lte(schema.bookings.completedAt, to))),
  ]);
  const cash = Number(agg?.cash ?? 0);
  const fees = Number(agg?.fees ?? 0);
  const net = cash - fees - Number(agg?.refunds ?? 0) + Number(agg?.adjustments ?? 0);
  const iso = (d: Date) => new Date(d.getTime() + 3600_000).toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title={t("tech.earningsTitle")} description={t("tech.earningsExplain")} />
      <form className="card mb-5 flex flex-wrap items-end gap-3 p-4" method="get">
        <label className="grid gap-1 text-sm font-medium">{t("common.from")}<Input type="date" name="du" defaultValue={iso(from)} /></label>
        <label className="grid gap-1 text-sm font-medium">{t("common.to")}<Input type="date" name="au" defaultValue={iso(to)} /></label>
        <Button type="submit" variant="outline">{t("common.applyFilters")}</Button>
        <a href={`/api/exports/tech-ledger?du=${iso(from)}&au=${iso(to)}`} className="ms-auto inline-flex h-11 items-center gap-2 rounded-md border border-border-strong px-4 text-sm font-medium hover:bg-bg">
          <Download className="h-4 w-4" aria-hidden /> {t("tech.exportCsv")}
        </a>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("tech.agreedValue")} value={money(Number(jobs?.value ?? 0))} />
        <Stat label={t("tech.cashCollected")} value={money(cash)} />
        <Stat label={t("tech.platformFees")} value={money(fees)} />
        <Stat label={t("tech.net")} value={money(net)} />
      </div>
      <Notice tone="neutral" className="my-5">{t("admin.paymentsStatus")}</Notice>
      {entries.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-border bg-bg text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("common.date")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.reference")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.description")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("common.amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(({ e, ref, title }) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">{date(e.createdAt)}</td>
                  <td className="px-4 py-3 ltr-nums">{ref ?? "—"}</td>
                  <td className="px-4 py-3">{t(`enums.ledger.${e.entryType}`)}{title ? ` — ${title}` : ""}</td>
                  <td className="px-4 py-3 text-end ltr-nums">{money(e.amountMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t("tech.ledgerEmpty")} />
      )}
    </>
  );
}
