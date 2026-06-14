import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getOrCreateUser } from "@/lib/db/user";
import { NextRequest, NextResponse } from "next/server";
import { getPkceCookies } from "@/lib/auth/pkce-store";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const state = searchParams.get("state");

  // Default: read cookies from the incoming request
  const getAllCookies = async () => {
    const cookieStore = await cookies();
    return cookieStore.getAll();
  };

  // If server-side PKCE cookies were stored for this state, merge them in.
  // This fixes mobile magic links opening in in-app browsers with a separate
  // cookie jar from the main browser, where the PKCE verifier cookie is missing.
  let storedCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> | null = null;
  if (state) {
    storedCookies = getPkceCookies(state);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const requestCookies = await getAllCookies();
          if (!storedCookies || storedCookies.length === 0)
            return requestCookies;

          // Merge stored PKCE cookies with request cookies.
          // Stored cookies take precedence for matching names (they contain the PKCE verifier).
          const merged = new Map<string, { name: string; value: string }>();
          for (const c of requestCookies) {
            merged.set(c.name, c);
          }
          for (const c of storedCookies) {
            merged.set(c.name, c);
          }
          return Array.from(merged.values());
        },
        async setAll(cookiesToSet) {
          const cookieStore = await cookies();
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignore: setAll may be called in read-only context
          }
        },
      },
    },
  );

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
    // Log the error to help debug, but don't leak details to the client
    if (error) {
      console.error(
        "[auth/callback] exchangeCodeForSession failed:",
        error.message,
      );
    }
  }

  // If all auth attempts fail, redirect to login with a generic error.
  // Use a generic parameter (not the detailed error) to avoid leaking info.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
