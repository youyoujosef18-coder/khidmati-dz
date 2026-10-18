import Link from "next/link";
import type { TFunction } from "@/lib/i18n/translate";
import type { Period } from "@/lib/services/admin";

export function parsePeriod(v?: string): Period {
  return v === "7" || v === "90" || v === "all" ? v : "30";
}

export function PeriodTabs({ base, active, t }: { base: string; active: Period; t: TFunction }) {
  const opts: [Period, string][] = [["7", t("admin.last7")], ["30", t("admin.last30")], ["90", t("admin.last90")], ["all", t("admin.allTime")]];
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-1" role="group" aria-label={t("admin.period")}>
      {opts.map(([k, label]) => (
        <Link key={k} href={`${base}?periode=${k}`} aria-current={k === active ? "true" : undefined} className="rounded px-3 py-1.5 text-sm text-muted aria-[current=true]:bg-primary aria-[current=true]:text-white">
          {label}
        </Link>
      ))}
    </div>
  );
}
