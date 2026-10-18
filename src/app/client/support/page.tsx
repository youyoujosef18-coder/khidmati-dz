import { desc, eq, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { getTicketForUser, listTickets } from "@/lib/services/support";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { NewTicketForm, TicketList, TicketThread } from "@/components/account/support-view";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ ticket?: string; reservation?: string }> }) {
  const user = await requireRole("client");
  const sp = await searchParams;
  const { t } = await getI18n();
  const [tickets, bookings] = await Promise.all([
    listTickets({ userId: user.id }),
    db
      .select({ id: schema.bookings.id, reference: schema.bookings.reference, title: schema.bookings.title })
      .from(schema.bookings)
      .leftJoin(schema.technicianProfiles, eq(schema.technicianProfiles.id, schema.bookings.technicianId))
      .where(or(eq(schema.bookings.clientId, user.id), eq(schema.technicianProfiles.userId, user.id)))
      .orderBy(desc(schema.bookings.createdAt))
      .limit(30),
  ]);
  const selected = sp.ticket && /^[0-9a-f-]{36}$/i.test(sp.ticket) ? await getTicketForUser(user, sp.ticket) : null;
  return (
    <>
      <PageHeader title={t("support.title")} description={t("support.subtitle")} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("support.newTicket")} />
            <CardBody>
              <NewTicketForm bookings={bookings} defaultBookingId={bookings.some((b) => b.id === sp.reservation) ? sp.reservation : undefined} />
            </CardBody>
          </Card>
          <TicketList base="/client/support" selected={selected?.ticket.id} tickets={tickets.map((x) => ({ ...x, updatedAt: x.updatedAt.toISOString() }))} />
        </div>
        {selected && selected.ticket.userId === user.id && (
          <Card>
            <CardHeader title={selected.ticket.subject} description={selected.ticket.reference} />
            <CardBody>
              <TicketThread
                ticketId={selected.ticket.id}
                status={selected.ticket.status}
                description={selected.ticket.description}
                isStaff={false}
                messages={selected.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), mine: m.authorId === user.id }))}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}
