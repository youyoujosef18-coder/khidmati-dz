"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, parseInput, type ActionState } from "@/lib/action";
import { actionRole, actionUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import * as tech from "@/lib/services/technicians";
import * as quotes from "@/lib/services/quotes";
import * as requests from "@/lib/services/requests";
import * as bookings from "@/lib/services/bookings";
import * as messaging from "@/lib/services/messaging";

export async function startTechnicianAction(): Promise<ActionState> {
  let go = false;
  const res = await runAction(async () => {
    const user = await actionUser();
    await tech.ensureTechnicianProfile(user, user.fullName);
    go = true;
  });
  if (go) {
    revalidatePath("/technicien", "layout"); // the shell changes from the start screen to the workspace
    redirect("/technicien/inscription?etape=1");
  }
  return res;
}

export async function saveProfileAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.updateTechnicianProfile(user, parseInput(tech.profileSchema, fd));
  });
}

/** Zones arrive as zone_wilaya[] + zone_communes_<index>[] */
export async function saveAreasAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    const wilayas = fd.getAll("zoneWilaya").map(String).filter(Boolean);
    const zones = wilayas.map((w, i) => ({ wilayaCode: w, communeIds: fd.getAll(`zoneCommunes_${i}`).map(String).filter(Boolean) }));
    const input = parseInput(tech.areasSchema, {
      primaryCategoryId: fd.get("primaryCategoryId"),
      additionalCategoryIds: fd.getAll("additionalCategoryIds").map(String),
      baseWilayaCode: fd.get("baseWilayaCode"),
      baseCommuneId: fd.get("baseCommuneId"),
      travelRadiusKm: fd.get("travelRadiusKm"),
      emergencyAvailable: fd.get("emergencyAvailable") ? "on" : "",
      zones,
    });
    await tech.setCategoriesAndAreas(user, input);
  });
}

export async function saveServiceAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.upsertService(user, parseInput(tech.serviceSchema, fd));
  });
}

export async function deleteServiceAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.deleteService(user, id);
  });
}

export async function toggleServiceAction(id: string, active: boolean): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.setServiceActive(user, id, active);
  });
}

export async function saveAvailabilityAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    const weekdays = fd.getAll("slotWeekday").map(String);
    const starts = fd.getAll("slotStart").map(String);
    const ends = fd.getAll("slotEnd").map(String);
    const slots = weekdays.map((w, i) => ({ weekday: w, startTime: starts[i], endTime: ends[i] }));
    await tech.setAvailability(
      user,
      parseInput(tech.availabilitySchema, {
        slots,
        defaultDurationMinutes: fd.get("defaultDurationMinutes"),
        travelBufferMinutes: fd.get("travelBufferMinutes"),
        maxDailyJobs: fd.get("maxDailyJobs"),
        availabilityStatus: fd.get("availabilityStatus"),
      }),
    );
  });
}

export async function addExceptionAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.addException(user, parseInput(tech.exceptionSchema, fd));
  });
}

export async function removeExceptionAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.removeException(user, id);
  });
}

export async function addDocumentAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    const input = parseInput(
      z.object({
        documentType: z.enum(["identity_card", "passport", "driving_license", "business_registration", "artisan_card", "qualification", "insurance", "other"]),
        fileId: z.string().uuid({ message: "validation.file" }),
      }),
      fd,
    );
    await tech.addDocument(user, input.documentType, input.fileId);
  });
}

export async function removeDocumentAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.removeDocument(user, id);
  });
}

export async function addPortfolioAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    const input = parseInput(z.object({ fileId: z.string().uuid({ message: "validation.file" }), caption: z.string().trim().max(140).optional().default("") }), fd);
    await tech.addPortfolioItem(user, input.fileId, input.caption);
  });
}

export async function removePortfolioAction(id: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await tech.removePortfolioItem(user, id);
  });
}

export async function submitApplicationAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  let go = false;
  const res = await runAction(async () => {
    const user = await actionRole("technician");
    if (fd.get("confirm") !== "on") throw new AppError("validation");
    await tech.submitApplication(user);
    go = true;
  }, "tech.submitted");
  if (go) {
    revalidatePath("/technicien", "layout");
    redirect("/technicien/verification?envoye=1");
  }
  return res;
}

/* ------------------------------- Work ------------------------------- */

export async function sendQuoteAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await rateLimit("quote", user.id, 40, 3600);
    const items = fd.getAll("itemDescription").map((d, i) => ({
      description: String(d),
      quantity: fd.getAll("itemQty")[i],
      unitDa: String(fd.getAll("itemUnit")[i] ?? "").replace(/\s/g, ""),
    })).filter((i) => i.description.trim());
    const raw = Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("item") && !k.startsWith("$ACTION")));
    await quotes.sendQuote(user, parseInput(quotes.quoteSchema, { ...raw, items }));
  }, "quote.sent");
}

export async function withdrawQuoteAction(quoteId: string): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    await quotes.withdrawQuote(user, quoteId);
  }, "quote.withdrawn");
}

export async function declineRequestAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  let go = false;
  const res = await runAction(async () => {
    const user = await actionRole("technician");
    const { requestId, reason } = parseInput(z.object({ requestId: z.string().uuid(), reason: z.string().trim().max(300).optional().default("") }), fd);
    await requests.declineMatch(user, requestId, reason);
    go = true;
  }, "tech.declined");
  if (go) redirect("/technicien/demandes");
  return res;
}

export async function techOpenConversationAction(requestId: string): Promise<ActionState> {
  let target = "";
  const res = await runAction(async () => {
    const user = await actionRole("technician");
    const id = await messaging.openConversationForRequest(user, requestId);
    target = `/technicien/messages/${id}`;
  });
  if (target) redirect(target);
  return res;
}

export async function recordCashAction(_p: ActionState | null, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await actionRole("technician");
    const input = parseInput(
      z.object({
        bookingId: z.string().uuid(),
        amountDa: z.string().transform((v) => v.replace(/[\s ]/g, "")).pipe(z.string().regex(/^\d{1,7}$/, "validation.amount")).transform(Number),
        note: z.string().trim().max(200).optional().default(""),
      }),
      fd,
    );
    await bookings.recordCashPayment(user, input.bookingId, input.amountDa, input.note);
  }, "booking.cashRecorded");
}
