import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { listBookings } from "@/lib/services/bookings";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { BookingList } from "@/components/booking/lists";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { tp } = await requireTechContext();
  const { t } = await getI18n();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const res = await listBookings({ technicianId: tp.id }, "past", page, 15);
  return (
    <>
      <PageHeader title={t("tech.jobsTitle")} />
      {res.rows.length ? <BookingList rows={res.rows} base="/technicien/reservations" viewer="technician" /> : <EmptyState title={t("tech.jobsEmpty")} />}
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/technicien/interventions?page=${p}`} t={t} />
    </>
  );
}
