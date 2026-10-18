import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { authenticate, registerUser } from "@/lib/services/auth";
import { createServiceRequest } from "@/lib/services/requests";
import { acceptQuote, rejectQuote, sendQuote, withdrawQuote } from "@/lib/services/quotes";
import {
  createFixedPriceBooking,
  expireBookingHolds,
  getBookingDetail,
  performBookingAction,
  proposeReschedule,
  recordCashPayment,
  respondReschedule,
} from "@/lib/services/bookings";
import { createReview } from "@/lib/services/reviews";
import { openDispute, resolveDispute } from "@/lib/services/disputes";
import { listMessages, sendMessage } from "@/lib/services/messaging";
import { searchTechnicians } from "@/lib/services/discovery";
import { ensureTechnicianProfile, submitApplication, decideApplication } from "@/lib/services/technicians";
import { grantRole, setAccountStatus } from "@/lib/services/admin";
import { canReadFile, storeUpload } from "@/lib/storage";
import { algeriaLocalToUtc } from "@/lib/time";
import type { Actor } from "@/lib/services/types";
import { actor, futureDate, key, makeAddress, makeApprovedTechnician, makeClient, makeStaff, pngBuffer } from "./helpers";

let admin: Actor;
let support: Actor;

beforeAll(async () => {
  admin = await makeStaff("super_administrator");
  support = await makeStaff("support_agent");
});

async function openRequest(client: Actor, opts: { targetSlug?: string; categoryId: string }) {
  const address = await makeAddress(client);
  return createServiceRequest(client, {
    idempotencyKey: key(),
    categoryId: opts.categoryId,
    targetTechnicianSlug: opts.targetSlug ?? "",
    serviceId: "",
    title: "Fuite sous l'évier",
    description: "L'eau coule sous l'évier de la cuisine depuis ce matin, merci.",
    urgency: "normal",
    addressId: address.id,
    preferredDate: futureDate(3),
    timeWindow: "morning",
    budgetDa: "",
    customerNotes: "",
    photoIds: [],
    confirm: "on",
  });
}

function quoteInput(requestId: string, day: number, time = "10:00", labor = "3000") {
  return {
    requestId,
    pricingModel: "fixed" as const,
    laborDa: Number(labor),
    materialsDa: 1500,
    travelDa: 500,
    otherDa: 0,
    otherNote: "",
    taxDa: 0,
    discountDa: 200,
    durationMinutes: 90,
    proposedDate: futureDate(day),
    proposedTime: time,
    validityHours: 48,
    terms: "",
    message: "Bonjour, je peux passer.",
    items: [],
  };
}

describe("authentication", () => {
  it("registers, rejects duplicates and authenticates by phone or email", async () => {
    const { userId } = await registerUser({ fullName: "Amina Test", email: "amina@test.khidmati", phone: "0555 99 88 77", password: "Secret123", preferredLocale: "ar-DZ", acceptTerms: "on" });
    await expect(
      registerUser({ fullName: "Other", email: "amina@test.khidmati", phone: "", password: "Secret123", preferredLocale: "fr-DZ", acceptTerms: "on" }),
    ).rejects.toMatchObject({ code: "email_taken" });
    await expect(
      registerUser({ fullName: "Other", email: "", phone: "+213555998877", password: "Secret123", preferredLocale: "fr-DZ", acceptTerms: "on" }),
    ).rejects.toMatchObject({ code: "phone_taken" });
    expect((await authenticate("0555998877", "Secret123")).userId).toBe(userId);
    expect((await authenticate("AMINA@test.khidmati", "Secret123")).locale).toBe("ar-DZ");
    await expect(authenticate("amina@test.khidmati", "wrong")).rejects.toMatchObject({ code: "invalid_credentials" });
    await expect(authenticate("nobody@test.khidmati", "Secret123")).rejects.toMatchObject({ code: "invalid_credentials" });
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(u!.passwordHash).not.toContain("Secret123");
  });

  it("suspension blocks login and revokes existing sessions", async () => {
    const c = await makeClient();
    await db.insert(schema.sessions).values({ id: `s-${c.id}`, userId: c.id, expiresAt: new Date(Date.now() + 86400_000) });
    await setAccountStatus(admin, c.id, "suspended", "Fraude suspectée");
    const [s] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, `s-${c.id}`));
    expect(s!.revokedAt).not.toBeNull();
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, c.id));
    await expect(authenticate(u!.email!, "Password1")).rejects.toMatchObject({ code: "account_suspended" });
  });

  it("users cannot escalate privileges; support cannot suspend", async () => {
    const c = await makeClient();
    await expect(grantRole(c, c.id, "administrator")).rejects.toMatchObject({ code: "forbidden" });
    const other = await makeClient();
    await expect(grantRole({ id: c.id, roles: ["administrator"] }, other.id, "administrator")).rejects.toMatchObject({ code: "forbidden" });
    await expect(setAccountStatus(support, other.id, "suspended", "x")).rejects.toMatchObject({ code: "forbidden" });
  });
});

describe("technician verification", () => {
  it("rejects incomplete applications and hides unapproved technicians", async () => {
    const c = await makeClient();
    await ensureTechnicianProfile(c, "Incomplet");
    const t = await actor(c.id);
    await expect(submitApplication(t)).rejects.toMatchObject({ code: "profile_incomplete" });
    const res = await searchTechnicians({ q: "Incomplet" });
    expect(res.rows.length).toBe(0);
  });

  it("approval makes the profile public; technicians cannot decide their own application", async () => {
    const { tp } = await makeApprovedTechnician(admin);
    expect(tp.verificationStatus).toBe("approved");
    const found = await searchTechnicians({ q: tp.publicName });
    expect(found.rows.map((r) => r.id)).toContain(tp.id);
    const self = await actor(tp.userId);
    await expect(decideApplication({ ...self, roles: [...self.roles, "administrator"] }, { technicianId: tp.id, decision: "suspended", reason: "x", approveCategoryIds: [] })).rejects.toMatchObject({ code: "self_action" });
    const [hist] = await db.select().from(schema.verificationReviews).where(and(eq(schema.verificationReviews.technicianId, tp.id), eq(schema.verificationReviews.newStatus, "approved")));
    expect(hist!.actorId).toBe(admin.id);
  });

  it("verification documents are private: owner and admins only, not support agents", async () => {
    const t = await makeApprovedTechnician(admin);
    const [doc] = await db.select().from(schema.technicianDocuments).where(eq(schema.technicianDocuments.technicianId, t.tp.id));
    const [file] = await db.select().from(schema.files).where(eq(schema.files.id, doc!.fileId));
    const meta = { id: file!.id, bucket: file!.bucket, ownerId: file!.ownerId, entityType: file!.entityType, entityId: file!.entityId };
    expect((await canReadFile(meta, { userId: t.tech.id, roles: t.tech.roles })).allowed).toBe(true);
    expect((await canReadFile(meta, { userId: admin.id, roles: admin.roles })).allowed).toBe(true);
    expect((await canReadFile(meta, { userId: support.id, roles: support.roles })).allowed).toBe(false);
    const stranger = await makeClient();
    expect((await canReadFile(meta, { userId: stranger.id, roles: stranger.roles })).allowed).toBe(false);
    expect((await canReadFile(meta, { userId: null, roles: [] })).allowed).toBe(false);
  });

  it("uploads validate real content, not the file name", async () => {
    const c = await makeClient();
    await expect(storeUpload({ ownerId: c.id, bucket: "service-request-media", data: Buffer.from("<script>alert(1)</script>") })).rejects.toMatchObject({ code: "file_type" });
    const ok = await storeUpload({ ownerId: c.id, bucket: "service-request-media", data: await pngBuffer(), originalName: "photo.exe" });
    expect(ok.mimeType).toBe("image/webp");
  });
});

describe("requests, quotes and bookings", () => {
  it("matches only eligible technicians and is idempotent", async () => {
    const { tp, category } = await makeApprovedTechnician(admin);
    const outsider = await makeApprovedTechnician(admin, { wilaya: "31", communeName: "Oran" });
    const client = await makeClient();
    const address = await makeAddress(client);
    const input = {
      idempotencyKey: key(),
      categoryId: category.id,
      targetTechnicianSlug: "",
      serviceId: "",
      title: "Robinet qui fuit",
      description: "Le robinet de la salle de bain goutte en permanence.",
      urgency: "normal" as const,
      addressId: address.id,
      preferredDate: "",
      timeWindow: "flexible" as const,
      budgetDa: "",
      customerNotes: "",
      photoIds: [],
      confirm: "on" as const,
    };
    const first = await createServiceRequest(client, input);
    const again = await createServiceRequest(client, input);
    expect(again.id).toBe(first.id);
    const matches = await db.select().from(schema.requestMatches).where(eq(schema.requestMatches.requestId, first.id));
    const ids = matches.map((m) => m.technicianId);
    expect(ids).toContain(tp.id);
    expect(ids).not.toContain(outsider.tp.id);
    const notif = await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, tp.userId), eq(schema.notifications.type, "new_job_request")));
    expect(notif.length).toBeGreaterThan(0);
    expect(notif[0]!.body).not.toContain("rue des Oliviers"); // no private address in bulk notifications
  });

  it("only matched technicians can quote; totals are computed on the server; revisions supersede", async () => {
    const a = await makeApprovedTechnician(admin);
    const b = await makeApprovedTechnician(admin, { wilaya: "31", communeName: "Oran" });
    const client = await makeClient();
    const req = await openRequest(client, { targetSlug: a.tp.slug, categoryId: a.category.id });
    await expect(sendQuote(b.tech, quoteInput(req.id, 3))).rejects.toMatchObject({ code: "not_eligible" });
    const q1 = await sendQuote(a.tech, quoteInput(req.id, 3));
    const [quote1] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, q1.quoteId));
    expect(quote1!.totalMinor).toBe((3000 + 1500 + 500 - 200) * 100);
    const q2 = await sendQuote(a.tech, quoteInput(req.id, 3, "11:00", "3500"));
    const [old] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, q1.quoteId));
    const [rev] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, q2.quoteId));
    expect(old!.status).toBe("superseded");
    expect(rev!.revisionNumber).toBe(2);
    await expect(acceptQuote(client, q1.quoteId)).rejects.toMatchObject({ code: "quote_not_available" });
    const [r] = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, req.id));
    expect(r!.status).toBe("quote_received");
    await withdrawQuote(a.tech, q2.quoteId);
    const [r2] = await db.select().from(schema.serviceRequests).where(eq(schema.serviceRequests.id, req.id));
    expect(r2!.status).toBe("awaiting_quote");
  });

  it("accepting a quote books atomically, rejects competitors and blocks double acceptance", async () => {
    const a = await makeApprovedTechnician(admin);
    const b = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const req = await openRequest(client, { categoryId: a.category.id });
    const qa = await sendQuote(a.tech, quoteInput(req.id, 4, "09:00"));
    const qb = await sendQuote(b.tech, quoteInput(req.id, 4, "09:00"));
    const stranger = await makeClient();
    await expect(acceptQuote(stranger, qa.quoteId)).rejects.toMatchObject({ code: "not_found" });
    const booking = await acceptQuote(client, qa.quoteId, key());
    const [bk] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, booking.id));
    expect(bk!.status).toBe("confirmed");
    expect(bk!.agreedTotalMinor).toBe(480000);
    const [other] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, qb.quoteId));
    expect(other!.status).toBe("rejected");
    await expect(acceptQuote(client, qb.quoteId)).rejects.toMatchObject({ code: "request_already_booked" });
    const history = await db.select().from(schema.bookingStatusHistory).where(eq(schema.bookingStatusHistory.bookingId, booking.id));
    expect(history.map((h) => h.newStatus)).toEqual(["confirmed"]);
  });

  it("concurrent acceptances cannot double-book the same technician slot", async () => {
    const t = await makeApprovedTechnician(admin);
    const c1 = await makeClient();
    const c2 = await makeClient();
    const r1 = await openRequest(c1, { targetSlug: t.tp.slug, categoryId: t.category.id });
    const r2 = await openRequest(c2, { targetSlug: t.tp.slug, categoryId: t.category.id });
    const q1 = await sendQuote(t.tech, quoteInput(r1.id, 6, "14:00"));
    const q2 = await sendQuote(t.tech, quoteInput(r2.id, 6, "14:30"));
    const results = await Promise.allSettled([acceptQuote(c1, q1.quoteId), acceptQuote(c2, q2.quoteId)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok.length).toBe(1);
    expect(failed.length).toBe(1);
    expect(["slot_unavailable"]).toContain((failed[0]!.reason as { code: string }).code);
  });

  it("the database exclusion constraint rejects overlapping active bookings even if app checks were bypassed", async () => {
    const t = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const address = await makeAddress(client);
    const start = algeriaLocalToUtc(futureDate(9), "10:00");
    const row = {
      clientId: client.id, technicianId: t.tp.id, categoryId: t.category.id, addressId: address.id, wilayaCode: "16", communeId: address.communeId,
      title: "x", scheduledStartAt: start, scheduledEndAt: new Date(start.getTime() + 3600_000), status: "confirmed" as const, pricingModel: "fixed" as const, agreedTotalMinor: 1000,
    };
    await db.insert(schema.bookings).values({ ...row, reference: `T-${key()}` });
    await expect(db.insert(schema.bookings).values({ ...row, reference: `T-${key()}`, scheduledStartAt: new Date(start.getTime() + 1800_000) })).rejects.toBeTruthy();
    // cancelled bookings release the slot
    await db.insert(schema.bookings).values({ ...row, reference: `T-${key()}`, status: "cancelled" });
  });

  it("runs the full job lifecycle with role checks, payment, review and history", async () => {
    const t = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const req = await openRequest(client, { categoryId: t.category.id, targetSlug: t.tp.slug });
    const q = await sendQuote(t.tech, quoteInput(req.id, 2, "15:00"));
    const { id } = await acceptQuote(client, q.quoteId);

    await expect(performBookingAction(client, id, "start")).rejects.toMatchObject({ code: "forbidden" });
    await expect(performBookingAction(t.tech, id, "request_completion")).rejects.toMatchObject({ code: "invalid_transition" });
    await expect(createReview(client, { bookingId: id, rating: 5, comment: "" })).rejects.toMatchObject({ code: "review_not_allowed" });

    await performBookingAction(t.tech, id, "en_route");
    await performBookingAction(t.tech, id, "start");
    await recordCashPayment(t.tech, id, 4800, "");
    await expect(recordCashPayment(t.tech, id, 4800, "")).rejects.toMatchObject({ code: "payment_exists" });
    await performBookingAction(t.tech, id, "request_completion");
    await performBookingAction(client, id, "confirm_completion");

    const detail = await getBookingDetail(client, id);
    expect(detail!.booking.status).toBe("completed");
    expect(detail!.booking.paymentStatus).toBe("cash_recorded");
    expect(detail!.history.map((h) => h.newStatus)).toEqual(["confirmed", "technician_en_route", "in_progress", "awaiting_completion_confirmation", "completed"]);

    const outsider = await makeClient();
    expect(await getBookingDetail(outsider, id)).toBeNull();
    await expect(createReview(outsider, { bookingId: id, rating: 1, comment: "" })).rejects.toMatchObject({ code: "review_not_allowed" });
    await createReview(client, { bookingId: id, rating: 4, comment: "Travail propre." });
    await expect(createReview(client, { bookingId: id, rating: 5, comment: "" })).rejects.toMatchObject({ code: "review_exists" });
    const [tp] = await db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.id, t.tp.id));
    expect(tp!.reviewCountDerived).toBe(1);
    expect(Number(tp!.averageRatingDerived)).toBe(4);
  });

  it("enforces the free cancellation window and releases the slot", async () => {
    const t = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const req = await openRequest(client, { categoryId: t.category.id, targetSlug: t.tp.slug });
    // The appointment must start inside the free-cancellation window (< 12 h away) whatever the
    // time of day the suite runs, so this technician works all day and we pick the first 15-minute
    // slot ≥ 45 min from now whose 90-minute job ends the same local (Algeria, UTC+1) day.
    await db
      .update(schema.technicianAvailability)
      .set({ startTime: "00:00", endTime: "23:59" })
      .where(eq(schema.technicianAvailability.technicianId, t.tp.id));
    let local: Date | null = null;
    for (let k = 3; k < 40 && !local; k++) {
      const start = Math.ceil((Date.now() + k * 15 * 60_000) / (15 * 60_000)) * (15 * 60_000);
      const l = new Date(start + 3600_000); // Algeria wall-clock time expressed in UTC fields
      if (l.getUTCHours() * 60 + l.getUTCMinutes() + 90 <= 23 * 60 + 59) local = l;
    }
    const q = await sendQuote(t.tech, { ...quoteInput(req.id, 0), proposedDate: local!.toISOString().slice(0, 10), proposedTime: local!.toISOString().slice(11, 16) });
    const { id } = await acceptQuote(client, q.quoteId);
    await expect(performBookingAction(client, id, "cancel", "Changement de programme")).rejects.toMatchObject({ code: "cancellation_window" });
    await expect(performBookingAction(t.tech, id, "cancel", "")).rejects.toMatchObject({ code: "validation" });
    await performBookingAction(t.tech, id, "cancel", "Imprévu");
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b!.status).toBe("cancelled");
    const notif = await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, client.id), eq(schema.notifications.type, "booking_cancelled")));
    expect(notif.length).toBe(1);
  });

  it("reschedules only after the other party accepts", async () => {
    const t = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const req = await openRequest(client, { categoryId: t.category.id, targetSlug: t.tp.slug });
    const q = await sendQuote(t.tech, quoteInput(req.id, 5, "10:00"));
    const { id } = await acceptQuote(client, q.quoteId);
    const [before] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    await proposeReschedule(client, { bookingId: id, date: futureDate(5), time: "16:00", reason: "" });
    const [cr] = await db.select().from(schema.bookingChangeRequests).where(eq(schema.bookingChangeRequests.bookingId, id));
    await expect(respondReschedule(client, cr!.id, true)).rejects.toMatchObject({ code: "forbidden" });
    const [unchanged] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(unchanged!.scheduledStartAt.getTime()).toBe(before!.scheduledStartAt.getTime());
    await respondReschedule(t.tech, cr!.id, true);
    const [after] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(after!.scheduledStartAt.toISOString()).toBe(algeriaLocalToUtc(futureDate(5), "16:00").toISOString());
  });

  it("fixed-price bookings hold the slot and are released when the hold expires", async () => {
    const t = await makeApprovedTechnician(admin, { fixedPriceDa: 1500 });
    const client = await makeClient();
    const address = await makeAddress(client);
    const input = { idempotencyKey: key(), serviceId: t.service.id, addressId: address.id, date: futureDate(7), time: "09:00", description: "Changer un joint de robinet.", customerNotes: "", photoIds: [], confirm: "on" as const };
    const b = await createFixedPriceBooking(client, input);
    const again = await createFixedPriceBooking(client, input);
    expect(again.id).toBe(b.id);
    const other = await makeClient();
    const otherAddr = await makeAddress(other);
    await expect(createFixedPriceBooking(other, { ...input, idempotencyKey: key(), addressId: otherAddr.id })).rejects.toMatchObject({ code: "slot_unavailable" });
    await db.update(schema.bookings).set({ holdExpiresAt: new Date(Date.now() - 1000) }).where(eq(schema.bookings.id, b.id));
    expect(await expireBookingHolds()).toBeGreaterThanOrEqual(1);
    const [expired] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, b.id));
    expect(expired!.status).toBe("expired");
    const retry = await createFixedPriceBooking(other, { ...input, idempotencyKey: key(), addressId: otherAddr.id });
    expect(retry.id).toBeTruthy();
  });

  it("disputes are opened by participants and resolved only by authorized staff", async () => {
    const t = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const req = await openRequest(client, { categoryId: t.category.id, targetSlug: t.tp.slug });
    const q = await sendQuote(t.tech, quoteInput(req.id, 8, "10:00"));
    const { id } = await acceptQuote(client, q.quoteId);
    await expect(openDispute(client, { bookingId: id, category: "quality", description: "Le travail n'a pas été réalisé correctement.", evidenceIds: [] })).rejects.toMatchObject({ code: "dispute_not_allowed" });
    await performBookingAction(t.tech, id, "start");
    const d = await openDispute(client, { bookingId: id, category: "quality", description: "Le travail n'a pas été réalisé correctement.", evidenceIds: [] });
    await expect(openDispute(t.tech, { bookingId: id, category: "price", description: "Le client refuse de payer le montant convenu.", evidenceIds: [] })).rejects.toBeTruthy();
    await expect(resolveDispute(client, { disputeId: d.id, outcome: "cancelled", resolution: "Je décide moi-même." })).rejects.toMatchObject({ code: "forbidden" });
    await resolveDispute(support, { disputeId: d.id, outcome: "completed", resolution: "Intervention constatée comme réalisée après échange." });
    const [b] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, id));
    expect(b!.status).toBe("completed");
    const audit = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.action, "dispute.resolved"), eq(schema.auditLogs.entityId, d.id)));
    expect(audit.length).toBe(1);
  });
});

describe("messaging, notifications and integrity", () => {
  it("only participants can read and send messages", async () => {
    const t = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const req = await openRequest(client, { categoryId: t.category.id, targetSlug: t.tp.slug });
    await sendQuote(t.tech, quoteInput(req.id, 3));
    const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.requestId, req.id));
    await sendMessage(client, { conversationId: conv!.id, body: "Bonjour, à quelle heure ?", attachmentFileId: "" });
    const outsider = await makeClient();
    await expect(sendMessage(outsider, { conversationId: conv!.id, body: "hack", attachmentFileId: "" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(listMessages(outsider, conv!.id)).rejects.toMatchObject({ code: "not_found" });
    const { messages } = await listMessages(t.tech, conv!.id);
    expect(messages.some((m) => m.body === "Bonjour, à quelle heure ?")).toBe(true);
    const n = await db.select().from(schema.notifications).where(and(eq(schema.notifications.userId, t.tech.id), eq(schema.notifications.type, "new_message")));
    expect(n.length).toBeGreaterThan(0);
  });

  it("records honest delivery states when email/SMS providers are not configured", async () => {
    const rows = await db.execute<{ delivery_status: string; channel: string }>(sql`SELECT DISTINCT channel, delivery_status FROM notification_deliveries`);
    const map = rows.map((r) => `${r.channel}:${r.delivery_status}`);
    expect(map).toContain("in_app:delivered");
    expect(map.some((m) => m.startsWith("email:") || m.startsWith("sms:"))).toBe(true);
    expect(map.filter((m) => !m.startsWith("in_app")).every((m) => m.endsWith("skipped_not_configured"))).toBe(true);
  });

  it("audit logs, ledger and booking history are append-only", async () => {
    await expect(db.execute(sql`UPDATE audit_logs SET action = 'tampered'`)).rejects.toBeTruthy();
    await expect(db.execute(sql`DELETE FROM booking_status_history`)).rejects.toBeTruthy();
    await expect(db.execute(sql`UPDATE ledger_entries SET amount_minor = 0`)).rejects.toBeTruthy();
  });

  it("client request photos are visible to matched technicians but not to strangers", async () => {
    const t = await makeApprovedTechnician(admin);
    const client = await makeClient();
    const address = await makeAddress(client);
    const photo = await storeUpload({ ownerId: client.id, bucket: "service-request-media", data: await pngBuffer() });
    const req = await createServiceRequest(client, {
      idempotencyKey: key(), categoryId: t.category.id, targetTechnicianSlug: t.tp.slug, serviceId: "", title: "Photo test", description: "Description suffisamment longue du problème.",
      urgency: "normal", addressId: address.id, preferredDate: "", timeWindow: "flexible", budgetDa: "", customerNotes: "", photoIds: [photo.id], confirm: "on",
    });
    const [file] = await db.select().from(schema.files).where(eq(schema.files.id, photo.id));
    expect(file!.entityId).toBe(req.id);
    const meta = { id: file!.id, bucket: file!.bucket, ownerId: file!.ownerId, entityType: file!.entityType, entityId: file!.entityId };
    expect((await canReadFile(meta, { userId: t.tech.id, roles: t.tech.roles })).allowed).toBe(true);
    const stranger = await makeClient();
    expect((await canReadFile(meta, { userId: stranger.id, roles: stranger.roles })).allowed).toBe(false);
    // another user cannot attach someone else's upload
    const thief = await makeClient();
    const thiefAddr = await makeAddress(thief);
    const photo2 = await storeUpload({ ownerId: client.id, bucket: "service-request-media", data: await pngBuffer() });
    await expect(
      createServiceRequest(thief, {
        idempotencyKey: key(), categoryId: t.category.id, targetTechnicianSlug: "", serviceId: "", title: "Vol de fichier", description: "Tentative d'attacher le fichier d'un autre.",
        urgency: "normal", addressId: thiefAddr.id, preferredDate: "", timeWindow: "flexible", budgetDa: "", customerNotes: "", photoIds: [photo2.id], confirm: "on",
      }),
    ).rejects.toMatchObject({ code: "file_type" });
  });

  it("exact address is hidden from technicians before confirmation", async () => {
    const t = await makeApprovedTechnician(admin, { fixedPriceDa: 1000 });
    const client = await makeClient();
    const address = await makeAddress(client);
    const b = await createFixedPriceBooking(client, { idempotencyKey: key(), serviceId: t.service.id, addressId: address.id, date: futureDate(10), time: "11:00", description: "Petite réparation rapide.", customerNotes: "", photoIds: [], confirm: "on" });
    const pending = await getBookingDetail(t.tech, b.id);
    expect(pending!.address).toBeNull();
    expect(pending!.clientPhone).toBeNull();
    await performBookingAction(t.tech, b.id, "confirm");
    const confirmed = await getBookingDetail(t.tech, b.id);
    expect(confirmed!.address?.addressLine).toBe("12 rue des Oliviers, Bât B");
    void rejectQuote;
  });
});
