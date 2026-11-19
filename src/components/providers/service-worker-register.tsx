"use client";

import { useEffect } from "react";

/**
 * Registers the Serwist service worker on mount.
 *
 * Without this, the browser has no active service worker, so:
 * - pushManager.subscribe() fails with "push service error"
 * - PWA offline caching doesn't work
 * - The app isn't installable
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log(
          "[sw] Registered:",
          registration.scope,
          "| active:",
          registration.active?.state ?? "none",
        );
      })
      .catch((err) => {
        console.error("[sw] Registration failed:", err);
      });
  }, []);

  return null;
}
