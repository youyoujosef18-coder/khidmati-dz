import { forwardRef } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px select-none";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white shadow-sm hover:bg-primary-hover",
  secondary: "bg-ink text-white hover:bg-ink/90",
  accent: "bg-accent text-ink hover:brightness-95",
  outline: "border border-border-strong bg-surface text-text hover:bg-bg hover:border-muted/40",
  ghost: "text-text hover:bg-ink/5",
  danger: "bg-error text-white hover:bg-error/90",
  link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
};
const sizes: Record<Size, string> = {
  sm: "h-9 rounded-md px-3 text-sm",
  md: "h-11 rounded-md px-4 text-[0.95rem]",
  lg: "h-12 rounded-lg px-6 text-base",
  icon: "h-11 w-11 rounded-md",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], variant !== "link" && sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  prefetch,
  ...rest
}: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode; prefetch?: boolean } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  return (
    <Link href={href} prefetch={prefetch} className={cn(base, variants[variant], variant !== "link" && sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}
