"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Flag, Navigation, Play, Wallet, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/inputs";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { ActionButton } from "@/components/forms/simple-action-button";
import { bookingAction, openDisputeAction, proposeRescheduleAction, respondRescheduleAction, reviewAction } from "@/app/actions/client";
import { recordCashAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";
import { todayInAlgeria } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

/** One-step transition with no extra input (confirm, en route, start…). */
function TransitionButton({ bookingId, action, children, variant = "primary", confirm }: { bookingId: string; action: string; children: React.ReactNode; variant?: "primary" | "outline"; confirm?: string }) {
  return (
    <ActionForm action={bookingAction as FormAction} confirmMessage={confirm}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="action" value={action} />
      <SubmitButton variant={variant} className="w-full sm:w-auto">
        {children}
      </SubmitButton>
    </ActionForm>
  );
}

function ReasonDialog({ bookingId, action, label, danger = true, reasonRequired = true }: { bookingId: string; action: string; label: string; danger?: boolean; reasonRequired?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={label}
      trigger={
        <Button variant="outline" className={cn("w-full sm:w-auto", danger && "text-error")}>
          <X className="h-4 w-4" aria-hidden /> {label}
        </Button>
      }
    >
      <ActionForm action={bookingAction as FormAction} onSuccess={() => setOpen(false)} className="space-y-4">
        <input type="hidden" name="bookingId" value={bookingId} />
        <input type="hidden" name="action" value={action} />
        <Field name="reason" label={t("booking.cancelReason")} optionalLabel={!reasonRequired}>
          {(p) => <Textarea {...p} rows={3} maxLength={500} required={reasonRequired} placeholder={t("common.reasonPlaceholder")} />}
        </Field>
        <SubmitButton variant={danger ? "danger" : "primary"} className="w-full">
          {label}
        </SubmitButton>
      </ActionForm>
    </Dialog>
  );
}

function RescheduleDialog({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("booking.reschedule")}
      description={t("booking.rescheduleSent")}
      trigger={
        <Button variant="outline" className="w-full sm:w-auto">
          <CalendarClock className="h-4 w-4" aria-hidden /> {t("booking.reschedule")}
        </Button>
      }
    >
      <ActionForm action={proposeRescheduleAction as FormAction} onSuccess={() => setOpen(false)} className="space-y-4">
        <input type="hidden" name="bookingId" value={bookingId} />
        <div className="grid grid-cols-2 gap-3">
          <Field name="date" label={t("booking.newDate")}>
            {(p) => <Input {...p} type="date" min={todayInAlgeria()} required />}
          </Field>
          <Field name="time" label={t("booking.newTime")}>
            {(p) => <Input {...p} type="time" step={900} required />}
          </Field>
        </div>
        <Field name="reason" label={t("common.reason")} optionalLabel>
          {(p) => <Textarea {...p} rows={2} maxLength={500} />}
        </Field>
        <SubmitButton className="w-full">{t("common.submit")}</SubmitButton>
      </ActionForm>
    </Dialog>
  );
}

function DisputeDialog({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("dispute.open")}
      trigger={
        <Button variant="outline" className="w-full text-error sm:w-auto">
          <Flag className="h-4 w-4" aria-hidden /> {t("booking.reportIssue")}
        </Button>
      }
    >
      <ActionForm action={openDisputeAction as FormAction} onSuccess={() => setOpen(false)} className="space-y-4">
        <input type="hidden" name="bookingId" value={bookingId} />
        <Field name="category" label={t("dispute.category")}>
          {(p) => (
            <Select {...p} required defaultValue="">
              <option value="" disabled>—</option>
              {["quality", "no_show", "price", "damage", "behavior", "other"].map((c) => (
                <option key={c} value={c}>{t(`enums.disputeCategory.${c}`)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="description" label={t("dispute.description")}>
          {(p) => <Textarea {...p} rows={5} required minLength={20} maxLength={3000} dir="auto" />}
        </Field>
        <FileUploader bucket="dispute-evidence" name="evidenceIds" max={5} accept="image/jpeg,image/png,image/webp,application/pdf" label={t("dispute.evidence")} />
        <SubmitButton variant="danger" className="w-full">{t("dispute.open")}</SubmitButton>
      </ActionForm>
    </Dialog>
  );
}

function CashDialog({ bookingId, defaultDa }: { bookingId: string; defaultDa: number }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("booking.recordCash")}
      trigger={
        <Button variant="outline" className="w-full sm:w-auto">
          <Wallet className="h-4 w-4" aria-hidden /> {t("booking.recordCash")}
        </Button>
      }
    >
      <ActionForm action={recordCashAction as FormAction} onSuccess={() => setOpen(false)} className="space-y-4">
        <input type="hidden" name="bookingId" value={bookingId} />
        <Field name="amountDa" label={t("booking.cashAmount")}>
          {(p) => <Input {...p} inputMode="numeric" defaultValue={String(defaultDa)} required className="ltr-nums" />}
        </Field>
        <Field name="note" label={t("common.note")} optionalLabel>
          {(p) => <Input {...p} maxLength={200} />}
        </Field>
        <SubmitButton className="w-full">{t("common.save")}</SubmitButton>
      </ActionForm>
    </Dialog>
  );
}

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const [rating, setRating] = useState(0);
  return (
    <ActionForm action={reviewAction as FormAction} className="space-y-4">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("booking.rating")}</legend>
        <div className="flex gap-1" role="radiogroup" aria-label={t("booking.rating")}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={rating === i}
              aria-label={`${i}/5`}
              onClick={() => setRating(i)}
              className="grid h-11 w-11 place-items-center rounded-md hover:bg-accent-50"
            >
              <Star className={cn("h-7 w-7", i <= rating ? "fill-accent text-accent" : "text-border-strong")} aria-hidden />
            </button>
          ))}
        </div>
      </fieldset>
      <Field name="comment" label={t("booking.comment")} optionalLabel hint={t("booking.reviewHint")}>
        {(p) => <Textarea {...p} rows={3} maxLength={1500} dir="auto" />}
      </Field>
      <SubmitButton disabled={!rating}>{t("booking.leaveReview")}</SubmitButton>
    </ActionForm>
  );
}

export function ChangeRequestActions({ changeId }: { changeId: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ActionButton run={() => respondRescheduleAction(changeId, true)}>{t("booking.rescheduleAccept")}</ActionButton>
      <ActionButton variant="outline" run={() => respondRescheduleAction(changeId, false)}>
        {t("booking.rescheduleReject")}
      </ActionButton>
    </div>
  );
}

export function BookingActions({
  bookingId,
  status,
  viewer,
  canClientCancelFreely,
  canDispute,
  hasPendingChange,
  paymentStatus,
  agreedDa,
}: {
  bookingId: string;
  status: string;
  viewer: "client" | "technician" | "staff";
  canClientCancelFreely: boolean;
  canDispute: boolean;
  hasPendingChange: boolean;
  paymentStatus: string;
  agreedDa: number;
}) {
  const { t } = useI18n();
  const items: React.ReactNode[] = [];
  if (viewer === "client") {
    if (status === "requested") items.push(<ReasonDialog key="c" bookingId={bookingId} action="cancel" label={t("booking.cancel")} />);
    if (status === "confirmed") {
      if (!hasPendingChange) items.push(<RescheduleDialog key="r" bookingId={bookingId} />);
      if (canClientCancelFreely) items.push(<ReasonDialog key="c" bookingId={bookingId} action="cancel" label={t("booking.cancel")} />);
    }
    if (status === "awaiting_completion_confirmation")
      items.push(
        <TransitionButton key="cc" bookingId={bookingId} action="confirm_completion" confirm={t("booking.confirmCompletion")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("booking.confirmCompletion")}
        </TransitionButton>,
      );
  }
  if (viewer === "technician") {
    if (status === "requested") {
      items.push(
        <TransitionButton key="a" bookingId={bookingId} action="confirm">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("booking.accept")}
        </TransitionButton>,
        <ReasonDialog key="d" bookingId={bookingId} action="decline" label={t("booking.decline")} reasonRequired={false} />,
      );
    }
    if (status === "confirmed") {
      items.push(
        <TransitionButton key="e" bookingId={bookingId} action="en_route">
          <Navigation className="h-4 w-4" aria-hidden /> {t("booking.markEnRoute")}
        </TransitionButton>,
        <TransitionButton key="s" bookingId={bookingId} action="start" variant="outline">
          <Play className="h-4 w-4" aria-hidden /> {t("booking.startJob")}
        </TransitionButton>,
      );
      if (!hasPendingChange) items.push(<RescheduleDialog key="r" bookingId={bookingId} />);
      items.push(<ReasonDialog key="c" bookingId={bookingId} action="cancel" label={t("booking.cancel")} />);
    }
    if (status === "technician_en_route")
      items.push(
        <TransitionButton key="s" bookingId={bookingId} action="start">
          <Play className="h-4 w-4" aria-hidden /> {t("booking.startJob")}
        </TransitionButton>,
      );
    if (status === "in_progress")
      items.push(
        <TransitionButton key="rc" bookingId={bookingId} action="request_completion" confirm={t("booking.markDoneHint")}>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("booking.markDone")}
        </TransitionButton>,
      );
    if (["in_progress", "awaiting_completion_confirmation", "completed"].includes(status) && paymentStatus === "unpaid")
      items.push(<CashDialog key="cash" bookingId={bookingId} defaultDa={agreedDa} />);
  }
  if (viewer !== "staff" && canDispute) items.push(<DisputeDialog key="disp" bookingId={bookingId} />);
  if (!items.length) return null;
  return <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">{items}</div>;
}
