"use client";

import { Ban } from "lucide-react";
import { ActionButton } from "@/components/forms/simple-action-button";
import { blockConversationAction } from "@/app/actions/messages";
import { useI18n } from "@/lib/i18n/client";

export function BlockButton({ conversationId }: { conversationId: string }) {
  const { t } = useI18n();
  return (
    <ActionButton variant="ghost" size="sm" className="text-muted" run={() => blockConversationAction(conversationId)} confirm={t("messages.block")}>
      <Ban className="h-4 w-4" aria-hidden /> {t("messages.block")}
    </ActionButton>
  );
}
