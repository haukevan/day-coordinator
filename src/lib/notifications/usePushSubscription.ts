"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * Convert a base64url string to a Uint8Array.
 * Used to convert the VAPID public key for the PushManager API.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

/**
 * Hook for managing browser push notification subscriptions.
 *
 * Provides `subscribe()` and `unsubscribe()` functions that handle
 * the browser Push API and persist the subscription to the server.
 *
 * Note: The browser will show a native permission prompt on first
 * subscribe. This should be triggered from a user gesture (button click).
 *
 * Usage:
 * ```ts
 * const { subscribe, unsubscribe, isSubscribed, isLoading, error } = usePushSubscription();
 * ```
 */
export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Check current subscription state on mount
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setIsSubscribed(!!subscription);
      })
      .catch(() => {
        // Silently fail — push may not be supported
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!publicKey) {
      setError("VAPID public key is not configured.");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Push notifications are not supported in this browser.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check for existing subscription first
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey,
        });
      }

      // Persist to server
      const response = await fetch("/api/user/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error ?? `Failed to save subscription (${response.status})`,
        );
      }

      setIsSubscribed(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to subscribe to push notifications";
      setError(message);
      console.error("[push] subscribe failed:", message);
    } finally {
      setIsLoading(false);
    }
  }, [publicKey]);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subscriptionJson = subscription.toJSON();
        await subscription.unsubscribe();

        // Remove from server
        const response = await fetch("/api/user/push-subscription", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscriptionJson.endpoint }),
        });

        if (!response.ok) {
          console.error(
            "[push] Failed to delete subscription on server:",
            response.status,
          );
        }
      }

      setIsSubscribed(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to unsubscribe from push notifications";
      setError(message);
      console.error("[push] unsubscribe failed:", message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { subscribe, unsubscribe, isSubscribed, isLoading, error };
}
