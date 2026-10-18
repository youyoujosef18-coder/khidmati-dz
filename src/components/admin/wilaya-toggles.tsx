"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/inputs";
import { toggleWilayaAction } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/toast";

export function WilayaToggles({ wilayas }: { wilayas: { code: string; nameFr: string; nameAr: string; isActive: boolean }[] }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const [filter, setFilter] = useState("");
  const [state, setState] = useState(Object.fromEntries(wilayas.map((w) => [w.code, w.isActive])));
  const [pending, start] = useTransition();
  return (
    <div>
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("common.search")} aria-label={t("common.search")} className="mb-3 max-w-xs" />
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {wilayas
          .filter((w) => !filter || w.nameFr.toLowerCase().includes(filter.toLowerCase()) || w.nameAr.includes(filter) || w.code.includes(filter))
          .map((w) => (
            <li key={w.code}>
              <label className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-bg">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={state[w.code]}
                  disabled={pending}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setState((s) => ({ ...s, [w.code]: next }));
                    start(async () => {
                      const r = await toggleWilayaAction(w.code, next);
                      if (!r.ok) {
                        setState((s) => ({ ...s, [w.code]: !next })); // rollback
                        toast(t(r.message ?? "errors.unexpected"), "error");
                      }
                    });
                  }}
                />
                <span className="ltr-nums text-muted">{w.code}</span> {locale === "ar-DZ" ? w.nameAr : w.nameFr}
              </label>
            </li>
          ))}
      </ul>
    </div>
  );
}
