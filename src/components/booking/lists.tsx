"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DateTime, Money, StatusBadge } from "@/components/shared/display";
import { useI18n } from "@/lib/i18n/client";

export interface BookingRow {
  id: string;
  reference: string;
  title: string;
  status: string;
  scheduledStartAt: Date | string;
  agreedTotalMinor: number;
  techName: string;
  techAvatar: string | null;
  clientName: string;
  communeFr: string;
  communeAr: string;
}

export function BookingList({ rows, base, viewer }: { rows: BookingRow[]; base: string; viewer: "client" | "technician" | "staff" }) {
  const { locale } = useI18n();
  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {rows.map((b) => (
        <li key={b.id}>
          <Link href={`${base}/${b.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg">
            {viewer === "client" ? <Avatar fileId={b.techAvatar} name={b.techName} size={40} /> : <Avatar name={b.clientName} size={40} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-ink" dir="auto">
                  {b.title}
                </p>
                <StatusBadge kind="booking" status={b.status} />
              </div>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden /> <DateTime value={b.scheduledStartAt} />
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {locale === "ar-DZ" ? b.communeAr : b.communeFr}
                </span>
                <span>{viewer === "client" ? b.techName : b.clientName}</span>
              </p>
            </div>
            <div className="hidden text-end sm:block">
              <Money minor={b.agreedTotalMinor} className="font-semibold text-ink" />
              <p className="text-xs text-muted ltr-nums">{b.reference}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export interface RequestRow {
  id: string;
  reference: string;
  title: string;
  status: string;
  urgency: string;
  createdAt: Date | string;
  categoryFr: string;
  categoryAr: string;
  communeFr: string;
  communeAr: string;
  quoteCount?: number;
}

export function RequestList({ rows, base }: { rows: RequestRow[]; base: string }) {
  const { t, locale } = useI18n();
  const ar = locale === "ar-DZ";
  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`${base}/${r.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-ink" dir="auto">
                  {r.title}
                </p>
                <StatusBadge kind="request" status={r.status} />
                {r.urgency !== "normal" && <span className="text-xs font-semibold text-warning">{t(`enums.urgency.${r.urgency}`)}</span>}
              </div>
              <p className="mt-0.5 text-sm text-muted">
                {ar ? r.categoryAr : r.categoryFr} · {ar ? r.communeAr : r.communeFr} · <DateTime value={r.createdAt} mode="relative" />
              </p>
            </div>
            {r.quoteCount !== undefined && r.quoteCount > 0 && (
              <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700">{t("client.quotesCount", { count: r.quoteCount })}</span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
