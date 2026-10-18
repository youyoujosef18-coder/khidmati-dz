"use client";

import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Radio, Textarea } from "@/components/ui/inputs";
import { resolveDisputeAction } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";

export function ResolveDisputeForm({ disputeId }: { disputeId: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={resolveDisputeAction as FormAction} confirmMessage={t("common.irreversible")} className="space-y-4">
      <input type="hidden" name="disputeId" value={disputeId} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">{t("dispute.outcome")}</legend>
        <label className="flex items-center gap-2 text-sm"><Radio name="outcome" value="completed" defaultChecked /> {t("dispute.outcomeCompleted")}</label>
        <label className="flex items-center gap-2 text-sm"><Radio name="outcome" value="cancelled" /> {t("dispute.outcomeCancelled")}</label>
      </fieldset>
      <Field name="resolution" label={t("dispute.resolution")}>
        {(p) => <Textarea {...p} rows={4} required minLength={10} maxLength={3000} />}
      </Field>
      <SubmitButton className="w-full">{t("dispute.resolve")}</SubmitButton>
    </ActionForm>
  );
}
