import { BarChart3, Bell, CalendarDays, ClipboardCheck, FileSearch, Flag, Gavel, LayoutDashboard, LifeBuoy, ListTree, Settings, Star, UserCog, Users, Wrench } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { getI18n } from "@/lib/i18n/server";
import { DashboardShell, type ShellItem } from "@/components/layout/dashboard-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePermission("admin.access");
  const { t } = await getI18n();
  const items: (ShellItem & { perm: Permission })[] = [
    { href: "/admin", label: t("admin.nav.overview"), icon: <LayoutDashboard />, exact: true, perm: "admin.access" },
    { href: "/admin/utilisateurs", label: t("admin.nav.users"), icon: <Users />, perm: "users.read" },
    { href: "/admin/techniciens", label: t("admin.nav.technicians"), icon: <Wrench />, perm: "users.read" },
    { href: "/admin/verification", label: t("admin.nav.verification"), icon: <UserCog />, perm: "verification.review" },
    { href: "/admin/categories", label: t("admin.nav.categories"), icon: <ListTree />, perm: "catalog.manage" },
    { href: "/admin/services", label: t("admin.nav.services"), icon: <ClipboardCheck />, perm: "services.moderate" },
    { href: "/admin/reservations", label: t("admin.nav.bookings"), icon: <CalendarDays />, perm: "bookings.read_all" },
    { href: "/admin/litiges", label: t("admin.nav.disputes"), icon: <Gavel />, perm: "disputes.handle" },
    { href: "/admin/signalements", label: t("admin.nav.reports"), icon: <Flag />, perm: "reports.handle" },
    { href: "/admin/avis", label: t("admin.nav.reviews"), icon: <Star />, perm: "reviews.moderate" },
    { href: "/admin/support", label: t("admin.nav.support"), icon: <LifeBuoy />, perm: "support.handle" },
    { href: "/admin/notifications", label: t("admin.nav.notifications"), icon: <Bell />, perm: "notifications.manage" },
    { href: "/admin/rapports", label: t("admin.nav.analytics"), icon: <BarChart3 />, perm: "analytics.read" },
    { href: "/admin/audit", label: t("admin.nav.audit"), icon: <FileSearch />, perm: "audit.read" },
    { href: "/admin/parametres", label: t("admin.nav.settings"), icon: <Settings />, perm: "settings.manage" },
  ];
  return (
    <DashboardShell title={t("admin.title")} items={items.filter((i) => hasPermission(user.roles, i.perm)).map((i) => ({ href: i.href, label: i.label, icon: i.icon, exact: i.exact }))}>
      {children}
    </DashboardShell>
  );
}
