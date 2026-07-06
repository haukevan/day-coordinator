import { NextRequest, NextResponse } from "next/server";
import { sendSms } from "@/lib/notifications/sms";
import { z } from "zod";

const testSchema = z.object({
  to: z
    .string()
    .regex(/^\+1\d{10}$/, "Phone must be E.164 format (+1XXXXXXXXXX)"),
  body: z.string().min(1, "Body is required").max(1600),
});

/**
 * GET /api/cron/test-sms
 * Debug endpoint for testing SMS dispatch.
 * Protected by CRON_SECRET — server-to-server only.
 *
 * Usage:
 *   curl -X POST https://daycoordinator.com/api/cron/test-sms \
 *     -H "Authorization: Bearer $CRON_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"to":"+15551234567","body":"Test from Day Coordinator"}'
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 },
    );
  }

  try {
    const result = await sendSms(parsed.data.to, parsed.data.body);
    return NextResponse.json({ ok: true, sid: result.sid });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "SMS dispatch failed",
      },
      { status: 500 },
    );
  }
}
