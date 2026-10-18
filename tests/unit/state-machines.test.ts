import { describe, expect, it } from "vitest";
import {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  allowedBookingTransitions,
  assertBookingTransition,
  assertQuoteTransition,
  assertVerificationTransition,
  canOpenDispute,
  canReview,
  canTransition,
  clientCanCancelConfirmed,
  requestAcceptsQuotes,
  TERMINAL_BOOKING_STATUSES,
} from "@/lib/domain/state-machines";

describe("booking state machine", () => {
  it("follows the happy path with the right actors", () => {
    expect(() => assertBookingTransition("requested", "confirmed", "technician")).not.toThrow();
    expect(() => assertBookingTransition("confirmed", "technician_en_route", "technician")).not.toThrow();
    expect(() => assertBookingTransition("technician_en_route", "in_progress", "technician")).not.toThrow();
    expect(() => assertBookingTransition("in_progress", "awaiting_completion_confirmation", "technician")).not.toThrow();
    expect(() => assertBookingTransition("awaiting_completion_confirmation", "completed", "client")).not.toThrow();
  });
  it("rejects transitions by the wrong actor", () => {
    expect(() => assertBookingTransition("requested", "confirmed", "client")).toThrow();
    expect(() => assertBookingTransition("confirmed", "in_progress", "client")).toThrow();
    expect(() => assertBookingTransition("awaiting_completion_confirmation", "completed", "technician")).toThrow();
    expect(() => assertBookingTransition("disputed", "completed", "client")).toThrow();
  });
  it("never leaves terminal states except completed → disputed", () => {
    for (const s of TERMINAL_BOOKING_STATUSES) {
      for (const to of BOOKING_STATUSES) {
        for (const actor of ["client", "technician", "staff", "system"] as const) {
          const allowed = canTransition(BOOKING_TRANSITIONS, s, to, actor);
          if (s === "completed" && to === "disputed" && (actor === "client" || actor === "technician")) expect(allowed).toBe(true);
          else expect(allowed).toBe(false);
        }
      }
    }
  });
  it("only staff resolve disputes", () => {
    expect(allowedBookingTransitions("disputed", "staff").sort()).toEqual(["cancelled", "completed"]);
    expect(allowedBookingTransitions("disputed", "client")).toEqual([]);
  });
  it("only the system expires holds and auto-completes", () => {
    expect(canTransition(BOOKING_TRANSITIONS, "requested", "expired", "system")).toBe(true);
    expect(canTransition(BOOKING_TRANSITIONS, "requested", "expired", "client")).toBe(false);
    expect(canTransition(BOOKING_TRANSITIONS, "awaiting_completion_confirmation", "completed", "system")).toBe(true);
  });
});

describe("quote, request and verification machines", () => {
  it("quotes can be accepted only from sent, by the client", () => {
    expect(() => assertQuoteTransition("sent", "accepted", "client")).not.toThrow();
    expect(() => assertQuoteTransition("sent", "accepted", "technician")).toThrow();
    expect(() => assertQuoteTransition("expired", "accepted", "client")).toThrow(/quote_expired/);
    expect(() => assertQuoteTransition("rejected", "accepted", "client")).toThrow(/quote_not_available/);
  });
  it("requests accept quotes only while open", () => {
    expect(requestAcceptsQuotes("awaiting_quote")).toBe(true);
    expect(requestAcceptsQuotes("quote_received")).toBe(true);
    expect(requestAcceptsQuotes("booked")).toBe(false);
    expect(requestAcceptsQuotes("expired")).toBe(false);
  });
  it("technicians cannot approve themselves", () => {
    expect(() => assertVerificationTransition("submitted", "approved", "technician")).toThrow();
    expect(() => assertVerificationTransition("submitted", "approved", "staff")).not.toThrow();
    expect(() => assertVerificationTransition("draft", "approved", "staff")).toThrow();
    expect(() => assertVerificationTransition("rejected", "submitted", "technician")).not.toThrow();
  });
});

describe("policies", () => {
  const now = new Date("2026-10-20T10:00:00Z");
  it("free cancellation window", () => {
    expect(clientCanCancelConfirmed(new Date("2026-10-21T10:00:00Z"), now, 12)).toBe(true);
    expect(clientCanCancelConfirmed(new Date("2026-10-20T20:00:00Z"), now, 12)).toBe(false);
  });
  it("review eligibility", () => {
    expect(canReview({ bookingStatus: "completed", isBookingClient: true, alreadyReviewed: false })).toBe(true);
    expect(canReview({ bookingStatus: "cancelled", isBookingClient: true, alreadyReviewed: false })).toBe(false);
    expect(canReview({ bookingStatus: "completed", isBookingClient: false, alreadyReviewed: false })).toBe(false);
    expect(canReview({ bookingStatus: "completed", isBookingClient: true, alreadyReviewed: true })).toBe(false);
  });
  it("dispute window", () => {
    expect(canOpenDispute({ bookingStatus: "in_progress", completedAt: null, now, windowDays: 7 })).toBe(true);
    expect(canOpenDispute({ bookingStatus: "completed", completedAt: new Date("2026-10-18T10:00:00Z"), now, windowDays: 7 })).toBe(true);
    expect(canOpenDispute({ bookingStatus: "completed", completedAt: new Date("2026-10-01T10:00:00Z"), now, windowDays: 7 })).toBe(false);
    expect(canOpenDispute({ bookingStatus: "confirmed", completedAt: null, now, windowDays: 7 })).toBe(false);
  });
});
