"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Notice } from "@/components/ui/states";
import { PriceDisplay, StatusBadge } from "@/components/shared/display";
import { deleteServiceAction, saveServiceAction, toggleServiceAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

export interface ServiceRow {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  pricingModel: string;
  startingPriceMinor: number | null;
  estimatedDurationMinutes: number;
  approvalStatus: string;
  moderationReason: string | null;
  isActive: boolean;
}

function ServiceForm({ categories, initial, onDone }: { categories: { id: string; name: string }[]; initial?: ServiceRow; onDone: () => void }) {
  const { t } = useI18n();
  const [model, setModel] = useState(initial?.pricingModel ?? "starting_at");
  return (
    <ActionForm action={saveServiceAction as FormAction} onSuccess={onDone} className="space-y-4">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <Field name="categoryId" label={t("request.category")}>
        {(p) => (
          <Select {...p} defaultValue={initial?.categoryId ?? categories[0]?.id} required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field name="title" label={t("tech.serviceTitle")}>
        {(p) => <Input {...p} defaultValue={initial?.title} required maxLength={100} dir="auto" />}
      </Field>
      <Field name="description" label={t("tech.serviceDescription")} optionalLabel>
        {(p) => <Textarea {...p} rows={3} defaultValue={initial?.description} maxLength={1000} dir="auto" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="pricingModel" label={t("tech.pricingModel")} hint={t(`enums.pricingHint.${model}`)}>
          {(p) => (
            <Select {...p} value={model} onChange={(e) => setModel(e.target.value)}>
              {["fixed", "starting_at", "hourly", "estimate", "quote_only"].map((m) => (
                <option key={m} value={m}>{t(`enums.pricingModel.${m}`)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="priceDa" label={t("tech.price")} hint={model === "quote_only" ? t("tech.priceHint") : undefined}>
          {(p) => (
            <Input {...p} inputMode="numeric" disabled={model === "quote_only"} defaultValue={initial?.startingPriceMinor != null ? String(initial.startingPriceMinor / 100) : ""} className="ltr-nums" />
          )}
        </Field>
      </div>
      <Field name="estimatedDurationMinutes" label={t("tech.estimatedDuration")}>
        {(p) => <Input {...p} type="number" min={15} max={600} step={15} defaultValue={initial?.estimatedDurationMinutes ?? 60} className="ltr-nums" />}
      </Field>
      <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}

export function ServicesEditor({ services, categories, approved }: { services: ServiceRow[]; categories: { id: string; name: string }[]; approved: boolean }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  return (
    <div>
      {approved && <Notice className="mb-4">{t("tech.servicePending")}</Notice>}
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")} disabled={!categories.length}>
          <Plus className="h-4 w-4" aria-hidden /> {t("tech.addService")}
        </Button>
      </div>
      {services.length ? (
        <ul className="card divide-y divide-border">
          {services.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink" dir="auto">{s.title}</p>
                  <StatusBadge kind="approval" status={s.approvalStatus} />
                  {!s.isActive && <span className="text-xs text-muted">({t("admin.inactive")})</span>}
                </div>
                <PriceDisplay minor={s.startingPriceMinor} model={s.pricingModel} className="text-sm" />
                {s.moderationReason && <p className="text-xs text-error">{s.moderationReason}</p>}
              </div>
              <div className="flex gap-1">
                <ActionButton variant="ghost" size="sm" run={() => toggleServiceAction(s.id, !s.isActive)}>
                  {s.isActive ? t("admin.disable") : t("admin.enable")}
                </ActionButton>
                <Button variant="ghost" size="icon" aria-label={t("common.edit")} onClick={() => setEditing(s)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <ActionButton variant="ghost" size="icon" aria-label={t("common.delete")} run={() => deleteServiceAction(s.id)} confirm={t("common.areYouSure")}>
                  <Trash2 className="h-4 w-4 text-error" />
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("tech.servicesEmpty")} />
      )}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? t("tech.addService") : t("common.edit")}>
        {editing !== null && <ServiceForm categories={categories} initial={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} />}
      </Dialog>
    </div>
  );
}
