"use client";

import Link from "next/link";
import { BellOff } from "lucide-react";
import { ActionButton } from "@/components/forms/simple-action-button";
import { EmptyState } from "@/components/ui/states";
import { DateTime } from "@/components/shared/display";
import { markNotificationsReadAction } from "@/app/actions/support";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export interface NotificationView {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationCenter({ items, hasUnread }: { items: NotificationView[]; hasUnread: boolean }) {
  const { t } = useI18n();
  return (
    <div>
      {hasUnread && (
        <div className="mb-4 flex justify-end">
          <ActionButton variant="outline" size="sm" run={() => markNotificationsReadAction("all")} successMessage={false}>
            {t("notifications.markAll")}
          </ActionButton>
        </div>
      )}
      {items.length ? (
        <ul className="card divide-y divide-border overflow-hidden">
          {items.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3.5", !n.readAt && "bg-primary-50/50")}>
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
              <div className="min-w-0 flex-1">
                {n.link ? (
                  <Link href={n.link} className="font-medium text-ink hover:text-primary" onClick={() => !n.readAt && markNotificationsReadAction([n.id])}>
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium text-ink">{n.title}</p>
                )}
                <p className="text-sm text-muted" dir="auto">{n.body}</p>
                <p className="mt-0.5 text-xs text-muted"><DateTime value={n.createdAt} mode="relative" /></p>
              </div>
              {!n.readAt && (
                <ActionButton variant="ghost" size="sm" run={() => markNotificationsReadAction([n.id])} successMessage={false}>
                  {t("notifications.markRead")}
                </ActionButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<BellOff className="h-6 w-6" />} title={t("notifications.empty")} />
      )}
    </div>
  );
}
