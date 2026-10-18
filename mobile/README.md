# Khidmati — Android app

The native Android app for Khidmati DZ (package `dz.khidmati.app`, min. Android 7.0 / API 24, target API 36).

**How it works.** The app is a native Android shell (Capacitor 8) around the production Khidmati platform. The server keeps the database, authentication, permissions, booking workflows, verification and administration. Every feature of the platform is therefore available in the app, for clients, technicians and staff alike, and one change on the server reaches both the app and the website with no app update needed.

**What the app adds natively**

| Feature | Implementation |
|---|---|
| App icon (adaptive), splash screen, white system bars with dark icons | `res/`, `styles.xml`, `capacitor.config.ts` |
| Android **back button** goes back in the app before leaving it | `MainActivity` (OnBackPressedCallback) |
| **Downloads** (CSV exports, personal data export) with the signed-in session | `MainActivity` → `DownloadManager` (Downloads folder) |
| **Printing** receipts with the Android print service (PDF or printer) | `khidmati://print` handled in `MainActivity` |
| **Camera** for request photos, documents and chat attachments ("Prendre une photo") | web `capture` input + `CAMERA` permission, asked at first use |
| "Use my location" when saving an address | WebView geolocation + location permission, asked at first use |
| **Offline screen** (FR/AR) with retry and automatic reconnection | `www/offline.html`; only network failures show it, server pages such as 404 are displayed as-is |
| **App Links**: `https://<site>/…` opens in the app | intent filter + `/.well-known/assetlinks.json` on the site |
| Session kept between launches, never backed up to the cloud | cookie flush on pause, `allowBackup=false` |

**Not included (needs credentials or services that don't exist yet)**
- Push notifications need a Firebase project (`google-services.json`) and a server-side push sender. Notifications stay in-app, as on the website.
- Online payment: the platform is cash-only.

## Configuration

| Setting | Where | Purpose |
|---|---|---|
| `KHIDMATI_APP_URL` | GitHub → Settings → Secrets and variables → Actions → **Variables** | https URL of the deployed web app. Defaults to `https://khidmati-dz.vercel.app`. |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | GitHub → Actions **Secrets** | Release signing (Google Play). Optional: without them only the debug APK is built. |
| `ANDROID_CERT_SHA256` | Vercel environment variables (web app) | Release certificate fingerprint printed by the build, for App Links verification. |

### Creating the release keystore (once, keep it safe)

Losing the keystore means you can never update the app on Google Play again. Keep a backup of the file and its passwords.

```bash
keytool -genkeypair -v -keystore khidmati-release.jks -alias khidmati -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 khidmati-release.jks   # paste the output into the ANDROID_KEYSTORE_BASE64 secret
```

## Builds

`.github/workflows/android.yml` runs on every push that touches `mobile/`, or manually from the Actions tab ("Run workflow").

- **Build job:** `npm ci` → `npm run sync` → `./gradlew assembleDebug` (plus `assembleRelease bundleRelease` when signing is configured). Artifacts: `khidmati-debug-apk`, `khidmati-release`.
- **Smoke test job** on an Android 14 emulator:
  - installs the APK, cold-starts it, and checks it doesn't crash;
  - checks the Khidmati home page renders, but only when the server's `/api/health` is OK (otherwise reported as SKIP);
  - checks the offline page appears with the network off, and that the back button works;
  - takes screenshots and saves logcat (artifact `smoke-test-results`).

Local build (Android Studio + JDK 21):

```bash
cd mobile
npm ci
KHIDMATI_APP_URL=https://your-domain npm run sync
npx cap open android      # or: cd android && ./gradlew assembleDebug
```

## Installing the test APK on a phone

1. Download the `khidmati-debug-apk` artifact from the workflow run and unzip it.
2. Send `app-debug.apk` to the phone and open it. Android asks you to allow installing from that source once.
3. A debug build is signed with a temporary key. Uninstall it before installing a Play Store or release build.
