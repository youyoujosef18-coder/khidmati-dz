import "server-only";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { AppError, pgCode } from "@/lib/errors";
import { canGrantRole, hasPermission, type Role } from "@/lib/auth/permissions";
import { revokeAllSessions } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { normalizeAlgerianMobile } from "@/lib/phone";
import { DEFAULT_SETTINGS, type PlatformSettings } from "@/lib/settings-defaults";
import type { Actor } from "./types";

/* ------------------------------ Metrics ------------------------------ */

export type Period = "7" | "30" | "90" | "all";

export async function getMetrics(period: Period) {
  const since = period === "all" ? sql`'-infinity'::timestamptz` : sql`now() - make_interval(days => ${Number(period)})`;
  const [row] = await db.execute<Record<string, number>>(sql`
    SELECT
      (SELECT count(*)::int FROM user_roles r JOIN profiles p ON p.id = r.user_id WHERE r.role = 'client' AND p.account_status = 'active') AS clients,
      (SELECT count(*)::int FROM technician_profiles WHERE verification_status IN ('submitted','under_review')) AS pending_applications,
      (SELECT count(*)::int FROM technician_profiles tp JOIN profiles p ON p.id = tp.user_id
         WHERE tp.verification_status = 'approved' AND p.account_status = 'active') AS active_techs,
      (SELECT count(*)::int FROM service_requests WHERE created_at >= ${since}) AS requests,
      (SELECT count(DISTINCT booking_id)::int FROM booking_status_history WHERE new_status = 'confirmed' AND created_at >= ${since}) AS confirmed,
      (SELECT count(DISTINCT booking_id)::int FROM booking_status_history WHERE new_status = 'completed' AND created_at >= ${since}) AS completed,
      (SELECT count(DISTINCT booking_id)::int FROM booking_status_history WHERE new_status = 'cancelled' AND created_at >= ${since}) AS cancellations,
      (SELECT count(*)::int FROM disputes WHERE status IN ('open','under_review','awaiting_information')) AS open_disputes,
      (SELECT coalesce(sum(amount_minor),0)::bigint FROM ledger_entries WHERE entry_type = 'platform_fee' AND created_at >= ${since}) AS revenue,
      (SELECT coalesce(sum(amount_minor),0)::bigint FROM payments WHERE provider = 'cash' AND payment_status = 'cash_recorded' AND created_at >= ${since}) AS cash
  `);
  return Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v)])) as Record<string, number>;
}

export async function getAnalytics(period: Period) {
  const since = period === "all" ? sql`'-infinity'::timestamptz` : sql`now() - make_interval(days => ${Number(period)})`;
  const byCategory = await db.execute<{ name_fr: string; name_ar: string; n: number }>(sql`
    SELECT c.name_fr, c.name_ar, count(r.id)::int AS n FROM service_categories c
    LEFT JOIN service_requests r ON r.category_id = c.id AND r.created_at >= ${since}
    GROUP BY c.id ORDER BY n DESC, c.sort_order`);
  const byWilaya = await db.execute<{ code: string; name_fr: string; name_ar: string; n: number }>(sql`
    SELECT w.code, w.name_fr, w.name_ar, count(r.id)::int AS n FROM service_requests r
    JOIN wilayas w ON w.code = r.wilaya_code WHERE r.created_at >= ${since}
    GROUP BY w.code ORDER BY n DESC LIMIT 15`);
  const [funnel] = await db.execute<Record<string, number>>(sql`
    SELECT
      (SELECT count(*)::int FROM service_requests WHERE created_at >= ${since}) AS requests,
      (SELECT count(DISTINCT request_id)::int FROM quotes WHERE created_at >= ${since}) AS quoted,
      (SELECT count(*)::int FROM bookings WHERE created_at >= ${since}) AS booked,
      (SELECT count(*)::int FROM bookings WHERE created_at >= ${since} AND status = 'completed') AS completed,
      (SELECT count(*)::int FROM reviews WHERE created_at >= ${since}) AS reviewed`);
  return {
    byCategory: byCategory.map((r) => ({ nameFr: r.name_fr, nameAr: r.name_ar, count: Number(r.n) })),
    byWilaya: byWilaya.map((r) => ({ code: r.code, nameFr: r.name_fr, nameAr: r.name_ar, count: Number(r.n) })),
    funnel: Object.fromEntries(Object.entries(funnel ?? {}).map(([k, v]) => [k, Number(v)])),
  };
}

/* ------------------------------- Users ------------------------------- */

export async function searchUsers(params: { q?: string; role?: string; status?: string; page?: number }) {
  const page = params.page ?? 1;
  const pageSize = 25;
  const q = params.q?.trim();
  const phone = q ? normalizeAlgerianMobile(q) : null;
  const where = and(
    q
      ? or(
          ilike(schema.profiles.fullName, `%${q}%`),
          ilike(schema.users.email, `%${q}%`),
          phone ? eq(schema.users.phone, phone) : ilike(schema.users.phone, `%${q}%`),
        )
      : undefined,
    params.status ? eq(schema.profiles.accountStatus, params.status as "active") : undefined,
    params.role ? sql`EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = "users"."id" AND r.role = ${params.role})` : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        phone: schema.users.phone,
        fullName: schema.profiles.fullName,
        status: schema.profiles.accountStatus,
        createdAt: schema.users.createdAt,
        lastLoginAt: schema.users.lastLoginAt,
        roles: sql<string[]>`(SELECT array_agg(r.role::text ORDER BY r.role) FROM user_roles r WHERE r.user_id = "users"."id")`,
      })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
      .where(where)
      .orderBy(desc(schema.users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.users)
      .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
      .where(where),
  ]);
  return { rows, total, page, pageSize };
}

export async function getUserDetail(userId: string) {
  const [u] = await db
    .select({ user: schema.users, profile: schema.profiles })
    .from(schema.users)
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(eq(schema.users.id, userId));
  if (!u) return null;
  const [roles, tech, sessions, audit, bookingsCount, reports] = await Promise.all([
    db.select().from(schema.userRoles).where(eq(schema.userRoles.userId, userId)),
    db.select().from(schema.technicianProfiles).where(eq(schema.technicianProfiles.userId, userId)).then((r) => r[0] ?? null),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.sessions)
      .where(and(eq(schema.sessions.userId, userId), sql`${schema.sessions.revokedAt} IS NULL AND ${schema.sessions.expiresAt} > now()`)),
    db
      .select()
      .from(schema.auditLogs)
      .where(or(and(eq(schema.auditLogs.entityType, "user"), eq(schema.auditLogs.entityId, userId)), eq(schema.auditLogs.actorId, userId)))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(30),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings).where(eq(schema.bookings.clientId, userId)),
    db.select().from(schema.userReports).where(eq(schema.userReports.reportedUserId, userId)).orderBy(desc(schema.userReports.createdAt)).limit(20),
  ]);
  return {
    ...u,
    roles: roles.map((r) => r.role),
    tech,
    activeSessions: sessions[0]?.n ?? 0,
    audit,
    bookingsCount: bookingsCount[0]?.n ?? 0,
    reports,
  };
}

export async function setAccountStatus(staff: Actor, userId: string, status: "active" | "suspended", reason: string) {
  if (!hasPermission(staff.roles, "users.suspend")) throw new AppError("forbidden", 403);
  if (staff.id === userId) throw new AppError("self_action");
  if (!reason.trim()) throw new AppError("validation", 400);
  const targetRoles = (await db.select({ role: schema.userRoles.role }).from(schema.userRoles).where(eq(schema.userRoles.userId, userId))).map((r) => r.role);
  if (targetRoles.includes("super_administrator") && !staff.roles.includes("super_administrator")) throw new AppError("forbidden", 403);
  await db.update(schema.profiles).set({ accountStatus: status, statusReason: reason }).where(eq(schema.profiles.id, userId));
  if (status === "suspended") {
    await revokeAllSessions(userId); // immediate effect, including existing sessions
  } else {
    await notify({ userId, type: "account_notice", params: { message: reason } });
  }
  await writeAudit({ actorId: staff.id, action: `account.${status === "suspended" ? "suspended" : "reactivated"}`, entityType: "user", entityId: userId, reason });
}

export async function staffRevokeSessions(staff: Actor, userId: string) {
  if (!hasPermission(staff.roles, "users.suspend")) throw new AppError("forbidden", 403);
  await revokeAllSessions(userId);
  await writeAudit({ actorId: staff.id, action: "account.sessions_revoked", entityType: "user", entityId: userId });
}

export async function grantRole(staff: Actor, userId: string, role: Role) {
  if (!canGrantRole(staff.roles, role)) throw new AppError("forbidden", 403);
  if (staff.id === userId) throw new AppError("self_action");
  await db.insert(schema.userRoles).values({ userId, role, grantedBy: staff.id }).onConflictDoNothing();
  await writeAudit({ actorId: staff.id, action: "role.granted", entityType: "user", entityId: userId, meta: { role } });
}

export async function revokeRole(staff: Actor, userId: string, role: Role) {
  if (!canGrantRole(staff.roles, role)) throw new AppError("forbidden", 403);
  if (staff.id === userId) throw new AppError("self_action");
  await db.transaction(async (tx) => {
    if (role === "super_administrator") {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(schema.userRoles)
        .where(eq(schema.userRoles.role, "super_administrator"));
      if (n <= 1) throw new AppError("last_super_admin");
    }
    await tx.delete(schema.userRoles).where(and(eq(schema.userRoles.userId, userId), eq(schema.userRoles.role, role)));
    await writeAudit({ actorId: staff.id, action: "role.revoked", entityType: "user", entityId: userId, meta: { role } }, tx);
  });
  await revokeAllSessions(userId);
}

/* ----------------------------- Categories ---------------------------- */

const lines = z
  .string()
  .optional()
  .default("")
  .transform((v) => v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10));

export const categorySchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/),
  nameFr: z.string().trim().min(2).max(60),
  nameAr: z.string().trim().min(2).max(60),
  descriptionFr: z.string().trim().max(300).optional().default(""),
  descriptionAr: z.string().trim().max(300).optional().default(""),
  examplesFr: lines,
  examplesAr: lines,
  iconKey: z.string().trim().max(40).default("wrench"),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(100),
  isActive: z.union([z.literal("on"), z.literal("")]).optional(),
});

export async function upsertCategory(staff: Actor, input: z.infer<typeof categorySchema>) {
  const values = {
    slug: input.slug,
    nameFr: input.nameFr,
    nameAr: input.nameAr,
    descriptionFr: input.descriptionFr || null,
    descriptionAr: input.descriptionAr || null,
    examplesFr: input.examplesFr,
    examplesAr: input.examplesAr,
    iconKey: input.iconKey,
    sortOrder: input.sortOrder,
    isActive: input.isActive === "on",
  };
  try {
    if (input.id) {
      await db.update(schema.serviceCategories).set(values).where(eq(schema.serviceCategories.id, input.id));
    } else {
      await db.insert(schema.serviceCategories).values(values);
    }
  } catch (err) {
    if (pgCode(err) === "23505") throw new AppError("validation", 400);
    throw err;
  }
  await writeAudit({ actorId: staff.id, action: input.id ? "category.updated" : "category.created", entityType: "service_category", entityId: input.id || input.slug });
}

/* ------------------------------ Settings ----------------------------- */

const SENSITIVE_KEYS: (keyof PlatformSettings)[] = ["maintenance_mode", "feature_flags", "platform_fee", "verification_requirements"];

export async function updateSettings(staff: Actor, patch: Partial<PlatformSettings>) {
  for (const key of Object.keys(patch) as (keyof PlatformSettings)[]) {
    if (!(key in DEFAULT_SETTINGS)) throw new AppError("validation", 400);
    if (SENSITIVE_KEYS.includes(key) && !hasPermission(staff.roles, "settings.sensitive")) throw new AppError("forbidden", 403);
  }
  // Online payments cannot be switched on without an integrated provider.
  if (patch.feature_flags?.onlinePayments) throw new AppError("provider_unavailable", 400);
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(patch)) {
      await tx
        .insert(schema.platformSettings)
        .values({ key, value, updatedBy: staff.id })
        .onConflictDoUpdate({ target: schema.platformSettings.key, set: { value, updatedBy: staff.id, updatedAt: new Date() } });
    }
    await writeAudit({ actorId: staff.id, action: "settings.updated", entityType: "platform_settings", meta: { keys: Object.keys(patch) } }, tx);
  });
}

export async function setWilayaActive(staff: Actor, code: string, active: boolean) {
  await db.update(schema.wilayas).set({ isActive: active }).where(eq(schema.wilayas.code, code));
  await writeAudit({ actorId: staff.id, action: active ? "wilaya.enabled" : "wilaya.disabled", entityType: "wilaya", entityId: code });
}

/* ---------------------------- Audit reading -------------------------- */

export async function listAudit(params: { action?: string; entityType?: string; page?: number }) {
  const page = params.page ?? 1;
  const pageSize = 50;
  const where = and(
    params.action ? ilike(schema.auditLogs.action, `${params.action}%`) : undefined,
    params.entityType ? eq(schema.auditLogs.entityType, params.entityType) : undefined,
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({ log: schema.auditLogs, actorName: schema.profiles.fullName })
      .from(schema.auditLogs)
      .leftJoin(schema.profiles, eq(schema.profiles.id, schema.auditLogs.actorId))
      .where(where)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: sql<number>`count(*)::int` }).from(schema.auditLogs).where(where),
  ]);
  return { rows, total, page, pageSize };
}

export async function listDeliveries(status?: string) {
  return db
    .select({
      delivery: schema.notificationDeliveries,
      type: schema.notifications.type,
      userId: schema.notifications.userId,
    })
    .from(schema.notificationDeliveries)
    .innerJoin(schema.notifications, eq(schema.notifications.id, schema.notificationDeliveries.notificationId))
    .where(
      and(
        status ? eq(schema.notificationDeliveries.deliveryStatus, status as "failed") : undefined,
        sql`${schema.notificationDeliveries.channel} <> 'in_app'`,
      ),
    )
    .orderBy(desc(schema.notificationDeliveries.createdAt))
    .limit(100);
}

export async function staffUsers() {
  return db
    .selectDistinct({ id: schema.users.id, name: schema.profiles.fullName })
    .from(schema.userRoles)
    .innerJoin(schema.users, eq(schema.users.id, schema.userRoles.userId))
    .innerJoin(schema.profiles, eq(schema.profiles.id, schema.users.id))
    .where(and(inArray(schema.userRoles.role, ["support_agent", "administrator", "super_administrator"]), eq(schema.profiles.accountStatus, "active")));
}
