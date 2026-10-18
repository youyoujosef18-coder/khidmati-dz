import Link from "next/link";
import { sql } from "drizzle-orm";
import { CalendarDays, FileText, Inbox, Wallet, Wrench, CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { getCompleteness } from "@/lib/services/technicians";
import { listBookings } from "@/lib/services/bookings";
import { listConversations } from "@/lib/services/messaging";
import { PageHeader, Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/display";
import { BookingList } from "@/components/booking/lists";

export default async function TechDashboard() {
  const { user, tp } = await requireTechContext();
  const { t, money } = await getI18n();
  const [completeness, upcoming, toConfirm, counts, convs] = await Promise.all([
    getCompleteness(tp),
    listBookings({ technicianId: tp.id }, "upcoming", 1, 5),
    listBookings({ technicianId: tp.id }, "to_confirm", 1, 5),
    db.execute<Record<string, number>>(sql`
      SELECT
        (SELECT count(*)::int FROM request_matches m JOIN service_requests r ON r.id = m.request_id
           WHERE m.technician_id = ${tp.id} AND m.declined_at IS NULL AND r.status IN ('awaiting_quote','quote_received') AND r.expires_at > now()
           AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.request_id = r.id AND q.technician_id = ${tp.id})) AS new_requests,
        (SELECT count(*)::int FROM quotes WHERE technician_id = ${tp.id} AND status = 'sent') AS pending_quotes,
        (SELECT count(*)::int FROM bookings WHERE technician_id = ${tp.id} AND status IN ('technician_en_route','in_progress','awaiting_completion_confirmation')) AS active_jobs,
        (SELECT count(*)::int FROM bookings WHERE technician_id = ${tp.id} AND status = 'completed') AS completed_jobs,
        (SELECT coalesce(sum(amount_minor),0)::bigint FROM ledger_entries WHERE technician_id = ${tp.id} AND entry_type = 'cash_collected' AND created_at >= now() - interval '30 days') AS cash30`),
    listConversations(user, "technician"),
  ]);
  const c = counts[0] ?? {};
  const unreadConvs = convs.filter((x) => x.unread > 0).length;
  return (
    <>
      <PageHeader title={t("client.hello", { name: user.firstName })} description={t("tech.dashboardTitle")} />
      {tp.verificationStatus !== "approved" && (
        <Notice tone="warning" title={t("tech.pendingAction")} className="mb-6">
          <p>{t("tech.notApprovedNotice")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge kind="verification" status={tp.verificationStatus} />
            <Link href="/technicien/inscription" className="font-semibold text-primary underline">{t("tech.completeOnboarding")}</Link>
          </div>
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t("tech.newRequests")} value={Number(c.new_requests ?? 0)} icon={<Inbox className="h-5 w-5" />} />
        <Stat label={t("tech.pendingQuotes")} value={Number(c.pending_quotes ?? 0)} icon={<FileText className="h-5 w-5" />} />
        <Stat label={t("tech.activeJobs")} value={Number(c.active_jobs ?? 0)} icon={<Wrench className="h-5 w-5" />} />
        <Stat label={t("tech.completedJobs")} value={Number(c.completed_jobs ?? 0)} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {toConfirm.rows.length > 0 && (
            <section>
              <h2 className="mb-3 font-semibold text-ink">{t("tech.toConfirm")}</h2>
              <BookingList rows={toConfirm.rows} base="/technicien/reservations" viewer="technician" />
            </section>
          )}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-ink">{t("tech.upcoming")}</h2>
              <Link href="/technicien/reservations" className="text-sm font-medium text-primary">{t("common.viewAll")}</Link>
            </div>
            {upcoming.rows.length ? (
              <BookingList rows={upcoming.rows} base="/technicien/reservations" viewer="technician" />
            ) : (
              <p className="card flex items-center gap-2 px-4 py-4 text-sm text-muted"><CalendarDays className="h-4 w-4" aria-hidden /> {t("client.noUpcoming")}</p>
            )}
          </section>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title={t("tech.profileCompleteness", { percent: completeness.percent })} as="h3" />
            <CardBody>
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary" style={{ width: `${completeness.percent}%` }} />
              </div>
              {completeness.missing.length > 0 && (
                <p className="mt-3 text-sm text-muted">{t("tech.checklist")} : {completeness.missing.map((m) => t(`tech.missing.${m}`)).join(", ")}</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("tech.availabilityStatus")} as="h3" />
            <CardBody className="flex items-center justify-between">
              <span className="text-sm font-medium">{t(`enums.availability.${tp.availabilityStatus}`)}</span>
              <ButtonLink href="/technicien/disponibilites" variant="outline" size="sm">{t("common.edit")}</ButtonLink>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("tech.earningsSummary")} as="h3" />
            <CardBody className="flex items-center justify-between">
              <span className="text-xl font-semibold ltr-nums">{money(Number(c.cash30 ?? 0))}</span>
              <Wallet className="h-5 w-5 text-primary" aria-hidden />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("messages.title")} as="h3" />
            <CardBody className="flex items-center justify-between text-sm">
              <span>{unreadConvs > 0 ? t("messages.unread", { count: unreadConvs }) : t("client.noConversations")}</span>
              <ButtonLink href="/technicien/messages" variant="ghost" size="sm">{t("common.open")}</ButtonLink>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
