import { CheckCircle2, Clock3, FileText, MessageSquare } from "lucide-react";
import type { TFunction } from "@/lib/i18n/translate";

/** Decorative illustration of the booking flow (no real names, prices or ratings). */
export function HeroVisual({ t }: { t: TFunction }) {
  const steps = [
    { icon: FileText, label: t("home.step1"), tone: "bg-primary-50 text-primary" },
    { icon: MessageSquare, label: t("home.step3"), tone: "bg-accent-50 text-accent-700" },
    { icon: Clock3, label: t("status.booking.confirmed"), tone: "bg-info-50 text-info" },
    { icon: CheckCircle2, label: t("status.booking.completed"), tone: "bg-success-50 text-success" },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      <svg className="absolute -inset-8 -z-10 h-[calc(100%+4rem)] w-[calc(100%+4rem)] text-primary/10" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="zellige" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M20 0 L25 15 L40 20 L25 25 L20 40 L15 25 L0 20 L15 15 Z" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#zellige)" />
      </svg>
      <div className="card relative overflow-hidden p-5 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-2.5 w-24 rounded-full bg-ink/10" />
          <div className="h-6 w-16 rounded-full bg-primary-50" />
        </div>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-border bg-bg/60 p-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${s.tone}`}>
                <s.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-ink">{s.label}</span>
              {i < 3 ? (
                <CheckCircle2 className="ms-auto h-4 w-4 text-success" />
              ) : (
                <span className="ms-auto h-2 w-2 animate-pulse rounded-full bg-primary" />
              )}
            </li>
          ))}
        </ol>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="h-2 rounded-full bg-primary" />
          <div className="h-2 rounded-full bg-primary" />
          <div className="h-2 rounded-full bg-primary/25" />
        </div>
      </div>
      <div className="card absolute -bottom-5 -start-4 hidden items-center gap-2 px-3 py-2 shadow-raised sm:flex">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-ink">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="text-xs font-semibold text-ink">{t("home.why2")}</span>
      </div>
    </div>
  );
}
