import type { Metadata } from "next";
import { TermsContent } from "./_content";

export const metadata: Metadata = {
  title: "Terms & Conditions — Day Coordinator",
  description:
    "Terms and conditions for using the Day Coordinator event coordination platform.",
};

export default function TermsPage() {
  return <TermsContent />;
}
