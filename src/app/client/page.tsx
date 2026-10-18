import Link from "next/link";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { Bell, CalendarDays, MessageSquare, Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { listBookings } from "@/lib/services/bookings";
import { listConversations } from "@/lib/services/messaging";
import { getActiveWilayas } from "@/lib/services/discovery";
import { PageHeader, Card, CardHeader, CardBody } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { Avatar } from "@/components/ui/avatar";
import { BookingList, RequestList } from "@/components/booking/lists";
import { ServiceSearchBar } from "@/components/marketplace/service-search-bar";
import { DateTime, StatusBadge } from "@/components/shared/display";
import { sql } from "drizzle-orm";

export default async function ClientDashboard() {
  const user = await requireRole("client");
  const { t } = await getI18n();
  const [upcoming, recent, wilayas, conversations, activeRequests, saved, notifications] = await Promise.all([
    listBookings({ clientId: user.id }, "upcoming", 1, 1),
    listBookings({ clientId: user.id }, "all", 1, 5),
    getActiveWilayas(),
    listConversations(user, "client"),
    db
      .select({
        id: schema.serviceRequests.id,
        reference: schema.serviceRequests.reference,
        title: schema.serviceRequests.title,
        status: schema.serviceRequests.status,
        urgency: schema.serviceRequests.urgency,
        createdAt: schema.serviceRequests.createdAt,
        categoryFr: schema.serviceCategories.nameFr,
        categoryAr: schema.serviceCategories.nameAr,
        communeFr: schema.communes.nameFr,
        communeAr: schema.communes.nameAr,
        quoteCount: sql<number>`(SELECT count(*)::int FROM quotes q WHERE q.request_id = "service_requests"."id" AND q.status = 'sent')`,
      })
      .from(schema.serviceRequests)
      .innerJoin(schema.serviceCategories, eq(schema.serviceCategories.id, schema.serviceRequests.categoryId))
      .innerJoin(schema.communes, eq(schema.communes.id, schema.serviceRequests.communeId))
      .where(and(eq(schema.serviceRequests.clientId, user.id), inArray(schema.serviceRequests.status, ["awaiting_quote", "quote_received"])))
      .orderBy(desc(schema.serviceRequests.createdAt))
      .limit(5),
    db
      .select({ id: schema.technicianProfiles.id, slug: schema.technicianProfiles.slug, name: schema.technicianProfiles.publicName, avatar: schema.technicianProfiles.avatarFileId })
      .from(schema.savedTechnicians)
      .innerJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.savedTechnicians.technicianId))
      .where(and(eq(schema.savedTechnicians.clientId, user.id), eq(schema.technicianProfiles.verificationStatus, "approved")))
      .limit(6),
    db
      .select()
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(5),
  ]);
  const next = upcoming.rows[0];

  return (
    <>
      <PageHeader
        title={t("client.hello", { name: user.firstName })}
        description={t("client.dashboardSubtitle")}
        actions={
          <ButtonLink href="/client/demandes/nouvelle">
            <Plus className="h-4 w-4" aria-hidden /> {t("client.newRequest")}
          </ButtonLink>
        }
      />
      <section aria-label={t("client.quickSearch")} className="mb-6">
        <ServiceSearchBar wilayas={wilayas} />
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={t("client.upcomingBooking")} />
          <CardBody>
            {next ? (
              <Link href={`/client/reservations/${next.id}`} className="flex items-center gap-4 rounded-md p-1 hover:bg-bg">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-primary text-white">
                  <CalendarDays className="h-6 w-6" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-ink" dir="auto">{next.title}</p>
                  <p className="text-sm text-muted">
                    <DateTime value={next.scheduledStartAt} /> · {next.techName}
                  </p>
                  <StatusBadge kind="booking" status={next.status} className="mt-1" />
                </div>
              </Link>
            ) : (
              <p className="text-sm text-muted">{t("client.noUpcoming")}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("client.activeRequest")} action={<Link href="/client/demandes" className="text-sm font-medium text-primary">{t("common.viewAll")}</Link>} />
          <CardBody className="p-0">
            {activeRequests.length ? (
              <div className="[&>ul]:rounded-none [&>ul]:border-0 [&>ul]:shadow-none">
                <RequestList rows={activeRequests} base="/client/demandes" />
              </div>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">{t("client.noActiveRequest")}</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("client.recentConversations")} action={<Link href="/client/messages" className="text-sm font-medium text-primary">{t("common.viewAll")}</Link>} />
          <CardBody className="p-0">
            {conversations.length ? (
              <ul className="divide-y divide-border">
                {conversations.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link href={`/client/messages/${c.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-bg">
                      <Avatar fileId={c.techAvatar} name={c.techName} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{c.techName}</p>
                        <p className="truncate text-xs text-muted" dir="auto">{c.lastBody ?? c.requestTitle}</p>
                      </div>
                      {c.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-white ltr-nums">{c.unread}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted">
                <MessageSquare className="h-4 w-4" aria-hidden /> {t("client.noConversations")}
              </p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("client.savedTechs")} action={<Link href="/client/favoris" className="text-sm font-medium text-primary">{t("common.viewAll")}</Link>} />
          <CardBody>
            {saved.length ? (
              <ul className="flex flex-wrap gap-3">
                {saved.map((s) => (
                  <li key={s.id}>
                    <Link href={`/techniciens/${s.slug}`} className="flex items-center gap-2 rounded-full border border-border py-1 pe-3 ps-1 text-sm hover:border-primary/40">
                      <Avatar fileId={s.avatar} name={s.name} size={28} /> {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("client.noSaved")}</p>
            )}
          </CardBody>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section>
          <h2 className="mb-3 font-semibold text-ink">{t("client.recentBookings")}</h2>
          {recent.rows.length ? (
            <BookingList rows={recent.rows} base="/client/reservations" viewer="client" />
          ) : (
            <EmptyState title={t("client.emptyBookings")} action={<ButtonLink href="/techniciens" variant="outline">{t("home.ctaFind")}</ButtonLink>} />
          )}
        </section>
        <section>
          <h2 className="mb-3 font-semibold text-ink">{t("nav.notifications")}</h2>
          {notifications.length ? (
            <ul className="card divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link href={n.link ?? "/client/notifications"} className="block px-4 py-3 hover:bg-bg">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    <p className="line-clamp-2 text-xs text-muted">{n.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="card flex items-center gap-2 px-4 py-4 text-sm text-muted">
              <Bell className="h-4 w-4" aria-hidden /> {t("notifications.empty")}
            </p>
          )}
        </section>
      </div>
    </>
  );
}
