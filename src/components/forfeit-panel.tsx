"use client";

import { useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

/**
 * The Forfeit link at the very bottom of the Slate, once the playoffs are open. It takes three separate clicks, each on a different
 * question, and the last one is the only one that does anything. Quiet by design: it should be findable but never in the way.
 */
const STEPS = [
  "Forfeit?",
  "Don’t give up, you still have a chance! Still want to forfeit?",
  "I understand this can’t be undone and my Pick’em season would end.",
] as const;

export default function ForfeitPanel() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function forfeit() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetchWithSession("/api/pickem/forfeit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ understood: true }) });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setMessage(body.error ?? "Your forfeit could not be saved. Nothing changed."); setBusy(false); return; }
      window.location.reload();
    } catch {
      setMessage("Your forfeit could not be saved. Nothing changed; please try again.");
      setBusy(false);
    }
  }

  return (
    <section aria-label="Forfeit the Pick’em season" className="forfeit-panel" data-step={step}>
      <button
        className="forfeit-button"
        disabled={busy}
        onClick={() => { if (step < STEPS.length - 1) setStep(step + 1); else void forfeit(); }}
        type="button"
      >
        {busy ? "Forfeiting…" : STEPS[step]}
      </button>
      {step > 0 && !busy ? <button className="forfeit-cancel" onClick={() => { setStep(0); setMessage(""); }} type="button">Never mind, I’m staying in</button> : null}
      {message ? <p className="forfeit-message" role="alert">{message}</p> : null}
    </section>
  );
}
