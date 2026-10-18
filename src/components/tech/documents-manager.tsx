"use client";

import { useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { ActionButton } from "@/components/forms/simple-action-button";
import { Select, Input } from "@/components/ui/inputs";
import { StatusBadge, DateTime } from "@/components/shared/display";
import { addDocumentAction, removeDocumentAction, addPortfolioAction, removePortfolioAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

const TYPES = ["identity_card", "passport", "driving_license", "artisan_card", "business_registration", "qualification", "insurance", "other"];

export function DocumentsManager({
  documents,
  locked,
}: {
  documents: { id: string; documentType: string; reviewStatus: string; reviewReason: string | null; fileId: string; createdAt: string }[];
  locked: boolean;
}) {
  const { t } = useI18n();
  const [formKey, setFormKey] = useState(0);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">{t("tech.documentsHint")}</p>
      {documents.length ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
              <FileText className="h-4 w-4 text-muted" aria-hidden />
              <a href={`/api/files/${d.fileId}`} target="_blank" rel="noopener" className="font-medium text-ink hover:text-primary">
                {t(`enums.documentType.${d.documentType}`)}
              </a>
              <span className="text-xs text-muted"><DateTime value={d.createdAt} mode="date" /></span>
              <StatusBadge kind="approval" status={d.reviewStatus} />
              {d.reviewReason && <span className="text-xs text-error">{d.reviewReason}</span>}
              {!(locked && d.reviewStatus === "approved") && (
                <ActionButton variant="ghost" size="icon" className="ms-auto" aria-label={t("common.remove")} run={() => removeDocumentAction(d.id)} confirm={t("common.areYouSure")}>
                  <Trash2 className="h-4 w-4 text-error" />
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("tech.documentsEmpty")}</p>
      )}
      <ActionForm key={formKey} action={addDocumentAction as FormAction} onSuccess={() => setFormKey((k) => k + 1)} className="grid gap-4 rounded-lg border border-dashed border-border-strong p-4">
        <Field name="documentType" label={t("tech.documentType")}>
          {(p) => (
            <Select {...p} defaultValue="identity_card">
              {TYPES.map((d) => (
                <option key={d} value={d}>{t(`enums.documentType.${d}`)}</option>
              ))}
            </Select>
          )}
        </Field>
        <FileUploader bucket="technician-verification" name="fileId" single accept="application/pdf,image/jpeg,image/png" />
        <SubmitButton variant="outline" className="justify-self-start">{t("tech.uploadDocument")}</SubmitButton>
      </ActionForm>
    </div>
  );
}

export function PortfolioManager({ items }: { items: { id: string; fileId: string; caption: string | null; moderationStatus: string }[] }) {
  const { t } = useI18n();
  const [formKey, setFormKey] = useState(0);
  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((p) => (
            <li key={p.id} className="relative overflow-hidden rounded-md border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${p.fileId}`} alt={p.caption ?? ""} className="aspect-square w-full object-cover" loading="lazy" />
              <div className="flex items-center justify-between gap-1 p-1.5">
                <span className="truncate text-xs text-muted">{p.caption}</span>
                <ActionButton variant="ghost" size="icon" className="h-8 w-8" aria-label={t("common.remove")} run={() => removePortfolioAction(p.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-error" />
                </ActionButton>
              </div>
              {p.moderationStatus === "hidden" && <span className="absolute start-1 top-1 rounded bg-ink/70 px-1.5 text-[10px] text-white">{t("status.moderation.hidden")}</span>}
            </li>
          ))}
        </ul>
      )}
      <ActionForm key={formKey} action={addPortfolioAction as FormAction} onSuccess={() => setFormKey((k) => k + 1)} className="flex flex-wrap items-end gap-3">
        <FileUploader bucket="portfolio" name="fileId" single />
        <Field name="caption" label={t("tech.caption")} optionalLabel className="min-w-48 flex-1">
          {(p) => <Input {...p} maxLength={140} dir="auto" />}
        </Field>
        <SubmitButton variant="outline">{t("tech.addPortfolio")}</SubmitButton>
      </ActionForm>
    </div>
  );
}
