/**
 * sw.js
 * -----------------------------------------------------------------------------
 * Service Worker for Nightlamp Bible
 * - Precaches app shell
 * - Precaches all Bible XML files so first-time import can work offline (after first load)
 * -----------------------------------------------------------------------------
 */

const CACHE_NAME = "nightlamp-vscode-v2";

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
  "./data/SpanishNVIBible.xml"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, resp.clone());
          return resp;
        });
      }).catch(() => cached);
    })
  );
});
