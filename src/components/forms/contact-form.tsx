"use client";

import { ActionForm, Field, SubmitButton, type FormAction } from "./action-form";
import { Input, Textarea } from "@/components/ui/inputs";
import { contactAction } from "@/app/actions/support";
import { useI18n } from "@/lib/i18n/client";

export function ContactForm() {
  const { t } = useI18n();
  return (
    <ActionForm action={contactAction as FormAction} resetOnSuccess className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label={t("pages.contactName")}>
          {(p) => <Input {...p} autoComplete="name" required />}
        </Field>
        <Field name="email" label={t("pages.contactEmail")}>
          {(p) => <Input {...p} type="email" autoComplete="email" dir="ltr" />}
        </Field>
      </div>
      <Field name="phone" label={t("pages.contactPhone")} optionalLabel>
        {(p) => <Input {...p} type="tel" autoComplete="tel" dir="ltr" />}
      </Field>
      <Field name="subject" label={t("pages.contactSubject")}>
        {(p) => <Input {...p} required maxLength={140} />}
      </Field>
      <Field name="message" label={t("pages.contactMessage")}>
        {(p) => <Textarea {...p} rows={6} required maxLength={4000} />}
      </Field>
      {/* honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <SubmitButton>{t("common.submit")}</SubmitButton>
    </ActionForm>
  );
}
