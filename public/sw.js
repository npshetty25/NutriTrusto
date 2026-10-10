// Minimal service worker — not offline data sync. The pantry list lives in
// Supabase, so nothing useful can render without a connection.
//
// What it does instead of pretending: page navigations always go to the
// network, and when that fails the worker serves /offline.html, a static
// page that says plainly that the app is offline. It used to replay the last
// cached copy of the page, which then ran, found no network, and showed
// "Your pantry is empty" — a false statement about the user's data. Hashed
// build assets are cached hard so the offline page and any open tab keep
// working.
//
// Update policy: a new deploy must take effect on the NEXT load, not
// "whenever every tab of the site happens to be closed at once". The
// default lifecycle parks a new worker in "waiting" until that happens,
// which in practice means never — you keep one tab open, you keep
// seeing the old build, and the deploy looks like it failed. skipWaiting
// plus clients.claim plus the reload handler in layout.tsx removes that
// window entirely.
// Cache identity, and the reason this is not a hand-bumped constant.
//
// It was `"v3"`, and had been since the file was last touched. `activate`
// only deletes caches whose key differs from the CURRENT name, so a name that
// never changes means nothing is ever evicted: hashed chunks from every build
// since accumulated in one cache. On their own those are harmless, because
// fresh HTML asks for fresh URLs — but the document fetch below falls back to
// `caches.match(request)` when the network fails, and that returns the last
// cached HTML, whose chunk URLs were all still resident. One flaky request
// served a complete, internally consistent OLDER BUILD with no error shown.
// That is the most likely explanation for a provenance string that read stale
// while the code produced the correct one (see ASSUMPTIONS.md §10).
//
// A hand-bumped constant fails the same way the moment someone forgets, so
// the version comes from the build instead: layout.tsx registers this file as
// `/sw.js?v=<build id>`, and the id is read back off our own URL here.
// Deploy changes the id, the id changes the cache name, and `activate` then
// evicts every older cache — including the stranded `nutri-trust-shell-v3`.
const CACHE_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `nutri-trust-shell-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";
const SHELL_ASSETS = [OFFLINE_URL, "/logo.svg"];

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
  // Documents: network only. They are never stored, so a stale build cannot
  // be replayed from here (see the cache-identity note above); the one thing
  // served on failure is the offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then(
          (cached) =>
            cached ||
            new Response("You're offline. Reconnect and try again.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
        )
      )
    );
    return;
  }

  // Build output is content-hashed, so it can be cached hard; anything else
  // (manifest, icons, API routes) goes to the network first.
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
      // A failed icon or manifest request must fail, not receive an HTML page.
      .catch(() => caches.match(request).then((cached) => cached || Response.error()))
  );
});
