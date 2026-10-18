import fr from "./fr";
import ar from "./ar";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/translate";

export const dictionaries: Record<Locale, Dictionary> = {
  "fr-DZ": fr as unknown as Dictionary,
  "ar-DZ": ar as unknown as Dictionary,
};
