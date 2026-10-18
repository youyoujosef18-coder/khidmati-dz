import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { getTechnicianForUser } from "@/lib/services/technicians";
import { toCsv } from "@/lib/csv";
import { writeAudit } from "@/lib/audit";

function range(url: URL) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const du = url.searchParams.get("du");
  const au = url.searchParams.get("au");
  return {
    from: du && re.test(du) ? new Date(`${du}T00:00:00+01:00`) : new Date(0),
    to: au && re.test(au) ? new Date(new Date(`${au}T00:00:00+01:00`).getTime() + 86400_000 - 1) : new Date(),
  };
}

function csvResponse(name: string, body: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { kind } = await ctx.params;
  const url = new URL(req.url);
  const { from, to } = range(url);

  if (kind === "tech-ledger") {
    const tp = await getTechnicianForUser(user.id);
    if (!tp) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const rows = await db
      .select({ e: schema.ledgerEntries, ref: schema.bookings.reference })
      .from(schema.ledgerEntries)
      .leftJoin(schema.bookings, eq(schema.bookings.id, schema.ledgerEntries.bookingId))
      .where(and(eq(schema.ledgerEntries.technicianId, tp.id), gte(schema.ledgerEntries.createdAt, from), lte(schema.ledgerEntries.createdAt, to)))
      .orderBy(desc(schema.ledgerEntries.createdAt));
    return csvResponse(
      "khidmati-revenus",
      toCsv([
        ["date_utc", "booking_reference", "entry_type", "amount_da", "currency", "note"],
        ...rows.map(({ e, ref }) => [e.createdAt.toISOString(), ref, e.entryType, (e.amountMinor / 100).toFixed(2), e.currency, e.reason]),
      ]),
    );
  }

  if (kind === "admin-bookings") {
    if (!hasPermission(user.roles, "analytics.read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const rows = await db
      .select({ b: schema.bookings, cat: schema.serviceCategories.slug })
      .from(schema.bookings)
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.bookings.categoryId))
      .where(and(gte(schema.bookings.createdAt, from), lte(schema.bookings.createdAt, to)))
      .orderBy(desc(schema.bookings.createdAt))
      .limit(20000);
    await writeAudit({ actorId: user.id, action: "export.bookings", entityType: "export", meta: { count: rows.length } });
    return csvResponse(
      "khidmati-reservations",
      toCsv([
        ["reference", "created_at_utc", "scheduled_start_utc", "status", "category", "wilaya", "agreed_total_da", "payment_status"],
        ...rows.map(({ b, cat }) => [b.reference, b.createdAt.toISOString(), b.scheduledStartAt.toISOString(), b.status, cat, b.wilayaCode, (b.agreedTotalMinor / 100).toFixed(2), b.paymentStatus]),
      ]),
    );
  }

  if (kind === "admin-requests") {
    if (!hasPermission(user.roles, "analytics.read")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const rows = await db
      .select({ r: schema.serviceRequests, cat: schema.serviceCategories.slug })
      .from(schema.serviceRequests)
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.serviceRequests.categoryId))
      .where(and(gte(schema.serviceRequests.createdAt, from), lte(schema.serviceRequests.createdAt, to)))
      .orderBy(desc(schema.serviceRequests.createdAt))
      .limit(20000);
    await writeAudit({ actorId: user.id, action: "export.requests", entityType: "export", meta: { count: rows.length } });
    return csvResponse(
      "khidmati-demandes",
      toCsv([
        ["reference", "created_at_utc", "status", "category", "wilaya", "commune_id", "urgency"],
        ...rows.map(({ r, cat }) => [r.reference, r.createdAt.toISOString(), r.status, cat, r.wilayaCode, r.communeId, r.urgency]),
      ]),
    );
  }
  return NextResponse.json({ error: "not found" }, { status: 404 });
}
