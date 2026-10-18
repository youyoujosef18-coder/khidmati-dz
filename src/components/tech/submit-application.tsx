"use client";

import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/inputs";
import { Notice } from "@/components/ui/states";
import { submitApplicationAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

export function SubmitApplication({ missing, canSubmit, resubmit, slug }: { missing: string[]; canSubmit: boolean; resubmit: boolean; slug: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <p className="text-text">{t("tech.submitBody")}</p>
      <p className="text-sm text-muted">{t("tech.verificationExplain")}</p>
      {missing.length > 0 && (
        <Notice tone="warning" title={t("tech.checklist")}>
          <ul className="list-inside list-disc">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Notice>
      )}
      <p className="text-xs text-muted">{t("tech.publicProfileHidden")} ({`/techniciens/${slug}`})</p>
      <ActionForm action={submitApplicationAction as FormAction} successToast={false} className="space-y-4">
        <Field name="confirm">
          {(p) => (
            <label className="flex items-start gap-3 text-sm">
              <Checkbox {...p} id={p.id} value="on" required />
              <span>{t("tech.submitConfirm")}</span>
            </label>
          )}
        </Field>
        <SubmitButton size="lg" disabled={!canSubmit}>
          {resubmit ? t("tech.resubmit") : t("tech.submit")}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
