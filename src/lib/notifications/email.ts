/**
 * Email dispatch via Resend — server-side only.
 *
 * Uses the existing Resend client from src/lib/resend.ts (same one used
 * for magic link auth emails).
 */

import { getResendClient, FROM_EMAIL } from "@/lib/resend";

/**
 * Send a transactional email via Resend.
 *
 * @param to       Recipient email address
 * @param subject  Email subject line
 * @param html     HTML body content
 * @returns The Resend message ID on success
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ id: string }> {
  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { id: data!.id! };
}
