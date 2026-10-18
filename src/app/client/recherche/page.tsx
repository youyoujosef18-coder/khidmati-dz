import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui/card";
import { DiscoveryView } from "@/components/marketplace/discovery-view";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireRole("client");
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("discovery.title")} description={t("discovery.subtitle")} />
      <DiscoveryView searchParams={await searchParams} basePath="/client/recherche" />
    </>
  );
}
