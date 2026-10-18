import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { listBookings } from "@/lib/services/bookings";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { Pagination, TabLinks } from "@/components/ui/pagination";
import { BookingList } from "@/components/booking/lists";

export default async function ClientBookings({ searchParams }: { searchParams: Promise<{ vue?: string; page?: string }> }) {
  const user = await requireRole("client");
  const { t } = await getI18n();
  const sp = await searchParams;
  const view = sp.vue === "passees" ? "past" : sp.vue === "toutes" ? "all" : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await listBookings({ clientId: user.id }, view, page, 10);
  const key = view === "past" ? "passees" : view === "all" ? "toutes" : "a-venir";
  return (
    <>
      <PageHeader title={t("client.bookingsTitle")} />
      <TabLinks
        active={key}
        tabs={[
          { key: "a-venir", label: t("client.tabUpcoming"), href: "/client/reservations" },
          { key: "passees", label: t("client.tabPast"), href: "/client/reservations?vue=passees" },
          { key: "toutes", label: t("client.tabAll"), href: "/client/reservations?vue=toutes" },
        ]}
      />
      {res.rows.length ? (
        <BookingList rows={res.rows} base="/client/reservations" viewer="client" />
      ) : (
        <EmptyState title={t("client.bookingsEmpty")} action={<ButtonLink href="/techniciens" variant="outline">{t("home.ctaFind")}</ButtonLink>} />
      )}
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `/client/reservations?vue=${key}&page=${p}`} t={t} />
    </>
  );
}
