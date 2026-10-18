"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { LocationPicker, type WilayaOption } from "./location-picker";
import { useI18n } from "@/lib/i18n/client";

export function ServiceSearchBar({ wilayas }: { wilayas: WilayaOption[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loc, setLoc] = useState({ wilaya: "", commune: "" });
  return (
    <form
      role="search"
      className="card grid gap-2 p-2 shadow-raised sm:grid-cols-[1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams();
        if (q.trim()) p.set("q", q.trim());
        if (loc.wilaya) p.set("wilaya", loc.wilaya);
        if (loc.commune) p.set("commune", loc.commune);
        router.push(`/techniciens${p.size ? `?${p}` : ""}`);
      }}
    >
      <label className="sr-only" htmlFor="hero-q">
        {t("home.searchService")}
      </label>
      <div className="relative sm:col-span-3">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.searchServicePlaceholder")} className="ps-9" />
      </div>
      <LocationPicker wilayas={wilayas} anyLabel onChange={setLoc} />
      <Button type="submit" size="md" className="md:px-6">
        {t("home.ctaFind")}
      </Button>
    </form>
  );
}
