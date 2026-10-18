import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth/session";
import { canReadFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

/**
 * Serves stored files after an authorization check. Private files are never
 * publicly cacheable; access to sensitive documents is written to the audit log.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const [meta] = await db
    .select({
      id: schema.files.id,
      bucket: schema.files.bucket,
      ownerId: schema.files.ownerId,
      entityType: schema.files.entityType,
      entityId: schema.files.entityId,
      mimeType: schema.files.mimeType,
    })
    .from(schema.files)
    .where(eq(schema.files.id, id));
  if (!meta) return new NextResponse(null, { status: 404 });
  const user = await getCurrentUser();
  const { allowed, sensitive } = await canReadFile(meta, { userId: user?.id ?? null, roles: user?.roles ?? [] });
  if (!allowed) return new NextResponse(null, { status: user ? 403 : 401 });
  if (sensitive && user && meta.ownerId !== user.id) {
    await writeAudit({ actorId: user.id, action: "file.sensitive_access", entityType: "file", entityId: meta.id, meta: { bucket: meta.bucket } });
  }
  const [row] = await db.select({ data: schema.files.data }).from(schema.files).where(eq(schema.files.id, id));
  const isPublicImage = meta.bucket === "public-avatars" || meta.bucket === "portfolio";
  return new NextResponse(new Uint8Array(row!.data), {
    headers: {
      "Content-Type": meta.mimeType,
      "Cache-Control": isPublicImage ? "private, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": meta.mimeType === "application/pdf" ? "inline" : "inline",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
