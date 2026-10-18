import { VERIFICATION_TRANSITIONS, type VerificationStatus } from "@/lib/domain/state-machines";

/** Decisions a staff member may take from the current verification status. */
export function allowedTransitionsFor(status: string): string[] {
  const row = VERIFICATION_TRANSITIONS[status as VerificationStatus] ?? {};
  return Object.entries(row)
    .filter(([, actors]) => actors?.includes("staff"))
    .map(([to]) => to);
}
