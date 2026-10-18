"use client";

import { useEffect, useState } from "react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { Input } from "@/components/ui/inputs";
import { resendEmailCodeAction, verifyEmailCodeAction } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export function EmailCodeForm({ resendAt, canResend }: { resendAt: string; canResend: boolean }) {
  const { t } = useI18n();
  const [availableAt, setAvailableAt] = useState(() => new Date(resendAt).getTime());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const wait = Math.max(0, Math.ceil((availableAt - now) / 1000));

  return (
    <div className="space-y-5">
      <ActionForm action={verifyEmailCodeAction as FormAction} successToast={false} className="space-y-4">
        <Field name="code" label={t("emailCode.label")}>
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              placeholder="123456"
              className="text-center text-lg tracking-[0.4em] ltr-nums"
              dir="ltr"
              autoFocus
              required
            />
          )}
        </Field>
        <SubmitButton className="w-full">{t("emailCode.submit")}</SubmitButton>
      </ActionForm>
      {canResend && (
        <div className="text-center">
          <ActionButton
            variant="ghost"
            size="sm"
            disabled={wait > 0}
            run={async () => {
              const res = await resendEmailCodeAction();
              if (res.ok) setAvailableAt(Date.now() + 60_000);
              return res;
            }}
          >
            {wait > 0 ? t("emailCode.resendIn", { seconds: wait }) : t("emailCode.resend")}
          </ActionButton>
        </div>
      )}
    </div>
  );
}
