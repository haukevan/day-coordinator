import Link from "next/link";
import { Calendar, Users, Zap, Bell, Check, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Calendar,
    title: "Smart Timeline",
    description:
      "Build your schedule with tasks, durations, and dependencies. When something shifts, the engine recalculates everything downstream — automatically.",
  },
  {
    icon: Users,
    title: "Vendor Coordination",
    description:
      "Invite vendors with a link. They sign in, see only their tasks, check in on arrival, and receive targeted notifications at exactly the right moment.",
  },
  {
    icon: Zap,
    title: "Live Mode",
    description:
      "One tap activates your real-time command center. See what's active, what's next, and what's running late — with live updates for your entire team.",
  },
  {
    icon: Bell,
    title: "Smart Notifications",
    description:
      "SMS and push alerts fire at the right time — task starting soon, vendor checked in, schedule shifted. Everyone stays in the loop without the noise.",
  },
];

const steps = [
  {
    num: "01",
    title: "Build your timeline",
    description:
      "Add tasks, set durations, and chain dependencies. The scheduling engine handles the math and propagates delays automatically.",
  },
  {
    num: "02",
    title: "Invite your people",
    description:
      "Send vendors and staff a link. They sign in with email, see exactly what they need, and get notified when it matters.",
  },
  {
    num: "03",
    title: "Go live",
    description:
      "On the day, tap to activate Live Mode. Real-time updates flow to everyone. You coordinate — it communicates.",
  },
];

const freePlan = [
  { included: true, text: "Unlimited events" },
  { included: true, text: "Full timeline builder" },
  { included: true, text: "Unlimited tasks" },
  { included: true, text: "Task dependencies & smart scheduling" },
  { included: false, text: "Vendor invitations & check-in" },
  { included: false, text: "Live Mode dashboard" },
  { included: false, text: "SMS & push notifications" },
];

const paidPlan = [
  { included: true, text: "Everything in Free" },
  { included: true, text: "Vendor invitations & check-in" },
  { included: true, text: "Live Mode dashboard" },
  { included: true, text: "SMS & push notifications" },
  { included: true, text: "Real-time messaging" },
  { included: true, text: "QR public timeline sharing" },
  { included: true, text: "File attachments" },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-32">
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[600px] w-[600px] rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl text-center">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              Free planning — no credit card required
            </span>

            <h1 className="mt-6 text-5xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Every moment.{" "}
              <span className="text-primary">Perfectly coordinated.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Day Coordinator is a real-time command center for your event.
              Build your timeline, coordinate vendors, and keep everyone in sync
              — from the first plan to the last dance.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild className="h-10 w-full px-6 text-sm sm:w-auto">
                <Link href="/login?mode=signup">Start planning free</Link>
              </Button>
              <Button
                variant="ghost"
                asChild
                className="h-10 w-full px-6 text-sm sm:w-auto"
              >
                <Link href="#features">See how it works</Link>
              </Button>
            </div>
          </div>

          {/* CSS timeline mockup — mirrors the logo motif */}
          <div className="relative mx-auto mt-20 max-w-sm select-none">
            <div className="flex flex-col gap-3">
              {/* Completed task */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 opacity-50">
                <div className="size-2 flex-shrink-0 rounded-full bg-success" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    Venue doors open
                  </p>
                  <p className="text-xs text-muted-foreground">
                    3:00 PM · 30 min
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                  Done
                </span>
              </div>

              {/* Active task */}
              <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-4 ring-1 ring-primary/20">
                <div className="size-2 flex-shrink-0 animate-pulse rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    Ceremony begins
                  </p>
                  <p className="text-xs text-muted-foreground">
                    3:30 PM · 45 min
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  Live
                </span>
              </div>

              {/* Upcoming task */}
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3 opacity-50">
                <div className="size-2 flex-shrink-0 rounded-full bg-muted-foreground/40" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    Cocktail hour
                  </p>
                  <p className="text-xs text-muted-foreground">
                    4:15 PM · 60 min
                  </p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Up next
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────── */}
        <section id="features" className="px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything you need. Nothing you don't.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                Built for the moments that matter — so you can focus on your
                event, not your tools.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
                >
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="mb-1.5 font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────── */}
        <section className="bg-muted/30 px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Simple by design.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                From first task to final dance — in three steps.
              </p>
            </div>

            <div className="grid gap-10 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step.num} className="flex flex-col gap-4">
                  <div className="flex size-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 text-sm font-bold text-primary">
                    {step.num}
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────── */}
        <section id="pricing" className="px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Pay only when you're ready to go live.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                Planning is always free. Unlock the full experience per event.
              </p>
            </div>

            <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
              {/* Free plan */}
              <div className="flex flex-col rounded-xl border border-border bg-card p-7">
                <p className="text-sm font-medium text-muted-foreground">
                  Free
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">$0</span>
                  <span className="text-muted-foreground">/ forever</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Perfect for planning your event
                </p>

                <ul className="mb-8 mt-7 flex flex-col gap-3">
                  {freePlan.map((item) => (
                    <li
                      key={item.text}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      {item.included ? (
                        <Check className="size-4 flex-shrink-0 text-success" />
                      ) : (
                        <Minus className="size-4 flex-shrink-0 text-muted-foreground/40" />
                      )}
                      <span
                        className={cn(
                          item.included
                            ? "text-foreground"
                            : "text-muted-foreground/60",
                        )}
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button variant="outline" asChild className="mt-auto w-full">
                  <Link href="/login?mode=signup">Start free</Link>
                </Button>
              </div>

              {/* Per-event plan */}
              <div className="relative flex flex-col rounded-xl border border-primary/40 bg-primary/5 p-7 ring-1 ring-primary/20">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    Most popular
                  </span>
                </div>

                <p className="text-sm font-medium text-muted-foreground">
                  Per Event
                </p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">
                    $29
                  </span>
                  <span className="text-muted-foreground">/ event</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Everything for the big day
                </p>

                <ul className="mb-8 mt-7 flex flex-col gap-3">
                  {paidPlan.map((item) => (
                    <li
                      key={item.text}
                      className="flex items-center gap-2.5 text-sm"
                    >
                      <Check className="size-4 flex-shrink-0 text-success" />
                      <span className="text-foreground">{item.text}</span>
                    </li>
                  ))}
                </ul>

                <Button asChild className="mt-auto w-full">
                  <Link href="/login?mode=signup">Get started</Link>
                </Button>
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              One payment per event. No subscriptions. No surprises.
            </p>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────── */}
        <section className="bg-primary/5 px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Your event deserves better than a spreadsheet.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
              Start planning in minutes. Go live when you're ready.
            </p>
            <div className="mt-10">
              <Button asChild className="h-10 px-8 text-sm">
                <Link href="/login?mode=signup">Start planning free</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
