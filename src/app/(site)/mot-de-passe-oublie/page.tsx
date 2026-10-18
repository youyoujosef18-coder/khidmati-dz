import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotForm, ResetForm } from "@/components/forms/auth-forms";
import { Notice } from "@/components/ui/states";
import { emailFlowsAvailable } from "@/lib/services/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.forgotTitle") };
}

export default async function ForgotPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { t } = await getI18n();
  if (sp.token) {
    return (
      <AuthShell title={t("auth.resetTitle")}>
        <ResetForm token={sp.token} />
      </AuthShell>
    );
  }
  const available = emailFlowsAvailable();
  return (
    <AuthShell title={t("auth.forgotTitle")} subtitle={available ? t("auth.forgotSubtitle") : undefined}>
      {available ? <ForgotForm /> : <Notice tone="warning">{t("auth.forgotUnavailable")}</Notice>}
    </AuthShell>
  );
}
