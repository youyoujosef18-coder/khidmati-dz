"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error("[ui] segment error", error.digest ?? error.message);
  }, [error]);
  return (
    <div className="py-16">
      <ErrorState
        title={t("states.errorTitle")}
        description={t("states.errorBody")}
        action={<Button onClick={reset}>{t("common.retry")}</Button>}
      />
    </div>
  );
}
