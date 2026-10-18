import { Wrench } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { LogoMark } from "./logo";

export async function MaintenanceScreen() {
  const { t } = await getI18n();
  return (
    <main className="grid flex-1 place-items-center px-6 py-24 text-center">
      <div className="max-w-md">
        <LogoMark size={48} className="mx-auto" />
        <Wrench className="mx-auto mt-6 h-8 w-8 text-primary" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold text-ink">{t("states.maintenanceTitle")}</h1>
        <p className="mt-2 text-muted">{t("states.maintenanceBody")}</p>
      </div>
    </main>
  );
}
