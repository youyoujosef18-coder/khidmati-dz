"use client";

import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Input, Checkbox } from "@/components/ui/inputs";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { saveSettingsAction } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import type { PlatformSettings } from "@/lib/settings-defaults";

export function SettingsForms({ settings: s, sensitive }: { settings: PlatformSettings; sensitive: boolean }) {
  const { t } = useI18n();
  const num = (name: string, label: string, v: number, min: number, max: number) => (
    <Field name={name} label={label}>{(p) => <Input {...p} type="number" min={min} max={max} defaultValue={v} className="ltr-nums" />}</Field>
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t("admin.nav.bookings")} />
        <CardBody>
          <ActionForm action={saveSettingsAction as FormAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="section" value="operations" />
            {num("cancellationHours", t("admin.cancellationHours"), s.cancellation_policy.clientFreeCancellationHours, 0, 168)}
            {num("completionHours", t("admin.completionHours"), s.completion_review_hours, 1, 720)}
            {num("requestExpiryDays", t("admin.requestExpiryDays"), s.request_expiry_days, 1, 60)}
            {num("quoteValidityHours", t("admin.quoteValidityHours"), s.quote_default_validity_hours, 2, 336)}
            {num("holdHours", t("admin.holdHours"), s.fixed_price_hold_hours, 1, 72)}
            {num("disputeWindowDays", t("admin.disputeWindowDays"), s.dispute_window_days, 1, 60)}
            <div className="sm:col-span-2 lg:col-span-3"><SubmitButton>{t("common.save")}</SubmitButton></div>
          </ActionForm>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={`${t("footer.support")} · ${t("admin.social")}`} />
        <CardBody>
          <ActionForm action={saveSettingsAction as FormAction} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="section" value="contacts" />
            <Field name="supportEmail" label={t("admin.supportEmail")}>{(p) => <Input {...p} type="email" defaultValue={s.support_contacts.email} dir="ltr" />}</Field>
            <Field name="supportPhone" label={t("admin.supportPhone")}>{(p) => <Input {...p} defaultValue={s.support_contacts.phone} dir="ltr" />}</Field>
            <Field name="supportWhatsapp" label={t("admin.supportWhatsapp")}>{(p) => <Input {...p} defaultValue={s.support_contacts.whatsapp} dir="ltr" />}</Field>
            <Field name="supportAddress" label={t("admin.supportAddress")}>{(p) => <Input {...p} defaultValue={s.support_contacts.address} />}</Field>
            {(["facebook", "instagram", "tiktok", "linkedin"] as const).map((k) => (
              <Field key={k} name={k} label={k}>{(p) => <Input {...p} type="url" placeholder="https://" defaultValue={s.social_links[k]} dir="ltr" />}</Field>
            ))}
            <div className="sm:col-span-2"><SubmitButton>{t("common.save")}</SubmitButton></div>
          </ActionForm>
        </CardBody>
      </Card>
      {sensitive && (
        <Card>
          <CardHeader title={t("admin.settingsSensitive")} />
          <CardBody>
            <ActionForm action={saveSettingsAction as FormAction} confirmMessage={t("common.areYouSure")} className="space-y-4">
              <input type="hidden" name="section" value="sensitive" />
              <label className="flex items-center gap-2 text-sm font-medium text-error"><Checkbox name="maintenance" defaultChecked={s.maintenance_mode} /> {t("admin.maintenance")}</label>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">{t("admin.featureFlags")}</legend>
                <label className="flex items-center gap-2 text-sm text-muted"><Checkbox disabled checked={false} readOnly /> {t("admin.flagOnlinePayments")}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox name="emergencyRequests" defaultChecked={s.feature_flags.emergencyRequests} /> {t("admin.flagEmergency")}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox name="sponsoredListings" defaultChecked={s.feature_flags.sponsoredListings} /> {t("admin.flagSponsored")}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox name="technicianSubscriptions" defaultChecked={s.feature_flags.technicianSubscriptions} /> {t("admin.flagSubscriptions")}</label>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium">{t("admin.nav.verification")}</legend>
                <label className="flex items-center gap-2 text-sm"><Checkbox name="requireIdentity" defaultChecked={s.verification_requirements.requireIdentityDocument} /> {t("admin.requireIdentity")}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox name="requireQualification" defaultChecked={s.verification_requirements.requireQualificationDocument} /> {t("admin.requireQualification")}</label>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm"><Checkbox name="feeEnabled" defaultChecked={s.platform_fee.enabled} /> {t("admin.platformFeeEnabled")}</label>
                {num("feeBasisPoints", t("admin.platformFee"), s.platform_fee.basisPoints, 0, 3000)}
              </div>
              <SubmitButton variant="danger">{t("common.save")}</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
