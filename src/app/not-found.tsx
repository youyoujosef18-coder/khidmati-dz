import { Compass } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { ButtonLink } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page grid flex-1 place-items-center py-24 text-center">
        <div>
          <Compass className="mx-auto h-10 w-10 text-primary" aria-hidden />
          <p className="mt-4 text-sm font-semibold text-primary ltr-nums">404</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{t("states.notFoundTitle")}</h1>
          <p className="mt-2 max-w-md text-muted">{t("states.notFoundBody")}</p>
          <ButtonLink href="/" className="mt-6">{t("states.goHome")}</ButtonLink>
        </div>
      </main>
    </>
  );
}
