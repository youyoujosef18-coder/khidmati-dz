"use client";

import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { claimFirstAdminAction } from "@/app/actions/setup";
import { useI18n } from "@/lib/i18n/client";

export function SetupForm() {
  const { t } = useI18n();
  return (
    <ActionForm action={claimFirstAdminAction as FormAction} successToast={false} className="mt-6 space-y-4">
      <Field name="token" label={t("setup.tokenLabel")} hint={t("setup.tokenHint")} required>
        {(p) => <Input {...p} type="password" autoComplete="off" spellCheck={false} />}
      </Field>
      <SubmitButton className="w-full">{t("setup.submit")}</SubmitButton>
    </ActionForm>
  );
}
