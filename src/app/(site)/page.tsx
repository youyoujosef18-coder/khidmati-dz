import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarCheck2, CheckCircle2, ClipboardList, FileText, MapPin, MessageSquareText, Scale, Search, ShieldCheck, Star } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getActiveCategories, getActiveWilayas, getCoverage, getFeaturedTechnicians } from "@/lib/services/discovery";
import { getSettings } from "@/lib/settings";
import { ServiceSearchBar } from "@/components/marketplace/service-search-bar";
import { ServiceCategoryCard } from "@/components/marketplace/category-card";
import { TechnicianCard } from "@/components/marketplace/technician-card";
import { HeroVisual } from "@/components/marketplace/hero-visual";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";

export default async function HomePage() {
  const { t, pick } = await getI18n();
  const [categories, wilayas, coverage, featured, settings] = await Promise.all([
    getActiveCategories(),
    getActiveWilayas(),
    getCoverage(),
    getFeaturedTechnicians(6),
    getSettings(),
  ]);
  const hours = settings.cancellation_policy.clientFreeCancellationHours;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary-50/70 to-bg">
        <div className="container-page grid items-center gap-12 py-12 md:py-20 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <Badge tone="primary" className="mb-5">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {t("home.heroBadge")}
            </Badge>
            <h1 className="max-w-xl text-[2.1rem] font-bold leading-[1.12] tracking-tight text-ink sm:text-5xl rtl:leading-[1.35]">
              {t("home.heroTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted">{t("home.heroSubtitle")}</p>
            <div className="mt-8">
              <ServiceSearchBar wilayas={wilayas} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/techniciens" size="lg" className="hidden sm:inline-flex">
                <Search className="h-4 w-4" aria-hidden /> {t("home.ctaFind")}
              </ButtonLink>
              <ButtonLink href="/devenir-technicien" variant="outline" size="lg">
                {t("home.ctaBecome")}
              </ButtonLink>
            </div>
          </div>
          <div className="hidden lg:block">
            <HeroVisual t={t} />
          </div>
        </div>
      </section>

      {/* Popular services */}
      <section className="container-page py-14 md:py-20" aria-labelledby="popular">
        <SectionTitle id="popular" title={t("home.popularTitle")} subtitle={t("home.popularSubtitle")} action={<Link href="/services" className="text-sm font-semibold text-primary hover:underline">{t("common.viewAll")}</Link>} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <ServiceCategoryCard
              key={c.id}
              href={`/services/${c.slug}`}
              iconKey={c.iconKey}
              name={pick(c, "name")}
              description={pick(c, "description")}
              countLabel={c.techCount > 0 ? t("pages.techCount", { count: c.techCount }) : t("pages.noTechYet")}
            />
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-surface py-14 md:py-20" aria-labelledby="how">
        <div className="container-page">
          <SectionTitle id="how" title={t("home.howTitle")} subtitle={t("home.howSubtitle")} />
          <ol className="grid gap-6 md:grid-cols-4">
            {[
              { icon: ClipboardList, title: t("home.step1"), body: t("home.step1Body") },
              { icon: Search, title: t("home.step2"), body: t("home.step2Body") },
              { icon: FileText, title: t("home.step3"), body: t("home.step3Body") },
              { icon: CalendarCheck2, title: t("home.step4"), body: t("home.step4Body") },
            ].map((s, i) => (
              <li key={i} className="relative">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-white">
                    <s.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-muted ltr-nums">0{i + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Verified professionals */}
      <section className="container-page py-14 md:py-20" aria-labelledby="verified">
        <SectionTitle
          id="verified"
          title={t("home.verifiedTitle")}
          subtitle={t("home.verifiedSubtitle")}
          action={featured.length > 0 ? <Link href="/techniciens" className="text-sm font-semibold text-primary hover:underline">{t("common.viewAll")}</Link> : undefined}
        />
        {featured.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((tech) => (
              <TechnicianCard key={tech.id} tech={tech} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BadgeCheck className="h-6 w-6" />}
            title={t("home.verifiedTitle")}
            description={t("home.verifiedEmpty")}
            action={<ButtonLink href="/devenir-technicien" variant="outline">{t("home.ctaBecome")}</ButtonLink>}
          />
        )}
      </section>

      {/* Why Khidmati */}
      <section className="bg-ink py-14 text-white md:py-20" aria-labelledby="why">
        <div className="container-page">
          <h2 id="why" className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("home.whyTitle")}
          </h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: t("home.why1"), body: t("home.why1Body") },
              { icon: Scale, title: t("home.why2"), body: t("home.why2Body") },
              { icon: MessageSquareText, title: t("home.why3"), body: t("home.why3Body") },
              { icon: Star, title: t("home.why4"), body: t("home.why4Body") },
            ].map((b, i) => (
              <div key={i}>
                <b.icon className="h-7 w-7 text-accent" aria-hidden />
                <h3 className="mt-4 font-semibold">{b.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage */}
      <section className="container-page py-14 md:py-20" aria-labelledby="coverage">
        <SectionTitle id="coverage" title={t("home.coverageTitle")} subtitle={t("home.coverageSubtitle")} />
        {coverage.length ? (
          <ul className="flex flex-wrap gap-2">
            {coverage.map((c) => (
              <li key={c.code}>
                <Link
                  href={`/techniciens?wilaya=${c.code}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm hover:border-primary/40 hover:text-primary"
                >
                  <MapPin className="h-4 w-4 text-primary" aria-hidden />
                  <span className="font-medium">{pick(c, "name")}</span>
                  <span className="text-muted">· {t("home.coverageCount", { count: c.count })}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<MapPin className="h-6 w-6" />} title={t("home.coverageTitle")} description={t("home.coverageEmpty")} />
        )}
      </section>

      {/* Technician recruitment */}
      <section className="container-page pb-14 md:pb-20" aria-labelledby="recruit">
        <div className="card grid gap-8 overflow-hidden p-6 md:grid-cols-[1.2fr_1fr] md:p-10">
          <div>
            <h2 id="recruit" className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
              {t("home.recruitTitle")}
            </h2>
            <p className="mt-3 text-muted">{t("home.recruitBody")}</p>
            <ButtonLink href="/devenir-technicien" size="lg" className="mt-6">
              {t("pages.becomeCta")} <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </ButtonLink>
          </div>
          <ul className="space-y-3 self-center">
            {[t("home.recruit1"), t("home.recruit2"), t("home.recruit3"), t("home.recruit4")].map((x) => (
              <li key={x} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="text-text">{x}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-surface py-14 md:py-20" aria-labelledby="faq">
        <div className="container-page max-w-3xl">
          <SectionTitle id="faq" title={t("home.faqTitle")} action={<Link href="/faq" className="text-sm font-semibold text-primary hover:underline">{t("home.faqMore")}</Link>} />
          <div className="divide-y divide-border rounded-lg border border-border">
            {[1, 2, 3, 4, 5].map((i) => (
              <details key={i} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">
                  {t(`faq.q${i}`)}
                  <span className="text-xl text-muted transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{t(`faq.a${i}`, { hours })}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ id, title, subtitle, action }: { id: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1.5 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
