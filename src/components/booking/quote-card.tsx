"use client";

import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import Link from "next/link";
import { CalendarClock, MessageSquare, Timer } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DateTime, Money, RatingDisplay, StatusBadge } from "@/components/shared/display";
import { ActionForm, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { acceptQuoteAction, askQuestionAction, rejectQuoteAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";

export interface QuoteView {
  id: string;
  status: string;
  revisionNumber: number;
  pricingModel: string;
  laborMinor: number;
  materialsMinor: number;
  travelMinor: number;
  otherChargesMinor: number;
  otherChargesNote: string | null;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  durationMinutes: number;
  proposedStartAt: Date | string;
  expiresAt: Date | string;
  /** computed on the server at render time */
  expired: boolean;
  terms: string | null;
  message: string | null;
  technicianId: string;
  techName: string;
  techSlug: string;
  techAvatar: string | null;
  techRating: number | null;
  techReviews: number;
  items: { id: string; description: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number }[];
}

export function QuoteBreakdown({ q }: { q: Pick<QuoteView, "laborMinor" | "materialsMinor" | "travelMinor" | "otherChargesMinor" | "otherChargesNote" | "taxMinor" | "discountMinor" | "totalMinor" | "items"> }) {
  const { t } = useI18n();
  const lines: [string, number, boolean?][] = [
    [t("quote.labor"), q.laborMinor],
    [t("quote.materials"), q.materialsMinor],
    [t("quote.travel"), q.travelMinor],
    [q.otherChargesNote ? `${t("quote.other")} — ${q.otherChargesNote}` : t("quote.other"), q.otherChargesMinor],
    [t("quote.tax"), q.taxMinor],
  ];
  return (
    <div className="rounded-md border border-border bg-bg/60 text-sm">
      <dl className="divide-y divide-border">
        {lines
          .filter(([, v]) => v > 0)
          .map(([label, v]) => (
            <div key={label} className="flex justify-between gap-4 px-3 py-2">
              <dt className="text-muted" dir="auto">{label}</dt>
              <dd><Money minor={v} /></dd>
            </div>
          ))}
        {q.items.length > 0 && (
          <div className="px-3 py-2">
            <ul className="space-y-1 text-xs text-muted">
              {q.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3">
                  <span dir="auto">
                    {i.description} × <span className="ltr-nums">{i.quantity}</span>
                  </span>
                  <Money minor={i.lineTotalMinor} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {q.discountMinor > 0 && (
          <div className="flex justify-between gap-4 px-3 py-2 text-success">
            <dt>{t("quote.discount")}</dt>
            <dd>− <Money minor={q.discountMinor} /></dd>
          </div>
        )}
        <div className="flex justify-between gap-4 px-3 py-2.5 font-semibold text-ink">
          <dt>{t("quote.total")}</dt>
          <dd><Money minor={q.totalMinor} className="text-base" /></dd>
        </div>
      </dl>
    </div>
  );
}

export function QuoteCard({ quote, requestId, canAct }: { quote: QuoteView; requestId: string; canAct: boolean }) {
  const { t, dateTime, money } = useI18n();
  const key = useIdempotencyKey();
  const expired = quote.expired;
  const live = quote.status === "sent" && !expired;
  return (
    <article className="card p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar fileId={quote.techAvatar} name={quote.techName} size={44} />
          <div>
            <Link href={`/techniciens/${quote.techSlug}`} className="font-semibold text-ink hover:text-primary">
              {quote.techName}
            </Link>
            <div>
              <RatingDisplay rating={quote.techRating} count={quote.techReviews} />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quote.revisionNumber > 1 && <span className="text-xs text-muted">{t("quote.revision", { n: quote.revisionNumber })}</span>}
          <StatusBadge kind="quote" status={expired && quote.status === "sent" ? "expired" : quote.status} />
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2 text-text">
            <CalendarClock className="h-4 w-4 text-muted" aria-hidden /> {t("quote.proposedDate")} : <strong className="font-semibold"><DateTime value={quote.proposedStartAt} /></strong>
          </p>
          <p className="flex items-center gap-2 text-text">
            <Timer className="h-4 w-4 text-muted" aria-hidden /> {t("quote.duration")} : {t("common.minutes", { count: quote.durationMinutes })}
          </p>
          <p className="text-xs text-muted">
            {t(`enums.pricingModel.${quote.pricingModel}`)} — {t(`enums.pricingHint.${quote.pricingModel}`)}
          </p>
          {live && <p className="text-xs text-warning">{t("quote.validUntil", { date: dateTime(quote.expiresAt) })}</p>}
          {quote.message && (
            <p className="rounded-md bg-bg p-3 text-sm text-text" dir="auto">
              {quote.message}
            </p>
          )}
          {quote.terms && (
            <div className="text-xs">
              <p className="font-medium text-ink">{t("quote.terms")}</p>
              <p className="whitespace-pre-line text-muted" dir="auto">{quote.terms}</p>
            </div>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{t("quote.breakdown")}</p>
          <QuoteBreakdown q={quote} />
          <p className="mt-1.5 text-[11px] text-muted">{t("quote.serverTotal")}</p>
        </div>
      </div>
      {canAct && live && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          <ActionForm
            action={acceptQuoteAction as FormAction}
            successToast={false}
            confirmMessage={t("quote.acceptConfirm", { date: dateTime(quote.proposedStartAt), total: money(quote.totalMinor) })}
          >
            <input type="hidden" name="quoteId" value={quote.id} />
            <input type="hidden" name="idempotencyKey" value={key} />
            <SubmitButton>{t("quote.accept")}</SubmitButton>
          </ActionForm>
          <ActionButton variant="outline" run={() => rejectQuoteAction(quote.id)} confirm={t("common.areYouSure")}>
            {t("quote.reject")}
          </ActionButton>
          <ActionButton variant="ghost" run={() => askQuestionAction(requestId, quote.technicianId)} successMessage={false}>
            <MessageSquare className="h-4 w-4" aria-hidden /> {t("request.askQuestion")}
          </ActionButton>
        </div>
      )}
    </article>
  );
}
