"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/inputs";
import { useI18n } from "@/lib/i18n/client";

export interface WilayaOption {
  code: string;
  nameFr: string;
  nameAr: string;
}
interface CommuneOption {
  id: number;
  nameFr: string;
  nameAr: string;
}

const cache = new Map<string, CommuneOption[]>();

export function useCommunes(wilaya: string) {
  const [loaded, setLoaded] = useState<Record<string, CommuneOption[]>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const communes = wilaya ? (cache.get(wilaya) ?? loaded[wilaya] ?? []) : [];
  const needsFetch = Boolean(wilaya) && !cache.has(wilaya) && !loaded[wilaya];
  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    fetch(`/api/communes?wilaya=${wilaya}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { communes: CommuneOption[] }) => {
        cache.set(wilaya, d.communes);
        if (!cancelled) setLoaded((l) => ({ ...l, [wilaya]: d.communes }));
      })
      .catch(() => {
        if (!cancelled) setFailed(wilaya);
      });
    return () => {
      cancelled = true;
    };
  }, [wilaya, needsFetch]);
  const state: "idle" | "loading" | "error" = failed === wilaya && needsFetch ? "error" : needsFetch ? "loading" : "idle";
  return { communes, state };
}

/** Wilaya + commune selectors (manual selection, works without geolocation). */
export function LocationPicker({
  wilayas,
  defaultWilaya = "",
  defaultCommune = "",
  wilayaName = "wilaya",
  communeName = "commune",
  required,
  anyLabel,
  ids,
  invalid,
  onChange,
}: {
  wilayas: WilayaOption[];
  defaultWilaya?: string;
  defaultCommune?: string | number;
  wilayaName?: string;
  communeName?: string;
  required?: boolean;
  anyLabel?: boolean;
  ids?: { wilaya?: string; commune?: string };
  invalid?: { wilaya?: boolean; commune?: boolean };
  onChange?: (v: { wilaya: string; commune: string }) => void;
}) {
  const { t, locale } = useI18n();
  const [wilaya, setWilaya] = useState(defaultWilaya);
  const [commune, setCommune] = useState(String(defaultCommune ?? ""));
  const { communes, state } = useCommunes(wilaya);
  const name = (o: { nameFr: string; nameAr: string }) => (locale === "ar-DZ" ? o.nameAr : o.nameFr);

  return (
    <>
      <Select
        id={ids?.wilaya}
        name={wilayaName}
        value={wilaya}
        required={required}
        aria-invalid={invalid?.wilaya || undefined}
        aria-label={ids?.wilaya ? undefined : t("home.searchWilaya")}
        onChange={(e) => {
          setWilaya(e.target.value);
          setCommune("");
          onChange?.({ wilaya: e.target.value, commune: "" });
        }}
      >
        <option value="">{anyLabel ? t("home.anyWilaya") : `— ${t("home.searchWilaya")} —`}</option>
        {wilayas.map((w) => (
          <option key={w.code} value={w.code}>
            {w.code} · {name(w)}
          </option>
        ))}
      </Select>
      <Select
        id={ids?.commune}
        name={communeName}
        value={commune}
        required={required}
        disabled={!wilaya || state === "loading"}
        aria-invalid={invalid?.commune || undefined}
        aria-label={ids?.commune ? undefined : t("home.searchCommune")}
        aria-busy={state === "loading" || undefined}
        onChange={(e) => {
          setCommune(e.target.value);
          onChange?.({ wilaya, commune: e.target.value });
        }}
      >
        <option value="">
          {state === "loading" ? t("common.loading") : anyLabel ? t("home.anyCommune") : `— ${t("home.searchCommune")} —`}
        </option>
        {communes.map((c) => (
          <option key={c.id} value={c.id}>
            {name(c)}
          </option>
        ))}
      </Select>
      {state === "error" && <p className="text-xs text-error">{t("states.errorBody")}</p>}
    </>
  );
}
