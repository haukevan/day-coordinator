"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

function formatPhone(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

interface Props {
  onboarded: boolean;
  initialFirstName: string;
  initialLastName: string;
  initialCompany: string;
  initialPhoneDigits: string;
}

export function OnboardingForm({
  onboarded,
  initialFirstName,
  initialLastName,
  initialCompany,
  initialPhoneDigits,
}: Props) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [company, setCompany] = useState(initialCompany);
  const [phoneDigits, setPhoneDigits] = useState(initialPhoneDigits);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
      setPhoneDigits(digits);
    },
    [],
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const body: Record<string, string | null> = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      company: company.trim() || null,
      phone: phoneDigits.length === 10 ? `+1${phoneDigits}` : null,
    };

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 bg-background">
      <div className="mb-8 text-center">
        <Logo size="lg" />
        <p className="mt-2 text-sm text-muted-foreground">
          {onboarded ? "Manage your account details" : "Let's get you set up"}
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        {onboarded && (
          <div className="mb-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Link>
          </div>
        )}

        <h1 className="mb-1 text-lg font-semibold text-foreground">
          Your profile
        </h1>
        <p className="mb-5 text-sm text-muted-foreground">
          {onboarded
            ? "Update your name, company, or phone number."
            : "Tell us a little about yourself to get started."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                First name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                autoComplete="given-name"
                autoFocus={!onboarded}
                required
                maxLength={64}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
                placeholder="Jane"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">
                Last name <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                autoComplete="family-name"
                required
                maxLength={64}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Company */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Company{" "}
              <span className="text-muted-foreground text-xs font-normal">
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
              placeholder="Acme Events Co."
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Phone{" "}
              <span className="text-muted-foreground text-xs font-normal">
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
            <p className="mt-1 text-xs text-muted-foreground">
              Used for event SMS notifications.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !firstName.trim() || !lastName.trim()}
          >
            {loading ? "Saving…" : onboarded ? "Save changes" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
