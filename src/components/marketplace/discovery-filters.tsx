"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, Search, Loader2 } from "lucide-react";
import { Input, Select, Checkbox } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LocationPicker, type WilayaOption } from "./location-picker";
import { useI18n } from "@/lib/i18n/client";
import { todayInAlgeria } from "@/lib/time";

interface Cat {
  slug: string;
  nameFr: string;
  nameAr: string;
}

function useApply() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const apply = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete("page");
    start(() => router.push(`${pathname}${p.size ? `?${p}` : ""}`, { scroll: false }));
  };
  const reset = () => start(() => router.push(pathname));
  return { apply, reset, pending, sp };
}

function FiltersForm({
  categories,
  wilayas,
  lockedCategory,
  onDone,
}: {
  categories: Cat[];
  wilayas: WilayaOption[];
  lockedCategory?: string;
  onDone?: () => void;
}) {
  const { t, locale } = useI18n();
  const { apply, reset, sp } = useApply();
  return (
    <form
      key={sp.toString()}
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const patch: Record<string, string | null> = {};
        for (const k of ["category", "wilaya", "commune", "date", "budgetMin", "budgetMax", "minRating"]) {
          if (k === "category" && lockedCategory) continue;
          patch[k] = ((fd.get(k) as string) || "").trim() || null;
        }
        patch.emergency = fd.get("emergency") ? "1" : null;
        apply(patch);
        onDone?.();
      }}
    >
      {!lockedCategory && (
        <label className="grid gap-1.5 text-sm font-medium text-ink">
          {t("discovery.category")}
          <Select name="category" defaultValue={sp.get("category") ?? ""}>
            <option value="">{t("discovery.anyCategory")}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {locale === "ar-DZ" ? c.nameAr : c.nameFr}
              </option>
            ))}
          </Select>
        </label>
      )}
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">
          {t("home.searchWilaya")} / {t("home.searchCommune")}
        </legend>
        <LocationPicker wilayas={wilayas} defaultWilaya={sp.get("wilaya") ?? ""} defaultCommune={sp.get("commune") ?? ""} anyLabel />
      </fieldset>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        {t("discovery.date")}
        <Input type="date" name="date" min={todayInAlgeria()} defaultValue={sp.get("date") ?? ""} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1.5 text-sm font-medium text-ink">
          {t("discovery.budgetMin")}
          <Input name="budgetMin" inputMode="numeric" defaultValue={sp.get("budgetMin") ?? ""} className="ltr-nums" />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-ink">
          {t("discovery.budgetMax")}
          <Input name="budgetMax" inputMode="numeric" defaultValue={sp.get("budgetMax") ?? ""} className="ltr-nums" />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm font-medium text-ink">
        {t("discovery.minRating")}
        <Select name="minRating" defaultValue={sp.get("minRating") ?? ""}>
          <option value="">{t("discovery.anyRating")}</option>
          {[4.5, 4, 3.5, 3].map((r) => (
            <option key={r} value={r}>
              ≥ {r}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex items-center gap-3 text-sm text-text">
        <Checkbox name="emergency" defaultChecked={sp.get("emergency") === "1"} />
        {t("discovery.emergencyOnly")}
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {t("common.applyFilters")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
            onDone?.();
          }}
        >
          {t("common.reset")}
        </Button>
      </div>
    </form>
  );
}

/** Desktop sidebar panel. Filters live in the URL so searches can be shared and revisited. */
export function DiscoveryFilterPanel(props: { categories: Cat[]; wilayas: WilayaOption[]; lockedCategory?: string }) {
  const { t } = useI18n();
  return (
    <aside className="hidden lg:block" aria-label={t("common.filters")}>
      <div className="card sticky top-20 p-4">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("common.filters")}</h2>
        <FiltersForm {...props} />
      </div>
    </aside>
  );
}

/** Keyword (debounced), sort and the mobile filter drawer. */
export function DiscoveryToolbar(props: { categories: Cat[]; wilayas: WilayaOption[]; lockedCategory?: string }) {
  const { t } = useI18n();
  const { apply, pending, sp } = useApply();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if ((sp.get("q") ?? "") === q.trim()) return;
    const id = setTimeout(() => apply({ q: q.trim() || null }), 450);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeCount = ["category", "wilaya", "commune", "date", "budgetMin", "budgetMax", "minRating", "emergency"].filter(
    (k) => sp.get(k) && !(k === "category" && props.lockedCategory),
  ).length;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 basis-60">
        {pending ? (
          <Loader2 className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />
        ) : (
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        )}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("discovery.keywordPlaceholder")} aria-label={t("discovery.keyword")} className="ps-9" type="search" />
      </div>
      <Select
        aria-label={t("discovery.sort")}
        className="w-auto min-w-44"
        value={sp.get("sort") ?? "relevance"}
        onChange={(e) => apply({ sort: e.target.value === "relevance" ? null : e.target.value })}
      >
        <option value="relevance">{t("discovery.sortRelevance")}</option>
        <option value="rating">{t("discovery.sortRating")}</option>
        <option value="reviews">{t("discovery.sortReviews")}</option>
        <option value="price_asc">{t("discovery.sortPriceAsc")}</option>
        <option value="price_desc">{t("discovery.sortPriceDesc")}</option>
        <option value="experience">{t("discovery.sortExperience")}</option>
      </Select>
      <Button variant="outline" className="lg:hidden" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        {t("discovery.openFilters")}
        {activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-white ltr-nums">{activeCount}</span>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={t("common.filters")}>
        <FiltersForm {...props} onDone={() => setOpen(false)} />
      </Dialog>
    </div>
  );
}
