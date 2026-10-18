/**
 * Central, typed state-transition rules. Pure functions — no I/O — so they can
 * be unit-tested exhaustively. Services call `assertTransition` inside a
 * transaction after locking the row (SELECT … FOR UPDATE).
 */
import { AppError } from "@/lib/errors";

export type Actor = "client" | "technician" | "staff" | "system";

/* ----------------------------- Bookings ----------------------------- */

export const BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "technician_en_route",
  "in_progress",
  "awaiting_completion_confirmation",
  "completed",
  "cancelled",
  "disputed",
  "expired",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that occupy the technician's calendar (mirrors the DB exclusion constraint). */
export const ACTIVE_SLOT_STATUSES: BookingStatus[] = ["requested", "confirmed", "technician_en_route", "in_progress"];
export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ["completed", "cancelled", "expired"];

type TransitionTable<S extends string> = Partial<Record<S, Partial<Record<S, readonly Actor[]>>>>;

export const BOOKING_TRANSITIONS: TransitionTable<BookingStatus> = {
  requested: {
    confirmed: ["technician"],
    cancelled: ["client", "technician", "staff"],
    expired: ["system"],
  },
  confirmed: {
    technician_en_route: ["technician"],
    in_progress: ["technician"],
    cancelled: ["client", "technician", "staff"],
  },
  technician_en_route: {
    in_progress: ["technician"],
    cancelled: ["staff"],
    disputed: ["client", "technician"],
  },
  in_progress: {
    awaiting_completion_confirmation: ["technician"],
    disputed: ["client", "technician"],
  },
  awaiting_completion_confirmation: {
    completed: ["client", "system"],
    disputed: ["client", "technician"],
  },
  completed: {
    disputed: ["client", "technician"],
  },
  disputed: {
    completed: ["staff"],
    cancelled: ["staff"],
  },
};

export function canTransition<S extends string>(
  table: TransitionTable<S>,
  from: S,
  to: S,
  actor: Actor,
): boolean {
  return Boolean(table[from]?.[to]?.includes(actor));
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus, actor: Actor) {
  if (!canTransition(BOOKING_TRANSITIONS, from, to, actor)) throw new AppError("invalid_transition", 409);
}

export function allowedBookingTransitions(from: BookingStatus, actor: Actor): BookingStatus[] {
  const row = BOOKING_TRANSITIONS[from] ?? {};
  return (Object.keys(row) as BookingStatus[]).filter((to) => row[to]?.includes(actor));
}

/* ------------------------------ Quotes ------------------------------ */

export const QUOTE_STATUSES = ["sent", "accepted", "rejected", "superseded", "withdrawn", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_TRANSITIONS: TransitionTable<QuoteStatus> = {
  sent: {
    accepted: ["client"],
    rejected: ["client", "system"],
    superseded: ["technician"],
    withdrawn: ["technician"],
    expired: ["system"],
  },
};

export function assertQuoteTransition(from: QuoteStatus, to: QuoteStatus, actor: Actor) {
  if (!canTransition(QUOTE_TRANSITIONS, from, to, actor)) {
    throw new AppError(from === "expired" ? "quote_expired" : "quote_not_available", 409);
  }
}

/* --------------------------- Requests ------------------------------- */

export const REQUEST_STATUSES = ["awaiting_quote", "quote_received", "booked", "cancelled", "expired"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_TRANSITIONS: TransitionTable<RequestStatus> = {
  awaiting_quote: { quote_received: ["system"], booked: ["system"], cancelled: ["client", "staff"], expired: ["system"] },
  quote_received: { awaiting_quote: ["system"], booked: ["system"], cancelled: ["client", "staff"], expired: ["system"] },
  // When the resulting booking is cancelled/declined/expired, the request closes; the client creates a new one.
  booked: { cancelled: ["system", "staff"], expired: ["system"] },
};

export function assertRequestTransition(from: RequestStatus, to: RequestStatus, actor: Actor) {
  if (!canTransition(REQUEST_TRANSITIONS, from, to, actor)) throw new AppError("request_closed", 409);
}

export function requestAcceptsQuotes(status: RequestStatus) {
  return status === "awaiting_quote" || status === "quote_received";
}

/* ------------------------- Verification ----------------------------- */

export const VERIFICATION_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "additional_information_required",
  "approved",
  "rejected",
  "suspended",
  "expired",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_TRANSITIONS: TransitionTable<VerificationStatus> = {
  draft: { submitted: ["technician"] },
  submitted: {
    under_review: ["staff"],
    approved: ["staff"],
    rejected: ["staff"],
    additional_information_required: ["staff"],
  },
  under_review: { approved: ["staff"], rejected: ["staff"], additional_information_required: ["staff"] },
  additional_information_required: { submitted: ["technician"], rejected: ["staff"] },
  rejected: { submitted: ["technician"] },
  approved: { suspended: ["staff"], expired: ["system"], submitted: ["technician"] },
  suspended: { approved: ["staff"], rejected: ["staff"] },
  expired: { submitted: ["technician"] },
};

export function assertVerificationTransition(from: VerificationStatus, to: VerificationStatus, actor: Actor) {
  if (!canTransition(VERIFICATION_TRANSITIONS, from, to, actor)) throw new AppError("invalid_transition", 409);
}

/* ---------------------------- Disputes ------------------------------ */

export const DISPUTE_STATUSES = ["open", "under_review", "awaiting_information", "resolved", "closed"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const DISPUTE_TRANSITIONS: TransitionTable<DisputeStatus> = {
  open: { under_review: ["staff"], awaiting_information: ["staff"], resolved: ["staff"] },
  under_review: { awaiting_information: ["staff"], resolved: ["staff"] },
  awaiting_information: { under_review: ["staff", "client", "technician"], resolved: ["staff"] },
  resolved: { closed: ["staff", "system"] },
};

export function assertDisputeTransition(from: DisputeStatus, to: DisputeStatus, actor: Actor) {
  if (!canTransition(DISPUTE_TRANSITIONS, from, to, actor)) throw new AppError("invalid_transition", 409);
}

/** Booking statuses from which a dispute can be opened. */
export const DISPUTABLE_BOOKING_STATUSES: BookingStatus[] = [
  "technician_en_route",
  "in_progress",
  "awaiting_completion_confirmation",
  "completed",
];

/* --------------------------- Policies ------------------------------- */

export function clientCanCancelConfirmed(scheduledStart: Date, now: Date, freeCancellationHours: number) {
  return scheduledStart.getTime() - now.getTime() >= freeCancellationHours * 3600_000;
}

export function canReview(params: { bookingStatus: BookingStatus; isBookingClient: boolean; alreadyReviewed: boolean }) {
  return params.bookingStatus === "completed" && params.isBookingClient && !params.alreadyReviewed;
}

export function canOpenDispute(params: {
  bookingStatus: BookingStatus;
  completedAt: Date | null;
  now: Date;
  windowDays: number;
}) {
  if (!DISPUTABLE_BOOKING_STATUSES.includes(params.bookingStatus)) return false;
  if (params.bookingStatus === "completed") {
    if (!params.completedAt) return false;
    return params.now.getTime() - params.completedAt.getTime() <= params.windowDays * 86400_000;
  }
  return true;
}
