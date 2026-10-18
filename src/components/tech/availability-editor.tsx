"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { Input, Select } from "@/components/ui/inputs";
import { Button } from "@/components/ui/button";
import { DateTime } from "@/components/shared/display";
import { addExceptionAction, removeExceptionAction, saveAvailabilityAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";
import { todayInAlgeria } from "@/lib/time";

export interface AvailabilityValue {
  slots: { weekday: number; startTime: string; endTime: string }[];
  defaultDurationMinutes: number;
  travelBufferMinutes: number;
  maxDailyJobs: number;
  availabilityStatus: string;
}

export function AvailabilityEditor({ initial, onSaved }: { initial: AvailabilityValue; onSaved?: () => void }) {
  const { t } = useI18n();
  const [slots, setSlots] = useState(initial.slots.map((s, i) => ({ ...s, startTime: s.startTime.slice(0, 5), endTime: s.endTime.slice(0, 5), key: i })));
  const order = [6, 0, 1, 2, 3, 4, 5]; // Saturday → Friday (Algerian week)
  return (
    <ActionForm action={saveAvailabilityAction as FormAction} onSuccess={onSaved} className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-ink">{t("tech.weeklyHours")}</p>
        <ul className="space-y-2">
          {slots.map((s) => (
            <li key={s.key} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <Select name="slotWeekday" defaultValue={s.weekday} aria-label={t("common.date")}>
                {order.map((d) => (
                  <option key={d} value={d}>{t(`enums.weekday.${d}`)}</option>
                ))}
              </Select>
              <Input name="slotStart" type="time" defaultValue={s.startTime} step={900} aria-label={t("tech.start")} className="w-28 ltr-nums" />
              <Input name="slotEnd" type="time" defaultValue={s.endTime} step={900} aria-label={t("tech.end")} className="w-28 ltr-nums" />
              <Button type="button" variant="ghost" size="icon" aria-label={t("common.remove")} onClick={() => setSlots(slots.filter((x) => x.key !== s.key))}>
                <Trash2 className="h-4 w-4 text-error" />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setSlots([...slots, { weekday: 0, startTime: "08:00", endTime: "17:00", key: Date.now() }])}>
          <Plus className="h-4 w-4" aria-hidden /> {t("tech.addSlot")}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="defaultDurationMinutes" label={t("tech.appointmentDuration")}>
          {(p) => <Input {...p} type="number" min={15} max={600} step={15} defaultValue={initial.defaultDurationMinutes} className="ltr-nums" />}
        </Field>
        <Field name="travelBufferMinutes" label={t("tech.travelBuffer")}>
          {(p) => <Input {...p} type="number" min={0} max={240} step={5} defaultValue={initial.travelBufferMinutes} className="ltr-nums" />}
        </Field>
        <Field name="maxDailyJobs" label={t("tech.maxDailyJobs")}>
          {(p) => <Input {...p} type="number" min={1} max={20} defaultValue={initial.maxDailyJobs} className="ltr-nums" />}
        </Field>
        <Field name="availabilityStatus" label={t("tech.availabilityStatus")}>
          {(p) => (
            <Select {...p} defaultValue={initial.availabilityStatus}>
              {["available", "unavailable", "vacation"].map((s) => (
                <option key={s} value={s}>{t(`enums.availability.${s}`)}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}

export function ExceptionsEditor({ exceptions }: { exceptions: { id: string; startsAt: string; endsAt: string; exceptionType: string; reason: string | null }[] }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {exceptions.length ? (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {exceptions.map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>
                <span className="font-medium">{t(`enums.exceptionType.${x.exceptionType}`)}</span> · <DateTime value={x.startsAt} mode="date" /> → <DateTime value={new Date(new Date(x.endsAt).getTime() - 1)} mode="date" />
                {x.reason && <span className="text-muted"> — {x.reason}</span>}
              </span>
              <ActionButton variant="ghost" size="icon" aria-label={t("common.remove")} run={() => removeExceptionAction(x.id)}>
                <Trash2 className="h-4 w-4 text-error" />
              </ActionButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("tech.exceptionsEmpty")}</p>
      )}
      <ActionForm action={addExceptionAction as FormAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <Field name="startDate" label={t("common.from")}>
          {(p) => <Input {...p} type="date" min={todayInAlgeria()} required />}
        </Field>
        <Field name="endDate" label={t("common.to")}>
          {(p) => <Input {...p} type="date" min={todayInAlgeria()} required />}
        </Field>
        <Field name="exceptionType" label={t("common.reason")}>
          {(p) => (
            <Select {...p} defaultValue="blocked">
              {["blocked", "vacation"].map((s) => (
                <option key={s} value={s}>{t(`enums.exceptionType.${s}`)}</option>
              ))}
            </Select>
          )}
        </Field>
        <SubmitButton variant="outline">{t("tech.addException")}</SubmitButton>
      </ActionForm>
    </div>
  );
}
