import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { claimFirstAdmin, hasSuperAdmin, setupTokenConfigured } from "@/lib/services/bootstrap";
import { makeClient, roles } from "./helpers";

const TOKEN = "k3y-For-Khidmati-Installation-0123456789";
let saved: { userId: string; grantedBy: string | null }[] = [];

// Other suites create super administrators; set them aside so this suite starts from "no admin".
beforeAll(async () => {
  saved = await db
    .select({ userId: schema.userRoles.userId, grantedBy: schema.userRoles.grantedBy })
    .from(schema.userRoles)
    .where(eq(schema.userRoles.role, "super_administrator"));
  await db.delete(schema.userRoles).where(eq(schema.userRoles.role, "super_administrator"));
});

afterAll(async () => {
  delete process.env.SETUP_TOKEN;
  await db.delete(schema.userRoles).where(eq(schema.userRoles.role, "super_administrator"));
  if (saved.length) {
    await db.insert(schema.userRoles).values(saved.map((s) => ({ ...s, role: "super_administrator" as const })));
  }
});

describe("first administrator provisioning (/installation)", () => {
  it("is disabled without a strong SETUP_TOKEN", async () => {
    const u = await makeClient();
    delete process.env.SETUP_TOKEN;
    expect(setupTokenConfigured()).toBe(false);
    await expect(claimFirstAdmin(u, "anything")).rejects.toMatchObject({ code: "setup_disabled" });
    process.env.SETUP_TOKEN = "too-short";
    expect(setupTokenConfigured()).toBe(false);
    await expect(claimFirstAdmin(u, "too-short")).rejects.toMatchObject({ code: "setup_disabled" });
    expect(await hasSuperAdmin()).toBe(false);
  });

  it("rejects a wrong code and grants exactly one super administrator, even under concurrency", async () => {
    process.env.SETUP_TOKEN = TOKEN;
    const a = await makeClient("Candidate A");
    const b = await makeClient("Candidate B");
    await expect(claimFirstAdmin(a, TOKEN + "x")).rejects.toMatchObject({ code: "setup_invalid_token" });
    expect(await hasSuperAdmin()).toBe(false);

    const results = await Promise.allSettled([claimFirstAdmin(a, TOKEN), claimFirstAdmin(b, ` ${TOKEN} `)]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toMatchObject({ code: "setup_done" });

    const admins = await db.select().from(schema.userRoles).where(eq(schema.userRoles.role, "super_administrator"));
    expect(admins).toHaveLength(1);
    const winner = admins[0]!.userId;
    expect([a.id, b.id]).toContain(winner);
    expect(await roles(winner)).toContain("super_administrator");

    const audit = await db
      .select()
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, "admin.bootstrap"), eq(schema.auditLogs.entityId, winner)));
    expect(audit).toHaveLength(1);
  });

  it("stays closed once an administrator exists", async () => {
    const late = await makeClient("Late");
    await expect(claimFirstAdmin(late, TOKEN)).rejects.toMatchObject({ code: "setup_done" });
    expect(await roles(late.id)).not.toContain("super_administrator");
  });
});
