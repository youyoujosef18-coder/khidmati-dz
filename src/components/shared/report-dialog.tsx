"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/inputs";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { reportAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";

const REASONS = ["fraud", "fake_profile", "inappropriate", "harassment", "safety", "spam", "other"];

export function ReportDialog({ targetType, targetId, label, loggedIn }: { targetType: string; targetId: string; label: string; loggedIn: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!loggedIn) {
    return (
      <a href="/connexion" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-error">
        <Flag className="h-4 w-4" aria-hidden /> {label}
      </a>
    );
  }
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={label}
      trigger={
        <Button variant="ghost" size="sm" className="text-muted hover:text-error">
          <Flag className="h-4 w-4" aria-hidden /> {label}
        </Button>
      }
    >
      <ActionForm action={reportAction as FormAction} onSuccess={() => setOpen(false)} className="space-y-4">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <Field name="reason" label={t("report.reason")}>
          {(p) => (
            <Select {...p} required defaultValue="">
              <option value="" disabled>
                —
              </option>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`enums.reportReason.${r}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="description" label={t("report.description")} optionalLabel>
          {(p) => <Textarea {...p} maxLength={2000} />}
        </Field>
        <SubmitButton className="w-full">{t("common.submit")}</SubmitButton>
      </ActionForm>
    </Dialog>
  );
}
