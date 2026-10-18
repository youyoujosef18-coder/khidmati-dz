"use client";

import { useRouter } from "next/navigation";
import { TechProfileForm, type TechProfileValue } from "./profile-form";
import { AreasForm, type AreasValue } from "./areas-form";
import { AvailabilityEditor, type AvailabilityValue } from "./availability-editor";
import type { WilayaOption } from "@/components/marketplace/location-picker";

export function OnboardingProfile({ initial }: { initial: TechProfileValue }) {
  const router = useRouter();
  return <TechProfileForm initial={initial} onSaved={() => router.push("/technicien/inscription?etape=2")} />;
}
export function OnboardingAreas(props: { categories: { id: string; nameFr: string; nameAr: string }[]; wilayas: WilayaOption[]; initial: AreasValue }) {
  const router = useRouter();
  return <AreasForm {...props} onSaved={() => router.push("/technicien/inscription?etape=3")} />;
}
export function OnboardingAvailability({ initial }: { initial: AvailabilityValue }) {
  const router = useRouter();
  return <AvailabilityEditor initial={initial} onSaved={() => router.push("/technicien/inscription?etape=5")} />;
}
