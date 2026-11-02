/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

// Take over immediately on update (matches the previous autoUpdate behaviour).
void self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST as never);

// SPA navigation fallback, except API calls.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }));

// Map tiles: cache so the last-viewed area still renders offline.
registerRoute(
  /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
  new CacheFirst({ cacheName: "osm-tiles", plugins: [new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 7 })] }),
);

// Last-known shelters/alerts for offline reference — always try network first.
registerRoute(
  /\/api\/(shelters|alerts)(\?.*)?$/i,
  new NetworkFirst({ cacheName: "resqflow-reference", networkTimeoutSeconds: 4, plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 })] }),
);

// Web Push (Stage B): the backend sends { title, body, url } via the push service.
self.addEventListener("push", (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {};
  try { payload = event.data?.json() ?? {}; } catch { payload = { title: "ResQFlow", body: event.data?.text() }; }
  const title = payload.title ?? "ResQFlow alert";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) { void client.focus(); void (client as WindowClient).navigate(url).catch(() => undefined); return; }
      }
      return self.clients.openWindow(url);
    }),
  );
});
