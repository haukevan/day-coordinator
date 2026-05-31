import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateUser } from "@/lib/db/user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  const supabase = await createSupabaseServerClient();

  // Check if session already exists (set by Supabase's magic link verify endpoint)
  // This handles magic link sign-ins that may not include a code parameter
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    // Session already established (magic link verified successfully)
    const dbUser = await getOrCreateUser(session.user);
    const isInviteFlow = next.startsWith("/invite/");
    const destination = dbUser.onboarded || isInviteFlow ? next : "/onboarding";
    return NextResponse.redirect(`${origin}${destination}`);
  }

  // If no existing session, try to exchange code (OAuth/PKCE flows)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const dbUser = await getOrCreateUser(data.user);
      const isInviteFlow = next.startsWith("/invite/");
      const destination =
        dbUser.onboarded || isInviteFlow ? next : "/onboarding";
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
