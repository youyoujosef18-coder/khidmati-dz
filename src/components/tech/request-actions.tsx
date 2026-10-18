"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/inputs";
import { ActionForm, Field, SubmitButton, type FormAction } from "@/components/forms/action-form";
import { ActionButton } from "@/components/forms/simple-action-button";
import { declineRequestAction, techOpenConversationAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

export function RequestTechActions({ requestId }: { requestId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-2">
      <ActionButton variant="outline" run={() => techOpenConversationAction(requestId)} successMessage={false}>
        <MessageSquare className="h-4 w-4" aria-hidden /> {t("request.askQuestion")}
      </ActionButton>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("tech.decline")}
        trigger={<Button variant="ghost" className="text-muted"><X className="h-4 w-4" aria-hidden /> {t("tech.decline")}</Button>}
      >
        <ActionForm action={declineRequestAction as FormAction} successToast={false} className="space-y-4">
          <input type="hidden" name="requestId" value={requestId} />
          <Field name="reason" label={t("tech.declineReason")} optionalLabel>
            {(p) => <Textarea {...p} rows={2} maxLength={300} />}
          </Field>
          <SubmitButton variant="outline" className="w-full">{t("tech.decline")}</SubmitButton>
        </ActionForm>
      </Dialog>
    </div>
  );
}
