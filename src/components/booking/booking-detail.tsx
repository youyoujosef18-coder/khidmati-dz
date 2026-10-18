import Link from "next/link";
import { CalendarClock, LifeBuoy, MapPin, MessageSquare, Phone, Printer, ShieldAlert, Wallet } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { formatPhone } from "@/lib/phone";
import { canOpenDispute, clientCanCancelConfirmed, type BookingStatus } from "@/lib/domain/state-machines";
import type { getBookingDetail } from "@/lib/services/bookings";
import { getDisputeForUser } from "@/lib/services/disputes";
import type { Actor } from "@/lib/services/types";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { Money, StatusBadge, Stars } from "@/components/shared/display";
import { QuoteBreakdown } from "./quote-card";
import { BookingActions, ChangeRequestActions, ReviewForm } from "./booking-actions";
import { DisputeThread } from "./dispute-thread";

type Detail = NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>;

export async function BookingDetailView({ detail, actor, basePath, banner }: { detail: Detail; actor: Actor; basePath: string; banner?: string }) {
  const { t, dateTime, pick, relative } = await getI18n();
  const settings = await getSettings();
  const b = detail.booking;
  const viewer = detail.viewer;
  const status = b.status as BookingStatus;
  const now = new Date();
  const pendingChange = detail.changes.find((c) => c.status === "pending");
  const canDispute =
    !detail.dispute || ["resolved", "closed"].includes(detail.dispute.status)
      ? canOpenDispute({ bookingStatus: status, completedAt: b.completedAt, now, windowDays: settings.dispute_window_days })
      : false;
  const canClientCancelFreely = clientCanCancelConfirmed(b.scheduledStartAt, now, settings.cancellation_policy.clientFreeCancellationHours);
  const dispute = detail.dispute ? await getDisputeForUser(actor, detail.dispute.id) : null;
  const messagesBase = viewer === "technician" ? "/technicien/messages" : "/client/messages";
  const actorLabel = (actorId: string | null) =>
    !actorId ? t("common.appName") : actorId === b.clientId ? t("booking.client") : actorId === detail.techUserId ? t("booking.technician") : t("admin.title");

  return (
    <>
      <PageHeader
        backHref={basePath}
        backLabel={t("client.bookingsTitle")}
        title={<span dir="auto">{b.title}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="ltr-nums">{b.reference}</span> <StatusBadge kind="booking" status={b.status} />
          </span>
        }
        actions={
          status === "completed" ? (
            <ButtonLink href={`${basePath}/${b.id}?recu=1`} variant="outline" size="sm" className="no-print">
              <Printer className="h-4 w-4" aria-hidden /> {t("booking.receipt")}
            </ButtonLink>
          ) : undefined
        }
      />
      {banner && <Notice tone="success" className="mb-5">{t(banner)}</Notice>}
      {status === "requested" && b.holdExpiresAt && (
        <Notice tone="warning" className="mb-5">{t("booking.holdExpires", { date: dateTime(b.holdExpiresAt) })}</Notice>
      )}
      {status === "awaiting_completion_confirmation" && b.autoCompleteAt && (
        <Notice tone="info" className="mb-5">{t("booking.autoComplete", { date: dateTime(b.autoCompleteAt) })}</Notice>
      )}
      {status === "disputed" && <Notice tone="error" className="mb-5" icon={<ShieldAlert className="h-4 w-4" />}>{t("booking.disputeOpen")}</Notice>}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* Actions */}
          {viewer !== "staff" && (
            <Card className="no-print">
              <CardBody>
                {pendingChange && (
                  <div className="mb-4 rounded-md border border-accent/50 bg-accent-50 p-3 text-sm">
                    <p className="font-medium text-ink">
                      {pendingChange.requestedBy === actor.id
                        ? t("booking.pendingChangeByYou", { date: dateTime(pendingChange.proposedStartAt) })
                        : t("booking.pendingChange", { date: dateTime(pendingChange.proposedStartAt) })}
                    </p>
                    {pendingChange.reason && <p className="mt-1 text-muted" dir="auto">{pendingChange.reason}</p>}
                    {pendingChange.requestedBy !== actor.id && <ChangeRequestActions changeId={pendingChange.id} />}
                  </div>
                )}
                <BookingActions
                  bookingId={b.id}
                  status={b.status}
                  viewer={viewer}
                  canClientCancelFreely={canClientCancelFreely}
                  canDispute={canDispute}
                  hasPendingChange={Boolean(pendingChange)}
                  paymentStatus={b.paymentStatus}
                  agreedDa={Math.round(b.agreedTotalMinor / 100)}
                />
                {viewer === "client" && status === "confirmed" && !canClientCancelFreely && (
                  <p className="mt-3 text-xs text-muted">{t("errors.cancellation_window")}</p>
                )}
                {viewer === "technician" && status === "in_progress" && <p className="mt-3 text-xs text-muted">{t("booking.scopeChangeHint")}</p>}
              </CardBody>
            </Card>
          )}

          {/* Review */}
          {viewer === "client" && status === "completed" && !detail.review && (
            <Card className="no-print">
              <CardHeader title={t("booking.leaveReview")} description={t("booking.reviewHint")} />
              <CardBody>
                <ReviewForm bookingId={b.id} />
              </CardBody>
            </Card>
          )}
          {detail.review && (
            <Card>
              <CardHeader title={t("booking.yourReview")} />
              <CardBody>
                <Stars value={detail.review.rating} />
                {detail.review.comment && <p className="mt-2 text-sm text-text" dir="auto">{detail.review.comment}</p>}
              </CardBody>
            </Card>
          )}

          {/* Dispute */}
          {dispute && (
            <Card>
              <CardHeader
                title={t("dispute.title", { ref: dispute.dispute.reference })}
                action={<StatusBadge kind="dispute" status={dispute.dispute.status} />}
                description={t(`enums.disputeCategory.${dispute.dispute.category}`)}
              />
              <CardBody>
                <p className="mb-4 whitespace-pre-line text-sm text-text" dir="auto">{dispute.dispute.description}</p>
                {dispute.dispute.resolution && (
                  <Notice tone="success" title={t("dispute.resolution")} className="mb-4">
                    <p>{dispute.dispute.outcome === "completed" ? t("dispute.outcomeCompleted") : t("dispute.outcomeCancelled")}</p>
                    <p className="mt-1 whitespace-pre-line">{dispute.dispute.resolution}</p>
                  </Notice>
                )}
                <DisputeThread
                  disputeId={dispute.dispute.id}
                  isStaff={false}
                  closed={["resolved", "closed"].includes(dispute.dispute.status)}
                  messages={dispute.messages.map((m) => ({ ...m, mine: m.authorId === actor.id }))}
                  evidence={dispute.evidence.map((e) => e.fileId)}
                />
              </CardBody>
            </Card>
          )}

          {/* Price */}
          <Card>
            <CardHeader title={t("booking.price")} description={t(`enums.pricingModel.${b.pricingModel}`)} />
            <CardBody>
              {detail.quote ? (
                <QuoteBreakdown q={{ ...detail.quote, items: detail.quoteItems }} />
              ) : (
                <div className="flex items-center justify-between rounded-md border border-border bg-bg/60 px-3 py-2.5 text-sm font-semibold">
                  <span>{t("quote.total")}</span>
                  <Money minor={b.agreedTotalMinor} className="text-base" />
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-2 text-muted">
                  <Wallet className="h-4 w-4" aria-hidden /> {t("booking.payment")} : {t("booking.paymentCash")}
                </span>
                <StatusBadge kind="payment" status={b.paymentStatus} />
              </div>
              {detail.payments.map((p) => (
                <p key={p.id} className="mt-2 text-xs text-muted">
                  {t("enums.ledger.cash_collected")} : <Money minor={p.amountMinor} /> · {dateTime(p.createdAt)}
                </p>
              ))}
            </CardBody>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader title={t("booking.timeline")} />
            <CardBody>
              <ol className="relative space-y-5 border-s border-border ps-5">
                {detail.history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className="absolute -start-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-surface bg-primary" aria-hidden />
                    <p className="text-sm font-medium text-ink">
                      {h.reason === "rescheduled" ? t("notifications.types.appointment_changed.title") : t(`status.booking.${h.newStatus}`)}
                    </p>
                    <p className="text-xs text-muted">
                      <time dateTime={h.createdAt.toISOString()}>{dateTime(h.createdAt)}</time> · {actorLabel(h.actorId)}
                    </p>
                    {h.reason && !["quote_accepted", "fixed_price_booking", "rescheduled"].includes(h.reason) && (
                      <p className="mt-0.5 text-xs text-muted" dir="auto">{h.reason}</p>
                    )}
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader title={t("booking.appointment")} as="h3" />
            <CardBody className="space-y-3 text-sm">
              <p className="flex items-start gap-2 font-medium text-ink">
                <CalendarClock className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <span>
                  {dateTime(b.scheduledStartAt)}
                  <span className="block text-xs font-normal text-muted">{relative(b.scheduledStartAt)}</span>
                </span>
              </p>
              <p className="flex items-start gap-2 text-text">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
                <span>
                  {detail.address ? (
                    <>
                      {detail.address.addressLine}
                      {detail.address.neighborhood ? `, ${detail.address.neighborhood}` : ""}
                      <span className="block text-muted">
                        {pick(detail, "commune")}, {pick(detail, "wilaya")}
                      </span>
                      {detail.address.accessNotes && <span className="mt-1 block text-xs text-muted" dir="auto">{detail.address.accessNotes}</span>}
                      {detail.address.latitude && detail.address.longitude && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${detail.address.latitude}&mlon=${detail.address.longitude}#map=17/${detail.address.latitude}/${detail.address.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 block text-xs font-medium text-primary underline"
                        >
                          OpenStreetMap
                        </a>
                      )}
                    </>
                  ) : (
                    <>
                      {pick(detail, "commune")}, {pick(detail, "wilaya")}
                      <span className="block text-xs text-muted">{t("booking.addressHidden")}</span>
                    </>
                  )}
                </span>
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={viewer === "client" ? t("booking.technician") : t("booking.client")} as="h3" />
            <CardBody className="space-y-3 text-sm">
              {viewer === "client" ? (
                <Link href={`/techniciens/${detail.techSlug}`} className="flex items-center gap-3 hover:text-primary">
                  <Avatar fileId={detail.techAvatar} name={detail.techName} size={40} /> <span className="font-medium">{detail.techName}</span>
                </Link>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar name={detail.clientName} size={40} />
                  <span className="font-medium">{viewer === "technician" ? detail.clientDisplay : detail.clientName}</span>
                </div>
              )}
              {viewer === "client" && detail.techPhone && (
                <a href={`tel:${detail.techPhone}`} className="flex items-center gap-2 text-primary">
                  <Phone className="h-4 w-4" aria-hidden /> <span className="ltr-nums">{formatPhone(detail.techPhone)}</span>
                </a>
              )}
              {viewer === "technician" && detail.clientPhone && (
                <a href={`tel:${detail.clientPhone}`} className="flex items-center gap-2 text-primary">
                  <Phone className="h-4 w-4" aria-hidden /> <span className="ltr-nums">{formatPhone(detail.clientPhone)}</span>
                </a>
              )}
              {detail.conversationId && viewer !== "staff" && (
                <ButtonLink href={`${messagesBase}/${detail.conversationId}`} variant="outline" size="sm" className="w-full no-print">
                  <MessageSquare className="h-4 w-4" aria-hidden /> {t("booking.openChat")}
                </ButtonLink>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("booking.policy")} as="h3" />
            <CardBody className="space-y-2 text-sm text-muted">
              <p>{t("profile.cancellationPolicy", { hours: settings.cancellation_policy.clientFreeCancellationHours })}</p>
              {detail.techTerms && <p className="whitespace-pre-line" dir="auto">{detail.techTerms}</p>}
            </CardBody>
          </Card>
          {viewer !== "staff" && (
            <Card className="no-print">
              <CardBody className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted">{t("booking.support")}</span>
                <ButtonLink href={`/client/support?reservation=${b.id}`} variant="ghost" size="sm">
                  <LifeBuoy className="h-4 w-4" aria-hidden /> {t("booking.contactSupport")}
                </ButtonLink>
              </CardBody>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
