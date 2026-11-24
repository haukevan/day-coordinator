"use client";

import type { ReactNode } from "react";
import { NotificationToastListener } from "@/components/ui/notification-toast";
import { useDashboardQuery } from "@/lib/query/hooks";

/**
 * Client wrapper for the dashboard layout that mounts the real-time
 * notification listener. The ToastProvider lives in the root layout so
 * auth/onboarding pages can show toasts too.
 *
 * The shared events query is mounted here (not just on the dashboard page) so
 * the list stays warm and active across every authenticated route. Returning
 * to the dashboard therefore renders from cache instantly — even after a
 * reload on the timeline — and task-count invalidations can refresh while the
 * user is still on the timeline.
 */
export function DashboardProviders({ children }: { children: ReactNode }) {
  useDashboardQuery();

  return (
    <>
      <NotificationToastListener />
      {children}
    </>
  );
}
