import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className={className}>
      <rect width="48" height="48" rx="12" fill="#146B52" />
      <path d="M12 23.5 24 13l12 10.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 21.5V34a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V21.5" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinejoin="round" />
      <path d="m19.5 27.5 3.2 3.2 6-6" fill="none" stroke="#F4B544" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ label, className, href = "/" }: { label: string; className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-md", className)} aria-label={label}>
      <LogoMark />
      <span className="text-lg font-bold tracking-tight text-ink">
        {label}
        <span className="text-primary">.</span>
      </span>
    </Link>
  );
}
