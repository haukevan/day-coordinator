"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "@/lib/query/client";

/**
 * Session-scoped React Query provider. Mounted in the root layout so sign-out
 * and profile edits can reach the same cache from anywhere in the app.
 */
export function QueryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [client] = useState(createQueryClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
