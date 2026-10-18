import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import { requirePermission } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { getTicketForUser, listTickets } from "@/lib/services/support";
import { PageHeader, Card, CardBody, CardHeader } from "@/components/ui/card";
import { TabLinks } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/shared/display";
import { TicketList, TicketThread } from "@/components/account/support-view";
import { ActionButton } from "@/components/forms/simple-action-button";
import { setContactStatusAction, staffTicketStatusAction } from "@/app/actions/admin";

export default async function AdminSupport({ searchParams }: { searchParams: Promise<{ ticket?: string; vue?: string }> }) {
  const staff = await requirePermission("support.handle");
  const sp = await searchParams;
  const { t, dateTime } = await getI18n();
  const view = sp.vue === "contact" ? "contact" : sp.vue === "fermes" ? "fermes" : "ouverts";
  const tickets = view === "contact" ? [] : await listTickets({ statuses: view === "fermes" ? ["resolved", "closed"] : ["open", "pending"] });
  const contacts = view === "contact" ? await db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt)).limit(100) : [];
  const selected = sp.ticket && /^[0-9a-f-]{36}$/i.test(sp.ticket) ? await getTicketForUser(staff, sp.ticket) : null;
  return (
    <>
      <PageHeader title={t("admin.ticketsQueue")} />
      <TabLinks
        active={view}
        tabs={[
          { key: "ouverts", label: t("status.ticket.open"), href: "/admin/support" },
          { key: "fermes", label: t("status.ticket.closed"), href: "/admin/support?vue=fermes" },
          { key: "contact", label: t("support.contactMessages"), href: "/admin/support?vue=contact" },
        ]}
      />
      {view === "contact" ? (
        <ul className="space-y-3">
          {contacts.map((c) => (
            <li key={c.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{c.subject}</p>
                <StatusBadge kind="ticket" status={c.status} />
              </div>
              <p className="text-xs text-muted ltr-nums">{c.name} · {c.email ?? ""} {c.phone ?? ""} · {dateTime(c.createdAt)}</p>
              <p className="mt-2 whitespace-pre-line text-sm" dir="auto">{c.message}</p>
              {c.status === "open" && <ActionButton size="sm" variant="outline" className="mt-3" run={setContactStatusAction.bind(null, c.id, "resolved")}>{t("status.ticket.resolved")}</ActionButton>}
            </li>
          ))}
          {!contacts.length && <p className="text-sm text-muted">{t("support.empty")}</p>}
        </ul>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <TicketList base="/admin/support" selected={selected?.ticket.id} tickets={tickets.map((x) => ({ ...x, updatedAt: x.updatedAt.toISOString() }))} />
          {selected && (
            <Card>
              <CardHeader title={selected.ticket.subject} description={`${selected.ticket.reference} · ${selected.userName}`} />
              <CardBody>
                <TicketThread
                  ticketId={selected.ticket.id}
                  status={selected.ticket.status}
                  description={selected.ticket.description}
                  isStaff
                  closeLabel={false}
                  messages={selected.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), mine: m.authorId === staff.id }))}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["pending", "resolved", "closed"] as const).map((s) => (
                    <ActionButton key={s} size="sm" variant="outline" run={staffTicketStatusAction.bind(null, selected.ticket.id, s)}>{t(`status.ticket.${s}`)}</ActionButton>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
