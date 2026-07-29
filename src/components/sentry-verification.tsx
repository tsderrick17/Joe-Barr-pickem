"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function SentryVerification() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function sendTest() {
    setMessage("");

    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
      setMessage("Sentry is not available to this browser. Recreate NEXT_PUBLIC_SENTRY_DSN in Vercel as a non-sensitive Production variable, then redeploy.");
      return;
    }

    setSending(true);

    try {
      Sentry.withScope((scope) => {
        scope.setTag("verification", "commissioner-browser-test");
        scope.setLevel("warning");
        Sentry.captureException(new Error("Sentry verification test — safe to resolve"));
      });

      await Sentry.flush(2000);
      setMessage("Test event sent. Open Sentry and look for “Sentry verification test — safe to resolve” in Issues.");
    } catch {
      setMessage("The browser could not send the Sentry test event. Check the DSN setting and redeploy from Vercel.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={sending}
        onClick={sendTest}
        type="button"
      >
        {sending ? "Sending Sentry test..." : "Send Sentry browser test"}
      </button>
      {message ? <p className="max-w-xl text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}
