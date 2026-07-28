"use client";

import { useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type ReconciliationResult = {
  matchup: string;
  awayScore: number | null;
  homeScore: number | null;
  providerAwayScore?: number | null;
  providerHomeScore?: number | null;
  state: "match" | "mismatch" | "not_reported" | "provider_not_final";
};

type ReconciliationResponse = {
  checkedAt: string;
  checkedGames: number;
  mismatches: number;
  results: ReconciliationResult[];
};

export default function FinalScoreReconciliation() {
  const [result, setResult] = useState<ReconciliationResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function check() {
    setErrorMessage("");
    setIsChecking(true);
    try {
      const response = await fetchWithSession("/api/admin/reconcile-finals", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Final-score reconciliation could not run.");
      setResult(data);
    } catch (error) {
      setErrorMessage(error instanceof SessionUnavailableError ? error.message : error instanceof Error ? error.message : "Final-score reconciliation could not run.");
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <section className="border-b-2 border-zinc-900 py-8" id="final-score-reconciliation">
      <h2 className="font-serif text-2xl font-bold">Final Score Reconciliation</h2>
      <p className="mt-2 text-zinc-700">Read-only comparison of recently saved finals against the score provider. It never alters scores, grades, or Survivor entries.</p>
      <button className="mt-5 bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-40" disabled={isChecking} onClick={check} type="button">{isChecking ? "Reconciling finals..." : "Reconcile recent finals"}</button>
      {errorMessage ? <p className="mt-4 font-semibold text-red-700">{errorMessage}</p> : null}
      {result ? (
        <div className={`mt-5 border p-4 ${result.mismatches ? "border-red-700 bg-red-50 text-red-950" : "border-green-800 bg-green-50 text-green-950"}`}>
          <p className="font-bold">{result.mismatches ? `${result.mismatches} score mismatch${result.mismatches === 1 ? "" : "es"} needs review.` : "All recently saved finals match the provider."}</p>
          <p className="mt-1 text-sm">Checked {result.checkedGames} final game{result.checkedGames === 1 ? "" : "s"} at {new Date(result.checkedAt).toLocaleString()}.</p>
          {result.results.filter((game) => game.state !== "match").map((game) => (
            <p className="mt-2 text-sm" key={game.matchup}>{game.matchup}: stored {game.awayScore}–{game.homeScore} · {game.state === "mismatch" ? `provider ${game.providerAwayScore}–${game.providerHomeScore}` : game.state === "not_reported" ? "not currently in provider feed" : "provider not final"}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
