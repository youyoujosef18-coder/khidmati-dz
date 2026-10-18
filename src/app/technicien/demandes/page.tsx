import Link from "next/link";
import { MapPin, Siren, ChevronRight } from "lucide-react";
import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { listEligibleRequests } from "@/lib/services/requests";
import { PageHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/shared/display";

export default async function TechRequests({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { tp } = await requireTechContext();
  const { t, pick, relative, date } = await getI18n();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await listEligibleRequests(tp.id, page, 10);
  return (
    <>
      <PageHeader title={t("tech.requestsTitle")} description={t("tech.requestsSubtitle")} />
      {tp.verificationStatus !== "approved" && <Notice tone="warning" className="mb-4">{t("tech.notApprovedNotice")}</Notice>}
      {res.rows.length ? (
        <ul className="space-y-3">
          {res.rows.map((r) => (
            <li key={r.id}>
              <Link href={`/technicien/demandes/${r.id}`} className="card flex items-start gap-4 p-4 hover:shadow-raised">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink" dir="auto">{r.title}</p>
                    {r.urgency !== "normal" && (
                      <Badge tone="warning"><Siren className="h-3 w-3" aria-hidden /> {t(`enums.urgency.${r.urgency}`)}</Badge>
                    )}
                    {r.targeted && <Badge tone="accent">{t("request.targetedTo", { name: tp.publicName })}</Badge>}
                    {r.myQuoteStatus && <StatusBadge kind="quote" status={r.myQuoteStatus} />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted" dir="auto">{r.description}</p>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{pick(r, "category")}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden /> {pick(r, "commune")}, {pick(r, "wilaya")}</span>
                    <span>{r.preferredDate ? `${date(`${r.preferredDate}T12:00:00+01:00`)} · ${t(`enums.timeWindow.${r.timeWindow}`)}` : t("enums.timeWindow.flexible")}</span>
                    <span>{relative(r.createdAt)}</span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("tech.requestsEmpty")} />
      )}
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/technicien/demandes?page=${p}`} t={t} />
    </>
  );
}
