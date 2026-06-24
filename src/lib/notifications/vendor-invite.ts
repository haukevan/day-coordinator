import { prisma } from "@/lib/db/prisma";
import { getResendClient, FROM_EMAIL } from "@/lib/resend";
import type {
  EventVendor,
  VendorContact,
  Event,
} from "@/generated/prisma/client";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Pre-fetched EventVendor shape used by the batch send path. */
type PreFetchedVendor = EventVendor & {
  vendorContact: VendorContact;
  event: Pick<Event, "title" | "eventDate">;
};

/**
 * Send invite emails for a batch of pre-fetched PENDING EventVendors.
 * Avoids N+1 DB queries by accepting already-loaded vendor data.
 *
 * Idempotent — skips any vendor where inviteSentAt is already set
 * or inviteToken is missing.
 */
export async function sendVendorInviteEmailBatch(
  vendors: PreFetchedVendor[],
): Promise<void> {
  const resend = getResendClient();
  const now = new Date();
  const toSend: PreFetchedVendor[] = [];

  // Filter to vendors that actually need an invite sent
  for (const ev of vendors) {
    if (!ev.inviteToken || ev.inviteSentAt) continue;
    toSend.push(ev);
  }

  if (toSend.length === 0) return;

  // Send all emails (fire-and-forget within the batch, but await all)
  const results = await Promise.allSettled(
    toSend.map(async (ev) => {
      const inviteUrl = `${APP_URL}/login?next=${encodeURIComponent(`/invite/${ev.inviteToken}`)}`;
      const recipientName =
        [ev.vendorContact.firstName, ev.vendorContact.lastName]
          .filter(Boolean)
          .join(" ") || ev.vendorContact.email;

      await resend.emails.send({
        from: FROM_EMAIL,
        to: ev.vendorContact.email,
        subject: `You've been invited to ${ev.event.title}`,
        html: buildInviteHtml({
          recipientName,
          eventTitle: ev.event.title,
          inviteUrl,
        }),
      });
    }),
  );

  // Log failures but continue to mark sent timestamps
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(
        "[vendor-invite] Failed to send invite for eventVendor",
        toSend[i].id,
        r.reason,
      );
    }
  });

  // Batch update inviteSentAt and create activity logs
  const succeededIds = toSend
    .filter((_, i) => results[i].status === "fulfilled")
    .map((ev) => ev.id);

  if (succeededIds.length > 0) {
    await prisma.$transaction([
      prisma.eventVendor.updateMany({
        where: { id: { in: succeededIds } },
        data: { inviteSentAt: now },
      }),
      prisma.activityLog.createMany({
        data: succeededIds.map((id) => {
          const ev = toSend.find((v) => v.id === id)!;
          return {
            eventId: ev.eventId,
            action: "vendor.invite_sent",
            metadata: { eventVendorId: id, email: ev.vendorContact.email },
          };
        }),
      }),
    ]);
  }
}

/**
 * Send a vendor invite email for a PENDING EventVendor.
 * Idempotent — checks inviteSentAt before sending.
 */
export async function sendVendorInviteEmail(
  eventVendorId: string,
): Promise<void> {
  const ev = await prisma.eventVendor.findUnique({
    where: { id: eventVendorId },
    include: {
      vendorContact: true,
      event: { select: { title: true, eventDate: true } },
    },
  });

  if (!ev || !ev.inviteToken) return;
  // Idempotency guard
  if (ev.inviteSentAt) return;

  const inviteUrl = `${APP_URL}/login?next=${encodeURIComponent(`/invite/${ev.inviteToken}`)}`;
  const recipientName =
    [ev.vendorContact.firstName, ev.vendorContact.lastName]
      .filter(Boolean)
      .join(" ") || ev.vendorContact.email;

  const html = buildInviteHtml({
    recipientName,
    eventTitle: ev.event.title,
    inviteUrl,
  });

  const resend = getResendClient();

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ev.vendorContact.email,
    subject: `You've been invited to ${ev.event.title}`,
    html,
  });

  await prisma.eventVendor.update({
    where: { id: eventVendorId },
    data: { inviteSentAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      eventId: ev.eventId,
      action: "vendor.invite_sent",
      metadata: { eventVendorId, email: ev.vendorContact.email },
    },
  });
}

/**
 * Send a "view your event" email to an ACCEPTED vendor (resend action).
 * No token — just a direct link to the vendor event view.
 */
export async function sendVendorEventLink(
  eventVendorId: string,
): Promise<void> {
  const ev = await prisma.eventVendor.findUnique({
    where: { id: eventVendorId },
    include: {
      vendorContact: true,
      event: { select: { id: true, title: true } },
    },
  });

  if (!ev) return;

  const eventUrl = `${APP_URL}/vendor/${ev.event.id}/timeline`;
  const recipientName =
    [ev.vendorContact.firstName, ev.vendorContact.lastName]
      .filter(Boolean)
      .join(" ") || ev.vendorContact.email;

  const html = buildEventLinkHtml({
    recipientName,
    eventTitle: ev.event.title,
    eventUrl,
  });

  const resend = getResendClient();

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ev.vendorContact.email,
    subject: `Your event link — ${ev.event.title}`,
    html,
  });

  await prisma.activityLog.create({
    data: {
      eventId: ev.eventId,
      action: "vendor.invite_sent",
      metadata: {
        eventVendorId,
        email: ev.vendorContact.email,
        type: "event_link",
      },
    },
  });
}

// ─── Email templates ──────────────────────────────────────────────────────────

function buildInviteHtml({
  recipientName,
  eventTitle,
  inviteUrl,
}: {
  recipientName: string;
  eventTitle: string;
  inviteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111;">
  <h2 style="margin:0 0 8px;">You're invited to an event</h2>
  <p style="color:#555;">Hi ${recipientName},</p>
  <p style="color:#555;">You've been added as a vendor for <strong>${eventTitle}</strong>. Click the button below to confirm your details and view the event.</p>
  <a href="${inviteUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#c0607a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View Invitation</a>
  <p style="font-size:12px;color:#999;">If you weren't expecting this, you can safely ignore this email.</p>
</body>
</html>`;
}

function buildEventLinkHtml({
  recipientName,
  eventTitle,
  eventUrl,
}: {
  recipientName: string;
  eventTitle: string;
  eventUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#111;">
  <h2 style="margin:0 0 8px;">${eventTitle}</h2>
  <p style="color:#555;">Hi ${recipientName},</p>
  <p style="color:#555;">Here's your link to view the event timeline and details for <strong>${eventTitle}</strong>.</p>
  <a href="${eventUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#c0607a;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View Event</a>
</body>
</html>`;
}
