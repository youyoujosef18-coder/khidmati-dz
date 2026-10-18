import { describe, expect, it } from "vitest";
import { normalizeAlgerianMobile } from "@/lib/phone";
import { algeriaLocalToUtc, todayInAlgeria, utcToAlgeriaParts } from "@/lib/time";
import { formatDateTime } from "@/lib/i18n/format";
import { safeReturnUrl } from "@/lib/utils";

describe("phone", () => {
  it("normalizes Algerian mobile numbers to E.164", () => {
    expect(normalizeAlgerianMobile("0555 12 34 56")).toBe("+213555123456");
    expect(normalizeAlgerianMobile("+213 6 61 23 45 67")).toBe("+213661234567");
    expect(normalizeAlgerianMobile("0770123456")).toBe("+213770123456");
  });
  it("rejects landlines, foreign and malformed numbers", () => {
    expect(normalizeAlgerianMobile("021 12 34 56")).toBeNull();
    expect(normalizeAlgerianMobile("+33612345678")).toBeNull();
    expect(normalizeAlgerianMobile("12345")).toBeNull();
  });
});

describe("time (Algeria, UTC+1 without DST)", () => {
  it("interprets local appointment times as UTC+01:00 all year", () => {
    expect(algeriaLocalToUtc("2026-01-15", "09:30").toISOString()).toBe("2026-01-15T08:30:00.000Z");
    expect(algeriaLocalToUtc("2026-07-15", "09:30").toISOString()).toBe("2026-07-15T08:30:00.000Z");
  });
  it("converts back to local parts and weekday", () => {
    const p = utcToAlgeriaParts(new Date("2026-10-17T23:30:00Z")); // 00:30 Sunday local
    expect(p).toMatchObject({ date: "2026-10-18", time: "00:30", weekday: 0 });
    expect(todayInAlgeria(new Date("2026-10-17T23:30:00Z"))).toBe("2026-10-18");
  });
  it("renders dates in Algeria time in both locales", () => {
    const d = new Date("2026-10-20T08:00:00Z");
    expect(formatDateTime(d, "fr-DZ")).toMatch(/09:00/);
    expect(formatDateTime(d, "ar-DZ")).toMatch(/09:00/);
  });
  it("rejects invalid inputs", () => {
    expect(() => algeriaLocalToUtc("2026-13-01", "10:00")).toThrow();
    expect(() => algeriaLocalToUtc("2026-10-01", "1000")).toThrow();
  });
});

describe("safe return URLs", () => {
  it("only allows same-site relative paths", () => {
    expect(safeReturnUrl("/client/demandes?x=1")).toBe("/client/demandes?x=1");
    expect(safeReturnUrl("//evil.com")).toBe("/");
    expect(safeReturnUrl("https://evil.com")).toBe("/");
    expect(safeReturnUrl("/\\evil.com")).toBe("/");
    expect(safeReturnUrl(undefined, "/x")).toBe("/x");
  });
});
