import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Bell, BadgeCheck, CalendarDays, CalendarRange, ClipboardCheck, FileText, Inbox, LayoutDashboard, MapPinned, MessageSquare, Settings, Star, UserRound, Wallet, Wrench,
} from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { getTechnicianForUser } from "@/lib/services/technicians";
import { unreadMessageCount } from "@/lib/services/messaging";
import { unreadNotificationCount } from "@/lib/services/support";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { t } = await getI18n();
  const path = (await headers()).get("x-pathname") ?? "";
  // Look the profile up directly: the cached user may predate a role granted earlier in this same request.
  const tp = await getTechnicianForUser(user.id);
  if (!tp) {
    if (!path.startsWith("/technicien/inscription")) redirect("/technicien/inscription");
    // Always render children so the onboarding page (which shows the start screen) stays authoritative.
    return (
      <>
        <SiteHeader />
        <main id="main" className="container-page flex-1 py-10">
          {children}
        </main>
      </>
    );
  }
  const [msgs, notifs] = await Promise.all([unreadMessageCount(user), unreadNotificationCount(user.id)]);
  const approved = tp.verificationStatus === "approved";
  return (
    <DashboardShell
      title={t("nav.techSpace")}
      items={[
        { href: "/technicien", label: t("tech.nav.dashboard"), icon: <LayoutDashboard />, exact: true },
        ...(!approved ? [{ href: "/technicien/inscription", label: t("tech.onboardingTitle"), icon: <ClipboardCheck /> }] : []),
        { href: "/technicien/verification", label: t("tech.nav.verification"), icon: <BadgeCheck /> },
        { href: "/technicien/demandes", label: t("tech.nav.requests"), icon: <Inbox /> },
        { href: "/technicien/devis", label: t("tech.nav.quotes"), icon: <FileText /> },
        { href: "/technicien/reservations", label: t("tech.nav.bookings"), icon: <CalendarDays /> },
        { href: "/technicien/interventions", label: t("tech.nav.jobs"), icon: <Wrench /> },
        { href: "/technicien/messages", label: t("tech.nav.messages"), icon: <MessageSquare />, badge: msgs },
        { href: "/technicien/notifications", label: t("tech.nav.notifications"), icon: <Bell />, badge: notifs },
        { href: "/technicien/profil", label: t("tech.nav.profile"), icon: <UserRound /> },
        { href: "/technicien/services", label: t("tech.nav.services"), icon: <ClipboardCheck /> },
        { href: "/technicien/zones", label: t("tech.nav.zones"), icon: <MapPinned /> },
        { href: "/technicien/disponibilites", label: t("tech.nav.availability"), icon: <CalendarRange /> },
        { href: "/technicien/revenus", label: t("tech.nav.earnings"), icon: <Wallet /> },
        { href: "/technicien/avis", label: t("tech.nav.reviews"), icon: <Star /> },
        { href: "/technicien/parametres", label: t("tech.nav.settings"), icon: <Settings /> },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
