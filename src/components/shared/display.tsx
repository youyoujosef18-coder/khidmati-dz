"use client";

import { BadgeCheck, Star } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const BOOKING_TONES: Record<string, Tone> = {
  requested: "warning",
  confirmed: "primary",
  technician_en_route: "info",
  in_progress: "info",
  awaiting_completion_confirmation: "accent",
  completed: "success",
  cancelled: "neutral",
  disputed: "error",
  expired: "neutral",
};
const REQUEST_TONES: Record<string, Tone> = {
  awaiting_quote: "warning",
  quote_received: "accent",
  booked: "success",
  cancelled: "neutral",
  expired: "neutral",
};
const QUOTE_TONES: Record<string, Tone> = {
  sent: "primary",
  accepted: "success",
  rejected: "neutral",
  superseded: "neutral",
  withdrawn: "neutral",
  expired: "neutral",
};
const VERIFICATION_TONES: Record<string, Tone> = {
  draft: "neutral",
  submitted: "info",
  under_review: "info",
  additional_information_required: "warning",
  approved: "success",
  rejected: "error",
  suspended: "error",
  expired: "neutral",
};
const GENERIC_TONES: Record<string, Tone> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  open: "warning",
  under_review: "info",
  awaiting_information: "warning",
  resolved: "success",
  closed: "neutral",
  reviewing: "info",
  actioned: "success",
  dismissed: "neutral",
  active: "success",
  suspended: "error",
  deletion_requested: "warning",
  deleted: "neutral",
  published: "success",
  hidden: "neutral",
  unpaid: "neutral",
  cash_recorded: "success",
  accepted: "success",
  cancelled: "neutral",
  delivered: "success",
  sent: "success",
  queued: "info",
  failed: "error",
  skipped_not_configured: "neutral",
  skipped_preference: "neutral",
};

export type StatusKind =
  | "booking"
  | "request"
  | "quote"
  | "verification"
  | "approval"
  | "payment"
  | "dispute"
  | "ticket"
  | "report"
  | "account"
  | "moderation"
  | "change"
  | "delivery";

export function StatusBadge({ kind, status, className }: { kind: StatusKind; status: string; className?: string }) {
  const { t } = useI18n();
  const tone =
    kind === "booking"
      ? BOOKING_TONES[status]
      : kind === "request"
        ? REQUEST_TONES[status]
        : kind === "quote"
          ? QUOTE_TONES[status]
          : kind === "verification"
            ? VERIFICATION_TONES[status]
            : GENERIC_TONES[status];
  return (
    <Badge tone={tone ?? "neutral"} dot className={className}>
      {t(`status.${kind}.${status}`)}
    </Badge>
  );
}

export function Money({ minor, className }: { minor: number; className?: string }) {
  const { money } = useI18n();
  return <span className={cn("ltr-nums whitespace-nowrap", className)}>{money(minor)}</span>;
}

/** Price with its nature made explicit (fixed, starting at, hourly, estimate, quote). */
export function PriceDisplay({ minor, model, className }: { minor: number | null; model: string | null; className?: string }) {
  const { t, money } = useI18n();
  if (minor == null || model === "quote_only" || !model) {
    return <span className={cn("text-muted", className)}>{t("enums.pricingModel.quote_only")}</span>;
  }
  const amount = <span className="ltr-nums whitespace-nowrap font-semibold text-ink">{money(minor)}</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-1", className)}>
      {model === "starting_at" && <span className="text-muted">{t("enums.pricingModel.starting_at")}</span>}
      {model === "estimate" && <span className="text-muted">≈</span>}
      {amount}
      {model === "hourly" && <span className="text-muted">{t("common.perHour")}</span>}
      {model === "fixed" && <span className="text-xs text-muted">({t("enums.pricingModel.fixed")})</span>}
    </span>
  );
}

export function RatingDisplay({ rating, count, size = "sm" }: { rating: number | null; count: number; size?: "sm" | "md" }) {
  const { t } = useI18n();
  if (rating == null) {
    return <span className="text-sm text-muted">{count > 0 ? t("discovery.reviewsCount", { count }) : t("discovery.noReviews")}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1", size === "md" ? "text-base" : "text-sm")} aria-label={t("common.stars", { rating: rating.toFixed(1) })}>
      <Star className={cn("fill-accent text-accent", size === "md" ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
      <span className="font-semibold text-ink ltr-nums">{rating.toFixed(1)}</span>
      <span className="text-muted">({t("discovery.reviewsCount", { count })})</span>
    </span>
  );
}

export function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-4 w-4", i <= value ? "fill-accent text-accent" : "text-border-strong")} aria-hidden />
      ))}
    </span>
  );
}

/** Shown only for approved profiles. */
export function VerificationBadge({ approved, compact }: { approved: boolean; compact?: boolean }) {
  const { t } = useI18n();
  if (!approved) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary" title={t("profile.verifiedBadge")}>
      <BadgeCheck className="h-4 w-4" aria-hidden />
      {!compact && t("profile.verifiedBadge")}
      {compact && <span className="sr-only">{t("profile.verifiedBadge")}</span>}
    </span>
  );
}

export function DateTime({ value, mode = "datetime" }: { value: Date | string; mode?: "date" | "datetime" | "relative" | "time" }) {
  const { date, dateTime, relative, time } = useI18n();
  const d = typeof value === "string" ? new Date(value) : value;
  const text = mode === "date" ? date(d) : mode === "relative" ? relative(d) : mode === "time" ? time(d) : dateTime(d);
  return <time dateTime={d.toISOString()}>{text}</time>;
}
