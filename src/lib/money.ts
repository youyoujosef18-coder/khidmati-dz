/**
 * Money is always an integer number of minor units (centimes) with an explicit
 * ISO currency. Never use floating point for amounts.
 */
export const DEFAULT_CURRENCY = "DZD" as const;
export const MINOR_PER_MAJOR = 100;

export function daToMinor(da: number): number {
  if (!Number.isInteger(da) || da < 0) throw new Error("Amount must be a non-negative whole number of DA");
  return da * MINOR_PER_MAJOR;
}

export function minorToDa(minor: number): number {
  return Math.round(minor / MINOR_PER_MAJOR);
}

/** Parse user input such as "2 500", "2500", "2.500" into whole DA. Returns null if invalid. */
export function parseDaInput(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw >= 0 ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\s  .,]/g, "").replace(/(DA|DZD|دج)$/i, "");
  if (cleaned === "") return null;
  if (!/^\d{1,9}$/.test(cleaned)) return null;
  return Number(cleaned);
}

export interface QuoteAmounts {
  laborMinor: number;
  materialsMinor: number;
  travelMinor: number;
  otherChargesMinor: number;
  taxMinor: number;
  discountMinor: number;
}

export function computeQuoteTotal(a: QuoteAmounts): number {
  for (const [k, v] of Object.entries(a)) {
    if (!Number.isSafeInteger(v) || v < 0) throw new Error(`Invalid amount for ${k}`);
  }
  const gross = a.laborMinor + a.materialsMinor + a.travelMinor + a.otherChargesMinor + a.taxMinor;
  if (a.discountMinor > gross) throw new Error("Discount cannot exceed the subtotal");
  return gross - a.discountMinor;
}

export function computeLineTotal(quantity: number, unitPriceMinor: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error("Invalid quantity");
  if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) throw new Error("Invalid unit price");
  return quantity * unitPriceMinor;
}

/** Fee in basis points, rounded half-up on integer arithmetic. */
export function computeFeeMinor(amountMinor: number, basisPoints: number): number {
  return Math.floor((amountMinor * basisPoints + 5000) / 10000);
}
