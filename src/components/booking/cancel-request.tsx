"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/inputs";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { cancelRequestAction } from "@/app/actions/client";
import { useI18n } from "@/lib/i18n/client";

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={t("request.cancel")}
      description={t("common.irreversible")}
      trigger={<Button variant="outline" className="text-error">{t("request.cancel")}</Button>}
    >
      <ActionForm action={cancelRequestAction as FormAction} onSuccess={() => setOpen(false)} className="space-y-4">
        <input type="hidden" name="requestId" value={requestId} />
        <Field name="reason" label={t("common.reason")} optionalLabel>
          {(p) => <Textarea {...p} rows={3} maxLength={500} placeholder={t("common.reasonPlaceholder")} />}
        </Field>
        <SubmitButton variant="danger" className="w-full">{t("request.cancel")}</SubmitButton>
      </ActionForm>
    </Dialog>
  );
}
