import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { storeUpload, MAX_UPLOAD_BYTES, type Bucket } from "@/lib/storage";

const USER_BUCKETS: Bucket[] = ["public-avatars", "portfolio", "technician-verification", "service-request-media", "conversation-attachments", "dispute-evidence"];

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "errors.unauthenticated" }, { status: 401 });
  // CSRF: only same-origin browser requests
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || new URL(origin).host !== host) return NextResponse.json({ error: "errors.forbidden" }, { status: 403 });
  try {
    await rateLimit("upload", user.id, 60, 3600);
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError("file_too_large", 413, { max: 4 });
    const form = await req.formData();
    const bucket = String(form.get("bucket") ?? "") as Bucket;
    if (!USER_BUCKETS.includes(bucket)) throw new AppError("file_type");
    if ((bucket === "portfolio" || bucket === "technician-verification") && !user.roles.includes("technician")) throw new AppError("forbidden", 403);
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("file_type");
    const data = Buffer.from(await file.arrayBuffer());
    const stored = await storeUpload({ ownerId: user.id, bucket, data, originalName: file.name });
    return NextResponse.json({ id: stored.id, mimeType: stored.mimeType, size: stored.sizeBytes });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: `errors.${err.code}`, params: err.params }, { status: err.status });
    console.error("[upload] failed", (err as Error).message);
    return NextResponse.json({ error: "errors.unexpected" }, { status: 500 });
  }
}
