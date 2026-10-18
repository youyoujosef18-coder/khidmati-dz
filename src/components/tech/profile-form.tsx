"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { Input, Textarea, Checkbox } from "@/components/ui/inputs";
import { Avatar } from "@/components/ui/avatar";
import { Notice } from "@/components/ui/states";
import { saveProfileAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

export interface TechProfileValue {
  legalName: string;
  publicName: string;
  bio: string;
  experienceYears: number;
  workingLanguages: string[];
  serviceTerms: string;
  avatarFileId: string | null;
  approved: boolean;
}

export function TechProfileForm({ initial, onSaved }: { initial: TechProfileValue; onSaved?: () => void }) {
  const { t } = useI18n();
  const [avatar, setAvatar] = useState<string | null>(null);
  return (
    <ActionForm action={saveProfileAction as FormAction} onSuccess={onSaved} className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar fileId={initial.avatarFileId} name={initial.publicName} size={72} />
        <FileUploader bucket="public-avatars" name="_avatar" single label={t("tech.photo")} hint={t("tech.photoHint")} onUploaded={(f) => setAvatar(f.id)} />
        <input type="hidden" name="avatarFileId" value={avatar ?? ""} />
      </div>
      {initial.approved && <Notice tone="warning">{t("tech.sensitiveChange")}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="legalName" label={t("tech.legalName")} hint={t("tech.legalNameHint")}>
          {(p) => <Input {...p} defaultValue={initial.legalName} required maxLength={100} />}
        </Field>
        <Field name="publicName" label={t("tech.publicName")} hint={t("tech.publicNameHint")}>
          {(p) => <Input {...p} defaultValue={initial.publicName} required maxLength={60} dir="auto" />}
        </Field>
      </div>
      <Field name="bio" label={t("tech.bio")} hint={t("tech.bioHint")}>
        {(p) => <Textarea {...p} rows={6} defaultValue={initial.bio} required minLength={30} maxLength={2000} dir="auto" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="experienceYears" label={t("tech.experienceYears")}>
          {(p) => <Input {...p} type="number" min={0} max={70} defaultValue={initial.experienceYears} required className="ltr-nums" />}
        </Field>
        <Field name="workingLanguages" label={t("tech.workingLanguages")}>
          {() => (
            <div className="flex flex-wrap gap-3 pt-2">
              {["ar", "fr", "kab", "en"].map((l) => (
                <label key={l} className="flex items-center gap-2 text-sm">
                  <Checkbox name="workingLanguages[]" value={l} defaultChecked={initial.workingLanguages.includes(l)} /> {t(`enums.language.${l}`)}
                </label>
              ))}
            </div>
          )}
        </Field>
      </div>
      <Field name="serviceTerms" label={t("tech.serviceTerms")} hint={t("tech.serviceTermsHint")} optionalLabel>
        {(p) => <Textarea {...p} rows={3} defaultValue={initial.serviceTerms} maxLength={1500} dir="auto" />}
      </Field>
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
