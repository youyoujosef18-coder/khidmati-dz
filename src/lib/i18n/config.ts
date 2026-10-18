export const LOCALES = ["fr-DZ", "ar-DZ"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr-DZ";
export const LOCALE_COOKIE = "kh_locale";

export const LOCALE_META: Record<Locale, { label: string; htmlLang: string; dir: "ltr" | "rtl" }> = {
  "fr-DZ": { label: "Français", htmlLang: "fr-DZ", dir: "ltr" },
  "ar-DZ": { label: "العربية", htmlLang: "ar-DZ", dir: "rtl" },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
