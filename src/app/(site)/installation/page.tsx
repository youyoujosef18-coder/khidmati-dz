import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/guards";
import { hasSuperAdmin, setupTokenConfigured, MIN_SETUP_TOKEN_LENGTH } from "@/lib/services/bootstrap";
import { Notice } from "@/components/ui/states";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Installation", robots: { index: false, follow: false } };

export default async function InstallationPage() {
  // Permanently unavailable once a super administrator exists.
  if (await hasSuperAdmin()) notFound();
  const user = await requireUser();
  const { t } = await getI18n();
  return (
    <div className="container-page max-w-lg py-12">
      <div className="card p-6 md:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary-50 text-primary">
          <KeyRound className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-ink">{t("setup.title")}</h1>
        <p className="mt-2 text-sm text-muted">{t("setup.intro", { name: user.fullName })}</p>
        {setupTokenConfigured() ? (
          <SetupForm />
        ) : (
          <Notice tone="warning" title={t("setup.disabledTitle")} className="mt-6">
            <p>{t("setup.disabledBody", { min: MIN_SETUP_TOKEN_LENGTH })}</p>
          </Notice>
        )}
      </div>
    </div>
  );
}
