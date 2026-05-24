import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const sendSchema = z.object({
  action: z.literal("send"),
  phone: z.string().min(10),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  phone: z.string().min(10),
  token: z.string().length(6),
});

const schema = z.discriminatedUnion("action", [sendSchema, verifySchema]);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.action === "send") {
    const { phone } = parsed.data;

    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  // verify
  const { phone, token } = parsed.data;

  const { error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
