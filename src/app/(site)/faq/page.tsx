import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("faq.title") };
}

export default async function FaqPage() {
  const { t } = await getI18n();
  const hours = (await getSettings()).cancellation_policy.clientFreeCancellationHours;
  return (
    <div className="container-page max-w-3xl py-8 md:py-12">
      <PageHeader title={t("faq.title")} description={t("faq.subtitle")} />
      <div className="divide-y divide-border rounded-lg border border-border bg-surface">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <details key={i} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden" open={i === 1}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
              {t(`faq.q${i}`)}
              <span className="text-xl text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(`faq.a${i}`, { hours })}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
