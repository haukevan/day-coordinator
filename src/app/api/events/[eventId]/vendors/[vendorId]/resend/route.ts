import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db/prisma";
import { nanoid } from "nanoid";
import { sendVendorInviteEmail, sendVendorEventLink } from "@/lib/notifications/vendor-invite";

type Params = { params: Promise<{ eventId: string; vendorId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { eventId, vendorId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const event = await prisma.event.findFirst({ where: { id: eventId, ownerId: dbUser.id } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const eventVendor = await prisma.eventVendor.findFirst({ where: { id: vendorId, eventId } });
  if (!eventVendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  if (eventVendor.status === "ACCEPTED") {
    // Send plain event link to accepted vendor
    try { await sendVendorEventLink(eventVendor.id); } catch { /* non-fatal */ }
    return NextResponse.json({ ok: true });
  }

  // Regenerate token for PENDING vendors (invalidates old link)
  const newToken = nanoid(32);
  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.eventVendor.update({
    where: { id: vendorId },
    data: {
      inviteToken: newToken,
      inviteTokenExpiresAt: newExpiry,
      inviteSentAt: null, // reset so sendVendorInviteEmail will send
    },
  });

  try { await sendVendorInviteEmail(eventVendor.id); } catch { /* non-fatal */ }

  return NextResponse.json({ ok: true });
}
