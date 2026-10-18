import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";

export async function LegalPage({ ns, titleKey, sections }: { ns: "privacy" | "terms"; titleKey: string; sections: number }) {
  const { t, date } = await getI18n();
  const hours = (await getSettings()).cancellation_policy.clientFreeCancellationHours;
  return (
    <div className="container-page max-w-3xl py-8 md:py-12">
      <PageHeader title={t(titleKey)} description={t("pages.lastUpdated", { date: date(new Date("2026-10-14T00:00:00Z")) })} />
      <Notice tone="warning">{t("pages.legalDraftNotice")}</Notice>
      <article className="prose-legal card mt-6 p-6">
        {Array.from({ length: sections }, (_, i) => i + 1).map((i) => (
          <section key={i}>
            <h2>{t(`${ns}.s${i}t`)}</h2>
            <p>{t(`${ns}.s${i}`, { hours })}</p>
          </section>
        ))}
      </article>
    </div>
  );
}
