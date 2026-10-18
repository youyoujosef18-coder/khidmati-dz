"use client";

import { Wrench } from "lucide-react";
import { ActionButton } from "@/components/forms/simple-action-button";
import { startTechnicianAction } from "@/app/actions/tech";
import { useI18n } from "@/lib/i18n/client";

export function StartOnboarding() {
  const { t } = useI18n();
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary-50 text-primary">
        <Wrench className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold text-ink">{t("tech.becomeTitle")}</h1>
      <p className="mt-2 text-muted">{t("pages.becomeLead")}</p>
      <ActionButton size="lg" className="mt-6" run={startTechnicianAction} successMessage={false}>
        {t("tech.startOnboarding")}
      </ActionButton>
    </div>
  );
}
