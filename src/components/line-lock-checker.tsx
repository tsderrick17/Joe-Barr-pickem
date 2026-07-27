"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type LockResult = {
  message: string;
  checkedAt: string;
  dueGames: number;
  lockedGames: number;
  fallbackLocks: number;
  pickEmLocks: number;
  missingGames: string[];
  providerAvailable: boolean;
  requestsRemaining: string | null;
  warnings: string[];
};

export default function LineLockChecker() {
  const [result, setResult] = useState<LockResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);

  async function checkOfficialLines() {
    setResult(null);
    setErrorMessage("");
    setIsChecking(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setErrorMessage(
        "Please sign in before checking official spreads.",
      );
      setIsChecking(false);
      return;
    }

    const response = await fetch("/api/admin/lock-lines", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();

    setIsChecking(false);

    if (!response.ok) {
      setErrorMessage(
        data.error ?? "The official spread check failed.",
      );
      return;
    }

    setResult(data);
  }

  return (
    <section className="mt-8 border-y-2 border-zinc-900 py-8">
      <h2 className="font-serif text-2xl font-bold">
        Official Spread Locks
      </h2>

      <p className="mt-2 text-zinc-700">
        Locks only games whose scheduled official spread time has
        arrived. It is safe to run this check more than once.
      </p>

      <button
        type="button"
        disabled={isChecking}
        onClick={checkOfficialLines}
        className="mt-6 bg-zinc-900 px-5 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isChecking
          ? "Checking official spreads..."
          : "Check official spread locks"}
      </button>

      {errorMessage ? (
        <p className="mt-5 font-semibold text-red-700">
          {errorMessage}
        </p>
      ) : null}

      {result ? (
        <div className="mt-6 border border-green-800 bg-green-50 p-5 text-green-950">
          <p className="font-bold">{result.message}</p>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="font-bold">Games due</dt>
              <dd>{result.dueGames}</dd>
            </div>

            <div>
              <dt className="font-bold">Lines locked</dt>
              <dd>{result.lockedGames}</dd>
            </div>

            <div>
              <dt className="font-bold">Fallbacks used</dt>
              <dd>{result.fallbackLocks}</dd>
            </div>

            <div>
              <dt className="font-bold">Pick&apos;em lines</dt>
              <dd>{result.pickEmLocks}</dd>
            </div>
          </dl>

          {result.missingGames.length > 0 ? (
            <div className="mt-4">
              <p className="font-bold">Games needing attention:</p>

              <ul className="mt-1 list-disc pl-5">
                {result.missingGames.map((game) => (
                  <li key={game}>{game}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.warnings.length > 0 ? (
            <div className="mt-4">
              {result.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
