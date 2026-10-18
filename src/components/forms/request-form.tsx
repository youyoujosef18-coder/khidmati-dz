"use client";

import { useMemo, useState } from "react";
import { useIdempotencyKey } from "@/lib/use-idempotency-key";
import { Check, Plus } from "lucide-react";
import { ActionForm, Field, SubmitButton, useFormCtx, type FormAction } from "./action-form";
import { FileUploader } from "./file-uploader";
import { AddressForm, type AddressValue } from "./address-form";
import { Input, Select, Textarea, Checkbox, Radio } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/states";
import { PriceDisplay } from "@/components/shared/display";
import { createRequestAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";
import { todayInAlgeria } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { WilayaOption } from "@/components/marketplace/location-picker";

interface Category {
  id: string;
  slug: string;
  nameFr: string;
  nameAr: string;
}
interface Service {
  id: string;
  categoryId: string;
  title: string;
  pricingModel: string;
  startingPriceMinor: number | null;
}
interface Address extends AddressValue {
  communeFr: string;
  communeAr: string;
  wilayaFr: string;
  wilayaAr: string;
}

const STEPS = ["stepService", "stepDetails", "stepPlace", "stepReview"] as const;

export function RequestForm({
  categories,
  addresses,
  wilayas,
  target,
  services,
  defaultCategoryId,
  defaultServiceId,
  emergencyEnabled,
}: {
  categories: Category[];
  addresses: Address[];
  wilayas: WilayaOption[];
  target?: { slug: string; name: string };
  services: Service[];
  defaultCategoryId?: string;
  defaultServiceId?: string;
  emergencyEnabled: boolean;
}) {
  const { t } = useI18n();
  const idempotencyKey = useIdempotencyKey();
  return (
    <ActionForm action={createRequestAction as FormAction} successToast={false}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="targetTechnicianSlug" value={target?.slug ?? ""} />
      {target ? <Notice className="mb-5">{t("request.targetedTo", { name: target.name })}</Notice> : <Notice className="mb-5">{t("request.openToAll")}</Notice>}
      <Steps
        categories={categories}
        addresses={addresses}
        wilayas={wilayas}
        services={services}
        defaultCategoryId={defaultCategoryId}
        defaultServiceId={defaultServiceId}
        emergencyEnabled={emergencyEnabled}
      />
    </ActionForm>
  );
}

function Steps({
  categories,
  addresses,
  wilayas,
  services,
  defaultCategoryId,
  defaultServiceId,
  emergencyEnabled,
}: {
  categories: Category[];
  addresses: Address[];
  wilayas: WilayaOption[];
  services: Service[];
  defaultCategoryId?: string;
  defaultServiceId?: string;
  emergencyEnabled: boolean;
}) {
  const { t, locale } = useI18n();
  const { state } = useFormCtx();
  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? (services.length === 1 ? services[0]!.categoryId : ""));
  const [serviceId, setServiceId] = useState(defaultServiceId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [addressId, setAddressId] = useState(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("flexible");
  const [urgency, setUrgency] = useState("normal");
  const [budget, setBudget] = useState("");
  const [addrOpen, setAddrOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const ar = locale === "ar-DZ";

  const servicesForCategory = useMemo(() => services.filter((s) => s.categoryId === categoryId), [services, categoryId]);
  const category = categories.find((c) => c.id === categoryId);
  const address = addresses.find((a) => a.id === addressId);
  const service = services.find((s) => s.id === serviceId);

  // Jump to the step that holds a server-side field error
  const errorStep = (() => {
    const fe = state?.fieldErrors ?? {};
    if (fe.categoryId || fe.serviceId) return 0;
    if (fe.title || fe.description) return 1;
    if (fe.addressId || fe.preferredDate || fe.budgetDa) return 2;
    if (fe.confirm) return 3;
    return null;
  })();
  const [lastAt, setLastAt] = useState<number | undefined>();
  if (state?.at !== lastAt) {
    setLastAt(state?.at);
    if (errorStep !== null) setStep(errorStep);
  }

  function validate(s: number) {
    if (s === 0 && !categoryId) return t("validation.required");
    if (s === 1 && (title.trim().length < 5 || description.trim().length < 20)) return t("validation.tooShort", { min: title.trim().length < 5 ? 5 : 20 });
    if (s === 2 && !addressId) return t("request.noAddress");
    return null;
  }
  const go = (n: number) => {
    if (n > step) {
      const err = validate(step);
      if (err) return setLocalError(err);
    }
    setLocalError(null);
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div>
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label={t("request.newTitle")}>
        {STEPS.map((k, i) => (
          <li key={k}>
            <button
              type="button"
              onClick={() => (i < step ? go(i) : undefined)}
              aria-current={i === step ? "step" : undefined}
              className={cn("w-full text-start", i > step && "cursor-default")}
            >
              <span className={cn("block h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
              <span className={cn("mt-2 hidden text-xs font-medium sm:block", i === step ? "text-primary" : "text-muted")}>
                {i + 1}. {t(`request.${k}`)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mb-4 text-sm font-semibold text-ink sm:hidden">
        {step + 1}/4 · {t(`request.${STEPS[step]}`)}
      </p>

      {/* Hidden mirrors so every field is submitted whatever the visible step */}
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="addressId" value={addressId} />
      <input type="hidden" name="preferredDate" value={date} />
      <input type="hidden" name="timeWindow" value={timeWindow} />
      <input type="hidden" name="urgency" value={urgency} />
      <input type="hidden" name="budgetDa" value={budget} />

      <div className={cn("space-y-5", step !== 0 && "hidden")}>
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-ink">{t("request.category")}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-3 text-sm transition-colors",
                  categoryId === c.id ? "border-primary bg-primary-50 text-primary" : "border-border-strong hover:bg-bg",
                )}
              >
                <Radio
                  name="_category"
                  checked={categoryId === c.id}
                  onChange={() => {
                    setCategoryId(c.id);
                    setServiceId("");
                  }}
                />
                <span className="font-medium">{ar ? c.nameAr : c.nameFr}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {servicesForCategory.length > 0 && (
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            {t("request.service")}
            <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">{t("request.anyService")}</option>
              {servicesForCategory.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      <div className={cn("space-y-5", step !== 1 && "hidden")}>
        <Field name="title" label={t("request.title")}>
          {(p) => <Input {...p} name="_title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("request.titlePlaceholder")} maxLength={120} dir="auto" />}
        </Field>
        <Field name="description" label={t("request.description")}>
          {(p) => (
            <Textarea {...p} name="_description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("request.descriptionPlaceholder")} maxLength={3000} dir="auto" />
          )}
        </Field>
        <FileUploader bucket="service-request-media" name="photoIds" max={5} label={`${t("request.photos")}`} hint={t("request.photosHint")} />
      </div>

      <div className={cn("space-y-5", step !== 2 && "hidden")}>
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-ink">{t("request.address")}</legend>
          {addresses.length ? (
            <div className="grid gap-2">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-sm",
                    addressId === a.id ? "border-primary bg-primary-50" : "border-border-strong hover:bg-bg",
                  )}
                >
                  <Radio name="_address" checked={addressId === a.id} onChange={() => setAddressId(a.id)} className="mt-0.5" />
                  <span>
                    <span className="font-medium text-ink">{a.label}</span>
                    <span className="block text-muted">
                      {a.addressLine}, {ar ? a.communeAr : a.communeFr}, {ar ? a.wilayaAr : a.wilayaFr}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <Notice tone="warning">{t("request.noAddress")}</Notice>
          )}
          {state?.fieldErrors?.addressId && <p className="mt-1 text-xs font-medium text-error">{t(state.fieldErrors.addressId.key)}</p>}
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setAddrOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> {t("client.addAddress")}
          </Button>
          <Dialog open={addrOpen} onOpenChange={setAddrOpen} title={t("client.addAddress")} description={t("client.addressesSubtitle")}>
            <AddressForm
              wilayas={wilayas}
              onSaved={(id) => {
                setAddrOpen(false);
                if (id) setAddressId(id);
              }}
            />
          </Dialog>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="preferredDate" label={t("request.preferredDate")} optionalLabel>
            {(p) => <Input {...p} name="_date" type="date" min={todayInAlgeria()} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <label className="grid gap-1.5 text-sm font-medium text-ink">
            {t("request.timeWindow")}
            <Select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}>
              {["flexible", "morning", "afternoon", "evening"].map((w) => (
                <option key={w} value={w}>
                  {t(`enums.timeWindow.${w}`)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t("request.urgency")}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(emergencyEnabled ? ["normal", "urgent", "emergency"] : ["normal", "urgent"]).map((u) => (
              <label key={u} className={cn("cursor-pointer rounded-md border px-3 py-2.5 text-sm", urgency === u ? "border-primary bg-primary-50" : "border-border-strong")}>
                <span className="flex items-center gap-2 font-medium">
                  <Radio name="_urgency" checked={urgency === u} onChange={() => setUrgency(u)} /> {t(`enums.urgency.${u}`)}
                </span>
                <span className="mt-1 block text-xs text-muted">{t(`enums.urgencyHint.${u}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field name="budgetDa" label={t("request.budget")} optionalLabel>
          {(p) => <Input {...p} name="_budget" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, "").slice(0, 7))} className="ltr-nums" />}
        </Field>
        <Field name="customerNotes" label={t("request.notes")} optionalLabel>
          {(p) => <Textarea {...p} rows={3} maxLength={1000} dir="auto" />}
        </Field>
      </div>

      <div className={cn("space-y-5", step !== 3 && "hidden")}>
        <h2 className="text-lg font-semibold text-ink">{t("request.reviewTitle")}</h2>
        <dl className="divide-y divide-border rounded-lg border border-border text-sm">
          <Row label={t("request.category")}>{category ? (ar ? category.nameAr : category.nameFr) : "—"}</Row>
          {service && (
            <Row label={t("request.service")}>
              {service.title} · <PriceDisplay minor={service.startingPriceMinor} model={service.pricingModel} />
            </Row>
          )}
          <Row label={t("request.title")}>{title || "—"}</Row>
          <Row label={t("request.description")}>
            <span className="whitespace-pre-line">{description || "—"}</span>
          </Row>
          <Row label={t("request.address")}>{address ? `${address.label} — ${ar ? address.communeAr : address.communeFr}` : "—"}</Row>
          <Row label={t("request.preferredDate")}>{date ? `${date} · ${t(`enums.timeWindow.${timeWindow}`)}` : t("enums.timeWindow.flexible")}</Row>
          <Row label={t("request.urgency")}>{t(`enums.urgency.${urgency}`)}</Row>
          <Row label={t("request.payment")}>{t("request.paymentCash")}</Row>
        </dl>
        <Notice tone="neutral">
          <p>{t("request.estimateNote")}</p>
          <p className="mt-1">{t("request.noPromise")}</p>
        </Notice>
        <Field name="confirm">
          {(p) => (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox {...p} id={p.id} value="on" />
              <span>{t("request.confirmCheckbox")}</span>
            </label>
          )}
        </Field>
      </div>

      {localError && (
        <p role="alert" className="mt-4 text-sm font-medium text-error">
          {localError}
        </p>
      )}
      <div className="mt-8 flex justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={() => go(step - 1)} disabled={step === 0}>
          {t("common.previous")}
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={() => go(step + 1)}>
            {t("common.next")}
          </Button>
        ) : (
          <SubmitButton>
            <Check className="h-4 w-4" aria-hidden /> {t("request.submit")}
          </SubmitButton>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink" dir="auto">
        {children}
      </dd>
    </div>
  );
}
