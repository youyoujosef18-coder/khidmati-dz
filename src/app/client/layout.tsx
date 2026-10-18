import { Bell, CalendarDays, ClipboardList, Heart, LayoutDashboard, LifeBuoy, MapPin, MessageSquare, Search, Settings, UserRound } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { unreadMessageCount } from "@/lib/services/messaging";
import { unreadNotificationCount } from "@/lib/services/support";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("client");
  const { t } = await getI18n();
  const [msgs, notifs] = await Promise.all([unreadMessageCount(user), unreadNotificationCount(user.id)]);
  return (
    <DashboardShell
      title={t("nav.clientSpace")}
      items={[
        { href: "/client", label: t("client.nav.dashboard"), icon: <LayoutDashboard />, exact: true },
        { href: "/client/recherche", label: t("client.nav.search"), icon: <Search /> },
        { href: "/client/demandes", label: t("client.nav.requests"), icon: <ClipboardList /> },
        { href: "/client/reservations", label: t("client.nav.bookings"), icon: <CalendarDays /> },
        { href: "/client/messages", label: t("client.nav.messages"), icon: <MessageSquare />, badge: msgs },
        { href: "/client/notifications", label: t("client.nav.notifications"), icon: <Bell />, badge: notifs },
        { href: "/client/favoris", label: t("client.nav.favorites"), icon: <Heart /> },
        { href: "/client/adresses", label: t("client.nav.addresses"), icon: <MapPin /> },
        { href: "/client/profil", label: t("client.nav.profile"), icon: <UserRound /> },
        { href: "/client/parametres", label: t("client.nav.settings"), icon: <Settings /> },
        { href: "/client/support", label: t("client.nav.support"), icon: <LifeBuoy /> },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
