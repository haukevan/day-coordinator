"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleMagicLink(e: React.SyntheticEvent<HTMLFormElement>) {
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

    if (res.ok) {
      setSent(true);
    } else {
      setError(data.error ?? "Something went wrong.");
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
            <h1 className="text-base font-semibold mb-4" style={{ color: "var(--text)" }}>
              Sign in
            </h1>
            <div>
              <label htmlFor="email" className="block text-xs font-medium mb-1.5 text-gray-400">
                Email address
              </label>
              <input
                id="email"
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
      </div>
    </div>
  );
}
