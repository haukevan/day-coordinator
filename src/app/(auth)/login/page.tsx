"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Mode = "magic-link" | "sms";
type SmsStep = "phone" | "otp";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("magic-link");
  const [smsStep, setSmsStep] = useState<SmsStep>("phone");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
    } else {
      setSent(true);
    }
  }

  async function handleSmsSend(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", phone }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
    } else {
      setSmsStep("otp");
    }
  }

  async function handleSmsVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", phone, token: otp }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Invalid code. Please try again.");
    } else {
      window.location.href = "/dashboard";
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--bg)" }}>

      {/* Logo */}
      <div className="mb-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Day Coordinator" className="h-10 mx-auto mb-3" />
        <p className="text-sm" style={{ color: "var(--text)", opacity: 0.5 }}>
          Real-time event coordination
        </p>
      </div>

      <div className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
        style={{ background: "var(--panel)" }}>

        {/* Mode Toggle */}
        <div className="flex rounded-lg overflow-hidden mb-6 border border-white/10">
          {(["magic-link", "sms"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSent(false); setError(""); setSmsStep("phone"); }}
              className={cn(
                "flex-1 py-2 text-sm font-medium transition-colors",
                mode === m
                  ? "text-white"
                  : "text-gray-400 hover:text-gray-200"
              )}
              style={mode === m ? { background: "var(--primary)" } : {}}
            >
              {m === "magic-link" ? "Email link" : "Text me"}
            </button>
          ))}
        </div>

        {/* Magic Link Form */}
        {mode === "magic-link" && (
          <>
            {sent ? (
              <div className="text-center py-4">
                <div className="text-3xl mb-3">📬</div>
                <p className="font-medium" style={{ color: "var(--text)" }}>Check your email</p>
                <p className="text-sm mt-1 text-gray-400">
                  We sent a sign-in link to <span className="text-white">{email}</span>
                </p>
                <button
                  onClick={() => { setSent(false); setEmail(""); }}
                  className="mt-4 text-sm underline text-gray-400 hover:text-white"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "var(--primary)" } as React.CSSProperties}
                  />
                </div>
                {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {loading ? "Sending…" : "Send magic link"}
                </button>
              </form>
            )}
          </>
        )}

        {/* SMS Form */}
        {mode === "sms" && (
          <>
            {smsStep === "phone" ? (
              <form onSubmit={handleSmsSend} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    Phone number
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2"
                    style={{ "--tw-ring-color": "var(--primary)" } as React.CSSProperties}
                  />
                  <p className="text-xs text-gray-500 mt-1">Include country code: +1 for US/CA</p>
                </div>
                {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {loading ? "Sending…" : "Send code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSmsVerify} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-gray-400">
                    6-digit code
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    Sent to <span className="text-white">{phone}</span>
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="w-full rounded-lg px-3 py-2.5 text-sm border border-white/10 bg-white/5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 tracking-widest text-center text-lg"
                    style={{ "--tw-ring-color": "var(--primary)" } as React.CSSProperties}
                  />
                </div>
                {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: "var(--primary)" }}
                >
                  {loading ? "Verifying…" : "Verify code"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSmsStep("phone"); setOtp(""); setError(""); }}
                  className="w-full text-sm text-gray-400 hover:text-white"
                >
                  Use a different number
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
