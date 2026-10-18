"use client";

import { useState } from "react";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Checkbox, Radio, Textarea } from "@/components/ui/inputs";
import { decisionAction } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

const CHECKS = ["identityMatches", "documentValid", "photoReal", "bioAppropriate", "qualificationsReviewed", "areasCoherent"];

export function DecisionForm({
  technicianId,
  allowed,
  categories,
}: {
  technicianId: string;
  allowed: string[];
  categories: { id: string; name: string; status: string; isPrimary: boolean }[];
}) {
  const { t } = useI18n();
  const [decision, setDecision] = useState(allowed[0] ?? "");
  const needsReason = ["rejected", "additional_information_required", "suspended"].includes(decision);
  if (!allowed.length) return null;
  return (
    <ActionForm action={decisionAction as FormAction} className="space-y-5">
      <input type="hidden" name="technicianId" value={technicianId} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("admin.checklist")}</legend>
        <div className="space-y-2">
          {CHECKS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <Checkbox name={`check_${c}`} /> {t(`admin.check.${c}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {categories.length > 0 && decision === "approved" && (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">{t("admin.categoriesToApprove")}</legend>
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm">
              <Checkbox name="approveCategoryIds" value={c.id} defaultChecked={c.isPrimary || c.status === "approved"} disabled={c.isPrimary} />
              {c.name} {c.isPrimary && <span className="text-xs text-muted">({t("tech.primaryCategory")})</span>}
            </label>
          ))}
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">{t("common.actions")}</legend>
        <div className="grid gap-2">
          {allowed.map((d) => (
            <label key={d} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm", decision === d ? "border-primary bg-primary-50" : "border-border")}>
              <Radio name="decision" value={d} checked={decision === d} onChange={() => setDecision(d)} />
              {d === "under_review" ? t("admin.startReview") : d === "approved" ? t("admin.approve") : d === "rejected" ? t("admin.reject") : d === "additional_information_required" ? t("admin.requestInfo") : t("admin.suspendVerification")}
            </label>
          ))}
        </div>
      </fieldset>
      <Field name="reason" label={t("common.reason")} optionalLabel={!needsReason}>
        {(p) => <Textarea {...p} rows={3} required={needsReason} maxLength={1000} placeholder={t("common.reasonPlaceholder")} />}
      </Field>
      <SubmitButton variant={decision === "rejected" || decision === "suspended" ? "danger" : "primary"} className="w-full">
        {t("common.confirm")}
      </SubmitButton>
    </ActionForm>
  );
}
