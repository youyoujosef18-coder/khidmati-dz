"use client";

import { useState } from "react";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { Plus } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "./action-form";
import { FileUploader } from "./file-uploader";
import { AddressForm } from "./address-form";
import { Input, Textarea, Checkbox, Radio } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/states";
import { createFixedBookingAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";
import { todayInAlgeria } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { WilayaOption } from "@/components/marketplace/location-picker";

interface Addr {
  id: string;
  label: string;
  addressLine: string;
  communeFr: string;
  communeAr: string;
  isDefault: boolean;
}

export function FixedBookingForm({ serviceId, addresses, wilayas }: { serviceId: string; addresses: Addr[]; wilayas: WilayaOption[] }) {
  const { t, locale } = useI18n();
  const key = useIdempotencyKey();
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  return (
    <ActionForm action={createFixedBookingAction as FormAction} successToast={false} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="addressId" value={addressId} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("request.address")}</legend>
        {addresses.length ? (
          <div className="grid gap-2">
            {addresses.map((a) => (
              <label key={a.id} className={cn("flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-sm", addressId === a.id ? "border-primary bg-primary-50" : "border-border-strong")}>
                <Radio name="_addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-0.5" />
                <span>
                  <span className="font-medium">{a.label}</span>
                  <span className="block text-muted">{a.addressLine}, {locale === "ar-DZ" ? a.communeAr : a.communeFr}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <Notice tone="warning">{t("request.noAddress")}</Notice>
        )}
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> {t("client.addAddress")}
        </Button>
        <Dialog open={open} onOpenChange={setOpen} title={t("client.addAddress")}>
          <AddressForm wilayas={wilayas} onSaved={(id) => { setOpen(false); if (id) setAddressId(id); }} />
        </Dialog>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field name="date" label={t("quote.proposedDate")}>
          {(p) => <Input {...p} type="date" min={todayInAlgeria()} required />}
        </Field>
        <Field name="time" label={t("quote.proposedTime")}>
          {(p) => <Input {...p} type="time" step={900} required />}
        </Field>
      </div>
      <Field name="description" label={t("request.description")}>
        {(p) => <Textarea {...p} rows={4} required minLength={10} maxLength={2000} placeholder={t("request.descriptionPlaceholder")} dir="auto" />}
      </Field>
      <Field name="customerNotes" label={t("request.notes")} optionalLabel>
        {(p) => <Textarea {...p} rows={2} maxLength={1000} dir="auto" />}
      </Field>
      <FileUploader bucket="service-request-media" name="photoIds" max={5} label={t("request.photos")} hint={t("request.photosHint")} />
      <Notice tone="neutral">{t("request.noPromise")}</Notice>
      <Field name="confirm">
        {(p) => (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox {...p} id={p.id} value="on" />
            <span>{t("request.confirmCheckbox")}</span>
          </label>
        )}
      </Field>
      <SubmitButton size="lg" className="w-full sm:w-auto">{t("booking.fixedSubmit")}</SubmitButton>
    </ActionForm>
  );
}
