/**
 * Algeria uses CET (UTC+01:00) all year round, without daylight saving time.
 * Timestamps are stored in UTC; appointment inputs are interpreted in Algeria time.
 */
export const APP_TIME_ZONE = "Africa/Algiers";
const OFFSET = "+01:00";

/** "2026-10-20" + "09:30" (Algeria local) → Date (UTC instant) */
export function algeriaLocalToUtc(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Invalid date/time");
  const d = new Date(`${date}T${time}:00${OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date/time");
  return d;
}

/** Date (UTC instant) → { date: "YYYY-MM-DD", time: "HH:MM", weekday: 0-6 } in Algeria time */
export function utcToAlgeriaParts(d: Date): { date: string; time: string; weekday: number; minutes: number } {
  const shifted = new Date(d.getTime() + 60 * 60 * 1000);
  const iso = shifted.toISOString();
  const hh = shifted.getUTCHours();
  const mm = shifted.getUTCMinutes();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    weekday: shifted.getUTCDay(),
    minutes: hh * 60 + mm,
  };
}

export function todayInAlgeria(now = new Date()): string {
  return utcToAlgeriaParts(now).date;
}

export function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3600_000);
}
export function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60_000);
}
export function addDays(d: Date, days: number) {
  return new Date(d.getTime() + days * 86_400_000);
}

export const TIME_WINDOWS = {
  morning: { start: "08:00", end: "12:00" },
  afternoon: { start: "12:00", end: "17:00" },
  evening: { start: "17:00", end: "20:00" },
  flexible: { start: "08:00", end: "20:00" },
} as const;

/** "HH:MM" or "HH:MM:SS" → minutes since midnight */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
}

/** Date N days before now (helper kept outside components for render purity). */
export function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}
