import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader, Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ContactForm } from "@/components/forms/contact-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.contactTitle") };
}

export default async function ContactPage() {
  const { t } = await getI18n();
  const [settings, user] = await Promise.all([getSettings(), getCurrentUser()]);
  const c = settings.support_contacts;
  const channels = [
    c.email && { icon: Mail, value: c.email, href: `mailto:${c.email}` },
    c.phone && { icon: Phone, value: c.phone, href: `tel:${c.phone.replace(/\s/g, "")}` },
    c.whatsapp && { icon: MessageCircle, value: c.whatsapp, href: `https://wa.me/${c.whatsapp.replace(/\D/g, "")}` },
    c.address && { icon: MapPin, value: c.address },
  ].filter(Boolean) as { icon: typeof Mail; value: string; href?: string }[];
  return (
    <div className="container-page py-8 md:py-12">
      <PageHeader title={t("pages.contactTitle")} description={t("pages.contactLead")} />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          {user && (
            <Notice className="mb-5">
              {t("pages.contactSupportTip")}{" "}
              <Link href="/client/support" className="font-semibold text-primary underline">
                {t("support.title")}
              </Link>
            </Notice>
          )}
          <ContactForm />
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold text-ink">{t("pages.contactChannels")}</h2>
          {channels.length ? (
            <ul className="mt-4 space-y-3">
              {channels.map((ch) => (
                <li key={ch.value} className="flex items-center gap-3 text-sm">
                  <ch.icon className="h-4 w-4 text-primary" aria-hidden />
                  {ch.href ? (
                    <a href={ch.href} className="ltr-nums text-text hover:text-primary">{ch.value}</a>
                  ) : (
                    <span className="text-text">{ch.value}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{t("pages.contactNoChannels")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
