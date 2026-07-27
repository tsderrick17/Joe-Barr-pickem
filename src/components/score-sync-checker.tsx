"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type ScoreSyncResult = {
  message: string;
  eligibleGames: number;
  providerChecked: boolean;
  finalScoresImported: number;
  picksGraded: number;
  picksAwaitingLine: number;
};

export default function ScoreSyncChecker() {
  const [result, setResult] = useState<ScoreSyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function checkFinalScores() {
    setErrorMessage("");
    setResult(null);
    setIsChecking(true);

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      setErrorMessage("Please sign in before checking final scores.");
      setIsChecking(false);
      return;
    }

    const response = await fetch("/api/admin/sync-scores", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await response.json();
    setIsChecking(false);

    if (!response.ok) {
      setErrorMessage(data.error ?? "The final score check failed.");
      return;
    }

    setResult(data);
  }

  return (
    <section className="border-b-2 border-zinc-900 py-8">
      <h2 className="font-serif text-2xl font-bold">Final Score Check</h2>
      <p className="mt-2 text-zinc-700">
        This follows the automatic rule: only games at least three hours past
        kickoff are checked, and only final scores are saved.
      </p>
      <button
        className="mt-5 bg-zinc-900 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        disabled={isChecking}
        onClick={checkFinalScores}
        type="button"
      >
        {isChecking ? "Checking final scores..." : "Check final scores now"}
      </button>

      {errorMessage ? <p className="mt-4 font-semibold text-red-700">{errorMessage}</p> : null}

      {result ? (
        <div className="mt-5 border border-green-800 bg-green-50 p-4 text-green-950">
          <p className="font-bold">{result.message}</p>
          <p className="mt-1 text-sm">
            Eligible games: {result.eligibleGames} {" · "}
            {result.providerChecked ? "Score provider checked" : "Provider not needed"} {" · "}
            Finals saved: {result.finalScoresImported} {" · "}
            Picks graded: {result.picksGraded}
            {result.picksAwaitingLine > 0
              ? ` · Picks awaiting an official line: ${result.picksAwaitingLine}`
              : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
