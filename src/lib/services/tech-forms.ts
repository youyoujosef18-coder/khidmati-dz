import "server-only";
import type { TechnicianProfile } from "./technicians";
import type { getTechnicianWorkspace } from "./technicians";

type Workspace = Awaited<ReturnType<typeof getTechnicianWorkspace>>;

export function profileValue(tp: TechnicianProfile) {
  return {
    legalName: tp.legalName,
    publicName: tp.publicName,
    bio: tp.bio,
    experienceYears: tp.experienceYears,
    workingLanguages: tp.workingLanguages,
    serviceTerms: tp.serviceTerms,
    avatarFileId: tp.avatarFileId,
    approved: tp.verificationStatus === "approved",
  };
}

export function areasValue(tp: TechnicianProfile, ws: Workspace) {
  const zones = new Map<string, number[]>();
  for (const a of ws.areas) {
    const list = zones.get(a.wilayaCode) ?? [];
    if (a.communeId) list.push(a.communeId);
    zones.set(a.wilayaCode, list);
  }
  return {
    primaryCategoryId: tp.primaryCategoryId ?? "",
    categories: ws.categories.map((c) => ({ categoryId: c.categoryId, approvalStatus: c.approvalStatus })),
    baseWilayaCode: tp.baseWilayaCode ?? "",
    baseCommuneId: tp.baseCommuneId,
    travelRadiusKm: tp.travelRadiusKm,
    emergencyAvailable: tp.emergencyAvailable,
    zones: [...zones.entries()].map(([wilayaCode, communeIds]) => ({ wilayaCode, communeIds })),
  };
}

export function availabilityValue(tp: TechnicianProfile, ws: Workspace) {
  return {
    slots: ws.weekly.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime })),
    defaultDurationMinutes: tp.defaultDurationMinutes,
    travelBufferMinutes: tp.travelBufferMinutes,
    maxDailyJobs: tp.maxDailyJobs,
    availabilityStatus: tp.availabilityStatus,
  };
}

export function servicesValue(ws: Workspace) {
  return ws.services.map((s) => ({
    id: s.id,
    categoryId: s.categoryId,
    title: s.title,
    description: s.description,
    pricingModel: s.pricingModel,
    startingPriceMinor: s.startingPriceMinor,
    estimatedDurationMinutes: s.estimatedDurationMinutes,
    approvalStatus: s.approvalStatus,
    moderationReason: s.moderationReason,
    isActive: s.isActive,
  }));
}
