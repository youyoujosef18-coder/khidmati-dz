import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader, Card } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.aboutTitle") };
}

export default async function AboutPage() {
  const { t } = await getI18n();
  return (
    <div className="container-page max-w-4xl py-8 md:py-12">
      <PageHeader title={t("pages.aboutTitle")} description={t("pages.aboutLead")} />
      <Card className="space-y-4 p-6 leading-relaxed text-text">
        <p>{t("pages.aboutP1")}</p>
        <p>{t("pages.aboutP2")}</p>
        <p>{t("pages.aboutP3")}</p>
      </Card>
      <h2 className="mt-10 text-lg font-semibold text-ink">{t("pages.principlesTitle")}</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[t("pages.p1"), t("pages.p2"), t("pages.p3"), t("pages.p4"), t("pages.p5")].map((p) => (
          <li key={p} className="card p-4 font-medium text-ink">{p}</li>
        ))}
      </ul>
    </div>
  );
}
