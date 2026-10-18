"use client";

import Link from "next/link";
import { BadgeCheck, Download, Wrench } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { PasswordInput } from "@/components/forms/password-input";
import { Checkbox, Input } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { changePasswordAction, logoutOtherSessionsAction, notificationPrefsAction, requestDeletionAction } from "@/app/actions/account";
import { sendEmailVerificationAction, sendPhoneOtpAction, verifyPhoneOtpAction } from "@/app/actions/auth";
import { useI18n } from "@/lib/i18n/client";

export interface SettingsData {
  email: string | null;
  phone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  prefs: { email: boolean; sms: boolean; push: boolean };
  channels: { email: boolean; sms: boolean; push: boolean };
  termsAcceptedAt: string;
  isTechnician: boolean;
}

export function SettingsPanel({ data }: { data: SettingsData }) {
  const { t, date } = useI18n();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t("account.contact")} />
        <CardBody className="space-y-4 text-sm">
          {data.email && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="ltr-nums">{data.email}</span>
              {data.emailVerified ? (
                <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {t("auth.verifiedBadge")}</Badge>
              ) : data.channels.email ? (
                <ActionButton size="sm" variant="outline" run={sendEmailVerificationAction}>{t("auth.sendVerification")}</ActionButton>
              ) : (
                <Badge tone="neutral">{t("auth.unverifiedEmail")}</Badge>
              )}
            </div>
          )}
          {data.phone && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="ltr-nums">{data.phone}</span>
                {data.phoneVerified ? (
                  <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> {t("auth.verifiedBadge")}</Badge>
                ) : data.channels.sms ? (
                  <ActionButton size="sm" variant="outline" run={sendPhoneOtpAction}>{t("auth.sendCode")}</ActionButton>
                ) : (
                  <Badge tone="neutral">{t("auth.unverifiedPhone")}</Badge>
                )}
              </div>
              {!data.phoneVerified && data.channels.sms && (
                <ActionForm action={verifyPhoneOtpAction as FormAction} className="flex items-end gap-2">
                  <Field name="code" label={t("auth.enterCode")} className="flex-1">
                    {(p) => <Input {...p} inputMode="numeric" maxLength={6} autoComplete="one-time-code" className="ltr-nums" />}
                  </Field>
                  <SubmitButton variant="outline">{t("auth.verifyCode")}</SubmitButton>
                </ActionForm>
              )}
            </div>
          )}
          {!data.channels.email && <p className="text-xs text-muted">{t("auth.emailVerificationUnavailable")}</p>}
          {!data.channels.sms && <p className="text-xs text-muted">{t("auth.phoneVerificationUnavailable")}</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("account.security")} />
        <CardBody>
          <ActionForm action={changePasswordAction as FormAction} resetOnSuccess className="grid gap-4 sm:max-w-md">
            <Field name="currentPassword" label={t("account.currentPassword")}>
              {(p) => <PasswordInput {...p} autoComplete="current-password" required />}
            </Field>
            <Field name="newPassword" label={t("account.newPassword")} hint={t("auth.passwordHint")}>
              {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
            </Field>
            <Field name="confirm" label={t("auth.confirmPassword")}>
              {(p) => <PasswordInput {...p} autoComplete="new-password" required />}
            </Field>
            <SubmitButton className="justify-self-start">{t("account.changePassword")}</SubmitButton>
          </ActionForm>
          <div className="mt-6 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium text-ink">{t("account.sessions")}</p>
            <ActionButton variant="outline" size="sm" run={logoutOtherSessionsAction}>{t("account.logoutOthers")}</ActionButton>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("account.notificationPrefs")} description={t("account.prefInApp")} />
        <CardBody>
          <ActionForm action={notificationPrefsAction as FormAction} className="space-y-3 text-sm">
            {(["email", "sms", "push"] as const).map((ch) => (
              <label key={ch} className="flex items-center gap-3">
                <Checkbox name={ch} defaultChecked={data.prefs[ch]} />
                <span>
                  {t(ch === "email" ? "account.prefEmail" : ch === "sms" ? "account.prefSms" : "account.prefPush")}
                  {!data.channels[ch] && <span className="ms-1 text-xs text-muted">{t("account.channelUnavailable")}</span>}
                </span>
              </label>
            ))}
            <SubmitButton size="sm" variant="outline">{t("common.save")}</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>

      {!data.isTechnician && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-ink">{t("account.becomeTech")}</p>
              <p className="text-sm text-muted">{t("account.becomeTechBody")}</p>
            </div>
            <ButtonLink href="/technicien/inscription" variant="outline">
              <Wrench className="h-4 w-4" aria-hidden /> {t("tech.startOnboarding")}
            </ButtonLink>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title={t("account.privacy")} description={t("account.termsAccepted", { date: date(data.termsAcceptedAt) })} />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap gap-3 text-sm">
            <a href="/api/account/export" className="inline-flex h-10 items-center gap-2 rounded-md border border-border-strong px-3 font-medium hover:bg-bg">
              <Download className="h-4 w-4" aria-hidden /> {t("account.exportData")}
            </a>
            <Link href="/confidentialite" className="inline-flex h-10 items-center text-primary hover:underline">{t("footer.privacy")}</Link>
          </div>
          <div className="rounded-lg border border-error/25 p-4">
            <p className="font-medium text-error">{t("account.deleteAccount")}</p>
            <Notice tone="neutral" className="my-3">{t("account.deleteWarning")}</Notice>
            <ActionForm action={requestDeletionAction as FormAction} successToast={false} className="flex flex-wrap items-end gap-2">
              <Field name="confirmText" label={t("account.deleteConfirmLabel")} className="min-w-52 flex-1">
                {(p) => <Input {...p} autoComplete="off" />}
              </Field>
              <SubmitButton variant="danger">{t("account.deleteAccount")}</SubmitButton>
            </ActionForm>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
