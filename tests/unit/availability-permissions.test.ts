import { describe, expect, it } from "vitest";
import { checkSlot, worksOnDate, type AvailabilityContext } from "@/lib/domain/availability";
import { canGrantRole, hasPermission, homeForRoles } from "@/lib/auth/permissions";
import { algeriaLocalToUtc } from "@/lib/time";

const base: AvailabilityContext = {
  weekly: [{ weekday: 2, startTime: "08:00:00", endTime: "17:00:00", isActive: true }], // Tuesday
  exceptions: [],
  busy: [],
  travelBufferMinutes: 30,
  maxDailyJobs: 2,
  availabilityStatus: "available",
};
const at = (time: string, mins = 60) => {
  const s = algeriaLocalToUtc("2026-10-20", time); // Tuesday
  return [s, new Date(s.getTime() + mins * 60_000)] as const;
};

describe("availability", () => {
  it("accepts a slot inside working hours", () => {
    expect(checkSlot(...at("09:00"), base)).toEqual({ ok: true });
  });
  it("rejects slots outside hours or on a closed day", () => {
    expect(checkSlot(...at("16:30"), base)).toMatchObject({ ok: false, reason: "outside_availability" });
    const wed = algeriaLocalToUtc("2026-10-21", "09:00");
    expect(checkSlot(wed, new Date(wed.getTime() + 3600_000), base)).toMatchObject({ reason: "outside_availability" });
  });
  it("respects the travel buffer between bookings", () => {
    const [bs, be] = at("10:00");
    const ctx = { ...base, busy: [{ start: bs, end: be }] };
    expect(checkSlot(...at("11:15"), ctx)).toMatchObject({ reason: "slot_unavailable" });
    expect(checkSlot(...at("11:30"), ctx)).toEqual({ ok: true });
  });
  it("enforces the daily cap and blocked dates", () => {
    const busy = [at("08:00"), at("12:00")].map(([start, end]) => ({ start, end }));
    expect(checkSlot(...at("15:00"), { ...base, busy })).toMatchObject({ reason: "daily_limit" });
    const exc = { startsAt: algeriaLocalToUtc("2026-10-20", "00:00"), endsAt: algeriaLocalToUtc("2026-10-21", "00:00") };
    expect(checkSlot(...at("09:00"), { ...base, exceptions: [exc] })).toMatchObject({ reason: "outside_availability" });
    expect(worksOnDate("2026-10-20", { ...base, exceptions: [exc] })).toBe(false);
    expect(worksOnDate("2026-10-20", base)).toBe(true);
  });
  it("refuses when the technician is on vacation", () => {
    expect(checkSlot(...at("09:00"), { ...base, availabilityStatus: "vacation" })).toMatchObject({ reason: "technician_unavailable" });
  });
});

describe("permissions", () => {
  it("maps roles to permissions with least privilege", () => {
    expect(hasPermission(["support_agent"], "disputes.handle")).toBe(true);
    expect(hasPermission(["support_agent"], "verification.documents.read")).toBe(false);
    expect(hasPermission(["administrator"], "settings.sensitive")).toBe(false);
    expect(hasPermission(["super_administrator"], "settings.sensitive")).toBe(true);
    expect(hasPermission(["client", "technician"], "admin.access")).toBe(false);
  });
  it("only super admins grant staff roles; nobody grants client/technician", () => {
    expect(canGrantRole(["administrator"], "administrator")).toBe(false);
    expect(canGrantRole(["super_administrator"], "support_agent")).toBe(true);
    expect(canGrantRole(["super_administrator"], "technician")).toBe(false);
  });
  it("routes users home by role", () => {
    expect(homeForRoles(["client"])).toBe("/client");
    expect(homeForRoles(["client", "technician"])).toBe("/technicien");
    expect(homeForRoles(["client", "administrator"])).toBe("/admin");
  });
});
