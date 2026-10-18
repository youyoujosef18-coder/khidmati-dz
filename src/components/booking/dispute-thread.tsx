"use client";

import { FileText, Lock } from "lucide-react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { FileUploader } from "@/components/forms/file-uploader";
import { Textarea, Checkbox } from "@/components/ui/inputs";
import { DateTime } from "@/components/shared/display";
import { disputeMessageAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface DisputeMessageView {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: Date | string;
  authorName: string;
  mine: boolean;
}

export function DisputeThread({
  disputeId,
  messages,
  evidence,
  isStaff,
  closed,
}: {
  disputeId: string;
  messages: DisputeMessageView[];
  evidence: string[];
  isStaff: boolean;
  closed: boolean;
}) {
  const { t } = useI18n();
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink">{t("dispute.messages")}</h3>
      {evidence.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-2">
          {evidence.map((id) => (
            <li key={id}>
              <a href={`/api/files/${id}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-bg">
                <FileText className="h-3.5 w-3.5" aria-hidden /> {t("dispute.evidence")}
              </a>
            </li>
          ))}
        </ul>
      )}
      <ul className="space-y-3">
        {messages.map((m) => (
          <li
            key={m.id}
            className={cn(
              "rounded-lg border px-3.5 py-2.5 text-sm",
              m.isInternal ? "border-warning/30 bg-warning-50" : m.mine ? "border-primary/20 bg-primary-50" : "border-border bg-bg",
            )}
          >
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-semibold text-ink">{m.mine ? t("messages.you") : m.authorName}</span>
              <DateTime value={m.createdAt} />
              {m.isInternal && (
                <span className="inline-flex items-center gap-1 font-medium text-warning">
                  <Lock className="h-3 w-3" aria-hidden /> {t("dispute.internalNote")}
                </span>
              )}
            </p>
            <p className="mt-1 whitespace-pre-line text-text" dir="auto">{m.body}</p>
          </li>
        ))}
      </ul>
      {(!closed || isStaff) && (
        <ActionForm action={disputeMessageAction as FormAction} resetOnSuccess className="mt-4 space-y-3">
          <input type="hidden" name="disputeId" value={disputeId} />
          <Field name="body" label={t("dispute.addMessage")}>
            {(p) => <Textarea {...p} rows={3} maxLength={3000} dir="auto" />}
          </Field>
          {!isStaff && <FileUploader bucket="dispute-evidence" name="evidenceIds" max={5} accept="image/jpeg,image/png,image/webp,application/pdf" />}
          {isStaff && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox name="isInternal" /> {t("dispute.internalNote")}
            </label>
          )}
          <SubmitButton size="sm">{t("common.send")}</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
