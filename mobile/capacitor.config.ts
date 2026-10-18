import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The Android app is a native shell around the production Khidmati platform:
 * all data, authentication and business rules stay on the server (one backend,
 * no duplicated logic). Set KHIDMATI_APP_URL to the deployed web app before
 * `npx cap sync android` (the GitHub Actions workflow does this).
 */
const raw = process.env.KHIDMATI_APP_URL ?? "https://khidmati-dz-youyoujosef18-7672s-projects.vercel.app";
const appUrl = new URL(raw);
if (appUrl.protocol !== "https:") {
  throw new Error(`KHIDMATI_APP_URL must use https (got ${raw})`);
}

const config: CapacitorConfig = {
  appId: "dz.khidmati.app",
  appName: "Khidmati",
  webDir: "www",
  backgroundColor: "#FFFFFF",
  // Capacitor logs only in debug builds (used by the emulator smoke test); release builds stay silent.
  loggingBehavior: "debug",
  server: {
    url: appUrl.origin,
    // Only the Khidmati domain is opened inside the app; every other link opens externally.
    allowNavigation: [appUrl.host],
    // Local page shown when the server cannot be reached (offline, DNS failure…).
    errorPath: "offline.html",
    cleartext: false,
  },
  android: {
    appendUserAgent: "KhidmatiAndroid/1.0",
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
    // Older WebViews lack DOCUMENT_START_SCRIPT and would fall back to Capacitor's HTML proxy,
    // which drops server headers/status codes; they get the update notice in offline.html instead.
    minWebViewVersion: 90,
  },
  plugins: {
    SystemBars: {
      // White status/navigation bar area with dark icons, matching the app header.
      style: "LIGHT",
      // Native padding keeps content clear of the system bars; no CSS variables are needed.
      insetsHandling: "native",
    },
  },
};

export default config;
