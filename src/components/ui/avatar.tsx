import { cn, initials } from "@/lib/utils";

export function Avatar({
  fileId,
  name,
  size = 40,
  className,
}: {
  fileId?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (fileId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/files/${fileId}`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={cn("shrink-0 rounded-full bg-primary-50 object-cover ring-1 ring-border", className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-primary-50 font-semibold text-primary ring-1 ring-primary/10", className)}
      style={{ ...style, fontSize: Math.max(11, size * 0.36) }}
    >
      {initials(name) || "?"}
    </span>
  );
}
