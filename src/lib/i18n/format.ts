import { APP_TIME_ZONE } from "@/lib/time";
import type { Locale } from "./config";

const intlLocale = (l: Locale) => (l === "ar-DZ" ? "ar-DZ-u-nu-latn" : "fr-DZ");

/** 250000 minor → "2 500 DA" (fr) / "2 500 دج" (ar). Always Latin digits. */
export function formatMoney(minor: number, locale: Locale, currency = "DZD"): string {
  const major = Math.round(minor / 100);
  const n = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, useGrouping: true })
    .format(major)
    .replace(/[  ]/g, " ");
  const unit = currency === "DZD" ? (locale === "ar-DZ" ? "دج" : "DA") : currency;
  return `${n} ${unit}`;
}

export function formatNumber(n: number, locale: Locale) {
  return new Intl.NumberFormat(intlLocale(locale)).format(n);
}

export function formatDate(d: Date | string, locale: Locale, opts: Intl.DateTimeFormatOptions = {}) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(date);
}

export function formatDateTime(d: Date | string, locale: Locale) {
  return formatDate(d, locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(d: Date | string, locale: Locale) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatRelative(d: Date | string, locale: Locale, now = new Date()) {
  const date = typeof d === "string" ? new Date(d) : d;
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return formatDate(date, locale, { day: "numeric", month: "short", year: "numeric" });
}
