import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "@/lib/auth/session";
import { getI18n } from "@/lib/i18n/server";
import { listNotifications } from "@/lib/services/support";
import { channelStatus } from "@/lib/notify/adapters";
import { formatPhone } from "@/lib/phone";
import { PageHeader, Card, CardBody } from "@/components/ui/card";
import { Pagination, TabLinks } from "@/components/ui/pagination";
import { ProfileEditor } from "./profile-editor";
import { SettingsPanel } from "./settings-panel";
import { NotificationCenter } from "./notification-center";

export async function ProfilePageView({ user }: { user: CurrentUser }) {
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("client.profileTitle")} />
      <Card className="max-w-3xl">
        <CardBody className="p-5 md:p-6">
          <ProfileEditor
            initial={{
              fullName: user.fullName,
              displayName: user.displayName,
              phone: user.phone ? formatPhone(user.phone) : "",
              email: user.email ?? "",
              preferredLocale: user.preferredLocale,
              avatarFileId: user.avatarFileId,
            }}
          />
        </CardBody>
      </Card>
    </>
  );
}

export async function SettingsPageView({ user }: { user: CurrentUser }) {
  const { t } = await getI18n();
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, user.id));
  const ch = channelStatus();
  return (
    <>
      <PageHeader title={t("client.settingsTitle")} />
      <div className="max-w-3xl">
        <SettingsPanel
          data={{
            email: user.email,
            phone: user.phone ? formatPhone(user.phone) : null,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            prefs: profile!.notificationPrefs,
            channels: { email: Boolean(ch.email), sms: Boolean(ch.sms), push: false },
            termsAcceptedAt: profile!.termsAcceptedAt.toISOString(),
            isTechnician: user.roles.includes("technician"),
          }}
        />
      </div>
    </>
  );
}

export async function NotificationsPageView({ user, base, sp }: { user: CurrentUser; base: string; sp: { filtre?: string; page?: string } }) {
  const { t } = await getI18n();
  const unreadOnly = sp.filtre === "non-lues";
  const page = Math.max(1, Number(sp.page) || 1);
  const res = await listNotifications(user.id, unreadOnly, page, 20);
  const unread = await listNotifications(user.id, true, 1, 1);
  return (
    <>
      <PageHeader title={t("notifications.title")} />
      <TabLinks
        active={unreadOnly ? "u" : "a"}
        tabs={[
          { key: "a", label: t("common.all"), href: base },
          { key: "u", label: t("notifications.unreadOnly"), href: `${base}?filtre=non-lues`, count: unread.total },
        ]}
      />
      <NotificationCenter
        hasUnread={unread.total > 0}
        items={res.rows.map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))}
      />
      <Pagination page={page} total={res.total} pageSize={res.pageSize} hrefFor={(p) => `${base}?${unreadOnly ? "filtre=non-lues&" : ""}page=${p}`} t={t} />
    </>
  );
}
