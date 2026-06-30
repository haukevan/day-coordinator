"use client";

import { useEffect, useRef } from "react";
import "@khmyznikov/pwa-install";
import type { PWAInstallElement } from "@khmyznikov/pwa-install";

/**
 * PWA Install Prompt — wraps the @khmyznikov/pwa-install web component.
 *
 * Handles the install prompt across all browsers (Chrome, Safari, Firefox,
 * iOS, Android) with a native-looking dialog. The component auto-detects
 * the platform and shows appropriate instructions.
 *
 * Renders nothing when:
 * - The app is already installed (standalone mode)
 * - The browser doesn't support PWA installation
 * - The user has dismissed the prompt (stored in localStorage)
 */
export function PwaInstall() {
  const ref = useRef<PWAInstallElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onSuccess = () => {
      console.log("[pwa] Install succeeded");
    };

    const onFail = () => {
      console.log("[pwa] Install failed or dismissed");
    };

    const onAvailable = () => {
      console.log("[pwa] Install prompt is available");
    };

    el.addEventListener("pwa-install-success-event", onSuccess);
    el.addEventListener("pwa-install-fail-event", onFail);
    el.addEventListener("pwa-install-available-event", onAvailable);

    return () => {
      el.removeEventListener("pwa-install-success-event", onSuccess);
      el.removeEventListener("pwa-install-fail-event", onFail);
      el.removeEventListener("pwa-install-available-event", onAvailable);
    };
  }, []);

  return (
    <pwa-install
      ref={ref}
      use-local-storage
      manifest-url="/manifest.webmanifest"
      name="Day Coordinator"
      description="Real-time event coordination for weddings and private events."
      icon="/logo.svg"
    />
  );
}
