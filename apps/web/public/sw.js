/**
 * Service worker (PLAN/06 §5).
 *
 * This file is the reason the rewrite exists at all. B-08: a service worker
 * cannot be registered from inside the Apps Script sandbox iframe, which made
 * offline capability impossible no matter how much effort was spent — while the
 * core work of this system happens in garages and vehicle pools with poor
 * signal.
 *
 * Written by hand rather than generated. It is privileged code that can serve a
 * stale application to every user, so it stays short enough to read in full.
 *
 * Three rules bind it (PLAN/06 §5):
 *   1. Session tokens never enter the Cache API or IndexedDB. The httpOnly
 *      cookie holds them, and JavaScript cannot touch it — that is the point.
 *   2. Caches are namespaced per user and cleared on logout. A shared device in
 *      a pool is a real scenario, not a hypothetical.
 *   3. This file is only ever updated through the deploy pipeline.
 */

const VERSION = "v1";
const SHELL_CACHE = `c26-shell-${VERSION}`;
const DATA_CACHE = `c26-data-${VERSION}`;

/** Precached so the application starts with no network at all. */
const SHELL_ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("c26-") && !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/**
 * Rule 2: logout wipes every cache belonging to this device.
 *
 * The application posts this message during logout, alongside clearing its own
 * state — D-17 found the legacy tab state surviving a logout and a fresh login,
 * which meant the session boundary was not being honoured at all.
 */
self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith("c26-")).map((key) => caches.delete(key))),
      ),
    );
  }
});

function isMasterData(url) {
  return url.pathname === "/api/masterdata";
}

function isAuthEndpoint(url) {
  return url.pathname.startsWith("/api/auth");
}

function isPhoto(url) {
  return url.pathname.startsWith("/api/uploads/") || /\.(webp|jpe?g|png)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cached, no exceptions. A cached authentication response is a session
  // that outlives its own revocation.
  if (isAuthEndpoint(url)) return;

  /**
   * Photos are never cached (PLAN/06 §5). Two reasons: their size fills the
   * quota fast, and they are customer fleet data that has no business surviving
   * on a device after the job is done.
   */
  if (isPhoto(url)) return;

  // Master data changes rarely and every form needs it, so it is served from
  // cache immediately and refreshed in the background.
  if (isMasterData(url)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
    return;
  }

  // Other API reads: network first, cache as the fallback. A stale inspection
  // list beats an error page when the signal drops mid-shift.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached !== undefined) return cached;
          // An honest offline answer in the same envelope shape the client
          // already knows how to render (PLAN/05 §2).
          return new Response(
            JSON.stringify({
              ok: false,
              code: "SERVICE_UNAVAILABLE",
              message: "Anda sedang offline. Data ini belum tersedia di perangkat.",
              requestId: "offline",
            }),
            { status: 503, headers: { "content-type": "application/json" } },
          );
        }),
    );
    return;
  }

  // Application shell: cache first, revalidate in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? caches.match("/index.html"));

      return cached ?? network;
    }),
  );
});
