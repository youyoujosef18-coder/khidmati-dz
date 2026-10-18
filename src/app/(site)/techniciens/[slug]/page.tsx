import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { BadgeCheck, CalendarClock, Languages, MapPin, PhoneOff, Siren, Timer } from "lucide-react";
import { db, schema } from "@/db";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getPublicProfile } from "@/lib/services/discovery";
import { listTechnicianReviews, MIN_REVIEWS_FOR_AVERAGE } from "@/lib/services/reviews";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Notice } from "@/components/ui/states";
import { PriceDisplay, RatingDisplay, Stars } from "@/components/shared/display";
import { ReportDialog } from "@/components/shared/report-dialog";
import { SaveTechnicianButton } from "@/components/marketplace/save-button";
import { Pagination } from "@/components/ui/pagination";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ avis?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPublicProfile(slug);
  if (!p) return {};
  return { title: p.tp.publicName, description: p.tp.bio.slice(0, 155) };
}

export default async function TechnicianProfilePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = await getPublicProfile(slug);
  if (!profile) notFound();
  const { t, pick, date, locale } = await getI18n();
  const [user, settings] = await Promise.all([getCurrentUser(), getSettings()]);
  const page = Math.max(1, Number(sp.avis) || 1);
  const reviews = await listTechnicianReviews(profile.tp.id, { publishedOnly: true, page, pageSize: 8 });
  const saved = user
    ? Boolean(
        (
          await db
            .select()
            .from(schema.savedTechnicians)
            .where(and(eq(schema.savedTechnicians.clientId, user.id), eq(schema.savedTechnicians.technicianId, profile.tp.id)))
        )[0],
      )
    : false;
  const tp = profile.tp;
  const rating = tp.reviewCountDerived >= MIN_REVIEWS_FOR_AVERAGE && tp.averageRatingDerived ? Number(tp.averageRatingDerived) : null;
  const isSelf = user?.id === tp.userId;
  const available = tp.availabilityStatus === "available";
  const byWilaya = new Map<string, { name: string; communes: string[] }>();
  for (const a of profile.areas) {
    const key = a.wilayaCode;
    const entry = byWilaya.get(key) ?? { name: pick(a, "wilaya"), communes: [] };
    const c = locale === "ar-DZ" ? a.communeAr : a.communeFr;
    if (c) entry.communes.push(c);
    byWilaya.set(key, entry);
  }
  const weekdays = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="container-page py-8 md:py-12">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* Identity */}
          <Card className="p-5 md:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Avatar fileId={tp.avatarFileId} name={tp.publicName} size={96} />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold tracking-tight text-ink">{tp.publicName}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge tone="primary">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {t("profile.verifiedBadge")}
                  </Badge>
                  {profile.categories.map((c) => (
                    <Badge key={c.id} tone={c.isPrimary ? "accent" : "neutral"}>
                      {pick(c, "name")}
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                  <RatingDisplay rating={rating} count={tp.reviewCountDerived} size="md" />
                  {profile.wilayaFr && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" aria-hidden /> {[pick(profile, "commune"), pick(profile, "wilaya")].filter(Boolean).join(", ")}
                    </span>
                  )}
                  {tp.experienceYears > 0 && <span>{t("discovery.experience", { count: tp.experienceYears })}</span>}
                  <span>{t("profile.memberSince", { date: date(profile.memberSince, { month: "long", year: "numeric", day: undefined }) })}</span>
                </div>
              </div>
            </div>
            {tp.approvedAt && (
              <p className="mt-5 rounded-md bg-primary-50 px-3 py-2 text-xs text-primary">
                {t("profile.verifiedExplanation", { date: date(tp.approvedAt) })}
              </p>
            )}
          </Card>

          {/* Bio */}
          <Card>
            <CardHeader title={t("profile.about")} />
            <CardBody>
              <p className="whitespace-pre-line leading-relaxed text-text" dir="auto">
                {tp.bio}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted">
                {tp.workingLanguages.length > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Languages className="h-4 w-4" aria-hidden />
                    {tp.workingLanguages.map((l) => t(`enums.language.${l}`)).join(", ")}
                  </span>
                )}
                {tp.emergencyAvailable && (
                  <span className="inline-flex items-center gap-1.5 text-warning">
                    <Siren className="h-4 w-4" aria-hidden /> {t("profile.emergency")}
                  </span>
                )}
              </div>
            </CardBody>
          </Card>

          {/* Services */}
          <Card>
            <CardHeader title={t("profile.services")} />
            <ul className="divide-y divide-border">
              {profile.services.map((s) => (
                <li key={s.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-ink" dir="auto">
                      {s.title}
                    </p>
                    {s.description && (
                      <p className="mt-0.5 text-sm text-muted" dir="auto">
                        {s.description}
                      </p>
                    )}
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted">
                      <Timer className="h-3.5 w-3.5" aria-hidden /> {t("profile.duration", { duration: t("common.minutes", { count: s.estimatedDurationMinutes }) })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    <PriceDisplay minor={s.startingPriceMinor} model={s.pricingModel} />
                    <p className="text-xs text-muted">{t(`enums.pricingHint.${s.pricingModel}`)}</p>
                    {!isSelf && available && (
                      <div className="flex gap-2">
                        {s.pricingModel === "fixed" && s.startingPriceMinor != null ? (
                          <ButtonLink href={`/client/reservations/nouvelle?service=${s.id}`} size="sm">
                            {t("profile.bookService")}
                          </ButtonLink>
                        ) : (
                          <ButtonLink href={`/client/demandes/nouvelle?technicien=${tp.slug}&service=${s.id}`} size="sm" variant="outline">
                            {t("profile.requestQuote")}
                          </ButtonLink>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {/* Portfolio */}
          {profile.portfolio.length > 0 && (
            <Card>
              <CardHeader title={t("profile.portfolio")} />
              <CardBody>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {profile.portfolio.map((p) => (
                    <li key={p.id} className="overflow-hidden rounded-md border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${p.fileId}`} alt={p.caption ?? ""} loading="lazy" className="aspect-[4/3] w-full bg-bg object-cover" />
                      {p.caption && <p className="px-2 py-1.5 text-xs text-muted">{p.caption}</p>}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {/* Reviews */}
          <Card>
            <CardHeader title={t("profile.reviews")} description={t("profile.reviewsNote")} />
            <CardBody>
              {reviews.rows.length ? (
                <ul className="divide-y divide-border">
                  {reviews.rows.map((r) => (
                    <li key={r.id} className="py-4 first:pt-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-ink">{r.clientName}</span>
                        <Stars value={r.rating} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {r.bookingTitle} · {date(r.createdAt)}
                      </p>
                      {r.comment && (
                        <p className="mt-2 text-sm text-text" dir="auto">
                          {r.comment}
                        </p>
                      )}
                      <div className="mt-1">
                        <ReportDialog targetType="review" targetId={r.id} label={t("report.title")} loggedIn={Boolean(user)} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title={t("profile.noReviews")} />
              )}
              <Pagination page={page} total={reviews.total} pageSize={reviews.pageSize} hrefFor={(p) => `/techniciens/${slug}?avis=${p}`} t={t} />
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-5">
            {!available && <Notice tone="warning" className="mb-4">{t("profile.notAvailable")}</Notice>}
            {!isSelf && available && (
              <div className="grid gap-2">
                <ButtonLink href={`/client/demandes/nouvelle?technicien=${tp.slug}`} size="lg">
                  {t("profile.requestQuote")}
                </ButtonLink>
                <SaveTechnicianButton technicianId={tp.id} initial={saved} loggedIn={Boolean(user)} />
              </div>
            )}
            <p className="mt-4 flex items-start gap-2 text-xs text-muted">
              <PhoneOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t("profile.phoneHidden")}
            </p>
          </Card>

          <Card>
            <CardHeader title={t("profile.areas")} as="h3" />
            <CardBody className="space-y-2 text-sm">
              {[...byWilaya.values()].map((w) => (
                <div key={w.name}>
                  <p className="font-medium text-ink">{w.name}</p>
                  <p className="text-muted">{w.communes.length ? w.communes.join(", ") : t("profile.wholeWilaya")}</p>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted">{t("profile.travelRadius", { km: tp.travelRadiusKm })}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("profile.weeklyHours")} as="h3" />
            <CardBody>
              <dl className="space-y-1.5 text-sm">
                {weekdays.map((d) => {
                  const slots = profile.weekly.filter((w) => w.weekday === d);
                  return (
                    <div key={d} className="flex justify-between gap-3">
                      <dt className="text-muted">{t(`enums.weekday.${d}`)}</dt>
                      <dd className="text-end ltr-nums">
                        {slots.length ? slots.map((s) => `${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`).join(", ") : <span className="text-muted">{t("profile.closed")}</span>}
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {t("profile.responseNote")}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("profile.policies")} as="h3" />
            <CardBody className="space-y-3 text-sm text-text">
              <p>{t("profile.cancellationPolicy", { hours: settings.cancellation_policy.clientFreeCancellationHours })}</p>
              <p className="text-muted">{t("booking.paymentCash")}</p>
              {tp.serviceTerms && (
                <div>
                  <p className="font-medium text-ink">{t("profile.serviceTerms")}</p>
                  <p className="mt-1 whitespace-pre-line text-muted" dir="auto">
                    {tp.serviceTerms}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
          {!isSelf && (
            <div className="text-center">
              <ReportDialog targetType="technician_profile" targetId={tp.id} label={t("profile.report")} loggedIn={Boolean(user)} />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
