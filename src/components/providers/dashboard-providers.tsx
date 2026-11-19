"use client";

import type { ReactNode } from "react";
import { NotificationToastListener } from "@/components/ui/notification-toast";

/**
 * Client wrapper for the dashboard layout that mounts the real-time
 * notification listener. The ToastProvider lives in the root layout so
 * auth/onboarding pages can show toasts too.
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <>
      <NotificationToastListener />
      {children}
    </>
  );
}
