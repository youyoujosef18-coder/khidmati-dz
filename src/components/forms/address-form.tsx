"use client";

import { useState } from "react";
import { LocateFixed } from "lucide-react";
import { ActionForm, Field, SubmitButton, useFormCtx, type FormAction } from "./action-form";
import { Input, Textarea, Checkbox } from "@/components/ui/inputs";
import { LocationPicker, type WilayaOption } from "@/components/marketplace/location-picker";
import { saveAddressAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";

export interface AddressValue {
  id: string;
  label: string;
  wilayaCode: string;
  communeId: number;
  neighborhood: string | null;
  addressLine: string;
  accessNotes: string | null;
  isDefault: boolean;
}

function LocationFields({ wilayas, initial }: { wilayas: WilayaOption[]; initial?: AddressValue }) {
  const { t } = useI18n();
  const { state } = useFormCtx();
  const invalid = Boolean(state?.fieldErrors?.wilaya || state?.fieldErrors?.commune);
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium text-ink">
        {t("home.searchWilaya")} / {t("home.searchCommune")}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <LocationPicker
          wilayas={wilayas}
          defaultWilaya={initial?.wilayaCode}
          defaultCommune={initial?.communeId}
          required
          invalid={{ wilaya: Boolean(state?.fieldErrors?.wilaya), commune: Boolean(state?.fieldErrors?.commune) }}
        />
      </div>
      {invalid && <p className="text-xs font-medium text-error">{t("validation.required")}</p>}
    </fieldset>
  );
}

export function AddressForm({ wilayas, initial, onSaved }: { wilayas: WilayaOption[]; initial?: AddressValue; onSaved?: (id: string) => void }) {
  const { t } = useI18n();
  const [coords, setCoords] = useState<{ lat: string; lng: string } | null>(null);
  const [geo, setGeo] = useState<string | null>(null);
  return (
    <ActionForm
      action={saveAddressAction as FormAction}
      onSuccess={(s) => onSaved?.(String((s.data as { id?: string } | undefined)?.id ?? ""))}
      className="space-y-4"
    >
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <Field name="label" label={t("client.addressLabel")}>
        {(p) => <Input {...p} defaultValue={initial?.label} placeholder={t("client.addressLabelPlaceholder")} required maxLength={40} />}
      </Field>
      <LocationFields wilayas={wilayas} initial={initial} />
      <Field name="neighborhood" label={t("client.neighborhood")} optionalLabel>
        {(p) => <Input {...p} defaultValue={initial?.neighborhood ?? ""} maxLength={80} />}
      </Field>
      <Field name="addressLine" label={t("client.addressLine")}>
        {(p) => <Input {...p} defaultValue={initial?.addressLine} required maxLength={200} autoComplete="street-address" />}
      </Field>
      <Field name="accessNotes" label={t("client.accessNotes")} optionalLabel>
        {(p) => <Textarea {...p} rows={2} defaultValue={initial?.accessNotes ?? ""} maxLength={300} />}
      </Field>
      <div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          onClick={() => {
            if (!("geolocation" in navigator)) return setGeo(t("client.locationDenied"));
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setCoords({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) });
                setGeo(t("client.locationSaved"));
              },
              () => setGeo(t("client.locationDenied")),
              { timeout: 10000, maximumAge: 300000 },
            );
          }}
        >
          <LocateFixed className="h-4 w-4" aria-hidden /> {t("client.useMyLocation")}
        </button>
        {geo && <p className="mt-1 text-xs text-muted">{geo}</p>}
        <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
        <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Checkbox name="isDefault" defaultChecked={initial?.isDefault} />
        {t("client.setDefault")}
      </label>
      <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
