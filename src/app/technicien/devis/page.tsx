import Link from "next/link";
import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { listTechnicianQuotes } from "@/lib/services/quotes";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { Money, StatusBadge } from "@/components/shared/display";
import { WithdrawQuoteButton } from "@/components/tech/withdraw-quote";

export default async function TechQuotes({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { tp } = await requireTechContext();
  const { t, dateTime } = await getI18n();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await listTechnicianQuotes(tp.id, page, 15);
  return (
    <>
      <PageHeader title={t("quote.myQuotes")} />
      {res.rows.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-bg text-start text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t("request.title")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("quote.proposedDate")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("quote.total")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {res.rows.map(({ quote: q, requestTitle, requestRef }) => {
                const expired = q.status === "sent" && q.expiresAt <= new Date();
                return (
                  <tr key={q.id}>
                    <td className="px-4 py-3">
                      <Link href={`/technicien/demandes/${q.requestId}`} className="font-medium text-ink hover:text-primary" dir="auto">{requestTitle}</Link>
                      <p className="text-xs text-muted ltr-nums">{requestRef} · {t("quote.revision", { n: q.revisionNumber })}</p>
                    </td>
                    <td className="px-4 py-3">{dateTime(q.proposedStartAt)}</td>
                    <td className="px-4 py-3 text-end"><Money minor={q.totalMinor} /></td>
                    <td className="px-4 py-3"><StatusBadge kind="quote" status={expired ? "expired" : q.status} /></td>
                    <td className="px-4 py-3 text-end">{q.status === "sent" && !expired && <WithdrawQuoteButton quoteId={q.id} />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={t("quote.myQuotesEmpty")} />
      )}
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/technicien/devis?page=${p}`} t={t} />
    </>
  );
}
