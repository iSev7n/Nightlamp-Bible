/**
 * sw.js - safer install + GET-only runtime caching
 */

const CACHE_NAME = "nightlamp-v3"; // bump this when you deploy changes

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",

  "./css/theme.css",

  "./js/app.js",
  "./js/db.js",
  "./js/providers.js",
  "./js/ui.js",
  "./js/importKJV.js",

  "./assets/icon-192.png",
  "./assets/icon-512.png",

  "./data/EnglishKJBible.xml",
  "./data/EnglishESVBible.xml",
  "./data/EnglishNIVBible.xml",
  "./data/EnglishAmplifiedBible.xml",
  "./data/EnglishAmplifiedClassicBible.xml",
  "./data/SpanishNVIBible.xml",

  "./data/dive_crossrefs.json",
  "./data/dive_explain.json",
  "./data/dive_tags.json",
  
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Tolerant precache: try each file so 1 failure doesn't break install
    await Promise.allSettled(
      PRECACHE.map((url) => cache.add(url))
    );

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  // Only handle GET requests (prevents cache.put errors)
  if (event.request.method !== "GET") return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    try {
      const resp = await fetch(event.request);

      // Only cache successful basic/cors responses
      if (resp && resp.ok && (resp.type === "basic" || resp.type === "cors")) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, resp.clone());
      }

      return resp;
    } catch {
      return cached || new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});
