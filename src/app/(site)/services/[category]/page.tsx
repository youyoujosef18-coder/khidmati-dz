import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getCategoryBySlug } from "@/lib/services/discovery";
import { DiscoveryView } from "@/components/marketplace/discovery-view";
import { PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const c = await getCategoryBySlug(category);
  const { pick } = await getI18n();
  return c ? { title: pick(c, "name"), description: pick(c, "description") } : {};
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const c = await getCategoryBySlug(category);
  if (!c) notFound();
  const { t, pick, locale } = await getI18n();
  const examples = locale === "ar-DZ" ? c.examplesAr : c.examplesFr;
  return (
    <div className="container-page py-8 md:py-12">
      <PageHeader
        backHref="/services"
        backLabel={t("nav.services")}
        title={pick(c, "name")}
        description={[pick(c, "description"), examples.length ? `${t("pages.examples")} : ${examples.join(", ")}` : ""].filter(Boolean).join(" ")}
        actions={<ButtonLink href={`/client/demandes/nouvelle?categorie=${c.slug}`}>{t("pages.requestThisService")}</ButtonLink>}
      />
      <DiscoveryView searchParams={await searchParams} basePath={`/services/${c.slug}`} lockedCategory={c.slug} />
    </div>
  );
}
