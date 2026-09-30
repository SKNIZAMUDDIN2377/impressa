// Minimal service worker: lets browsers treat Impressa as an installable app.
// It does NOT cache anything, so login, feeds and posts are always up to date.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener("fetch", () => {});