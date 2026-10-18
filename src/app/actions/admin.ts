"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { runAction, parseInput, type ActionState } from "@/lib/action";
import { actionPermission } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { dispatchPendingDeliveries } from "@/lib/notify";
import { ROLES, type Role } from "@/lib/auth/permissions";
import * as admin from "@/lib/services/admin";
import * as tech from "@/lib/services/technicians";
import * as bookings from "@/lib/services/bookings";
import * as disputes from "@/lib/services/disputes";
import * as reviews from "@/lib/services/reviews";
import * as support from "@/lib/services/support";
import { anonymizeUser } from "@/lib/services/auth";
import type { PlatformSettings } from "@/lib/settings-defaults";

/* ------------------------------- Users ------------------------------- */

export async function setAccountStatusAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("users.suspend");
    const input = parseInput(z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]), reason: z.string().trim().min(3).max(500) }), fd);
    await admin.setAccountStatus(staff, input.userId, input.status, input.reason);
    return { ok: true, message: input.status === "suspended" ? "admin.suspended" : "admin.reactivated" };
  });
}

export async function revokeSessionsAction(userId: string): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("users.suspend");
    await admin.staffRevokeSessions(staff, userId);
  }, "admin.sessionsRevoked");
}

export async function roleAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("users.roles");
    const input = parseInput(z.object({ userId: z.string().uuid(), role: z.enum(ROLES), op: z.enum(["grant", "revoke"]) }), fd);
    if (input.op === "grant") await admin.grantRole(staff, input.userId, input.role as Role);
    else await admin.revokeRole(staff, input.userId, input.role as Role);
    return { ok: true, message: input.op === "grant" ? "admin.roleGranted" : "admin.roleRevoked" };
  });
}

export async function processDeletionAction(userId: string): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("users.deletion");
    await anonymizeUser(staff, userId);
  }, "admin.deletionProcessed");
}

/* ---------------------------- Verification --------------------------- */

export async function decisionAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("verification.review");
    const checklist: Record<string, string> = {};
    for (const [k, v] of fd.entries()) if (k.startsWith("check_")) checklist[k.slice(6)] = String(v);
    await tech.decideApplication(
      staff,
      parseInput(tech.decisionSchema, {
        technicianId: fd.get("technicianId"),
        decision: fd.get("decision"),
        reason: fd.get("reason") ?? "",
        checklist,
        approveCategoryIds: fd.getAll("approveCategoryIds").map(String),
      }),
    );
  }, "admin.decisionSaved");
}

export async function categoryApprovalAction(technicianId: string, categoryId: string, status: "approved" | "rejected"): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("verification.review");
    await tech.setCategoryApproval(staff, technicianId, categoryId, status);
  });
}

/* ------------------------- Catalogue & moderation -------------------- */

export async function saveCategoryAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("catalog.manage");
    await admin.upsertCategory(staff, parseInput(admin.categorySchema, fd));
  });
}

export async function moderateServiceAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("services.moderate");
    const input = parseInput(z.object({ serviceId: z.string().uuid(), status: z.enum(["approved", "rejected"]), reason: z.string().trim().max(500).optional().default("") }), fd);
    await tech.moderateService(staff, input.serviceId, input.status, input.reason);
  });
}

export async function moderatePortfolioAction(itemId: string, status: "published" | "hidden"): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("services.moderate");
    await tech.moderatePortfolio(staff, itemId, status, status);
  });
}

export async function moderateReviewAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("reviews.moderate");
    const input = parseInput(z.object({ reviewId: z.string().uuid(), status: z.enum(["published", "hidden"]), reason: z.string().trim().min(3).max(500) }), fd);
    await reviews.moderateReview(staff, input.reviewId, input.status, input.reason);
  });
}

/* ------------------------------ Bookings ----------------------------- */

export async function staffCancelBookingAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("bookings.intervene");
    const input = parseInput(z.object({ bookingId: z.string().uuid(), reason: z.string().trim().min(5).max(500) }), fd);
    await bookings.performBookingAction(staff, input.bookingId, "cancel", input.reason);
  }, "booking.cancelled");
}

/* ------------------------------ Disputes ----------------------------- */

export async function assignDisputeAction(disputeId: string, assigneeId: string | null): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("disputes.handle");
    await disputes.assignDispute(staff, disputeId, assigneeId);
  });
}

export async function requestDisputeInfoAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("disputes.handle");
    const input = parseInput(z.object({ disputeId: z.string().uuid(), message: z.string().trim().min(5).max(2000) }), fd);
    await disputes.requestDisputeInfo(staff, input.disputeId, input.message);
  });
}

export async function resolveDisputeAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("disputes.handle");
    await disputes.resolveDispute(staff, parseInput(disputes.resolveSchema, fd));
  }, "dispute.resolved");
}

/* --------------------------- Reports & support ----------------------- */

export async function handleReportAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("reports.handle");
    const input = parseInput(z.object({ reportId: z.string().uuid(), status: z.enum(["reviewing", "actioned", "dismissed"]), note: z.string().trim().max(1000).optional().default("") }), fd);
    await support.handleReport(staff, input.reportId, input.status, input.note);
  });
}

export async function setContactStatusAction(id: string, status: "open" | "resolved" | "closed"): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("support.handle");
    await db.update(schema.contactMessages).set({ status, handledBy: staff.id }).where(eq(schema.contactMessages.id, id));
    await writeAudit({ actorId: staff.id, action: `contact.${status}`, entityType: "contact_message", entityId: id });
  });
}

export async function staffTicketStatusAction(ticketId: string, status: "open" | "pending" | "resolved" | "closed"): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("support.handle");
    await support.setTicketStatus(staff, ticketId, status);
  });
}

/* ------------------------- Settings & notifications ------------------ */

const bool = (fd: FormData, k: string) => fd.get(k) === "on";
const int = (fd: FormData, k: string, min: number, max: number) => {
  const n = Number(fd.get(k));
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError("validation");
  return n;
};
const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

export async function saveSettingsAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("settings.manage");
    const section = String(fd.get("section"));
    const patch: Partial<PlatformSettings> = {};
    if (section === "operations") {
      patch.cancellation_policy = { clientFreeCancellationHours: int(fd, "cancellationHours", 0, 168), lateCancellationRequiresSupport: true };
      patch.completion_review_hours = int(fd, "completionHours", 1, 720);
      patch.request_expiry_days = int(fd, "requestExpiryDays", 1, 60);
      patch.quote_default_validity_hours = int(fd, "quoteValidityHours", 2, 336);
      patch.fixed_price_hold_hours = int(fd, "holdHours", 1, 72);
      patch.dispute_window_days = int(fd, "disputeWindowDays", 1, 60);
    } else if (section === "contacts") {
      const url = (k: string) => {
        const v = str(fd, k, 300);
        if (v && !/^https:\/\/[^\s]+$/.test(v)) throw new AppError("validation");
        return v;
      };
      patch.support_contacts = { email: str(fd, "supportEmail"), phone: str(fd, "supportPhone", 30), whatsapp: str(fd, "supportWhatsapp", 30), address: str(fd, "supportAddress") };
      patch.social_links = { facebook: url("facebook"), instagram: url("instagram"), tiktok: url("tiktok"), linkedin: url("linkedin") };
    } else if (section === "sensitive") {
      patch.maintenance_mode = bool(fd, "maintenance");
      patch.feature_flags = {
        onlinePayments: false,
        emergencyRequests: bool(fd, "emergencyRequests"),
        sponsoredListings: bool(fd, "sponsoredListings"),
        technicianSubscriptions: bool(fd, "technicianSubscriptions"),
      };
      patch.verification_requirements = { requireIdentityDocument: bool(fd, "requireIdentity"), requireQualificationDocument: bool(fd, "requireQualification") };
      patch.platform_fee = { enabled: bool(fd, "feeEnabled"), basisPoints: int(fd, "feeBasisPoints", 0, 3000) };
    } else if (section === "templates") {
      const overrides: PlatformSettings["notification_overrides"] = {};
      for (const [k, v] of fd.entries()) {
        const m = /^tpl\.([a-z_]+)\.(titleFr|bodyFr|titleAr|bodyAr)$/.exec(k);
        if (m && String(v).trim()) (overrides[m[1]!] ??= {})[m[2] as "titleFr"] = String(v).trim().slice(0, 300);
      }
      patch.notification_overrides = overrides;
    } else {
      throw new AppError("validation");
    }
    await admin.updateSettings(staff, patch);
  });
}

export async function toggleWilayaAction(code: string, active: boolean): Promise<ActionState> {
  return runAction(async () => {
    const staff = await actionPermission("settings.manage");
    await admin.setWilayaActive(staff, code, active);
  });
}

export async function retryDeliveriesAction(): Promise<ActionState> {
  return runAction(async () => {
    await actionPermission("notifications.manage");
    const count = await dispatchPendingDeliveries(100);
    return { ok: true, message: "admin.retried", params: { count } };
  });
}
