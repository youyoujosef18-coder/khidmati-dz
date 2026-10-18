import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { getActiveCategories } from "@/lib/services/discovery";
import { PageHeader } from "@/components/ui/card";
import { CategoryIcon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.servicesTitle"), description: t("pages.servicesSubtitle") };
}

export default async function ServicesPage() {
  const { t, pick, locale } = await getI18n();
  const categories = await getActiveCategories();
  return (
    <div className="container-page py-8 md:py-12">
      <PageHeader title={t("pages.servicesTitle")} description={t("pages.servicesSubtitle")} />
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((c) => {
          const examples = locale === "ar-DZ" ? c.examplesAr : c.examplesFr;
          return (
            <section key={c.id} className="card flex flex-col p-5">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary">
                  <CategoryIcon iconKey={c.iconKey} className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-ink">{pick(c, "name")}</h2>
                  <p className="text-sm text-muted">{pick(c, "description")}</p>
                  <p className="mt-1 text-xs font-medium text-primary">
                    {c.techCount > 0 ? t("pages.techCount", { count: c.techCount }) : t("pages.noTechYet")}
                  </p>
                </div>
              </div>
              {examples.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("pages.examples")}>
                  {examples.map((e) => (
                    <li key={e} className="rounded-full bg-bg px-2.5 py-1 text-xs text-text ring-1 ring-border">
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 flex flex-wrap gap-2 pt-1">
                <ButtonLink href={`/services/${c.slug}`} variant="outline" size="sm">
                  {t("pages.seeProfessionals")}
                </ButtonLink>
                <ButtonLink href={`/client/demandes/nouvelle?categorie=${c.slug}`} size="sm">
                  {t("pages.requestThisService")}
                </ButtonLink>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
