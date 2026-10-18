"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export function OfflineBanner() {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-[70] flex items-center justify-center gap-2 bg-ink px-4 py-2 text-center text-sm text-white">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong>{t("states.offlineTitle")}.</strong> {t("states.offlineBody")}
      </span>
    </div>
  );
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
