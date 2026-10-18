import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { DiscoveryView } from "@/components/marketplace/discovery-view";
import { PageHeader } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("discovery.title"), description: t("discovery.subtitle") };
}

export default async function TechniciansPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { t } = await getI18n();
  return (
    <div className="container-page py-8 md:py-12">
      <PageHeader title={t("discovery.title")} description={t("discovery.subtitle")} />
      <DiscoveryView searchParams={await searchParams} basePath="/techniciens" />
    </div>
  );
}
