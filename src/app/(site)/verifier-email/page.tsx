import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { Notice } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { verifyEmailToken } from "@/lib/services/auth";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await getI18n();
  const ok = sp.token && /^[A-Za-z0-9_-]{20,200}$/.test(sp.token) ? await verifyEmailToken(sp.token) : false;
  return (
    <AuthShell title={t("auth.email")}>
      <Notice tone={ok ? "success" : "error"}>{ok ? t("auth.verifyEmailDone") : t("auth.verifyEmailInvalid")}</Notice>
      <ButtonLink href="/" variant="outline" className="mt-5 w-full">
        {t("states.goHome")}
      </ButtonLink>
    </AuthShell>
  );
}
