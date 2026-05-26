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
