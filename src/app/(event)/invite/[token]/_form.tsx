"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { VenueStaticMap } from "@/components/ui/venue-static-map";
import { MapPin } from "lucide-react";

function formatPhone(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

interface Props {
  readonly token: string;
  readonly eventId: string;
  readonly eventTitle: string;
  readonly eventDate: string | null;
  readonly eventVenue: {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
  } | null;
  readonly onboarded: boolean;
  readonly userEmail: string;
  readonly inviteEmail: string;
  readonly initialFirstName: string;
  readonly initialLastName: string;
  readonly initialPhoneDigits: string;
  readonly initialCompany: string;
  readonly initialJobTitle: string;
}

export function VendorJoinForm({
  token,
  eventId,
  eventTitle,
  eventDate,
  eventVenue,
  onboarded,
  userEmail,
  inviteEmail,
  initialFirstName,
  initialLastName,
  initialPhoneDigits,
  initialCompany,
  initialJobTitle,
}: Props) {
  const router = useRouter();
  const emailMismatch = userEmail.toLowerCase() !== inviteEmail.toLowerCase();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phoneDigits, setPhoneDigits] = useState(initialPhoneDigits);
  const [company, setCompany] = useState(initialCompany);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [error, setError] = useState("");

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
      setPhoneDigits(digits);
      setPhoneError(
        digits.length > 0 && digits.length < 10
          ? "Please enter a valid 10-digit phone number."
          : "",
      );
    },
    [],
  );

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phoneDigits.length === 10 ? `+1${phoneDigits}` : null,
          company: company.trim() || null,
          jobTitle: jobTitle.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/vendor/${eventId}/timeline`);
      } else {
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-background">
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex justify-center">
          <Logo size="lg" />
        </Link>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        {/* Event info */}
        <div className="mb-5 rounded-lg bg-muted/60 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            You&apos;re invited to
          </p>
          <p className="mt-0.5 text-base font-semibold text-foreground">
            {eventTitle}
          </p>
          {eventDate && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(eventDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
          {eventVenue && (
            <div className="mt-2 border-t border-border pt-2">
              <div className="flex items-start gap-1.5">
                <MapPin className="mt-0.5 size-3 shrink-0 text-accent" />
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {eventVenue.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {eventVenue.address}
                  </p>
                </div>
              </div>
              {eventVenue.lat != null && eventVenue.lng != null && (
                <div className="mt-2">
                  <VenueStaticMap
                    lat={eventVenue.lat}
                    lng={eventVenue.lng}
                    name={eventVenue.name}
                    address={eventVenue.address}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {emailMismatch ? (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            This invite was sent to{" "}
            <span className="font-medium">{inviteEmail}</span>. Please sign out
            and sign in with that email address.
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-lg font-semibold text-foreground">
              {onboarded ? "Confirm your details" : "Set up your profile"}
            </h1>
            <p className="mb-5 text-sm text-muted-foreground">
              {onboarded
                ? "Review your info for this event."
                : "Tell us about yourself to get started."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name — editable for new users, editable but pre-filled for existing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="invite-first-name"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    First name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="invite-first-name"
                    type="text"
                    autoComplete="given-name"
                    required
                    maxLength={64}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                    placeholder="Jane"
                    readOnly={onboarded}
                  />
                </div>
                <div>
                  <label
                    htmlFor="invite-last-name"
                    className="mb-1 block text-xs font-medium text-foreground"
                  >
                    Last name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="invite-last-name"
                    type="text"
                    autoComplete="family-name"
                    required
                    maxLength={64}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                    placeholder="Doe"
                    readOnly={onboarded}
                  />
                </div>
              </div>

              {/* Phone — only shown for new users */}
              {!onboarded && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Phone{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="flex h-[42px] items-center rounded-lg border border-border bg-muted px-3 text-sm text-muted-foreground select-none">
                      +1
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={formatPhone(phoneDigits)}
                      onChange={handlePhoneChange}
                      className={inputClass}
                      placeholder="(555) 123-4567"
                      maxLength={14}
                    />
                  </div>
                  {phoneError && (
                    <p className="mt-1 text-xs text-destructive">
                      {phoneError}
                    </p>
                  )}
                </div>
              )}

              {/* Company */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Company{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  autoComplete="organization"
                  maxLength={128}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className={inputClass}
                  placeholder="Blooms & Co."
                />
              </div>

              {/* Job title */}
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Job title{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  maxLength={128}
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Lead Florist"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  !firstName.trim() ||
                  !lastName.trim() ||
                  !!phoneError
                }
              >
                {loading ? "Joining…" : "Join event"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
