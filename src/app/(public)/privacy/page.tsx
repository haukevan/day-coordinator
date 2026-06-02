import type { Metadata } from "next";
import { PrivacyContent } from "./_content";

export const metadata: Metadata = {
  title: "Privacy Policy — Day Coordinator",
  description:
    "How Day Coordinator collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return <PrivacyContent />;
}
