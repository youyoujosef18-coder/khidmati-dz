"use client";

import { useId, useRef, useState } from "react";
import { Camera, FileText, ImagePlus, Loader2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

interface Uploaded {
  id: string;
  mimeType: string;
  name: string;
  preview?: string;
}

/**
 * Uploads files one by one to /api/uploads (server validates real content type
 * and size) and exposes the resulting ids as hidden inputs.
 */
export function FileUploader({
  bucket,
  name,
  max = 5,
  accept = "image/jpeg,image/png,image/webp",
  label,
  hint,
  single,
  onUploaded,
  disabled,
}: {
  bucket: string;
  name: string;
  max?: number;
  accept?: string;
  label?: string;
  hint?: string;
  single?: boolean;
  onUploaded?: (f: Uploaded) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const cameraId = `${id}-camera`;
  // Camera capture is offered for image uploads on touch devices (mobile browsers and the Android app).
  const acceptsImages = accept.split(",").some((a) => a.trim().startsWith("image/"));
  const [files, setFiles] = useState<Uploaded[]>([]);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const room = single ? 1 : max - files.length;
    const chosen = Array.from(list).slice(0, Math.max(0, room));
    if (!chosen.length) return setError(t("errors.too_many_files"));
    for (const file of chosen) {
      if (file.size > 4 * 1024 * 1024) {
        setError(t("errors.file_too_large", { max: 4 }));
        continue;
      }
      if (!navigator.onLine) {
        setError(t("errors.offline"));
        break;
      }
      setBusy((b) => b + 1);
      try {
        const fd = new FormData();
        fd.set("bucket", bucket);
        fd.set("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(t(body.error ?? "errors.unexpected", body.params));
        } else {
          const item: Uploaded = {
            id: body.id,
            mimeType: body.mimeType,
            name: file.name,
            preview: body.mimeType.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          };
          setFiles((f) => (single ? [item] : [...f, item]));
          onUploaded?.(item);
        }
      } catch {
        setError(t("errors.unexpected"));
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = "";
  }

  const full = single ? false : files.length >= max;
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      {files.map((f) => (
        <input key={f.id} type="hidden" name={single ? name : `${name}[]`} value={f.id} />
      ))}
      <div className="flex flex-wrap gap-2">
        {files.map((f) => (
          <div key={f.id} className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-bg">
            {f.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center p-1 text-center text-[10px] text-muted">
                <FileText className="h-6 w-6" aria-hidden />
                <span className="line-clamp-2 break-all">{f.name}</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setFiles((all) => all.filter((x) => x.id !== f.id))}
              className="absolute end-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white"
              aria-label={`${t("common.remove")} ${f.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {!full && (
          <label
            htmlFor={id}
            className={cn(
              "grid h-20 min-w-20 cursor-pointer place-items-center rounded-md border border-dashed border-border-strong px-3 text-center text-xs text-muted hover:border-primary hover:text-primary",
              (disabled || busy > 0) && "pointer-events-none opacity-60",
            )}
          >
            {busy > 0 ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ImagePlus className="h-5 w-5" aria-hidden />}
            <span>{busy > 0 ? t("common.loading") : t("common.upload")}</span>
          </label>
        )}
        {!full && acceptsImages && busy === 0 && (
          <label
            htmlFor={cameraId}
            className={cn(
              "hidden h-20 min-w-20 cursor-pointer place-items-center rounded-md border border-dashed border-border-strong px-3 text-center text-xs text-muted hover:border-primary hover:text-primary pointer-coarse:grid",
              disabled && "pointer-events-none opacity-60",
            )}
          >
            <Camera className="h-5 w-5" aria-hidden />
            <span>{t("common.takePhoto")}</span>
          </label>
        )}
      </div>
      <input
        ref={input}
        id={id}
        type="file"
        accept={accept}
        multiple={!single && max > 1}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => upload(e.target.files)}
      />
      {acceptsImages && (
        <input
          id={cameraId}
          type="file"
          accept="image/jpeg"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          disabled={disabled}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
      )}
      {hint && !error && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-error">
          {error}
        </p>
      )}
    </div>
  );
}
