import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { getI18n } from "@/lib/i18n/server";
import { getMetrics } from "@/lib/services/admin";
import { channelStatus } from "@/lib/notify/adapters";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/states";
import { parsePeriod, PeriodTabs } from "@/components/admin/period";

export default async function AdminOverview({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const user = await requirePermission("admin.access");
  const { t, money, dateTime } = await getI18n();
  const period = parsePeriod((await searchParams).periode);
  const m = await getMetrics(period);
  const audit = hasPermission(user.roles, "audit.read")
    ? await db
        .select({ log: schema.auditLogs, actor: schema.profiles.fullName })
        .from(schema.auditLogs)
        .leftJoin(schema.profiles, eq(schema.profiles.id, schema.auditLogs.actorId))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(10)
    : [];
  const ch = channelStatus();
  const metrics: [string, string, string | number, string?][] = [
    ["clients", "clientsDef", m.clients ?? 0],
    ["pendingApplications", "pendingApplicationsDef", m.pending_applications ?? 0, "/admin/verification"],
    ["activeTechs", "activeTechsDef", m.active_techs ?? 0, "/admin/techniciens"],
    ["requests", "requestsDef", m.requests ?? 0],
    ["confirmed", "confirmedDef", m.confirmed ?? 0, "/admin/reservations"],
    ["completed", "completedDef", m.completed ?? 0],
    ["cancellations", "cancellationsDef", m.cancellations ?? 0],
    ["openDisputes", "openDisputesDef", m.open_disputes ?? 0, "/admin/litiges"],
    ["revenue", "revenueDef", money(m.revenue ?? 0)],
    ["cash", "cashDef", money(m.cash ?? 0)],
  ];
  return (
    <>
      <PageHeader title={t("admin.nav.overview")} actions={<PeriodTabs base="/admin" active={period} t={t} />} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([k, def, v, href]) => {
          const body = (
            <div className="card h-full p-4">
              <p className="text-sm font-medium text-muted">{t(`admin.metrics.${k}`)}</p>
              <p className="mt-2 text-2xl font-semibold text-ink ltr-nums">{v}</p>
              <p className="mt-1 text-xs text-muted">{t(`admin.metrics.${def}`)}</p>
            </div>
          );
          return href ? <Link key={k} href={href} className="block hover:shadow-raised">{body}</Link> : <div key={k}>{body}</div>;
        })}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {audit.length > 0 && (
          <Card>
            <CardHeader title={t("admin.recentAudit")} action={<Link href="/admin/audit" className="text-sm font-medium text-primary">{t("common.viewAll")}</Link>} />
            <ul className="divide-y divide-border">
              {audit.map(({ log, actor }) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm">
                  <span><code className="rounded bg-bg px-1.5 py-0.5 text-xs">{log.action}</code> <span className="text-muted">{actor ?? t("admin.system")}</span></span>
                  <span className="text-xs text-muted">{dateTime(log.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card>
          <CardHeader title={t("admin.integrations")} />
          <CardBody className="space-y-3 text-sm">
            <p className="flex justify-between"><span>{t("admin.dbOk")}</span><Badge tone="success">OK</Badge></p>
            {(["email", "sms"] as const).map((c) => (
              <p key={c} className="flex justify-between">
                <span>{t(`enums.channel.${c}`)}</span>
                {ch[c] ? <Badge tone="success">{t("admin.channelConfigured", { provider: ch[c]! })}</Badge> : <Badge>{t("admin.channelNotConfigured")}</Badge>}
              </p>
            ))}
            <p className="flex justify-between"><span>{t("enums.channel.push")}</span><Badge>{t("admin.channelNotConfigured")}</Badge></p>
            <Notice tone="neutral">{t("admin.paymentsStatus")}</Notice>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
