import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LegalPage } from "@/components/layout/legal-page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pages.termsTitle") };
}
export default function TermsPage() {
  return <LegalPage ns="terms" titleKey="pages.termsTitle" sections={9} />;
}
