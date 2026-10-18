import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import type { CurrentUser } from "@/lib/auth/session";
import { listConversations, listMessages } from "@/lib/services/messaging";
import { AppError } from "@/lib/errors";
import { PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Avatar } from "@/components/ui/avatar";
import { DateTime } from "@/components/shared/display";
import { ReportDialog } from "@/components/shared/report-dialog";
import { ChatWindow } from "./chat-window";
import { BlockButton } from "./block-button";
import { cn } from "@/lib/utils";

/** Conversation list + selected conversation, shared by client and technician spaces. */
export async function ConversationsPage({ user, side, base, selectedId }: { user: CurrentUser; side: "client" | "technician"; base: string; selectedId?: string }) {
  const { t } = await getI18n();
  const conversations = await listConversations(user, side);
  let selected: Awaited<ReturnType<typeof listMessages>> | null = null;
  if (selectedId) {
    if (!/^[0-9a-f-]{36}$/i.test(selectedId)) notFound();
    try {
      selected = await listMessages(user, selectedId);
    } catch (e) {
      if (e instanceof AppError) notFound();
      throw e;
    }
    if (!selected.conversation.isParticipant) notFound();
  }
  const other = (c: (typeof conversations)[number]) => (side === "client" ? c.techName : c.clientName);
  return (
    <>
      <PageHeader title={t("messages.title")} />
      {conversations.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-6 w-6" />} title={t("messages.empty")} />
      ) : (
        <div className="card grid overflow-hidden md:grid-cols-[300px_1fr]">
          <ul className={cn("max-h-[70dvh] divide-y divide-border overflow-y-auto border-e border-border", selected && "hidden md:block")}>
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`${base}/${c.id}`}
                  aria-current={c.id === selectedId ? "page" : undefined}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-bg aria-[current=page]:bg-primary-50"
                >
                  <Avatar fileId={side === "client" ? c.techAvatar : null} name={other(c)} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-ink">{other(c)}</p>
                      {c.lastMessageAt && <span className="shrink-0 text-[11px] text-muted"><DateTime value={c.lastMessageAt} mode="relative" /></span>}
                    </div>
                    <p className="truncate text-xs text-muted" dir="auto">{c.lastBody || c.requestTitle}</p>
                  </div>
                  {c.unread > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-white ltr-nums">{c.unread}</span>}
                </Link>
              </li>
            ))}
          </ul>
          <section className={cn("min-w-0", !selected && "hidden md:block")}>
            {selected ? (
              <>
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <Link href={base} className="text-xs text-primary md:hidden">← {t("messages.title")}</Link>
                    <p className="truncate font-semibold text-ink">{side === "client" ? selected.conversation.techName : selected.conversation.clientName}</p>
                    <p className="truncate text-xs text-muted" dir="auto">{t("messages.aboutRequest", { title: selected.conversation.requestTitle })}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ReportDialog targetType="conversation" targetId={selected.conversation.conversation.id} label={t("messages.report")} loggedIn />
                    {!selected.conversation.conversation.blockedAt && <BlockButton conversationId={selected.conversation.conversation.id} />}
                  </div>
                </header>
                <ChatWindow
                  conversationId={selected.conversation.conversation.id}
                  meId={user.id}
                  blocked={Boolean(selected.conversation.conversation.blockedAt)}
                  initial={selected.messages.map((m) => ({
                    id: m.id,
                    senderId: m.senderId,
                    body: m.body,
                    attachmentFileId: m.attachmentFileId,
                    readAt: m.readAt?.toISOString() ?? null,
                    createdAt: m.createdAt.toISOString(),
                  }))}
                />
              </>
            ) : (
              <p className="grid h-full min-h-60 place-items-center p-6 text-sm text-muted">{t("messages.select")}</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
