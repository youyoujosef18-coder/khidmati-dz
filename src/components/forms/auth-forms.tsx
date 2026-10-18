"use client";

import Link from "next/link";
import { ActionForm, Field, SubmitButton, useFormCtx, type FormAction } from "./action-form";
import { Notice } from "@/components/ui/states";
import { PasswordInput } from "./password-input";
import { Input, Select, Checkbox } from "@/components/ui/inputs";
import { useI18n } from "@/lib/i18n/client";
import { loginAction, registerAction, forgotPasswordAction, resetPasswordAction } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={loginAction as FormAction} successToast={false} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="identifier" label={t("auth.identifier")}>
        {(p) => <Input {...p} autoComplete="username" inputMode="email" placeholder={t("auth.identifierPlaceholder")} required />}
      </Field>
      <Field name="password" label={t("auth.password")}>
        {(p) => <PasswordInput {...p} autoComplete="current-password" required />}
      </Field>
      <div className="flex justify-end">
        <Link href="/mot-de-passe-oublie" className="text-sm font-medium text-primary hover:underline">
          {t("auth.forgot")}
        </Link>
      </div>
      <SubmitButton className="w-full" size="lg">
        {t("auth.loginCta")}
      </SubmitButton>
    </ActionForm>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { t, locale } = useI18n();
  return (
    <ActionForm action={registerAction as FormAction} successToast={false} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field name="fullName" label={t("auth.fullName")}>
        {(p) => <Input {...p} autoComplete="name" required maxLength={80} />}
      </Field>
      <Field name="phone" label={t("auth.phone")} hint={t("auth.phoneHint")}>
        {(p) => <Input {...p} type="tel" autoComplete="tel" inputMode="tel" placeholder="0555 12 34 56" className="ltr-nums" dir="ltr" />}
      </Field>
      <Field name="email" label={t("auth.email")} hint={t("auth.emailHint")}>
        {(p) => <Input {...p} type="email" autoComplete="email" inputMode="email" dir="ltr" />}
      </Field>
      <Field name="password" label={t("auth.password")} hint={t("auth.passwordHint")}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field name="preferredLocale" label={t("auth.preferredLanguage")}>
        {(p) => (
          <Select {...p} defaultValue={locale}>
            <option value="fr-DZ">Français</option>
            <option value="ar-DZ">العربية</option>
          </Select>
        )}
      </Field>
      <Field name="acceptTerms">
        {(p) => (
          <label className="flex items-start gap-3 text-sm text-text">
            <Checkbox {...p} id={p.id} value="on" required />
            <span>
              {t("auth.acceptTerms", { terms: "§T", privacy: "§P" })
                .split(/(§T|§P)/)
                .map((part, i) =>
                  part === "§T" ? (
                    <Link key={i} href="/conditions" target="_blank" className="font-medium text-primary underline">
                      {t("auth.termsLink")}
                    </Link>
                  ) : part === "§P" ? (
                    <Link key={i} href="/confidentialite" target="_blank" className="font-medium text-primary underline">
                      {t("auth.privacyLink")}
                    </Link>
                  ) : (
                    <span key={i}>{part}</span>
                  ),
                )}
            </span>
          </label>
        )}
      </Field>
      <SubmitButton className="w-full" size="lg">
        {t("auth.registerCta")}
      </SubmitButton>
    </ActionForm>
  );
}

export function ForgotForm() {
  const { t } = useI18n();
  return (
    <ActionForm action={forgotPasswordAction as FormAction} className="space-y-4" successToast={false}>
      <Field name="email" label={t("auth.email")}>
        {(p) => <Input {...p} type="email" autoComplete="email" dir="ltr" required />}
      </Field>
      <ForgotResult />
      <SubmitButton className="w-full" size="lg">
        {t("auth.forgotCta")}
      </SubmitButton>
    </ActionForm>
  );
}

function ForgotResult() {
  const { state } = useFormCtx();
  const { t } = useI18n();
  if (!state?.ok) return null;
  return <Notice tone="success">{t("auth.forgotSent")}</Notice>;
}

export function ResetForm({ token }: { token: string }) {
  const { t } = useI18n();
  return (
    <ActionForm action={resetPasswordAction as FormAction} className="space-y-4" redirectTo="/connexion?reinitialise=1">
      <input type="hidden" name="token" value={token} />
      <Field name="password" label={t("account.newPassword")} hint={t("auth.passwordHint")}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
      </Field>
      <Field name="confirm" label={t("auth.confirmPassword")}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
      </Field>
      <SubmitButton className="w-full" size="lg">
        {t("auth.resetCta")}
      </SubmitButton>
    </ActionForm>
  );
}
