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
  invitedBy?: {
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string;
  } | null;
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
          invitedByName: ev.invitedBy
            ? [ev.invitedBy.firstName, ev.invitedBy.lastName]
                .filter(Boolean)
                .join(" ") ||
              ev.invitedBy.name ||
              ev.invitedBy.email
            : undefined,
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
  const ev = await prisma.eventVendor
    .findUnique({
      where: { id: eventVendorId },
      include: {
        vendorContact: true,
        invitedBy: {
          select: { firstName: true, lastName: true, name: true, email: true },
        },
        event: { select: { title: true, eventDate: true } },
      },
    })
    .catch((err) => {
      console.error("[sendVendorInviteEmail] Prisma query failed:", err);
      return null;
    });

  if (!ev || !ev.inviteToken) return;
  // Idempotency guard
  if (ev.inviteSentAt) return;

  const inviteUrl = `${APP_URL}/login?next=${encodeURIComponent(`/invite/${ev.inviteToken}`)}`;
  const recipientName =
    [ev.vendorContact.firstName, ev.vendorContact.lastName]
      .filter(Boolean)
      .join(" ") || ev.vendorContact.email;

  const invitedByName = ev.invitedBy
    ? [ev.invitedBy.firstName, ev.invitedBy.lastName]
        .filter(Boolean)
        .join(" ") ||
      ev.invitedBy.name ||
      ev.invitedBy.email
    : undefined;

  const html = buildInviteHtml({
    recipientName,
    eventTitle: ev.event.title,
    inviteUrl,
    invitedByName,
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
  const ev = await prisma.eventVendor
    .findUnique({
      where: { id: eventVendorId },
      include: {
        vendorContact: true,
        invitedBy: {
          select: { firstName: true, lastName: true, name: true, email: true },
        },
        event: { select: { id: true, title: true } },
      },
    })
    .catch((err) => {
      console.error("[sendVendorEventLink] Prisma query failed:", err);
      return null;
    });

  if (!ev) return;

  const eventUrl = `${APP_URL}/vendor/${ev.event.id}/timeline`;
  const recipientName =
    [ev.vendorContact.firstName, ev.vendorContact.lastName]
      .filter(Boolean)
      .join(" ") || ev.vendorContact.email;

  const invitedByName = ev.invitedBy
    ? [ev.invitedBy.firstName, ev.invitedBy.lastName]
        .filter(Boolean)
        .join(" ") ||
      ev.invitedBy.name ||
      ev.invitedBy.email
    : undefined;

  const html = buildEventLinkHtml({
    recipientName,
    eventTitle: ev.event.title,
    eventUrl,
    invitedByName,
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
  invitedByName,
}: {
  recipientName: string;
  eventTitle: string;
  inviteUrl: string;
  invitedByName?: string;
}): string {
  const inviterLine = invitedByName
    ? `<p style="color:#7d8494;font-size:14px;margin:0 0 24px;">Invited by <strong style="color:#364259;">${invitedByName}</strong></p>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#364259;background-color:#faf9f7;">
  <div style="background:#ffffff;border-radius:12px;padding:32px 24px;border:1px solid #e8e3db;">
    <h2 style="margin:0 0 4px;font-size:20px;color:#1f2e50;">You're invited to an event</h2>
    <p style="color:#7d8494;font-size:14px;margin:0 0 24px;">${eventTitle}</p>
    ${inviterLine}
    <p style="color:#364259;font-size:15px;line-height:1.5;">Hi ${recipientName},</p>
    <p style="color:#364259;font-size:15px;line-height:1.5;">You've been added as a vendor. Click below to confirm your details and view the event.</p>
    <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#1f2e50;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">View Invitation</a>
    <p style="font-size:12px;color:#7d8494;margin:0;">If you weren't expecting this, you can safely ignore this email.</p>
  </div>
</body>
</html>`;
}

function buildEventLinkHtml({
  recipientName,
  eventTitle,
  eventUrl,
  invitedByName,
}: {
  recipientName: string;
  eventTitle: string;
  eventUrl: string;
  invitedByName?: string;
}): string {
  const inviterLine = invitedByName
    ? `<p style="color:#7d8494;font-size:14px;margin:0 0 24px;">Invited by <strong style="color:#364259;">${invitedByName}</strong></p>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 16px;color:#364259;background-color:#faf9f7;">
  <div style="background:#ffffff;border-radius:12px;padding:32px 24px;border:1px solid #e8e3db;">
    <h2 style="margin:0 0 4px;font-size:20px;color:#1f2e50;">${eventTitle}</h2>
    ${inviterLine}
    <p style="color:#364259;font-size:15px;line-height:1.5;">Hi ${recipientName},</p>
    <p style="color:#364259;font-size:15px;line-height:1.5;">Here's your link to view the event timeline and details.</p>
    <a href="${eventUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#1f2e50;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">View Event</a>
    <p style="font-size:12px;color:#7d8494;margin:0;">Day Coordinator</p>
  </div>
</body>
</html>`;
}
