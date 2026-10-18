import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/inter";
import "@fontsource/noto-sans-arabic/400.css";
import "@fontsource/noto-sans-arabic/500.css";
import "@fontsource/noto-sans-arabic/600.css";
import "@fontsource/noto-sans-arabic/700.css";
import "./globals.css";
import { getI18n, getDictionary } from "@/lib/i18n/server";
import { LOCALE_META } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import { ToastProvider } from "@/components/ui/toast";
import { ConfirmProvider } from "@/components/ui/confirm";
import { OfflineBanner, ServiceWorkerRegister } from "@/components/layout/offline-banner";
import { getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/permissions";
import { MaintenanceScreen } from "@/components/layout/maintenance";
import { after } from "next/server";
import { maybeRunMaintenance } from "@/lib/maintenance";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    metadataBase: new URL(appUrl),
    title: { default: t("meta.title"), template: `%s · ${t("common.appName")}` },
    description: t("meta.description"),
    applicationName: "Khidmati",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
      apple: "/icons/apple-touch-icon.png",
    },
    openGraph: { title: t("meta.title"), description: t("meta.description"), type: "website", siteName: "Khidmati" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#146B52",
  width: "device-width",
  initialScale: 1,
  // No viewport-fit=cover: the UI has no safe-area padding, so the system keeps content clear of
  // notches and system bars (installed PWA on iOS, Android app).
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  const meta = LOCALE_META[locale];
  after(() => maybeRunMaintenance().catch((e) => console.error("[maintenance]", (e as Error).message)));
  const path = (await headers()).get("x-pathname") ?? "/";
  const settings = await getSettings().catch(() => null);
  let maintenance = false;
  if (settings?.maintenance_mode && !path.startsWith("/connexion") && !path.startsWith("/admin") && !path.startsWith("/api")) {
    const user = await getCurrentUser().catch(() => null);
    maintenance = !user || !isStaff(user.roles);
  }
  return (
    <html lang={meta.htmlLang} dir={meta.dir} className="h-full">
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} dictionary={getDictionary(locale)}>
          <ToastProvider>
            <ConfirmProvider>
              <OfflineBanner />
              {maintenance ? <MaintenanceScreen /> : children}
              <ServiceWorkerRegister />
            </ConfirmProvider>
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
