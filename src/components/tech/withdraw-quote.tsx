"use client";

import { ActionButton } from "@/components/forms/simple-action-button";
import { withdrawQuoteAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

export function WithdrawQuoteButton({ quoteId }: { quoteId: string }) {
  const { t } = useI18n();
  return (
    <ActionButton variant="ghost" size="sm" className="text-error" run={() => withdrawQuoteAction(quoteId)} confirm={t("common.areYouSure")}>
      {t("quote.withdraw")}
    </ActionButton>
  );
}
