import "server-only";
import { and, eq, gt, inArray, lt, ne, sql } from "drizzle-orm";
import { schema, type DbOrTx } from "@/db";
import { AppError, pgCode } from "@/lib/errors";
import { checkSlot, type AvailabilityContext } from "@/lib/domain/availability";
import { ACTIVE_SLOT_STATUSES } from "@/lib/domain/state-machines";

/**
 * Locks the technician row (serializes all calendar writes for this technician)
 * and verifies the slot against hours, exceptions, travel buffer and daily cap.
 * The DB exclusion constraint remains the final guard against overlaps.
 */
export async function lockAndCheckSlot(
  tx: DbOrTx,
  technicianId: string,
  start: Date,
  end: Date,
  opts: { excludeBookingId?: string } = {},
) {
  const [tp] = await tx
    .select()
    .from(schema.technicianProfiles)
    .where(eq(schema.technicianProfiles.id, technicianId))
    .for("update");
  if (!tp) throw new AppError("not_found", 404);
  if (tp.verificationStatus !== "approved") throw new AppError("technician_unavailable", 409);

  const [account] = await tx
    .select({ status: schema.profiles.accountStatus })
    .from(schema.profiles)
    .where(eq(schema.profiles.id, tp.userId));
  if (account?.status !== "active") throw new AppError("technician_unavailable", 409);

  const dayStart = new Date(start.getTime() - 36 * 3600_000);
  const dayEnd = new Date(end.getTime() + 36 * 3600_000);

  const [weekly, exceptions, busy] = await Promise.all([
    tx.select().from(schema.technicianAvailability).where(eq(schema.technicianAvailability.technicianId, technicianId)),
    tx
      .select()
      .from(schema.availabilityExceptions)
      .where(
        and(
          eq(schema.availabilityExceptions.technicianId, technicianId),
          lt(schema.availabilityExceptions.startsAt, dayEnd),
          gt(schema.availabilityExceptions.endsAt, dayStart),
        ),
      ),
    tx
      .select({ id: schema.bookings.id, start: schema.bookings.scheduledStartAt, end: schema.bookings.scheduledEndAt })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.technicianId, technicianId),
          inArray(schema.bookings.status, ACTIVE_SLOT_STATUSES),
          lt(schema.bookings.scheduledStartAt, dayEnd),
          gt(schema.bookings.scheduledEndAt, dayStart),
          opts.excludeBookingId ? ne(schema.bookings.id, opts.excludeBookingId) : sql`true`,
        ),
      ),
  ]);

  const ctx: AvailabilityContext = {
    weekly: weekly.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime, isActive: w.isActive })),
    exceptions: exceptions.map((x) => ({ startsAt: x.startsAt, endsAt: x.endsAt })),
    busy: busy.map((b) => ({ start: b.start, end: b.end })),
    travelBufferMinutes: tp.travelBufferMinutes,
    maxDailyJobs: tp.maxDailyJobs,
    availabilityStatus: tp.availabilityStatus,
  };
  const result = checkSlot(start, end, ctx);
  if (!result.ok) throw new AppError(result.reason, 409);
  return tp;
}

/** Map an exclusion-constraint violation to a friendly business error. */
export function mapSlotConflict(err: unknown): never {
  if (pgCode(err) === "23P01") throw new AppError("slot_unavailable", 409);
  throw err;
}
