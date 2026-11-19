import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDbUser } from "@/lib/db/user";

/**
 * Cached Supabase auth lookup for the current request.
 * Layouts and pages often both need the user — this avoids duplicate
 * round-trips to the Auth server. getClaims() verifies locally when the
 * project uses asymmetric signing keys.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" && sub.length > 0 ? { id: sub } : null;
});

/**
 * Cached database user for the current request.
 * Returns null when the user is not signed in or has no DB row yet.
 */
export const getCurrentDbUser = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  return getDbUser(user.id);
});
