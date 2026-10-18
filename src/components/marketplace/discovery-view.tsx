import { Suspense } from "react";
import { SearchX } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getActiveCategories, getActiveWilayas, searchTechnicians, type SearchFilters } from "@/lib/services/discovery";
import { MIN_REVIEWS_FOR_AVERAGE } from "@/lib/services/reviews";
import { DiscoveryFilterPanel, DiscoveryToolbar } from "./discovery-filters";
import { TechnicianCard } from "./technician-card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const int = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : undefined);

export function parseFilters(sp: SP, lockedCategory?: string): SearchFilters {
  const sort = one(sp.sort);
  return {
    q: one(sp.q) || undefined,
    category: lockedCategory ?? (one(sp.category) || undefined),
    wilaya: /^\d{2}$/.test(one(sp.wilaya)) ? one(sp.wilaya) : undefined,
    commune: int(one(sp.commune)),
    date: /^\d{4}-\d{2}-\d{2}$/.test(one(sp.date)) ? one(sp.date) : undefined,
    budgetMin: int(one(sp.budgetMin)),
    budgetMax: int(one(sp.budgetMax)),
    minRating: ["3", "3.5", "4", "4.5"].includes(one(sp.minRating)) ? Number(one(sp.minRating)) : undefined,
    emergency: one(sp.emergency) === "1",
    sort: (["rating", "reviews", "price_asc", "price_desc", "experience"].includes(sort) ? sort : "relevance") as SearchFilters["sort"],
    page: int(one(sp.page)) ?? 1,
  };
}

export async function DiscoveryView({ searchParams, basePath, lockedCategory }: { searchParams: SP; basePath: string; lockedCategory?: string }) {
  const { t } = await getI18n();
  const filters = parseFilters(searchParams, lockedCategory);
  const [categories, wilayas, result] = await Promise.all([getActiveCategories(), getActiveWilayas(), searchTechnicians(filters)]);
  const cats = categories.map((c) => ({ slug: c.slug, nameFr: c.nameFr, nameAr: c.nameAr }));
  const hrefFor = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) if (typeof v === "string" && v && k !== "page") p.set(k, v);
    if (page > 1) p.set("page", String(page));
    return `${basePath}${p.size ? `?${p}` : ""}`;
  };
  const requestHref = `/client/demandes/nouvelle${filters.category ? `?categorie=${filters.category}` : ""}`;
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <Suspense>
        <DiscoveryFilterPanel categories={cats} wilayas={wilayas} lockedCategory={lockedCategory} />
      </Suspense>
      <div className="min-w-0">
        <Suspense>
          <DiscoveryToolbar categories={cats} wilayas={wilayas} lockedCategory={lockedCategory} />
        </Suspense>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
          <p aria-live="polite">{t("common.results", { count: result.total })}</p>
          <p className="text-xs">{t("discovery.ratingNote", { min: MIN_REVIEWS_FOR_AVERAGE })}</p>
        </div>
        {result.rows.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {result.rows.map((tech) => (
              <TechnicianCard key={tech.id} tech={tech} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<SearchX className="h-6 w-6" />}
            title={t("discovery.empty")}
            description={t("discovery.noMatchHint")}
            action={<ButtonLink href={requestHref}>{t("discovery.publishRequest")}</ButtonLink>}
          />
        )}
        <Pagination page={result.page} total={result.total} pageSize={result.pageSize} hrefFor={hrefFor} t={t} />
      </div>
    </div>
  );
}
