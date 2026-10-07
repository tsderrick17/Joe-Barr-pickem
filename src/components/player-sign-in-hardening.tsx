"use client";

import { useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

export default function PlayerSignInHardening() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function hardenAccounts() {
    if (!window.confirm("Rotate every player account to protected sign-in credentials? Existing four-digit PINs will not change.")) return;
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetchWithSession("/api/admin/security/player-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "HARDEN PLAYER SIGN-INS" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Player sign-ins could not be hardened.");
      setMessage(data.message);
    } catch (reason) {
      setError(
        reason instanceof SessionUnavailableError || reason instanceof Error
          ? reason.message
          : "Player sign-ins could not be hardened.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="commissioner-tool" aria-labelledby="player-sign-in-hardening-title">
      <p className="commissioner-tool-eyebrow">SECURITY</p>
      <h2 className="mt-1 font-serif text-2xl font-bold" id="player-sign-in-hardening-title">Player sign-ins</h2>
      <p className="mt-2 text-sm text-zinc-700">Replace predictable legacy Auth passwords with server-protected credentials. Player PINs stay the same. The operation is audited and safe to re-run.</p>
      <button className="mt-4 bg-zinc-900 px-4 py-2 font-bold text-white disabled:opacity-40" disabled={busy || Boolean(message)} onClick={hardenAccounts} type="button">
        {busy ? "Hardening sign-ins…" : message ? "Sign-ins hardened" : "Harden player sign-ins"}
      </button>
      {message ? <p className="mt-3 text-sm font-semibold text-green-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </section>
  );
}
