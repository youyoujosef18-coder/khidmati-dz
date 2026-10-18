import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRoles } from "@/lib/auth/permissions";
import { safeReturnUrl } from "@/lib/utils";
import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/components/forms/auth-forms";
import { Notice } from "@/components/ui/states";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.loginTitle") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await getI18n();
  const next = safeReturnUrl(sp.next, "");
  const user = await getCurrentUser();
  if (user) redirect(next || homeForRoles(user.roles));
  return (
    <AuthShell
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link href={`/inscription${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-primary hover:underline">
            {t("auth.createAccount")}
          </Link>
        </>
      }
    >
      {sp.deconnecte && <Notice tone="success" className="mb-4">{t("auth.logoutDone")}</Notice>}
      {sp.reinitialise && <Notice tone="success" className="mb-4">{t("auth.resetDone")}</Notice>}
      <LoginForm next={next} />
    </AuthShell>
  );
}
