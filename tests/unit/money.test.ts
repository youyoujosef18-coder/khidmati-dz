import { describe, expect, it } from "vitest";
import { computeFeeMinor, computeLineTotal, computeQuoteTotal, daToMinor, parseDaInput } from "@/lib/money";
import { formatMoney } from "@/lib/i18n/format";
import { toCsv } from "@/lib/csv";

describe("money", () => {
  it("converts whole DA to integer minor units", () => {
    expect(daToMinor(2500)).toBe(250000);
    expect(() => daToMinor(10.5)).toThrow();
    expect(() => daToMinor(-1)).toThrow();
  });
  it("parses user input with spaces and suffixes", () => {
    expect(parseDaInput("2 500")).toBe(2500);
    expect(parseDaInput("12000 DA")).toBe(12000);
    expect(parseDaInput("12,5")).toBe(125);
    expect(parseDaInput("abc")).toBeNull();
    expect(parseDaInput("")).toBeNull();
  });
  it("computes quote totals on integers", () => {
    expect(
      computeQuoteTotal({ laborMinor: 300000, materialsMinor: 150000, travelMinor: 50000, otherChargesMinor: 0, taxMinor: 0, discountMinor: 20000 }),
    ).toBe(480000);
  });
  it("rejects discounts larger than the subtotal and negative amounts", () => {
    expect(() => computeQuoteTotal({ laborMinor: 100, materialsMinor: 0, travelMinor: 0, otherChargesMinor: 0, taxMinor: 0, discountMinor: 200 })).toThrow();
    expect(() => computeQuoteTotal({ laborMinor: -1, materialsMinor: 0, travelMinor: 0, otherChargesMinor: 0, taxMinor: 0, discountMinor: 0 })).toThrow();
    expect(() => computeQuoteTotal({ laborMinor: 0.5, materialsMinor: 0, travelMinor: 0, otherChargesMinor: 0, taxMinor: 0, discountMinor: 0 })).toThrow();
  });
  it("computes line totals and fees without floating point drift", () => {
    expect(computeLineTotal(3, 33333)).toBe(99999);
    expect(computeFeeMinor(100000, 750)).toBe(7500);
    expect(computeFeeMinor(333, 1000)).toBe(33);
  });
  it("formats DZD as DA / دج with Latin digits", () => {
    expect(formatMoney(250000, "fr-DZ")).toBe("2 500 DA");
    expect(formatMoney(1200000, "ar-DZ")).toBe("12 000 دج");
  });
  it("escapes CSV and neutralises spreadsheet formulas", () => {
    const csv = toCsv([["a,b", '=HYPERLINK("x")', 3]]);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
