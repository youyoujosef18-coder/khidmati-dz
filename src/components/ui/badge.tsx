import { cn } from "@/lib/utils";

export type Tone = "neutral" | "primary" | "success" | "warning" | "error" | "info" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-ink/5 text-text ring-ink/10",
  primary: "bg-primary-50 text-primary ring-primary/20",
  success: "bg-success-50 text-success ring-success/20",
  warning: "bg-warning-50 text-warning ring-warning/25",
  error: "bg-error-50 text-error ring-error/20",
  info: "bg-info-50 text-info ring-info/20",
  accent: "bg-accent-50 text-accent-700 ring-accent/40",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
