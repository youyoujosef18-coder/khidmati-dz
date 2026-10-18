import { requireTechContext } from "@/lib/services/tech-context";
import { getI18n } from "@/lib/i18n/server";
import { listBookings } from "@/lib/services/bookings";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Pagination, TabLinks } from "@/components/ui/pagination";
import { BookingList } from "@/components/booking/lists";

export default async function TechBookings({ searchParams }: { searchParams: Promise<{ vue?: string; page?: string }> }) {
  const { tp } = await requireTechContext();
  const { t } = await getI18n();
  const sp = await searchParams;
  const view = sp.vue === "a-confirmer" ? "to_confirm" : sp.vue === "passees" ? "past" : sp.vue === "toutes" ? "all" : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);
  const [res, pending] = await Promise.all([listBookings({ technicianId: tp.id }, view, page, 10), listBookings({ technicianId: tp.id }, "to_confirm", 1, 1)]);
  const key = sp.vue ?? "a-venir";
  return (
    <>
      <PageHeader title={t("tech.bookingsTitle")} />
      <TabLinks
        active={key}
        tabs={[
          { key: "a-venir", label: t("client.tabUpcoming"), href: "/technicien/reservations" },
          { key: "a-confirmer", label: t("tech.toConfirm"), href: "/technicien/reservations?vue=a-confirmer", count: pending.total },
          { key: "passees", label: t("client.tabPast"), href: "/technicien/reservations?vue=passees" },
          { key: "toutes", label: t("client.tabAll"), href: "/technicien/reservations?vue=toutes" },
        ]}
      />
      {res.rows.length ? <BookingList rows={res.rows} base="/technicien/reservations" viewer="technician" /> : <EmptyState title={t("booking.listEmpty")} />}
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/technicien/reservations?vue=${key}&page=${p}`} t={t} />
    </>
  );
}
