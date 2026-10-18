import type { Metadata } from "next";
import { ClipboardList, Search, FileText, CalendarCheck2, ShieldCheck, Wrench } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader, Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.howTitle") };
}

export default async function HowPage() {
  const { t } = await getI18n();
  const clientSteps = [
    { icon: ClipboardList, title: t("home.step1"), body: t("home.step1Body") },
    { icon: Search, title: t("home.step2"), body: t("home.step2Body") },
    { icon: FileText, title: t("home.step3"), body: t("home.step3Body") },
    { icon: CalendarCheck2, title: t("home.step4"), body: t("home.step4Body") },
  ];
  const techSteps = [t("pages.howT1"), t("pages.howT2"), t("pages.howT3"), t("pages.howT4"), t("pages.howT5")];
  return (
    <div className="container-page py-8 md:py-12">
      <PageHeader title={t("pages.howTitle")} description={t("home.howSubtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink">{t("pages.howClients")}</h2>
          <ol className="mt-5 space-y-5">
            {clientSteps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-white">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-medium text-ink">{s.title}</p>
                  <p className="text-sm text-muted">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ButtonLink href="/techniciens" className="mt-6">{t("home.ctaFind")}</ButtonLink>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-ink">{t("pages.howTechs")}</h2>
          <ol className="mt-5 space-y-4">
            {techSteps.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-50 text-sm font-semibold text-accent-700 ltr-nums">{i + 1}</span>
                <p className="pt-1 text-text">{s}</p>
              </li>
            ))}
          </ol>
          <ButtonLink href="/devenir-technicien" variant="outline" className="mt-6">
            <Wrench className="h-4 w-4" aria-hidden /> {t("nav.becomeTech")}
          </ButtonLink>
        </Card>
      </div>
      <Card className="mt-6 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden /> {t("pages.howSafety")}
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {[t("pages.howSafety1"), t("pages.howSafety2"), t("pages.howSafety3")].map((x) => (
            <li key={x} className="rounded-md bg-bg p-4 text-sm text-text">{x}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
