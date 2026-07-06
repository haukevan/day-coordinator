"use client";

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { NotificationToastListener } from "@/components/ui/notification-toast";

/**
 * Client wrapper for dashboard layout that provides:
 * - Toast notifications (ToastProvider)
 * - Real-time notification listener (NotificationToastListener)
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <NotificationToastListener />
      {children}
    </ToastProvider>
  );
}
