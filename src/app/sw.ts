import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// ─── Push Notification Handler ───────────────────────────────────────────────
// Receives Web Push messages from the server (wired in Phase 1).
// Payload format: { title: string, body?: string, icon?: string, data?: { url?: string } }
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title ?? "Day Coordinator";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: data.icon ?? "/logo.svg",
    badge: "/logo.svg",
    tag: data.tag,
    data: data.data ?? {},
    requireInteraction: data.requireInteraction ?? false,
    silent: data.silent ?? false,
  };

  event.waitUntil(
    (async () => {
      // Show the system notification
      await self.registration.showNotification(title, options);

      // Notify all open clients so the in-app bell updates immediately
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: "NOTIFICATION_RECEIVED" });
      }
    })(),
  );
});

// ─── Notification Click Handler ──────────────────────────────────────────────
// When the user taps a notification, open (or focus) the app at the relevant page.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
