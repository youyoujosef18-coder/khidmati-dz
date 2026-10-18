import { LogoMark } from "./logo";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="container-page grid place-items-center py-10 md:py-16">
      <div className="w-full max-w-md">
        <div className="card p-6 md:p-8">
          <LogoMark size={40} />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  );
}
