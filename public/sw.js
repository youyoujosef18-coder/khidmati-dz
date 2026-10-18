/* Khidmati service worker — minimal and privacy-safe.
 * - Caches only public static assets and the offline page.
 * - Never caches API responses, private dashboards, documents or conversations.
 * - Never replays mutations: offline submissions are refused by the UI.
 */
const VERSION = "kh-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/hors-ligne";
const PRIVATE_PREFIXES = ["/api/", "/client", "/technicien", "/admin", "/connexion", "/inscription", "/bienvenue"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png", "/manifest.webmanifest"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (PRIVATE_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    if (req.mode === "navigate") {
      event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    }
    return;
  }
  // Immutable build assets: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }
  // Public pages: network-first, offline fallback (no caching of HTML that may carry session data)
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
