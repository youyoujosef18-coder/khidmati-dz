import { ShieldAlert } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { ButtonLink } from "@/components/ui/button";

export default async function UnauthorizedPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page grid place-items-center py-24 text-center">
      <ShieldAlert className="h-10 w-10 text-warning" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold text-ink">{t("states.unauthorizedTitle")}</h1>
      <p className="mt-2 max-w-md text-muted">{t("states.unauthorizedBody")}</p>
      <ButtonLink href="/" className="mt-6">{t("states.goHome")}</ButtonLink>
    </div>
  );
}
