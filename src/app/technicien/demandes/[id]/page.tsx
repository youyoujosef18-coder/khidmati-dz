import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { CalendarDays, MapPin, Siren, Wallet } from "lucide-react";
import { db, schema } from "@/db";
import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { loadRequestDetail, technicianCanAccessRequest } from "@/lib/services/requests";
import { requestAcceptsQuotes, type RequestStatus } from "@/lib/domain/state-machines";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { Money, StatusBadge } from "@/components/shared/display";
import { QuoteBuilder } from "@/components/tech/quote-builder";
import { RequestTechActions } from "@/components/tech/request-actions";

export default async function TechRequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { tp } = await requireTechContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (!(await technicianCanAccessRequest(db, tp.id, id))) notFound();
  const detail = await loadRequestDetail(id);
  if (!detail) notFound();
  const { t, pick, date, dateTime } = await getI18n();
  const settings = await getSettings();
  const r = detail.request;
  const [last] = await db
    .select()
    .from(schema.quotes)
    .where(and(eq(schema.quotes.requestId, r.id), eq(schema.quotes.technicianId, tp.id)))
    .orderBy(desc(schema.quotes.revisionNumber))
    .limit(1);
  const open = requestAcceptsQuotes(r.status as RequestStatus) && r.expiresAt > new Date();
  const approved = tp.verificationStatus === "approved";
  return (
    <>
      <PageHeader backHref="/technicien/demandes" backLabel={t("tech.requestsTitle")} title={<span dir="auto">{r.title}</span>} description={<span className="ltr-nums">{r.reference}</span>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {last && (
            <Notice tone={last.status === "accepted" ? "success" : "info"} title={t("tech.alreadyQuoted")}>
              {t("quote.revision", { n: last.revisionNumber })} · <StatusBadge kind="quote" status={last.status} /> · <Money minor={last.totalMinor} />
            </Notice>
          )}
          {!approved && <Notice tone="warning">{t("tech.notApprovedNotice")}</Notice>}
          {open && approved && last?.status !== "accepted" && (
            <Card>
              <CardHeader title={last ? t("quote.reviseTitle") : t("quote.builderTitle")} />
              <CardBody>
                <QuoteBuilder
                  requestId={r.id}
                  defaultDate={r.preferredDate ?? undefined}
                  defaultDuration={tp.defaultDurationMinutes}
                  defaultValidityHours={settings.quote_default_validity_hours}
                  previous={last && last.status === "sent" ? last : undefined}
                />
              </CardBody>
            </Card>
          )}
          {!open && <Notice tone="neutral">{t("errors.request_closed")}</Notice>}
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader title={t("common.details")} as="h3" action={<StatusBadge kind="request" status={r.status} />} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-muted">{pick(detail, "category")}</p>
              <p className="whitespace-pre-line text-text" dir="auto">{r.description}</p>
              {r.customerNotes && <p className="whitespace-pre-line text-muted" dir="auto">{r.customerNotes}</p>}
              <p className="text-muted">{t("tech.clientFirstName", { name: detail.clientFirstName })}</p>
              <p className="flex items-center gap-2 text-muted"><MapPin className="h-4 w-4" aria-hidden /> {pick(detail, "commune")}, {pick(detail, "wilaya")} <span className="text-xs">({t("tech.approxLocation")})</span></p>
              <p className="flex items-center gap-2 text-muted">
                <CalendarDays className="h-4 w-4" aria-hidden />
                {r.preferredDate ? `${date(`${r.preferredDate}T12:00:00+01:00`)} · ${t(`enums.timeWindow.${r.timeWindow}`)}` : t("enums.timeWindow.flexible")}
              </p>
              {r.urgency !== "normal" && <p className="flex items-center gap-2 font-medium text-warning"><Siren className="h-4 w-4" aria-hidden /> {t(`enums.urgency.${r.urgency}`)}</p>}
              {r.budgetMaxMinor && <p className="flex items-center gap-2 text-muted"><Wallet className="h-4 w-4" aria-hidden /> {t("request.budget")} : <Money minor={r.budgetMaxMinor} /></p>}
              <p className="text-xs text-muted">{t("request.expiresOn", { date: dateTime(r.expiresAt) })}</p>
            </CardBody>
          </Card>
          {detail.media.length > 0 && (
            <Card>
              <CardHeader title={t("request.photosAttached")} as="h3" />
              <CardBody className="grid grid-cols-3 gap-2">
                {detail.media.map((m) => (
                  <a key={m} href={`/api/files/${m}`} target="_blank" rel="noopener" className="overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/files/${m}`} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </CardBody>
            </Card>
          )}
          {open && approved && <RequestTechActions requestId={r.id} />}
          <Notice tone="neutral">{t("request.exactAddressHidden")}</Notice>
        </aside>
      </div>
    </>
  );
}
