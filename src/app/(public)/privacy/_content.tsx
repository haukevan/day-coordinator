"use client";

import Link from "next/link";

export function PrivacyContent() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: June 2, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        {/* Intro */}
        <p>
          Day Coordinator (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or
          &ldquo;us&rdquo;) is committed to protecting your privacy. This
          Privacy Policy explains how we collect, use, disclose, and safeguard
          your information when you use our event coordination platform (the
          &ldquo;Service&rdquo;). By using the Service, you agree to the
          practices described in this policy.
        </p>

        <p>
          Day Coordinator is a sole proprietorship based in British Columbia,
          Canada. We comply with Canada&rsquo;s{" "}
          <em>Personal Information Protection and Electronic Documents Act</em>{" "}
          (PIPEDA), British Columbia&rsquo;s{" "}
          <em>Personal Information Protection Act</em> (PIPA), the European
          Union&rsquo;s <em>General Data Protection Regulation</em> (GDPR), and
          the <em>California Consumer Privacy Act</em> (CCPA/CPRA), as
          applicable.
        </p>

        {/* 1. Information We Collect */}
        <Section title="1. Information We Collect">
          <Subsection title="1.1 Account Data">
            When you sign in via magic link, we collect your{" "}
            <strong>email address</strong> from Supabase Auth. During onboarding
            you provide your <strong>first name</strong> and{" "}
            <strong>last name</strong> (required), and optionally your{" "}
            <strong>phone number</strong> (stored in E.164 format, e.g.
            +1XXXXXXXXXX) and <strong>company name</strong>. Phone numbers are
            collected solely for SMS notifications and are never used for
            authentication.
          </Subsection>

          <Subsection title="1.2 Event Data">
            When you create an event, we store the event&rsquo;s{" "}
            <strong>title</strong>, <strong>description</strong>,{" "}
            <strong>date and time</strong>, <strong>timezone</strong>, and
            optional <strong>venue assignment</strong>. Events may also have a
            public-facing <strong>slug</strong> if you enable the public
            timeline feature.
          </Subsection>

          <Subsection title="1.3 Task & Timeline Data">
            We store the tasks you create within each event, including{" "}
            <strong>task titles</strong>, <strong>descriptions</strong>,{" "}
            <strong>scheduled start and end times</strong>,{" "}
            <strong>durations</strong>,{" "}
            <strong>dependency relationships</strong> between tasks,{" "}
            <strong>assignments</strong> to team members, and actual{" "}
            <strong>start and completion times</strong> recorded during live
            mode.
          </Subsection>

          <Subsection title="1.4 Vendor Data">
            When you add vendors to an event, we store{" "}
            <strong>vendor names</strong>, <strong>email addresses</strong>,
            phone numbers, company names, and job titles as provided by you.
            Vendors who accept your invitation may also provide additional
            contact details during the join process.
          </Subsection>

          <Subsection title="1.5 Venue Data">
            We store venue information you save to your account, including{" "}
            <strong>venue name</strong>, <strong>street address</strong>,
            geographic coordinates (latitude/longitude), and venue contact
            names, phone numbers, and email addresses.
          </Subsection>

          <Subsection title="1.6 Activity Logs">
            We maintain an audit trail of actions taken within each event, such
            as task creation, status changes, and notification sends. These logs
            include the action type, timestamp, and which user performed the
            action.
          </Subsection>

          <Subsection title="1.7 Notification Records">
            When notifications are sent (email or SMS), we record the
            notification type, delivery channel, recipient, status, and
            timestamp to ensure idempotency and track delivery.
          </Subsection>

          <Subsection title="1.8 Cookies & Tracking">
            We use <strong>only one cookie</strong>: the Supabase authentication
            session cookie (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              sb-*-auth-token
            </code>
            ), which is strictly necessary to keep you signed in. We do{" "}
            <strong>not</strong> use analytics cookies, advertising cookies,
            tracking pixels, fingerprinting scripts, or any other tracking
            technology. We do not integrate with Google Analytics, Facebook
            Pixel, or any third-party analytics service.
          </Subsection>
        </Section>

        {/* 2. How We Use Your Data */}
        <Section title="2. How We Use Your Data">
          <p>We use your data exclusively for the following purposes:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Service delivery:</strong> Providing the core event
              coordination features — timeline management, task scheduling,
              dependency resolution, vendor coordination, and live mode
              tracking.
            </li>
            <li>
              <strong>Authentication:</strong> Sending magic link sign-in emails
              so you can access your account.
            </li>
            <li>
              <strong>Vendor invitations:</strong> Sending invitation emails to
              vendors you add to your events.
            </li>
            <li>
              <strong>Notifications:</strong> Sending task reminders, delay
              alerts, and event status updates via email or SMS, based on your
              notification preferences.
            </li>
            <li>
              <strong>Payment processing:</strong> Processing payments for paid
              features through a third-party payment processor. We never store
              full payment card details.
            </li>
            <li>
              <strong>Maps &amp; location:</strong> Displaying venue locations
              on maps using publicly available map tiles.
            </li>
            <li>
              <strong>Real-time updates:</strong> Broadcasting event changes to
              connected team members during live events.
            </li>
            <li>
              <strong>Audit &amp; security:</strong> Maintaining activity logs
              for troubleshooting, security monitoring, and service improvement.
            </li>
          </ul>
          <p className="mt-3">
            We do <strong>not</strong> use your data for advertising, profiling,
            automated decision-making, or any purpose beyond operating and
            improving the Service.
          </p>
        </Section>

        {/* 3. Legal Basis for Processing */}
        <Section title="3. Legal Basis for Processing (GDPR)">
          <p>
            For users in the European Economic Area (EEA), our legal bases for
            processing personal data are:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Contractual necessity:</strong> Processing your email,
              event data, and task data is necessary to provide the Service you
              have requested.
            </li>
            <li>
              <strong>Legitimate interests:</strong> We process activity logs
              and notification records to maintain service security, debug
              issues, and improve the platform. These interests are balanced
              against your rights and do not override them.
            </li>
            <li>
              <strong>Consent:</strong> SMS notifications require your explicit
              consent. You provide your phone number optionally during
              onboarding with clear notice that it is used only for event
              notifications. You may withdraw this consent at any time through
              your account settings or by contacting us.
            </li>
          </ul>
        </Section>

        {/* 4. Data Sharing & Third-Party Services */}
        <Section title="4. Data Sharing & Third-Party Services">
          <p>
            We do <strong>not</strong> sell, rent, trade, or otherwise disclose
            your personal data to third parties for their own marketing or
            commercial purposes. We share data only with the following
            categories of service providers, and only to the extent necessary to
            operate the Service:
          </p>

          <div className="mt-3 space-y-3">
            <Subsection title="Cloud Infrastructure &amp; Authentication">
              Your account data, event data, task data, vendor contacts, venues,
              and activity logs are stored with our cloud database and
              authentication provider. This provider also handles sign-in and
              real-time updates during live events.
            </Subsection>

            <Subsection title="Email Delivery">
              We use a transactional email service to deliver magic-link sign-in
              emails, vendor invitation emails, and event notification emails.
              This provider receives your email address and the content of the
              message being delivered.
            </Subsection>

            <Subsection title="SMS Delivery">
              If you opt in to SMS notifications, we use an SMS delivery
              provider to send text messages to your phone number. This provider
              receives your phone number and message content.
            </Subsection>

            <Subsection title="Payment Processing">
              Payments for paid features are processed by a third-party payment
              processor. This provider collects and processes your payment
              method details directly — we never receive or store full credit
              card numbers.
            </Subsection>

            <Subsection title="Maps">
              Venue locations are displayed using an open-source map library
              with publicly available map tiles. When a map is shown, your
              browser may make requests to a tile server. No personal data is
              sent in these requests.
            </Subsection>
          </div>
        </Section>

        {/* 5. Data Retention */}
        <Section title="5. Data Retention">
          <p>We retain your data only as long as necessary:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Account data:</strong> Retained until you delete your
              account or request deletion.
            </li>
            <li>
              <strong>
                Event data (including tasks, vendors, and activity logs):
              </strong>{" "}
              Retained until you delete the event or your account. Deleting an
              event cascades to remove all associated tasks, vendor assignments,
              and activity logs.
            </li>
            <li>
              <strong>Venue data:</strong> Retained until you delete the venue
              or your account.
            </li>
            <li>
              <strong>Notification records:</strong> Retained for 90 days after
              the notification is sent, after which they are eligible for
              deletion.
            </li>
          </ul>
        </Section>

        {/* 6. Your Rights */}
        <Section title="6. Your Data Protection Rights">
          <p>
            Depending on your jurisdiction, you may have rights regarding your
            personal data, including the right to access, correct, delete, or
            export your data, and to withdraw consent where processing is based
            on consent. To exercise any of these rights, contact us at{" "}
            <a
              href="mailto:daycoordinator.org@gmail.com"
              className="underline hover:text-primary"
            >
              daycoordinator.org@gmail.com
            </a>
            . We will respond within 30 days and may need to verify your
            identity before fulfilling your request.
          </p>
        </Section>

        {/* 7. International Data Transfers */}
        <Section title="7. International Data Transfers">
          <p>
            Day Coordinator is based in Canada, and your data is stored on
            Supabase servers in the United States. If you are located outside
            Canada or the United States, your data will be transferred to and
            processed in these countries. We rely on appropriate safeguards,
            including standard contractual clauses and the adequacy of Canadian
            privacy law under GDPR, to ensure your data remains protected. By
            using the Service, you consent to this transfer.
          </p>
        </Section>

        {/* 8. Children's Privacy */}
        <Section title="8. Children&rsquo;s Privacy">
          <p>
            The Service is not directed to individuals under the age of 18. We
            do not knowingly collect personal data from anyone under 18. If we
            become aware that a minor has provided us with personal data, we
            will delete it promptly. If you believe we may have collected data
            from a minor, please contact us immediately.
          </p>
        </Section>

        {/* 9. Security */}
        <Section title="9. Security">
          <p>
            We implement appropriate technical and organizational measures to
            protect your personal data, including:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Encryption of data in transit (TLS) and at rest (Supabase-managed
              encryption).
            </li>
            <li>Rate limiting on authentication endpoints to prevent abuse.</li>
            <li>
              Event-scoped access controls — every database query enforces
              event-level data isolation.
            </li>
            <li>
              Idempotent notification delivery to prevent duplicate messages.
            </li>
          </ul>
          <p className="mt-3">
            In accordance with British Columbia&rsquo;s PIPA, in the event of a
            data breach that poses a real risk of significant harm, we will
            notify affected individuals and the BC Office of the Information
            &amp; Privacy Commissioner without unreasonable delay.
          </p>
          <p className="mt-2">
            No method of electronic transmission or storage is 100% secure.
            While we strive to protect your data, we cannot guarantee absolute
            security.
          </p>
        </Section>

        {/* 10. Canada's Anti-Spam Legislation (CASL) */}
        <Section title="10. Canada&rsquo;s Anti-Spam Legislation (CASL)">
          <p>Emails we send fall into two categories:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>Transactional messages</strong> — magic-link sign-in
              emails, vendor invitation emails sent at your direction, and event
              notification emails. These are exempt from CASL&rsquo;s consent
              requirements as they are essential to providing the Service.
            </li>
            <li>
              <strong>SMS notifications</strong> — sent only with your express
              consent, provided during onboarding. You may withdraw this consent
              at any time.
            </li>
          </ul>
        </Section>

        {/* 11. Changes to This Policy */}
        <Section title="11. Changes to This Privacy Policy">
          <p>
            We may update this Privacy Policy from time to time. When we make
            material changes, we will notify you via the email address
            associated with your account or through an in-app notice before the
            changes take effect. The &ldquo;Last updated&rdquo; date at the top
            of this page reflects the most recent revision. Your continued use
            of the Service after changes become effective constitutes acceptance
            of the updated policy.
          </p>
        </Section>

        {/* 12. Contact */}
        <Section title="12. Contact Us">
          <p>
            If you have questions about this Privacy Policy, wish to exercise
            your data rights, or need to report a privacy concern, contact us
            at:
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

function Subsection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-foreground">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
