"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DM from "@radix-ui/react-dropdown-menu";
import { Bell, ChevronDown, LayoutDashboard, LogOut, Menu, ShieldCheck, Wrench, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { Logo } from "./logo";
import { NavLink } from "./nav-link";
import { LanguageSwitcher } from "./language-switcher";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { logoutAction } from "@/app/actions/auth";

export interface HeaderUser {
  name: string;
  avatarFileId: string | null;
  home: string;
  isClient: boolean;
  isTech: boolean;
  isStaff: boolean;
  notificationsHref: string;
}

export function HeaderClient({ user, unread }: { user: HeaderUser | null; unread: number }) {
  const { t, dir } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const links = [
    { href: "/services", label: t("nav.services") },
    { href: "/comment-ca-marche", label: t("nav.howItWorks") },
    { href: "/techniciens", label: t("nav.findPro") },
    { href: "/devenir-technicien", label: t("nav.becomeTech") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:shadow-raised">
        {t("common.skipToContent")}
      </a>
      <div className="container-page flex h-16 items-center gap-3">
        <Logo label={t("common.appName")} />
        <nav aria-label={t("nav.main")} className="ms-6 hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-[0.92rem] font-medium text-muted transition-colors hover:text-ink"
              activeClassName="!text-primary"
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <LanguageSwitcher className="sm:hidden" compact />
          {user ? (
            <>
              <Link
                href={user.notificationsHref}
                className="relative grid h-10 w-10 place-items-center rounded-md text-text hover:bg-ink/5"
                aria-label={`${t("nav.notifications")}${unread ? ` (${unread})` : ""}`}
              >
                <Bell className="h-5 w-5" aria-hidden />
                {unread > 0 && (
                  <span className="absolute end-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-error px-1 text-[10px] font-semibold text-white ltr-nums">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <DM.Root dir={dir}>
                <DM.Trigger className="hidden h-10 items-center gap-2 rounded-md ps-1 pe-2 hover:bg-ink/5 md:inline-flex" aria-label={t("nav.account")}>
                  <Avatar fileId={user.avatarFileId} name={user.name} size={30} />
                  <span className="max-w-[9rem] truncate text-sm font-medium">{user.name}</span>
                  <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
                </DM.Trigger>
                <DM.Portal>
                  <DM.Content align="end" sideOffset={6} className="z-50 min-w-56 rounded-lg border border-border bg-surface p-1.5 shadow-overlay animate-fade-in">
                    {user.isClient && (
                      <MenuItem href="/client" icon={<LayoutDashboard className="h-4 w-4" />}>
                        {t("nav.clientSpace")}
                      </MenuItem>
                    )}
                    {user.isTech && (
                      <MenuItem href="/technicien" icon={<Wrench className="h-4 w-4" />}>
                        {t("nav.techSpace")}
                      </MenuItem>
                    )}
                    {user.isStaff && (
                      <MenuItem href="/admin" icon={<ShieldCheck className="h-4 w-4" />}>
                        {t("nav.adminSpace")}
                      </MenuItem>
                    )}
                    <DM.Separator className="my-1 h-px bg-border" />
                    <form action={logoutAction}>
                      <DM.Item asChild>
                        <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-error outline-none data-[highlighted]:bg-error-50">
                          <LogOut className="h-4 w-4" aria-hidden /> {t("nav.logout")}
                        </button>
                      </DM.Item>
                    </form>
                  </DM.Content>
                </DM.Portal>
              </DM.Root>
            </>
          ) : (
            <Link href="/connexion" className="hidden rounded-md px-3 py-2 text-sm font-medium text-text hover:bg-ink/5 md:inline-flex">
              {t("nav.login")}
            </Link>
          )}
          <ButtonLink href={user ? "/client/demandes/nouvelle" : "/inscription?next=/client/demandes/nouvelle"} size="sm" className="hidden md:inline-flex">
            {t("nav.requestService")}
          </ButtonLink>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-md hover:bg-ink/5 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? t("common.closeMenu") : t("common.menu")}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-border bg-surface animate-fade-in lg:hidden">
          <nav aria-label={t("nav.main")} className="container-page flex flex-col py-4">
            {links.map((l) => (
              <NavLink key={l.href} href={l.href} className="rounded-md px-3 py-3.5 text-base font-medium text-text hover:bg-bg" activeClassName="!text-primary bg-primary-50">
                {l.label}
              </NavLink>
            ))}
            <div className="my-3 h-px bg-border" />
            {user ? (
              <>
                {user.isClient && <MobileLink href="/client">{t("nav.clientSpace")}</MobileLink>}
                {user.isTech && <MobileLink href="/technicien">{t("nav.techSpace")}</MobileLink>}
                {user.isStaff && <MobileLink href="/admin">{t("nav.adminSpace")}</MobileLink>}
                <form action={logoutAction}>
                  <button type="submit" className="w-full rounded-md px-3 py-3.5 text-start text-base font-medium text-error hover:bg-error-50">
                    {t("nav.logout")}
                  </button>
                </form>
              </>
            ) : (
              <>
                <MobileLink href="/connexion">{t("nav.login")}</MobileLink>
                <MobileLink href="/inscription">{t("nav.register")}</MobileLink>
              </>
            )}
            <ButtonLink href={user ? "/client/demandes/nouvelle" : "/inscription?next=/client/demandes/nouvelle"} size="lg" className="mt-4">
              {t("nav.requestService")}
            </ButtonLink>
          </nav>
        </div>
      )}
    </header>
  );
}

function MenuItem({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <DM.Item asChild>
      <Link href={href} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm text-text outline-none data-[highlighted]:bg-bg">
        <span className="text-muted">{icon}</span>
        {children}
      </Link>
    </DM.Item>
  );
}

function MobileLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-md px-3 py-3.5 text-base font-medium text-text hover:bg-bg">
      {children}
    </Link>
  );
}
