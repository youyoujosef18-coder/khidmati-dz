import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { LogoMark } from "./logo";
import { LanguageSwitcher } from "./language-switcher";

export async function SiteFooter() {
  const { t } = await getI18n();
  const settings = await getSettings().catch(() => null);
  const social = settings?.social_links;
  const contacts = settings?.support_contacts;
  const socialLinks = social
    ? (Object.entries(social) as [string, string][]).filter(([, url]) => /^https:\/\//.test(url))
    : [];
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-surface no-print">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-lg font-bold text-ink">{t("common.appName")}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{t("footer.pitch")}</p>
          <p className="mt-3 text-xs text-muted">{t("footer.cashNotice")}</p>
          <LanguageSwitcher className="mt-4 -ms-2.5" />
        </div>
        <FooterCol title={t("footer.platform")}>
          <FooterLink href="/services">{t("nav.services")}</FooterLink>
          <FooterLink href="/techniciens">{t("nav.findPro")}</FooterLink>
          <FooterLink href="/comment-ca-marche">{t("nav.howItWorks")}</FooterLink>
          <FooterLink href="/devenir-technicien">{t("nav.becomeTech")}</FooterLink>
        </FooterCol>
        <FooterCol title={t("footer.support")}>
          <FooterLink href="/faq">{t("footer.faq")}</FooterLink>
          <FooterLink href="/contact">{t("footer.contact")}</FooterLink>
          <FooterLink href="/a-propos">{t("footer.about")}</FooterLink>
          {contacts?.email && <li className="text-sm text-muted ltr-nums">{contacts.email}</li>}
          {contacts?.phone && <li className="text-sm text-muted ltr-nums">{contacts.phone}</li>}
        </FooterCol>
        <FooterCol title={t("footer.legal")}>
          <FooterLink href="/confidentialite">{t("footer.privacy")}</FooterLink>
          <FooterLink href="/conditions">{t("footer.terms")}</FooterLink>
          {socialLinks.length > 0 && (
            <li className="pt-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{t("footer.followUs")}</p>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map(([name, url]) => (
                  <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="text-sm capitalize text-text hover:text-primary">
                    {name}
                  </a>
                ))}
              </div>
            </li>
          )}
        </FooterCol>
      </div>
      <div className="border-t border-border">
        <div className="container-page py-5 text-xs text-muted">{t("footer.rights", { year })}</div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <ul className="mt-3 space-y-2.5">{children}</ul>
    </div>
  );
}
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-muted transition-colors hover:text-primary">
        {children}
      </Link>
    </li>
  );
}
