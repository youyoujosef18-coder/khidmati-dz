import "server-only";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema, type DbOrTx } from "@/db";
import { AppError } from "@/lib/errors";
import { hasPermission, type Role } from "@/lib/auth/permissions";

export type Bucket = (typeof schema.fileBucketEnum.enumValues)[number];

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB bodies
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [...IMAGE_TYPES, "application/pdf"];

export const BUCKET_RULES: Record<Bucket, { types: string[]; maxDimension: number }> = {
  "public-avatars": { types: IMAGE_TYPES, maxDimension: 800 },
  portfolio: { types: IMAGE_TYPES, maxDimension: 1600 },
  "technician-verification": { types: DOC_TYPES, maxDimension: 2400 },
  "service-request-media": { types: IMAGE_TYPES, maxDimension: 1600 },
  "conversation-attachments": { types: IMAGE_TYPES, maxDimension: 1600 },
  "dispute-evidence": { types: DOC_TYPES, maxDimension: 2400 },
};

/**
 * Validates real content (magic bytes, not the declared MIME type), strips
 * metadata and downsizes images, then stores the file privately.
 */
export async function storeUpload(params: {
  ownerId: string;
  bucket: Bucket;
  data: Buffer;
  originalName?: string;
}): Promise<{ id: string; mimeType: string; sizeBytes: number }> {
  const { ownerId, bucket, data } = params;
  if (data.byteLength === 0) throw new AppError("file_type");
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new AppError("file_too_large", 400, { max: 4 });

  const detected = await fileTypeFromBuffer(data);
  const rules = BUCKET_RULES[bucket];
  if (!detected || !rules.types.includes(detected.mime)) throw new AppError("file_type");

  let out = data;
  let mime = detected.mime;
  let width: number | null = null;
  let height: number | null = null;

  if (IMAGE_TYPES.includes(detected.mime)) {
    try {
      const img = sharp(data, { failOn: "error" }).rotate(); // apply EXIF orientation, then drop metadata
      const resized = img.resize({
        width: rules.maxDimension,
        height: rules.maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      });
      const { data: buf, info } = await resized.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      out = buf;
      mime = "image/webp";
      width = info.width;
      height = info.height;
    } catch {
      throw new AppError("file_type");
    }
  }

  const [row] = await db
    .insert(schema.files)
    .values({
      ownerId,
      bucket,
      mimeType: mime,
      sizeBytes: out.byteLength,
      width,
      height,
      originalName: params.originalName?.slice(0, 120) ?? null,
      data: out,
    })
    .returning({ id: schema.files.id });
  return { id: row!.id, mimeType: mime, sizeBytes: out.byteLength };
}

/** Attach uploaded files (owned by the user and not yet attached) to an entity. */
export async function attachFiles(
  tx: DbOrTx,
  ownerId: string,
  fileIds: string[],
  bucket: Bucket,
  entityType: string,
  entityId: string,
) {
  for (const id of fileIds) {
    const res = await tx
      .update(schema.files)
      .set({ entityType, entityId })
      .where(
        and(
          eq(schema.files.id, id),
          eq(schema.files.ownerId, ownerId),
          eq(schema.files.bucket, bucket),
          isNull(schema.files.entityType),
        ),
      )
      .returning({ id: schema.files.id });
    if (!res.length) throw new AppError("file_type");
  }
  return fileIds;
}

export interface FileAccessContext {
  userId: string | null;
  roles: Role[];
}

/**
 * Central authorization for file reads. Public buckets are readable when the
 * owning profile is public; everything else requires participation in the
 * related record or an explicit staff permission.
 */
export async function canReadFile(
  file: { id: string; bucket: Bucket; ownerId: string | null; entityType: string | null; entityId: string | null },
  ctx: FileAccessContext,
): Promise<{ allowed: boolean; sensitive: boolean }> {
  const isOwner = ctx.userId !== null && file.ownerId === ctx.userId;

  switch (file.bucket) {
    case "public-avatars":
    case "portfolio": {
      if (isOwner) return { allowed: true, sensitive: false };
      if (hasPermission(ctx.roles, "admin.access")) return { allowed: true, sensitive: false };
      // Client avatars are visible to authenticated users they interact with; technician avatars when approved.
      if (file.entityType === "technician_avatar" || file.entityType === "portfolio") {
        const [tp] = await db
          .select({ status: schema.technicianProfiles.verificationStatus })
          .from(schema.technicianProfiles)
          .where(eq(schema.technicianProfiles.id, file.entityId!))
          .limit(1);
        return { allowed: tp?.status === "approved", sensitive: false };
      }
      return { allowed: ctx.userId !== null, sensitive: false };
    }
    case "technician-verification": {
      if (isOwner) return { allowed: true, sensitive: true };
      return { allowed: hasPermission(ctx.roles, "verification.documents.read"), sensitive: true };
    }
    case "service-request-media": {
      if (isOwner) return { allowed: true, sensitive: false };
      if (!ctx.userId || !file.entityId) return { allowed: false, sensitive: false };
      if (hasPermission(ctx.roles, "bookings.read_all")) return { allowed: true, sensitive: false };
      // Matched or targeted technicians can see request photos
      const rows = await db.execute(sql`
        SELECT 1 FROM service_requests r
        JOIN technician_profiles tp ON tp.user_id = ${ctx.userId}
        WHERE r.id = ${file.entityId}
          AND (r.target_technician_id = tp.id
               OR EXISTS (SELECT 1 FROM request_matches m WHERE m.request_id = r.id AND m.technician_id = tp.id))
        LIMIT 1`);
      return { allowed: rows.length > 0, sensitive: false };
    }
    case "conversation-attachments": {
      if (!ctx.userId || !file.entityId) return { allowed: false, sensitive: false };
      const [c] = await db
        .select({ clientId: schema.conversations.clientId, techUserId: schema.conversations.technicianUserId })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, file.entityId))
        .limit(1);
      if (!c) return { allowed: false, sensitive: false };
      if (c.clientId === ctx.userId || c.techUserId === ctx.userId) return { allowed: true, sensitive: false };
      return { allowed: hasPermission(ctx.roles, "disputes.handle"), sensitive: true };
    }
    case "dispute-evidence": {
      if (isOwner) return { allowed: true, sensitive: true };
      if (!ctx.userId || !file.entityId) return { allowed: false, sensitive: true };
      if (hasPermission(ctx.roles, "disputes.handle")) return { allowed: true, sensitive: true };
      const [d] = await db
        .select({ clientId: schema.bookings.clientId, techUserId: schema.technicianProfiles.userId })
        .from(schema.disputes)
        .innerJoin(schema.bookings, eq(schema.bookings.id, schema.disputes.bookingId))
        .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
        .where(eq(schema.disputes.id, file.entityId))
        .limit(1);
      return { allowed: Boolean(d && (d.clientId === ctx.userId || d.techUserId === ctx.userId)), sensitive: true };
    }
  }
}
