import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export async function getOrCreateUser(supabaseUser: SupabaseUser) {
  return prisma.user.upsert({
    where: { supabaseId: supabaseUser.id },
    update: {
      email: supabaseUser.email ?? "",
    },
    create: {
      supabaseId: supabaseUser.id,
      email: supabaseUser.email ?? "",
      name: supabaseUser.user_metadata?.name ?? null,
      avatar: supabaseUser.user_metadata?.avatar_url ?? null,
    },
    select: {
      id: true,
      onboarded: true,
    },
  });
}

/**
 * Cached user lookup by Supabase ID.
 * Wrapped in React.cache() so multiple calls within the same request
 * (e.g. layout + page) reuse the same DB query result.
 */
export const getDbUser = cache(async (supabaseId: string) => {
  return prisma.user.findUnique({
    where: { supabaseId },
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      onboarded: true,
    },
  });
});
