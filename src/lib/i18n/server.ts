import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { dictionaries } from "@/messages";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_META, isLocale, type Locale } from "./config";
import { createT, type TFunction } from "./translate";
import * as fmt from "./format";

export const getLocale = cache(async (): Promise<Locale> => {
  const jar = await cookies();
  const fromCookie = jar.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  if (/^ar\b/i.test(accept.trim())) return "ar-DZ";
  return DEFAULT_LOCALE;
});

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export function tFor(locale: Locale): TFunction {
  return createT(dictionaries[locale], dictionaries[DEFAULT_LOCALE]);
}

export const getI18n = cache(async () => {
  const locale = await getLocale();
  const t = tFor(locale);
  return {
    locale,
    dir: LOCALE_META[locale].dir,
    t,
    money: (minor: number, currency?: string) => fmt.formatMoney(minor, locale, currency),
    date: (d: Date | string, o?: Intl.DateTimeFormatOptions) => fmt.formatDate(d, locale, o),
    dateTime: (d: Date | string) => fmt.formatDateTime(d, locale),
    time: (d: Date | string) => fmt.formatTime(d, locale),
    relative: (d: Date | string) => fmt.formatRelative(d, locale),
    /** Pick the localized column of a bilingual record */
    pick: <T extends Record<string, unknown>>(row: T, base: string) =>
      String((locale === "ar-DZ" ? row[`${base}Ar`] : row[`${base}Fr`]) ?? row[`${base}Fr`] ?? ""),
  };
});
export type ServerI18n = Awaited<ReturnType<typeof getI18n>>;
