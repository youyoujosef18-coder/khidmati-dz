"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Input, Select, Checkbox } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LocationPicker, useCommunes, type WilayaOption } from "@/components/marketplace/location-picker";
import { saveAreasAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

interface Cat {
  id: string;
  nameFr: string;
  nameAr: string;
}
export interface AreasValue {
  primaryCategoryId: string;
  categories: { categoryId: string; approvalStatus: string }[];
  baseWilayaCode: string;
  baseCommuneId: number | null;
  travelRadiusKm: number;
  emergencyAvailable: boolean;
  zones: { wilayaCode: string; communeIds: number[] }[];
}

function ZoneEditor({ index, wilayas, initial, onRemove }: { index: number; wilayas: WilayaOption[]; initial: { wilayaCode: string; communeIds: number[] }; onRemove?: () => void }) {
  const { t, locale } = useI18n();
  const [wilaya, setWilaya] = useState(initial.wilayaCode);
  const [selected, setSelected] = useState<Set<number>>(new Set(initial.communeIds));
  const [filter, setFilter] = useState("");
  const { communes, state } = useCommunes(wilaya);
  const shown = useMemo(
    () => communes.filter((c) => !filter || c.nameFr.toLowerCase().includes(filter.toLowerCase()) || c.nameAr.includes(filter)),
    [communes, filter],
  );
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-end gap-2">
        <label className="grid flex-1 gap-1.5 text-sm font-medium text-ink">
          {t("home.searchWilaya")}
          <Select
            name="zoneWilaya"
            value={wilaya}
            required
            onChange={(e) => {
              setWilaya(e.target.value);
              setSelected(new Set());
            }}
          >
            <option value="">—</option>
            {wilayas.map((w) => (
              <option key={w.code} value={w.code}>{w.code} · {locale === "ar-DZ" ? w.nameAr : w.nameFr}</option>
            ))}
          </Select>
        </label>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={t("common.remove")}>
            <Trash2 className="h-4 w-4 text-error" />
          </Button>
        )}
      </div>
      {wilaya && (
        <fieldset className="mt-3">
          <legend className="text-sm font-medium text-ink">
            {t("tech.servedCommunes")} {selected.size === 0 ? <Badge tone="primary" className="ms-1">{t("profile.wholeWilaya")}</Badge> : <span className="text-muted ltr-nums">({selected.size})</span>}
          </legend>
          <p className="mb-2 text-xs text-muted">{t("tech.servedHint")}</p>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("common.search")} className="mb-2 h-9" aria-label={t("common.search")} />
          {state === "loading" ? (
            <p className="text-sm text-muted">{t("common.loading")}</p>
          ) : (
            <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-border p-2 sm:grid-cols-2">
              {shown.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-bg">
                  <Checkbox
                    checked={selected.has(c.id)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(c.id);
                      else next.delete(c.id);
                      setSelected(next);
                    }}
                  />
                  {locale === "ar-DZ" ? c.nameAr : c.nameFr}
                </label>
              ))}
            </div>
          )}
          {[...selected].map((id) => (
            <input key={id} type="hidden" name={`zoneCommunes_${index}`} value={id} />
          ))}
        </fieldset>
      )}
    </div>
  );
}

export function AreasForm({ categories, wilayas, initial, onSaved }: { categories: Cat[]; wilayas: WilayaOption[]; initial: AreasValue; onSaved?: () => void }) {
  const { t, locale } = useI18n();
  const [primary, setPrimary] = useState(initial.primaryCategoryId);
  const [zones, setZones] = useState(initial.zones.length ? initial.zones.map((z, i) => ({ ...z, key: i })) : [{ wilayaCode: initial.baseWilayaCode, communeIds: [], key: 0 }]);
  const statusOf = (id: string) => initial.categories.find((c) => c.categoryId === id)?.approvalStatus;
  const name = (c: Cat) => (locale === "ar-DZ" ? c.nameAr : c.nameFr);
  return (
    <ActionForm action={saveAreasAction as FormAction} onSuccess={onSaved} className="space-y-6">
      <Field name="primaryCategoryId" label={t("tech.primaryCategory")}>
        {(p) => (
          <Select {...p} value={primary} onChange={(e) => setPrimary(e.target.value)} required>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{name(c)}</option>
            ))}
          </Select>
        )}
      </Field>
      <fieldset>
        <legend className="text-sm font-medium text-ink">{t("tech.additionalCategories")}</legend>
        <p className="mb-2 text-xs text-muted">{t("tech.additionalHint")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories
            .filter((c) => c.id !== primary)
            .map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <Checkbox name="additionalCategoryIds" value={c.id} defaultChecked={Boolean(statusOf(c.id))} />
                {name(c)}
                {statusOf(c.id) && <span className="text-xs text-muted">({t(`status.approval.${statusOf(c.id)}`)})</span>}
              </label>
            ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">{t("tech.baseWilaya")} / {t("tech.baseCommune")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <LocationPicker wilayas={wilayas} wilayaName="baseWilayaCode" communeName="baseCommuneId" defaultWilaya={initial.baseWilayaCode} defaultCommune={initial.baseCommuneId ?? ""} required />
        </div>
      </fieldset>
      <div>
        <p className="mb-2 text-sm font-medium text-ink">{t("profile.areas")}</p>
        <div className="space-y-3">
          {zones.map((z, i) => (
            <ZoneEditor key={z.key} index={i} wilayas={wilayas} initial={z} onRemove={zones.length > 1 ? () => setZones(zones.filter((x) => x.key !== z.key)) : undefined} />
          ))}
        </div>
        {zones.length < 10 && (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setZones([...zones, { wilayaCode: "", communeIds: [], key: Date.now() }])}>
            <Plus className="h-4 w-4" aria-hidden /> {t("tech.addZone")}
          </Button>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="travelRadiusKm" label={t("tech.travelRadius")}>
          {(p) => <Input {...p} type="number" min={0} max={200} defaultValue={initial.travelRadiusKm} className="ltr-nums" />}
        </Field>
        <label className="flex items-center gap-3 self-end pb-3 text-sm">
          <Checkbox name="emergencyAvailable" defaultChecked={initial.emergencyAvailable} /> {t("tech.emergency")}
        </label>
      </div>
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
