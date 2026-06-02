"use client";

export function TermsContent() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Terms &amp; Conditions
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: June 2, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        {/* Intro */}
        <p>
          These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of
          the Day Coordinator event coordination platform (the
          &ldquo;Service&rdquo;), operated as a sole proprietorship based in
          British Columbia, Canada (&ldquo;Day Coordinator,&rdquo;
          &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). By creating
          an account or using the Service, you agree to be bound by these Terms.
          If you do not agree, do not use the Service.
        </p>

        {/* 1. Description of Service */}
        <Section title="1. Description of Service">
          <p>
            Day Coordinator is a day-of coordination and scheduling platform for
            weddings and private events. The Service provides:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Smart timeline builder with task dependencies and automatic
              schedule propagation.
            </li>
            <li>
              Vendor coordination — invite vendors, track their status, and
              provide them with a read-only view of their assigned tasks.
            </li>
            <li>
              Live-mode event tracking with real-time updates for your team.
            </li>
            <li>
              Optional public-facing event pages for sharing schedules with
              guests.
            </li>
            <li>
              Email and optional SMS notifications for task reminders and event
              updates.
            </li>
          </ul>
          <p className="mt-3">
            The Service is offered in both free and paid tiers. Some features
            may require a one-time purchase.
          </p>
        </Section>

        {/* 2. Account Terms */}
        <Section title="2. Account Terms">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              You must be at least 18 years old, or have the consent of a parent
              or legal guardian, to create an account.
            </li>
            <li>
              You must provide a valid email address to receive magic-link
              sign-in emails. You are responsible for maintaining the security
              of your email account, as access to your email is the sole method
              of signing in to the Service.
            </li>
            <li>
              Your account is for your individual use. You may not share your
              account credentials or magic-link emails with others.
            </li>
            <li>
              You are responsible for all activity that occurs under your
              account.
            </li>
            <li>
              You must provide accurate, current, and complete information
              during onboarding and keep your account information updated.
            </li>
          </ul>
        </Section>

        {/* 3. Acceptable Use */}
        <Section title="3. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Use the Service for any unlawful purpose or in violation of any
              applicable laws or regulations.
            </li>
            <li>
              Upload, post, or transmit any content that is unlawful, harmful,
              threatening, abusive, harassing, defamatory, invasive of privacy,
              or otherwise objectionable.
            </li>
            <li>
              Attempt to gain unauthorized access to any part of the Service,
              other accounts, or any systems or networks connected to the
              Service.
            </li>
            <li>
              Interfere with or disrupt the Service, its servers, or its
              networks, including by transmitting viruses, malware, or harmful
              code.
            </li>
            <li>
              Use any robot, scraper, or automated means to access the Service
              without our express permission.
            </li>
            <li>
              Impersonate any person or entity, or falsely state or misrepresent
              your affiliation with any person or entity.
            </li>
            <li>
              Use the Service to send unsolicited commercial messages (spam) to
              vendors or other users.
            </li>
          </ul>
        </Section>

        {/* 4. Payment Terms */}
        <Section title="4. Payment Terms">
          <p>
            The Service offers both free features and paid features available
            via one-time purchase. Paid features are clearly marked within the
            Service. By making a purchase, you agree to the pricing and billing
            terms presented at the time of purchase.
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Payment processing:</strong> All payments are processed
              securely through a third-party payment processor. We do not store
              your full credit card or payment details on our servers.
            </li>
            <li>
              <strong>Refunds:</strong> Refund eligibility is described at the
              time of purchase. Unless otherwise stated, payments are
              non-refundable. If you believe you are entitled to a refund,
              contact us at{" "}
              <a
                href="mailto:daycoordinator.org@gmail.com"
                className="underline hover:text-primary"
              >
                daycoordinator.org@gmail.com
              </a>
              .
            </li>
            <li>
              <strong>Price changes:</strong> We may change our pricing with
              reasonable notice. Price changes will not affect purchases already
              completed.
            </li>
          </ul>
        </Section>

        {/* 5. User Content & Data */}
        <Section title="5. User Content &amp; Data">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Ownership:</strong> You retain all ownership rights to the
              event data, task lists, vendor contacts, venue information, and
              other content you create or upload to the Service (&ldquo;User
              Content&rdquo;).
            </li>
            <li>
              <strong>License to us:</strong> By using the Service, you grant us
              a limited, non-exclusive, royalty-free license to process, store,
              and transmit your User Content solely as necessary to provide the
              Service to you and your invited vendors. This license ends when
              you delete your account or the relevant content.
            </li>
            <li>
              <strong>Your responsibility:</strong> You are solely responsible
              for the User Content you provide. You represent that you have all
              necessary rights and permissions to share vendor and venue contact
              information with us for the purpose of providing the Service.
            </li>
            <li>
              <strong>Public timelines:</strong> If you enable the public
              timeline feature for an event, the event title, date, location,
              and tasks marked as publicly visible will be accessible to anyone
              with the event&rsquo;s public URL. You are responsible for
              ensuring that no sensitive or private information is included in
              publicly visible tasks.
            </li>
          </ul>
        </Section>

        {/* 6. Third-Party Services */}
        <Section title="6. Third-Party Services">
          <p>
            The Service relies on third-party providers for cloud
            infrastructure, authentication, email delivery, SMS delivery,
            payment processing, and map display. By using the Service, you
            acknowledge that these providers have their own terms and
            conditions. We are not responsible for the availability, accuracy,
            or practices of these third-party services. Interruptions or
            failures of third-party services may affect the availability of the
            Service.
          </p>
        </Section>

        {/* 7. Intellectual Property */}
        <Section title="7. Intellectual Property">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Our IP:</strong> The Day Coordinator name, logo, brand,
              website design, user interface, software code, and all related
              materials are our intellectual property or the property of our
              licensors. You may not copy, modify, distribute, or create
              derivative works from these materials without our express
              permission.
            </li>
            <li>
              <strong>Your IP:</strong> As stated in Section 5, you retain
              ownership of your User Content. Nothing in these Terms transfers
              ownership of your User Content to us.
            </li>
            <li>
              <strong>Feedback:</strong> If you provide feedback, suggestions,
              or ideas about the Service, you grant us the right to use that
              feedback without restriction or compensation.
            </li>
          </ul>
        </Section>

        {/* 8. Limitation of Liability */}
        <Section title="8. Limitation of Liability">
          <p className="font-medium">
            THE SERVICE IS PROVIDED &ldquo;AS IS.&rdquo;
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              To the fullest extent permitted by applicable law, Day Coordinator
              disclaims all warranties, express or implied, including
              merchantability, fitness for a particular purpose, and
              non-infringement.
            </li>
            <li>
              We do not warrant that the Service will be uninterrupted,
              error-free, or completely secure, or that any defects will be
              corrected.
            </li>
            <li>
              To the fullest extent permitted by law, Day Coordinator shall not
              be liable for any indirect, incidental, special, consequential, or
              punitive damages, including but not limited to lost profits, lost
              data, event disruptions, missed notifications, scheduling errors,
              or damage to reputation, arising from your use of or inability to
              use the Service.
            </li>
            <li>
              Our total liability to you for any claims under these Terms,
              whether in contract, tort (including negligence), or otherwise,
              shall not exceed the greater of (a) the amount you paid us in the
              twelve months preceding the claim, or (b) one hundred Canadian
              dollars (CAD $100).
            </li>
            <li>
              The limitations in this section apply even if we have been advised
              of the possibility of such damages.
            </li>
          </ul>
        </Section>

        {/* 9. Indemnification */}
        <Section title="9. Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless Day Coordinator
            and its owner from and against any claims, liabilities, damages,
            losses, and expenses (including reasonable legal fees) arising from:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>Your use of the Service.</li>
            <li>Your violation of these Terms.</li>
            <li>
              Your violation of any third-party rights, including privacy
              rights.
            </li>
            <li>
              Any User Content you provide, including vendor and venue contact
              information you share through the Service.
            </li>
          </ul>
        </Section>

        {/* 10. Termination */}
        <Section title="10. Termination">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>By you:</strong> You may stop using the Service and delete
              your account at any time through your account settings or by
              contacting us. Deleting your account will remove your personal
              data as described in our Privacy Policy.
            </li>
            <li>
              <strong>By us:</strong> We may suspend or terminate your access to
              the Service at any time, with or without cause, and with or
              without notice, including if we reasonably believe you have
              violated these Terms. If we terminate your account without cause,
              we will provide a refund for any recent paid purchases at our
              discretion.
            </li>
            <li>
              <strong>Effect of termination:</strong> Upon termination, your
              right to access the Service ceases immediately. Provisions of
              these Terms that by their nature should survive termination (such
              as limitation of liability, indemnification, and governing law)
              will survive.
            </li>
          </ul>
        </Section>

        {/* 11. Governing Law & Disputes */}
        <Section title="11. Governing Law &amp; Disputes">
          <p>
            These Terms are governed by and construed in accordance with the
            laws of British Columbia, Canada, and the federal laws of Canada
            applicable therein, without regard to conflict of law principles.
          </p>
          <p className="mt-2">
            Any dispute arising from or relating to these Terms or the Service
            shall be resolved as follows:
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>
              <strong>Informal resolution:</strong> You agree to first contact
              us at{" "}
              <a
                href="mailto:daycoordinator.org@gmail.com"
                className="underline hover:text-primary"
              >
                daycoordinator.org@gmail.com
              </a>{" "}
              and attempt to resolve the dispute informally for at least 30 days
              before initiating formal proceedings.
            </li>
            <li>
              <strong>Arbitration or small claims:</strong> If informal
              resolution fails, disputes shall be resolved by binding
              arbitration in Kamloops, British Columbia, or in small claims
              court in Kamloops, British Columbia if the claim qualifies. You
              waive any right to participate in a class action or class-wide
              arbitration.
            </li>
          </ol>
        </Section>

        {/* 12. Changes to These Terms */}
        <Section title="12. Changes to These Terms">
          <p>
            We may update these Terms from time to time. When we make material
            changes, we will notify you via the email address associated with
            your account or through an in-app notice at least 30 days before the
            changes take effect. Your continued use of the Service after the
            effective date constitutes acceptance of the updated Terms. If you
            do not agree to the updated Terms, you must stop using the Service
            and delete your account.
          </p>
        </Section>

        {/* 13. General */}
        <Section title="13. General Provisions">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Entire agreement:</strong> These Terms, together with our
              Privacy Policy, constitute the entire agreement between you and
              Day Coordinator regarding the Service.
            </li>
            <li>
              <strong>Severability:</strong> If any provision of these Terms is
              found to be unenforceable, the remaining provisions will remain in
              full force and effect.
            </li>
            <li>
              <strong>Waiver:</strong> Our failure to enforce any right or
              provision of these Terms does not constitute a waiver of that
              right or provision.
            </li>
            <li>
              <strong>Assignment:</strong> You may not assign or transfer these
              Terms or your account without our prior written consent. We may
              assign these Terms at our discretion.
            </li>
            <li>
              <strong>Force majeure:</strong> We are not liable for delays or
              failures in performance resulting from causes beyond our
              reasonable control, including natural disasters, acts of
              government, internet or telecommunications failures, or
              third-party service outages.
            </li>
          </ul>
        </Section>

        {/* 14. Contact */}
        <Section title="14. Contact Us">
          <p>
            For questions about these Terms, account issues, or legal inquiries,
            contact us at:
          </p>
          <p className="mt-2 text-muted-foreground">
            <strong className="text-foreground">Day Coordinator</strong>
            <br />
            Kamloops, British Columbia, Canada
            <br />
            <a
              href="mailto:daycoordinator.org@gmail.com"
              className="underline hover:text-foreground"
            >
              daycoordinator.org@gmail.com
            </a>
          </p>
        </Section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}
