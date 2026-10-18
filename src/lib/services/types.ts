import type { Role } from "@/lib/auth/permissions";

/** The authenticated principal performing an operation. Always resolved server-side. */
export interface Actor {
  id: string;
  roles: Role[];
}
