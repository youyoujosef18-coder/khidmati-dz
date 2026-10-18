"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { sendQuoteAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";
import { todayInAlgeria } from "@/lib/time";

const num = (v: string) => (/^\d{1,7}$/.test(v.replace(/\s/g, "")) ? Number(v.replace(/\s/g, "")) : 0);

export function QuoteBuilder({
  requestId,
  defaultDate,
  defaultDuration,
  defaultValidityHours,
  previous,
}: {
  requestId: string;
  defaultDate?: string;
  defaultDuration: number;
  defaultValidityHours: number;
  previous?: { laborMinor: number; materialsMinor: number; travelMinor: number; otherChargesMinor: number; taxMinor: number; discountMinor: number; durationMinutes: number; terms: string | null; pricingModel: string };
}) {
  const { t, money } = useI18n();
  const da = (m?: number) => (m ? String(Math.round(m / 100)) : "");
  const [v, setV] = useState({
    labor: da(previous?.laborMinor),
    materials: da(previous?.materialsMinor),
    travel: da(previous?.travelMinor),
    other: da(previous?.otherChargesMinor),
    tax: da(previous?.taxMinor),
    discount: da(previous?.discountMinor),
  });
  const [items, setItems] = useState<{ key: number; d: string; q: string; u: string }[]>([]);
  const itemsTotal = items.reduce((s, i) => s + num(i.q || "0") * num(i.u || "0"), 0);
  const total = useMemo(
    () => num(v.labor) + (items.length ? itemsTotal : num(v.materials)) + num(v.travel) + num(v.other) + num(v.tax) - num(v.discount),
    [v, items.length, itemsTotal],
  );
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value.replace(/[^\d\s]/g, "") });
  const amount = (k: keyof typeof v, label: string, disabled?: boolean) => (
    <Field name={`${k}Da`} label={label}>
      {(p) => <Input {...p} inputMode="numeric" value={disabled ? String(itemsTotal) : v[k]} onChange={set(k)} disabled={disabled} className="ltr-nums" placeholder="0" />}
    </Field>
  );
  return (
    <ActionForm action={sendQuoteAction as FormAction} className="space-y-5">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="pricingModel" label={t("tech.pricingModel")}>
          {(p) => (
            <Select {...p} defaultValue={previous?.pricingModel && previous.pricingModel !== "quote_only" ? previous.pricingModel : "fixed"}>
              {["fixed", "starting_at", "hourly", "estimate"].map((m) => (
                <option key={m} value={m}>{t(`enums.pricingModel.${m}`)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="durationMinutes" label={`${t("quote.duration")} (min)`}>
          {(p) => <Input {...p} type="number" min={15} max={720} step={15} defaultValue={previous?.durationMinutes ?? defaultDuration} className="ltr-nums" />}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {amount("labor", t("quote.labor"))}
        {amount("materials", t("quote.materials"), items.length > 0)}
        {amount("travel", t("quote.travel"))}
        {amount("other", t("quote.other"))}
        {amount("tax", t("quote.tax"))}
        {amount("discount", t("quote.discount"))}
      </div>
      <Field name="otherNote" label={t("quote.otherNote")} optionalLabel>
        {(p) => <Input {...p} maxLength={300} dir="auto" />}
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("quote.items")}</legend>
        {items.map((i) => (
          <div key={i.key} className="mb-2 grid grid-cols-[1fr_70px_110px_auto] gap-2">
            <Input name="itemDescription" value={i.d} onChange={(e) => setItems(items.map((x) => (x.key === i.key ? { ...x, d: e.target.value } : x)))} placeholder={t("quote.itemDescription")} aria-label={t("quote.itemDescription")} dir="auto" />
            <Input name="itemQty" value={i.q} inputMode="numeric" onChange={(e) => setItems(items.map((x) => (x.key === i.key ? { ...x, q: e.target.value.replace(/\D/g, "") } : x)))} aria-label={t("quote.itemQty")} className="ltr-nums" />
            <Input name="itemUnit" value={i.u} inputMode="numeric" onChange={(e) => setItems(items.map((x) => (x.key === i.key ? { ...x, u: e.target.value.replace(/\D/g, "") } : x)))} aria-label={t("quote.itemUnit")} placeholder={t("quote.itemUnit")} className="ltr-nums" />
            <Button type="button" variant="ghost" size="icon" aria-label={t("common.remove")} onClick={() => setItems(items.filter((x) => x.key !== i.key))}>
              <Trash2 className="h-4 w-4 text-error" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, { key: Date.now(), d: "", q: "1", u: "" }])}>
          <Plus className="h-4 w-4" aria-hidden /> {t("quote.addItem")}
        </Button>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="proposedDate" label={t("quote.proposedDate")}>
          {(p) => <Input {...p} type="date" min={todayInAlgeria()} defaultValue={defaultDate} required />}
        </Field>
        <Field name="proposedTime" label={t("quote.proposedTime")}>
          {(p) => <Input {...p} type="time" step={900} defaultValue="09:00" required />}
        </Field>
        <Field name="validityHours" label={t("quote.validityHours")}>
          {(p) => <Input {...p} type="number" min={2} max={336} defaultValue={defaultValidityHours} className="ltr-nums" />}
        </Field>
      </div>
      <Field name="terms" label={t("quote.terms")} optionalLabel>
        {(p) => <Textarea {...p} rows={3} defaultValue={previous?.terms ?? ""} maxLength={2000} dir="auto" />}
      </Field>
      <Field name="message" label={t("quote.message")} optionalLabel>
        {(p) => <Textarea {...p} rows={3} maxLength={1000} dir="auto" />}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-primary-50 px-4 py-3">
        <p className="font-semibold text-primary">{t("quote.previewTotal", { total: money(Math.max(0, total) * 100) })}</p>
        <p className="text-xs text-muted">{t("quote.serverTotal")}</p>
      </div>
      <SubmitButton size="lg">{previous ? t("quote.revise") : t("quote.send")}</SubmitButton>
    </ActionForm>
  );
}
