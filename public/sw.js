// Minimal app-shell service worker — not full offline data sync (the
// pantry list itself needs Supabase, so it won't load fresh while
// offline). This only makes sure the app shell renders instead of the
// browser's default "no internet" page when there's no connection.
//
// Update policy: a new deploy must take effect on the NEXT load, not
// "whenever every tab of the site happens to be closed at once". The
// default lifecycle parks a new worker in "waiting" until that happens,
// which in practice means never — you keep one tab open, you keep
// seeing the old build, and the deploy looks like it failed. skipWaiting
// plus clients.claim plus the reload handler in layout.tsx removes that
// window entirely.
const CACHE_VERSION = "v3";
const CACHE_NAME = `nutri-trust-shell-${CACHE_VERSION}`;
const SHELL_ASSETS = ["/", "/logo.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // A single missing asset rejects the whole addAll and aborts the
      // install, which would leave the old worker in charge forever.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      // Take over already-open tabs instead of waiting for a navigation.
      .then(() => self.clients.claim())
  );
});

// Lets the page ask an updated worker to activate at once (see layout.tsx).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Never touch other origins (Supabase, Open Food Facts, fonts) — caching
  // an opaque cross-origin response here would only bloat storage and can
  // serve a stale API reply that looks like fresh data.
  if (url.origin !== self.location.origin) return;
  // Build output is content-hashed, so it can be cached hard; anything else
  // (HTML, API routes) goes to the network first.
  const isHashedAsset = url.pathname.startsWith("/_next/static/");

  if (isHashedAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache real, complete responses. Storing a 404 or a redirect
        // would make the offline fallback replay the error page.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
