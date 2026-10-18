import "server-only";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getTechnicianForUser } from "./technicians";

/** Page helper: authenticated technician + their profile, or onboarding. */
export async function requireTechContext() {
  const user = await requireRole("technician");
  const tp = await getTechnicianForUser(user.id);
  if (!tp) redirect("/technicien/inscription");
  return { user, tp };
}
