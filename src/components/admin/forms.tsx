"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/inputs";
import { Dialog } from "@/components/ui/dialog";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/** Generic server-action form with hidden fields and an optional reason. */
export function InlineActionForm({
  action,
  hidden,
  submitLabel,
  variant = "primary",
  reason,
  confirm,
  children,
  className,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  submitLabel: string;
  variant?: ButtonProps["variant"];
  reason?: { label: string; required?: boolean };
  confirm?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirm} className={className ?? "space-y-3"}>
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {reason && (
        <Field name={Object.keys(hidden).includes("note") ? "note" : "reason"} label={reason.label} optionalLabel={!reason.required}>
          {(p) => <Textarea {...p} rows={2} maxLength={1000} required={reason.required} />}
        </Field>
      )}
      <SubmitButton variant={variant} size="sm">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}

/** Button opening a dialog with a reason-required action form. */
export function ReasonDialogButton({
  action,
  hidden,
  label,
  title,
  variant = "outline",
  reasonLabel,
  reasonName = "reason",
  danger,
}: {
  action: FormAction;
  hidden: Record<string, string>;
  label: string;
  title?: string;
  variant?: ButtonProps["variant"];
  reasonLabel?: string;
  reasonName?: string;
  danger?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen} title={title ?? label} trigger={<Button variant={variant} size="sm">{label}</Button>}>
      <ActionForm action={action} onSuccess={() => setOpen(false)} className="space-y-4">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Field name={reasonName} label={reasonLabel ?? t("common.reason")}>
          {(p) => <Textarea {...p} rows={3} required maxLength={1000} placeholder={t("common.reasonPlaceholder")} />}
        </Field>
        <SubmitButton variant={danger ? "danger" : "primary"} className="w-full">{label}</SubmitButton>
      </ActionForm>
    </Dialog>
  );
}
