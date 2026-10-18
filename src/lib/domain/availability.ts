/**
 * Pure availability rules (Algeria local time, UTC+1, no DST).
 */
import { timeToMinutes, utcToAlgeriaParts } from "@/lib/time";

export interface WeeklySlot {
  weekday: number; // 0 = Sunday
  startTime: string; // "HH:MM[:SS]"
  endTime: string;
  isActive: boolean;
}
export interface Exception {
  startsAt: Date;
  endsAt: Date;
}
export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface AvailabilityContext {
  weekly: WeeklySlot[];
  exceptions: Exception[];
  busy: BusyInterval[];
  travelBufferMinutes: number;
  maxDailyJobs: number;
  availabilityStatus: "available" | "unavailable" | "vacation";
}

export type AvailabilityResult =
  | { ok: true }
  | { ok: false; reason: "technician_unavailable" | "outside_availability" | "slot_unavailable" | "daily_limit" };

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Does [start, end) fit the technician's working hours, exceptions, buffer and daily cap? */
export function checkSlot(start: Date, end: Date, ctx: AvailabilityContext): AvailabilityResult {
  if (ctx.availabilityStatus !== "available") return { ok: false, reason: "technician_unavailable" };
  if (end <= start) return { ok: false, reason: "outside_availability" };

  const s = utcToAlgeriaParts(start);
  const e = utcToAlgeriaParts(end);
  // Appointments must start and end on the same local day
  if (s.date !== e.date && !(e.minutes === 0 && end.getTime() - start.getTime() <= 24 * 3600_000)) {
    return { ok: false, reason: "outside_availability" };
  }
  const endMinutes = e.minutes === 0 && s.date !== e.date ? 24 * 60 : e.minutes;

  const fits = ctx.weekly.some(
    (w) =>
      w.isActive &&
      w.weekday === s.weekday &&
      timeToMinutes(w.startTime) <= s.minutes &&
      timeToMinutes(w.endTime) >= endMinutes,
  );
  if (!fits) return { ok: false, reason: "outside_availability" };

  if (ctx.exceptions.some((x) => overlaps(start.getTime(), end.getTime(), x.startsAt.getTime(), x.endsAt.getTime()))) {
    return { ok: false, reason: "outside_availability" };
  }

  const buffer = ctx.travelBufferMinutes * 60_000;
  if (
    ctx.busy.some((b) =>
      overlaps(start.getTime() - buffer, end.getTime() + buffer, b.start.getTime(), b.end.getTime()),
    )
  ) {
    return { ok: false, reason: "slot_unavailable" };
  }

  const sameDay = ctx.busy.filter((b) => utcToAlgeriaParts(b.start).date === s.date).length;
  if (sameDay >= ctx.maxDailyJobs) return { ok: false, reason: "daily_limit" };

  return { ok: true };
}

/** Does the technician work at all on this local date (used for discovery's "available on" filter)? */
export function worksOnDate(date: string, ctx: Pick<AvailabilityContext, "weekly" | "exceptions" | "availabilityStatus">) {
  if (ctx.availabilityStatus !== "available") return false;
  const weekday = new Date(`${date}T12:00:00+01:00`).getUTCDay();
  const dayStart = new Date(`${date}T00:00:00+01:00`).getTime();
  const dayEnd = dayStart + 24 * 3600_000;
  const slots = ctx.weekly.filter((w) => w.isActive && w.weekday === weekday);
  if (!slots.length) return false;
  const fullyBlocked = ctx.exceptions.some((x) => x.startsAt.getTime() <= dayStart && x.endsAt.getTime() >= dayEnd);
  return !fullyBlocked;
}
