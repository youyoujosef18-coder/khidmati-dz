import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { listTechnicianReviews, MIN_REVIEWS_FOR_AVERAGE } from "@/lib/services/reviews";
import { PageHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { Stars, StatusBadge } from "@/components/shared/display";

export default async function TechReviews({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { tp } = await requireTechContext();
  const { t, date } = await getI18n();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await listTechnicianReviews(tp.id, { publishedOnly: false, page, pageSize: 10 });
  return (
    <>
      <PageHeader title={t("tech.reviewsTitle")} />
      {tp.reviewCountDerived > 0 && tp.averageRatingDerived && (
        <Notice className="mb-4">
          {t("tech.average", { avg: Number(tp.averageRatingDerived).toFixed(2), count: tp.reviewCountDerived })} — {t("discovery.ratingNote", { min: MIN_REVIEWS_FOR_AVERAGE })}
        </Notice>
      )}
      {res.rows.length ? (
        <ul className="card divide-y divide-border">
          {res.rows.map((r) => (
            <li key={r.id} className="px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink">{r.clientName}</span>
                <div className="flex items-center gap-2"><Stars value={r.rating} />{r.moderationStatus !== "published" && <StatusBadge kind="moderation" status={r.moderationStatus} />}</div>
              </div>
              <p className="text-xs text-muted">{r.bookingTitle} · {date(r.createdAt)}</p>
              {r.comment && <p className="mt-2 text-sm" dir="auto">{r.comment}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("tech.reviewsEmpty")} />
      )}
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/technicien/avis?page=${p}`} t={t} />
    </>
  );
}
