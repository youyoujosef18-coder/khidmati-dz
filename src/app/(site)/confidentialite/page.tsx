import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LegalPage } from "@/components/layout/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.privacyTitle") };
}
export default function PrivacyPage() {
  return <LegalPage ns="privacy" titleKey="pages.privacyTitle" sections={7} />;
}
