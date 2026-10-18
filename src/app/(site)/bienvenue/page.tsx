import { LayoutDashboard, Wrench } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/guards";
import { safeReturnUrl } from "@/lib/utils";
import { AuthShell } from "@/components/layout/auth-shell";
import { ButtonLink } from "@/components/ui/button";
import { WelcomeLocation } from "@/components/marketplace/welcome-location";
import { getActiveWilayas } from "@/lib/services/discovery";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const { t } = await getI18n();
  const next = safeReturnUrl(sp.next, "");
  const wilayas = await getActiveWilayas();
  return (
    <AuthShell title={t("auth.welcomeTitle", { name: user.firstName })} subtitle={t("auth.welcomeBody")}>
      {next ? (
        <ButtonLink href={next} size="lg" className="w-full">
          {t("common.next")}
        </ButtonLink>
      ) : (
        <div className="space-y-5">
          <WelcomeLocation wilayas={wilayas} />
          <div className="grid gap-2">
            <ButtonLink href="/client" variant="outline" className="justify-start">
              <LayoutDashboard className="h-4 w-4" aria-hidden /> {t("auth.welcomeDashboard")}
            </ButtonLink>
            <ButtonLink href="/technicien/inscription" variant="ghost" className="justify-start">
              <Wrench className="h-4 w-4" aria-hidden /> {t("auth.welcomeBecomeTech")}
            </ButtonLink>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
