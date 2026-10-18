import { WifiOff } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";

export default async function OfflinePage() {
  const { t } = await getI18n();
  return (
    <div className="container-page grid place-items-center py-24 text-center">
      <WifiOff className="h-10 w-10 text-muted" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold text-ink">{t("states.offlineTitle")}</h1>
      <p className="mt-2 max-w-md text-muted">{t("states.offlineBody")}</p>
    </div>
  );
}
