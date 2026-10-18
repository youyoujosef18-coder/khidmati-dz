"use client";

import { ActionForm, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { Input } from "@/components/ui/inputs";
import { saveSettingsAction } from "@/app/actions/admin";
import { useI18n } from "@/lib/i18n/client";

export function TemplatesForm({ types, overrides }: { types: string[]; overrides: Record<string, { titleFr?: string; bodyFr?: string; titleAr?: string; bodyAr?: string }> }) {
  const { t } = useI18n();
  return (
    <ActionForm action={saveSettingsAction as FormAction} className="space-y-4">
      <input type="hidden" name="section" value="templates" />
      {types.map((type) => (
        <details key={type} className="rounded-md border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">{t(`notifications.types.${type}.title`)} <code className="text-xs text-muted">{type}</code></summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(["titleFr", "bodyFr", "titleAr", "bodyAr"] as const).map((f) => (
              <label key={f} className="grid gap-1 text-xs font-medium text-muted">
                {f}
                <Input name={`tpl.${type}.${f}`} defaultValue={overrides[type]?.[f] ?? ""} dir={f.endsWith("Ar") ? "rtl" : "ltr"} className="h-9" />
              </label>
            ))}
          </div>
        </details>
      ))}
      <SubmitButton>{t("common.save")}</SubmitButton>
    </ActionForm>
  );
}
