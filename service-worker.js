// This one-time worker replaces and removes any cache worker from an older site.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    await self.registration.unregister();
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: "window" });
    windows.forEach((client) => client.navigate(client.url));
  })());
});
