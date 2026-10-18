"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/** Inside the Khidmati Android app, printing goes through the Android print service (native handler). */
function isAndroidApp() {
  return typeof navigator !== "undefined" && /\bKhidmatiAndroid\//.test(navigator.userAgent);
}

export function PrintButton() {
  const { t } = useI18n();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (isAndroidApp()) window.location.href = "khidmati://print";
        else window.print();
      }}
    >
      <Printer className="h-4 w-4" aria-hidden /> {t("common.print")}
    </Button>
  );
}
