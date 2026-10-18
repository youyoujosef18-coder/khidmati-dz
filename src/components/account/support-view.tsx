"use client";

import Link from "next/link";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/inputs";
import { StatusBadge, DateTime } from "@/components/shared/display";
import { createTicketAction, replyTicketAction, setTicketStatusAction } from "@/app/actions/support";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function NewTicketForm({ bookings, defaultBookingId }: { bookings: { id: string; reference: string; title: string }[]; defaultBookingId?: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={createTicketAction as FormAction} resetOnSuccess className="space-y-4">
      <Field name="subject" label={t("support.subject")}>
        {(p) => <Input {...p} required maxLength={140} />}
      </Field>
      <Field name="bookingId" label={t("support.booking")}>
        {(p) => (
          <Select {...p} defaultValue={defaultBookingId ?? ""}>
            <option value="">{t("support.noBooking")}</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>{b.reference} — {b.title}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field name="description" label={t("support.description")}>
        {(p) => <Textarea {...p} rows={5} required maxLength={4000} dir="auto" />}
      </Field>
      <SubmitButton>{t("support.newTicket")}</SubmitButton>
    </ActionForm>
  );
}

export interface TicketMessageView {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  authorName: string;
  mine: boolean;
}

export function TicketThread({
  ticketId,
  status,
  description,
  messages,
  isStaff,
  closeLabel = true,
}: {
  ticketId: string;
  status: string;
  description: string;
  messages: TicketMessageView[];
  isStaff: boolean;
  closeLabel?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-line rounded-md bg-bg p-3 text-sm" dir="auto">{description}</p>
      <ul className="space-y-2">
        {messages.map((m) => (
          <li key={m.id} className={cn("rounded-lg border px-3.5 py-2.5 text-sm", m.isInternal ? "border-warning/30 bg-warning-50" : m.mine ? "border-primary/20 bg-primary-50" : "border-border")}>
            <p className="text-xs text-muted">
              <span className="font-semibold text-ink">{m.mine ? t("messages.you") : m.authorName}</span> · <DateTime value={m.createdAt} />
              {m.isInternal && ` · ${t("support.internal")}`}
            </p>
            <p className="mt-1 whitespace-pre-line" dir="auto">{m.body}</p>
          </li>
        ))}
      </ul>
      {status !== "closed" || isStaff ? (
        <ActionForm action={replyTicketAction as FormAction} resetOnSuccess className="space-y-2">
          <input type="hidden" name="ticketId" value={ticketId} />
          <Field name="body" label={t("support.reply")}>
            {(p) => <Textarea {...p} rows={3} required maxLength={4000} dir="auto" />}
          </Field>
          {isStaff && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isInternal" /> {t("support.internal")}
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <SubmitButton size="sm">{t("support.reply")}</SubmitButton>
            {closeLabel && status !== "closed" && (
              <ActionButton size="sm" variant="outline" run={() => setTicketStatusAction(ticketId, "closed")}>
                {t("support.closeTicket")}
              </ActionButton>
            )}
          </div>
        </ActionForm>
      ) : null}
      <StatusBadge kind="ticket" status={status} />
    </div>
  );
}

export function TicketList({ tickets, base, selected }: { tickets: { id: string; reference: string; subject: string; status: string; updatedAt: string }[]; base: string; selected?: string }) {
  const { t } = useI18n();
  if (!tickets.length) return <p className="text-sm text-muted">{t("support.empty")}</p>;
  return (
    <ul className="card divide-y divide-border overflow-hidden">
      {tickets.map((tk) => (
        <li key={tk.id}>
          <Link href={`${base}?ticket=${tk.id}`} aria-current={tk.id === selected ? "true" : undefined} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-bg aria-[current=true]:bg-primary-50">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{tk.subject}</span>
              <span className="text-xs text-muted ltr-nums">{tk.reference} · <DateTime value={tk.updatedAt} mode="relative" /></span>
            </span>
            <StatusBadge kind="ticket" status={tk.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
