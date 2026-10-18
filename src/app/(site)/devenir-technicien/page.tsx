import type { Metadata } from "next";
import { CheckCircle2, FileCheck2, MapPinned, UserRound, UserPlus, BadgeCheck } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.becomeTitle"), description: t("pages.becomeLead") };
}

export default async function BecomeTechPage() {
  const { t } = await getI18n();
  const user = await getCurrentUser();
  const cta = user ? "/technicien/inscription" : "/inscription?next=/technicien/inscription";
  const steps = [
    { icon: UserPlus, title: t("pages.becomeS1"), body: t("pages.becomeS1Body") },
    { icon: UserRound, title: t("pages.becomeS2"), body: t("pages.becomeS2Body") },
    { icon: MapPinned, title: t("pages.becomeS3"), body: t("pages.becomeS3Body") },
    { icon: FileCheck2, title: t("pages.becomeS4"), body: t("pages.becomeS4Body") },
    { icon: BadgeCheck, title: t("pages.becomeS5"), body: t("pages.becomeS5Body") },
  ];
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-primary-50/70 to-bg">
        <div className="container-page py-12 md:py-20">
          <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-ink md:text-5xl rtl:leading-[1.35]">{t("pages.becomeTitle")}</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">{t("pages.becomeLead")}</p>
          <ButtonLink href={cta} size="lg" className="mt-8">
            {user ? t("pages.becomeCtaLogged") : t("pages.becomeCta")}
          </ButtonLink>
        </div>
      </section>
      <div className="container-page py-12 md:py-16">
        <h2 className="text-2xl font-semibold text-ink">{t("pages.becomeStepsTitle")}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <li key={i} className="card p-5">
              <s.icon className="h-6 w-6 text-primary" aria-hidden />
              <p className="mt-3 font-semibold text-ink">
                <span className="text-muted ltr-nums">{i + 1}. </span>
                {s.title}
              </p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-ink">{t("pages.becomeBenefits")}</h2>
            <ul className="mt-4 space-y-3">
              {[t("pages.becomeB1"), t("pages.becomeB2"), t("pages.becomeB3"), t("pages.becomeB4")].map((x) => (
                <li key={x} className="flex gap-3 text-text">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden /> {x}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-ink">{t("pages.becomeRequirements")}</h2>
            <ul className="mt-4 space-y-3">
              {[t("pages.becomeReq1"), t("pages.becomeReq2"), t("pages.becomeReq3")].map((x) => (
                <li key={x} className="flex gap-3 text-text">
                  <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-700" aria-hidden /> {x}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs text-muted">{t("faq.a3")}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
