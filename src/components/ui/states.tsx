import { AlertTriangle, Inbox, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center", className)}>
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-primary-50 text-primary">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-lg border border-error/20 bg-error-50 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-error" aria-hidden />
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "warning" | "success" | "error" | "neutral";
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const t = {
    info: "border-info/20 bg-info-50 text-info",
    warning: "border-warning/25 bg-warning-50 text-warning",
    success: "border-success/20 bg-success-50 text-success",
    error: "border-error/20 bg-error-50 text-error",
    neutral: "border-border bg-surface text-muted",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", t, className)} role={tone === "error" ? "alert" : "status"}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 text-text">
        {title && <p className="font-semibold text-ink">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-text/85")}>{children}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="card space-y-3 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OfflineIcon() {
  return <WifiOff className="h-4 w-4" aria-hidden />;
}
