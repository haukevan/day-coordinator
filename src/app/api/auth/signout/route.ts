import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  const origin = request.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL!;
  return NextResponse.redirect(`${origin}/login`);
}
