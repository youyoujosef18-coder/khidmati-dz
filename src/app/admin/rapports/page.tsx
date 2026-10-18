import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { daysAgo } from "@/lib/time";
import { getI18n } from "@/lib/i18n/server";
import { getAnalytics, getMetrics } from "@/lib/services/admin";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { parsePeriod, PeriodTabs } from "@/components/admin/period";

function Bars({ rows, label }: { rows: { name: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2" aria-label={label}>
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,10rem)_1fr_3rem] items-center gap-3 text-sm">
          <span className="truncate text-muted">{r.name}</span>
          <span className="h-2.5 rounded-full bg-border">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-end font-medium ltr-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  await requirePermission("analytics.read");
  const { t, pick } = await getI18n();
  const period = parsePeriod((await searchParams).periode);
  const [a, m] = await Promise.all([getAnalytics(period), getMetrics(period)]);
  const days = period === "all" ? null : Number(period);
  const du = days ? daysAgo(days).toISOString().slice(0, 10) : "";
  const funnel: [string, number][] = [
    [t("admin.metrics.requests"), a.funnel.requests ?? 0],
    [t("quote.title"), a.funnel.quoted ?? 0],
    [t("client.nav.bookings"), a.funnel.booked ?? 0],
    [t("admin.metrics.completed"), a.funnel.completed ?? 0],
    [t("profile.reviews"), a.funnel.reviewed ?? 0],
  ];
  return (
    <>
      <PageHeader
        title={t("admin.analyticsTitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <PeriodTabs base="/admin/rapports" active={period} t={t} />
            <a href={`/api/exports/admin-bookings${du ? `?du=${du}` : ""}`} className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-bg"><Download className="h-4 w-4" aria-hidden /> {t("client.nav.bookings")} CSV</a>
            <a href={`/api/exports/admin-requests${du ? `?du=${du}` : ""}`} className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium hover:bg-bg"><Download className="h-4 w-4" aria-hidden /> {t("client.nav.requests")} CSV</a>
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={t("admin.funnel")} />
          <CardBody><Bars label={t("admin.funnel")} rows={funnel.map(([name, count]) => ({ name, count }))} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={t("admin.byCategory")} />
          <CardBody><Bars label={t("admin.byCategory")} rows={a.byCategory.map((c) => ({ name: pick(c, "name"), count: c.count }))} /></CardBody>
        </Card>
        <Card>
          <CardHeader title={t("admin.byWilaya")} />
          <CardBody>{a.byWilaya.length ? <Bars label={t("admin.byWilaya")} rows={a.byWilaya.map((c) => ({ name: `${c.code} · ${pick(c, "name")}`, count: c.count }))} /> : <p className="text-sm text-muted">{t("states.emptyTitle")}</p>}</CardBody>
        </Card>
        <Card>
          <CardHeader title={t("admin.nav.overview")} />
          <CardBody className="grid grid-cols-2 gap-3 text-sm">
            {(["cancellations", "openDisputes", "activeTechs", "pendingApplications"] as const).map((k) => (
              <div key={k} className="rounded-md bg-bg p-3">
                <p className="text-muted">{t(`admin.metrics.${k}`)}</p>
                <p className="text-xl font-semibold ltr-nums">{m[{ cancellations: "cancellations", openDisputes: "open_disputes", activeTechs: "active_techs", pendingApplications: "pending_applications" }[k]] ?? 0}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
