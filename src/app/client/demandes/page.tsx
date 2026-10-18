import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { listClientRequests } from "@/lib/services/requests";
import { PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { RequestList } from "@/components/booking/lists";

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireRole("client");
  const { t } = await getI18n();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await listClientRequests(user.id, page, 10);
  return (
    <>
      <PageHeader
        title={t("client.requestsTitle")}
        description={t("client.requestsSubtitle")}
        actions={<ButtonLink href="/client/demandes/nouvelle"><Plus className="h-4 w-4" aria-hidden /> {t("client.newRequest")}</ButtonLink>}
      />
      {res.rows.length ? (
        <RequestList rows={res.rows} base="/client/demandes" />
      ) : (
        <EmptyState title={t("client.requestsEmpty")} action={<ButtonLink href="/client/demandes/nouvelle">{t("client.newRequest")}</ButtonLink>} />
      )}
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/client/demandes?page=${p}`} t={t} />
    </>
  );
}
