import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { MailCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { AuthShell } from "@/components/layout/auth-shell";
import { Notice } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { CHALLENGE_COOKIE, CODE_TTL_MINUTES, pendingChallenge } from "@/lib/services/email-code";
import { EmailCodeForm } from "./code-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("emailCode.title"), robots: { index: false, follow: false } };
}

export default async function EmailCodePage() {
  const { t } = await getI18n();
  const challenge = await pendingChallenge((await cookies()).get(CHALLENGE_COOKIE)?.value);

  if (!challenge) {
    return (
      <AuthShell title={t("emailCode.title")}>
        <Notice tone="warning">{t("emailCode.missing")}</Notice>
        <ButtonLink href="/connexion" className="mt-5 w-full">{t("auth.loginTitle")}</ButtonLink>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("emailCode.title")}
      subtitle={challenge.purpose === "signup" ? t("emailCode.signupIntro") : t("emailCode.loginIntro")}
      footer={
        <Link href="/connexion" className="font-semibold text-primary hover:underline">
          {t("emailCode.otherAccount")}
        </Link>
      }
    >
      <p className="mb-5 flex items-start gap-2.5 rounded-md bg-primary-50 px-3.5 py-3 text-sm text-ink">
        <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>{t("emailCode.sentTo", { email: challenge.email, minutes: CODE_TTL_MINUTES })}</span>
      </p>
      {challenge.expired && <Notice tone="warning" className="mb-4">{t("errors.code_expired")}</Notice>}
      <EmailCodeForm resendAt={challenge.resendAt.toISOString()} canResend={challenge.canResend} />
    </AuthShell>
  );
}
