"use client";

import { createContext, useContext, useMemo } from "react";
import { LOCALE_META, type Locale } from "./config";
import { createT, type Dictionary, type TFunction } from "./translate";
import * as fmt from "./format";

interface I18nValue {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: TFunction;
  money: (minor: number) => string;
  date: (d: Date | string, o?: Intl.DateTimeFormatOptions) => string;
  dateTime: (d: Date | string) => string;
  time: (d: Date | string) => string;
  relative: (d: Date | string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: LOCALE_META[locale].dir,
      t: createT(dictionary),
      money: (m) => fmt.formatMoney(m, locale),
      date: (d, o) => fmt.formatDate(d, locale, o),
      dateTime: (d) => fmt.formatDateTime(d, locale),
      time: (d) => fmt.formatTime(d, locale),
      relative: (d) => fmt.formatRelative(d, locale),
    }),
    [locale, dictionary],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
