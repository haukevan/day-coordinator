import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY. Set it in the environment for this deployment.",
    );
  }

  resendClient = new Resend(apiKey);
  return resendClient;
}

export const FROM_EMAIL =
  process.env.EMAIL_FROM ?? "Day Coordinator <noreply@daycoordinator.com>";
