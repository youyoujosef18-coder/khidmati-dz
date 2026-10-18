"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { Input, Select } from "@/components/ui/inputs";
import { Avatar } from "@/components/ui/avatar";
import { updateAccountProfileAction } from "@/app/actions/account";
import { useI18n } from "@/lib/i18n/client";

export function ProfileEditor({
  initial,
}: {
  initial: { fullName: string; displayName: string; phone: string; email: string; preferredLocale: string; avatarFileId: string | null };
}) {
  const { t } = useI18n();
  const [avatar, setAvatar] = useState<string | null>(null);
  return (
    <ActionForm action={updateAccountProfileAction as FormAction} className="space-y-5">
      <div className="flex items-center gap-4">
        <Avatar fileId={initial.avatarFileId} name={initial.fullName} size={64} />
        <FileUploader bucket="public-avatars" name="avatarFileId" single label={t("account.changeAvatar")} onUploaded={(f) => setAvatar(f.id)} />
        {avatar && <input type="hidden" name="avatarFileId" value={avatar} />}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="fullName" label={t("account.fullName")}>
          {(p) => <Input {...p} defaultValue={initial.fullName} required autoComplete="name" />}
        </Field>
        <Field name="displayName" label={t("account.displayName")}>
          {(p) => <Input {...p} defaultValue={initial.displayName} required />}
        </Field>
        <Field name="phone" label={t("auth.phone")} hint={t("auth.phoneHint")}>
          {(p) => <Input {...p} type="tel" defaultValue={initial.phone} dir="ltr" autoComplete="tel" />}
        </Field>
        <Field name="email" label={t("auth.email")}>
          {(p) => <Input {...p} type="email" defaultValue={initial.email} dir="ltr" autoComplete="email" />}
        </Field>
        <Field name="preferredLocale" label={t("account.locale")}>
          {(p) => (
            <Select {...p} defaultValue={initial.preferredLocale}>
              <option value="fr-DZ">Français</option>
              <option value="ar-DZ">العربية</option>
            </Select>
          )}
        </Field>
      </div>
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
