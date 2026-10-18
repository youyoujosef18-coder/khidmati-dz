import { NextResponse } from "next/server";

/**
 * Digital Asset Links for the Khidmati Android app (Android App Links verification).
 * Configure ANDROID_CERT_SHA256 with the SHA-256 fingerprint(s) of the signing certificate
 * (comma-separated, "AA:BB:…" format, as printed by the GitHub Actions build or Play Console).
 * Without it, an empty list is returned: links simply open in the browser.
 */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

export function GET() {
  const packageName = process.env.ANDROID_APP_PACKAGE?.trim() || "dz.khidmati.app";
  const fingerprints = (process.env.ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => FINGERPRINT.test(f));

  const body = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
        },
      ]
    : [];
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
