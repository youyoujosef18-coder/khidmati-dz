import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { CalendarDays, MapPin, Siren } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { loadRequestDetail, getMatchCount } from "@/lib/services/requests";
import { listQuotesForRequest } from "@/lib/services/quotes";
import { MIN_REVIEWS_FOR_AVERAGE } from "@/lib/services/reviews";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/display";
import { QuoteCard } from "@/components/booking/quote-card";
import { CancelRequestButton } from "@/components/booking/cancel-request";

export default async function ClientRequestDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  const user = await requireRole("client");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await loadRequestDetail(id);
  if (!detail || detail.request.clientId !== user.id) notFound();
  const { t, pick, dateTime, date } = await getI18n();
  const r = detail.request;
  const [quotes, matched, booking] = await Promise.all([
    listQuotesForRequest(r.id),
    sp.cree ? getMatchCount(r.id) : Promise.resolve(0),
    db.select({ id: schema.bookings.id, reference: schema.bookings.reference }).from(schema.bookings).where(eq(schema.bookings.requestId, r.id)).then((x) => x[0]),
  ]);
  const visibleQuotes = quotes.filter((q) => q.quote.status !== "superseded");
  const now = new Date();
  const canAct = r.status === "awaiting_quote" || r.status === "quote_received";
  return (
    <>
      <PageHeader
        backHref="/client/demandes"
        backLabel={t("client.requestsTitle")}
        title={<span dir="auto">{r.title}</span>}
        description={<span className="ltr-nums">{r.reference}</span>}
        actions={canAct ? <CancelRequestButton requestId={r.id} /> : undefined}
      />
      {sp.cree && (
        <Notice tone={matched > 0 ? "success" : "warning"} title={t("request.createdTitle")} className="mb-5">
          {t("request.created", { ref: r.reference })} {matched > 0 ? t("request.matchedCount", { count: matched }) : t("request.noMatch")}
        </Notice>
      )}
      {booking && (
        <Notice tone="success" className="mb-5">
          {t("request.bookingCreated", { ref: booking.reference })}{" "}
          <a href={`/client/reservations/${booking.id}`} className="font-semibold text-primary underline">{t("request.viewBooking")}</a>
        </Notice>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4" aria-labelledby="quotes">
          <h2 id="quotes" className="font-semibold text-ink">{t("request.quotesTitle")}</h2>
          {visibleQuotes.length ? (
            visibleQuotes.map((q) => (
              <QuoteCard
                key={q.quote.id}
                requestId={r.id}
                canAct={canAct}
                quote={{
                  ...q.quote,
                  expired: q.quote.expiresAt <= now,
                  techName: q.techName,
                  techSlug: q.techSlug,
                  techAvatar: q.techAvatar,
                  techRating: q.techReviews >= MIN_REVIEWS_FOR_AVERAGE && q.techRating ? Number(q.techRating) : null,
                  techReviews: q.techReviews,
                  items: q.items,
                }}
              />
            ))
          ) : (
            <EmptyState title={t("request.noQuotes")} action={canAct ? <ButtonLink href="/techniciens" variant="outline">{t("home.ctaFind")}</ButtonLink> : undefined} />
          )}
        </section>
        <aside className="space-y-4">
          <Card>
            <CardHeader title={t("common.details")} as="h3" action={<StatusBadge kind="request" status={r.status} />} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-muted">{pick(detail, "category")}</p>
              <p className="whitespace-pre-line text-text" dir="auto">{r.description}</p>
              <p className="flex items-center gap-2 text-muted">
                <MapPin className="h-4 w-4" aria-hidden /> {pick(detail, "commune")}, {pick(detail, "wilaya")}
              </p>
              <p className="flex items-center gap-2 text-muted">
                <CalendarDays className="h-4 w-4" aria-hidden />
                {r.preferredDate ? `${date(`${r.preferredDate}T12:00:00+01:00`)} · ${t(`enums.timeWindow.${r.timeWindow}`)}` : t("enums.timeWindow.flexible")}
              </p>
              {r.urgency !== "normal" && (
                <p className="flex items-center gap-2 font-medium text-warning">
                  <Siren className="h-4 w-4" aria-hidden /> {t(`enums.urgency.${r.urgency}`)}
                </p>
              )}
              {canAct && <p className="text-xs text-muted">{t("request.expiresOn", { date: dateTime(r.expiresAt) })}</p>}
            </CardBody>
          </Card>
          {detail.media.length > 0 && (
            <Card>
              <CardHeader title={t("request.photosAttached")} as="h3" />
              <CardBody>
                <div className="grid grid-cols-3 gap-2">
                  {detail.media.map((m) => (
                    <a key={m} href={`/api/files/${m}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${m}`} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
          <Notice tone="neutral">{t("request.exactAddressHidden")}</Notice>
        </aside>
      </div>
    </>
  );
}
