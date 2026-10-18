import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/**
 * Normalizes an Algerian mobile number (05/06/07 …) to E.164 (+213…).
 * Returns null when the number is not a valid Algerian mobile number.
 */
export function normalizeAlgerianMobile(input: string): string | null {
  if (!input) return null;
  const parsed = parsePhoneNumberFromString(input.trim(), "DZ");
  if (!parsed || parsed.country !== "DZ" || !parsed.isValid()) return null;
  const type = parsed.getType();
  if (type !== "MOBILE" && type !== "FIXED_LINE_OR_MOBILE") return null;
  return parsed.number; // E.164
}

/** Formats an E.164 Algerian number for display: +213 5 55 12 34 56 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
