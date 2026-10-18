import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TFunction } from "@/lib/i18n/translate";

export function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
  t,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
  t: TFunction;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const btn = "inline-flex h-10 items-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-bg aria-disabled:pointer-events-none aria-disabled:opacity-50";
  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label="pagination">
      <Link href={hrefFor(page - 1)} className={btn} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
        <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden /> {t("common.prev")}
      </Link>
      <span className="text-sm text-muted">{t("common.page", { page, total: pages })}</span>
      <Link href={hrefFor(page + 1)} className={btn} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
        {t("common.nextPage")} <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
      </Link>
    </nav>
  );
}

export function TabLinks({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto border-b border-border" role="tablist">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={tab.key === active}
          className="-mb-px inline-flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-muted hover:text-text aria-selected:border-primary aria-selected:text-primary"
        >
          {tab.label}
          {tab.count !== undefined && tab.count > 0 && (
            <span className="rounded-full bg-primary-50 px-1.5 text-xs text-primary ltr-nums">{tab.count}</span>
          )}
        </Link>
      ))}
    </div>
  );
}
