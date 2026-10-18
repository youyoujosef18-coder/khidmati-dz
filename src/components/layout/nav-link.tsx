"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  className,
  activeClassName = "text-primary",
  exact,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)} onClick={onClick}>
      {children}
    </Link>
  );
}
