import { SiteHeader } from "./site-header";
import { NavLink } from "./nav-link";

export interface ShellItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  exact?: boolean;
}

export function DashboardShell({ title, items, children }: { title: string; items: ShellItem[]; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="container-page flex flex-1 gap-8 py-6 md:py-8">
        <aside className="hidden w-60 shrink-0 lg:block no-print">
          <nav aria-label={title} className="sticky top-20">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
            <ul className="space-y-0.5">
              {items.map((i) => (
                <li key={i.href}>
                  <NavLink
                    href={i.href}
                    exact={i.exact}
                    className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-ink/5 hover:text-ink"
                    activeClassName="!bg-primary-50 !text-primary"
                  >
                    <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{i.icon}</span>
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.badge ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white ltr-nums">{i.badge}</span> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <nav aria-label={title} className="-mx-4 mb-5 overflow-x-auto border-b border-border px-4 lg:hidden no-print">
            <ul className="flex gap-1 pb-px">
              {items.map((i) => (
                <li key={i.href}>
                  <NavLink
                    href={i.href}
                    exact={i.exact}
                    className="-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 text-sm font-medium text-muted"
                    activeClassName="!border-primary !text-primary"
                  >
                    {i.label}
                    {i.badge ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white ltr-nums">{i.badge}</span> : null}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <main id="main">{children}</main>
        </div>
      </div>
    </>
  );
}
