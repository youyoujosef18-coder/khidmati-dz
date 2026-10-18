export const ROLES = ["client", "technician", "support_agent", "administrator", "super_administrator"] as const;
export type Role = (typeof ROLES)[number];
export const STAFF_ROLES: Role[] = ["support_agent", "administrator", "super_administrator"];

export const PERMISSIONS = {
  "admin.access": ["support_agent", "administrator", "super_administrator"],
  "users.read": ["support_agent", "administrator", "super_administrator"],
  "users.suspend": ["administrator", "super_administrator"],
  "users.roles": ["super_administrator"],
  "users.deletion": ["administrator", "super_administrator"],
  "verification.review": ["administrator", "super_administrator"],
  "verification.documents.read": ["administrator", "super_administrator"],
  "catalog.manage": ["administrator", "super_administrator"],
  "services.moderate": ["administrator", "super_administrator"],
  "bookings.read_all": ["support_agent", "administrator", "super_administrator"],
  "bookings.intervene": ["administrator", "super_administrator"],
  "disputes.handle": ["support_agent", "administrator", "super_administrator"],
  "reports.handle": ["support_agent", "administrator", "super_administrator"],
  "reviews.moderate": ["administrator", "super_administrator"],
  "support.handle": ["support_agent", "administrator", "super_administrator"],
  "analytics.read": ["administrator", "super_administrator"],
  "audit.read": ["administrator", "super_administrator"],
  "notifications.manage": ["administrator", "super_administrator"],
  "settings.manage": ["administrator", "super_administrator"],
  "settings.sensitive": ["super_administrator"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  const allowed = PERMISSIONS[permission] as readonly Role[];
  return roles.some((r) => allowed.includes(r));
}

export function isStaff(roles: readonly Role[]) {
  return roles.some((r) => STAFF_ROLES.includes(r));
}

/** Which roles may a given actor grant? Only super admins can grant staff roles. */
export function canGrantRole(actorRoles: readonly Role[], role: Role): boolean {
  if (role === "client" || role === "technician") return false; // self-service only
  return actorRoles.includes("super_administrator");
}

export function homeForRoles(roles: readonly Role[]): string {
  if (isStaff(roles)) return "/admin";
  if (roles.includes("technician")) return "/technicien";
  return "/client";
}
