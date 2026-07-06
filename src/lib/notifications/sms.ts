/**
 * SMS dispatch via Twilio — server-side only.
 *
 * Follows the same lazy-singleton pattern as src/lib/resend.ts.
 *
 * Phone numbers must be in E.164 format (+1XXXXXXXXXX).
 */

import twilio from "twilio";

let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (twilioClient) return twilioClient;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error(
      "Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN. Set them in the environment for this deployment.",
    );
  }

  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

/** The Twilio phone number to send from. */
function getFromNumber(): string {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error(
      "Missing TWILIO_PHONE_NUMBER. Set it in the environment for this deployment.",
    );
  }
  return from;
}

/** E.164 phone number regex (+1 followed by 10 digits). */
const E164_REGEX = /^\+1\d{10}$/;

/**
 * Send an SMS message via Twilio.
 *
 * @param to  Recipient phone number in E.164 format (e.g. "+15551234567")
 * @param body  Message body text
 * @returns The Twilio message SID on success
 * @throws If the phone number is invalid or Twilio returns an error
 */
export async function sendSms(
  to: string,
  body: string,
): Promise<{ sid: string }> {
  if (!E164_REGEX.test(to)) {
    throw new Error(
      `Invalid phone number "${to}". Must be E.164 format (+1XXXXXXXXXX).`,
    );
  }

  const client = getTwilioClient();
  const from = getFromNumber();

  const message = await client.messages.create({
    to,
    from,
    body,
  });

  if (message.errorCode) {
    throw new Error(
      `Twilio error ${message.errorCode}: ${message.errorMessage}`,
    );
  }

  return { sid: message.sid };
}
