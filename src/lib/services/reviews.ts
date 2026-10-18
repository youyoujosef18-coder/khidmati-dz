import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema, type DbOrTx } from "@/db";
import { AppError, pgCode } from "@/lib/errors";
import { canReview, type BookingStatus } from "@/lib/domain/state-machines";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "./types";

/** Ratings are only displayed publicly from this many published reviews. */
export const MIN_REVIEWS_FOR_AVERAGE = 3;

export const reviewSchema = z.object({
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1, "validation.rating").max(5, "validation.rating"),
  comment: z.string().trim().max(1500).optional().default(""),
});

/** Derived rating is always recomputed on the server from published reviews. */
export async function recomputeRating(tx: DbOrTx, technicianId: string) {
  await tx.execute(sql`
    UPDATE technician_profiles tp SET
      average_rating_derived = sub.avg,
      review_count_derived = sub.cnt
    FROM (
      SELECT round(avg(rating)::numeric, 2) AS avg, count(*)::int AS cnt
      FROM reviews WHERE technician_id = ${technicianId} AND moderation_status = 'published'
    ) sub
    WHERE tp.id = ${technicianId}`);
}

export async function createReview(actor: Actor, input: z.infer<typeof reviewSchema>) {
  try {
    await db.transaction(async (tx) => {
      const [b] = await tx.select().from(schema.bookings).where(eq(schema.bookings.id, input.bookingId)).for("update");
      if (!b) throw new AppError("not_found", 404);
      const [existing] = await tx
        .select({ id: schema.reviews.id })
        .from(schema.reviews)
        .where(and(eq(schema.reviews.bookingId, b.id), eq(schema.reviews.clientId, actor.id)));
      if (!canReview({ bookingStatus: b.status as BookingStatus, isBookingClient: b.clientId === actor.id, alreadyReviewed: Boolean(existing) })) {
        throw new AppError(existing ? "review_exists" : "review_not_allowed", 409);
      }
      await tx.insert(schema.reviews).values({
        bookingId: b.id,
        clientId: actor.id,
        technicianId: b.technicianId,
        rating: input.rating,
        comment: input.comment || null,
      });
      await recomputeRating(tx, b.technicianId);
      const [tp] = await tx.select({ userId: schema.technicianProfiles.userId }).from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, b.technicianId));
      await notify({ userId: tp!.userId, type: "review_received", params: { rating: input.rating }, link: "/technicien/avis" }, tx);
    });
  } catch (err) {
    if (pgCode(err) === "23505") throw new AppError("review_exists", 409);
    throw err;
  }
}

export async function moderateReview(staff: Actor, reviewId: string, status: "published" | "hidden", reason: string) {
  if (!reason.trim()) throw new AppError("validation", 400);
  await db.transaction(async (tx) => {
    const [r] = await tx
      .update(schema.reviews)
      .set({ moderationStatus: status, moderationReason: reason, moderatedBy: staff.id })
      .where(eq(schema.reviews.id, reviewId))
      .returning();
    if (!r) throw new AppError("not_found", 404);
    await recomputeRating(tx, r.technicianId);
    await writeAudit({ actorId: staff.id, action: `review.${status}`, entityType: "review", entityId: r.id, reason }, tx);
  });
}

export async function listTechnicianReviews(technicianId: string, opts: { publishedOnly: boolean; page?: number; pageSize?: number }) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 10;
  const where = and(
    eq(schema.reviews.technicianId, technicianId),
    opts.publishedOnly ? eq(schema.reviews.moderationStatus, "published") : sql`true`,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: schema.reviews.id,
        rating: schema.reviews.rating,
        comment: schema.reviews.comment,
        createdAt: schema.reviews.createdAt,
        moderationStatus: schema.reviews.moderationStatus,
        clientName: schema.profiles.displayName,
        bookingTitle: schema.bookings.title,
      })
      .from(schema.reviews)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.reviews.clientId))
      .innerJoin(schema.bookings, eq(schema.bookings.id, schema.reviews.bookingId))
      .where(where)
      .orderBy(desc(schema.reviews.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.reviews).where(where),
  ]);
  return { rows, total, page, pageSize };
}
