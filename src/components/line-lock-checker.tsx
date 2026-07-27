"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

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

type LatestLockRun = {
  status: "success" | "failed" | "started";
  started_at: string;
  completed_at: string | null;
  details: Omit<LockResult, "message"> | null;
  error_message: string | null;
};

async function readResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export default function LineLockChecker() {
  const [result, setResult] = useState<LockResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [latestRun, setLatestRun] = useState<LatestLockRun | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);

  async function checkOfficialLines() {
    setResult(null);
    setErrorMessage("");
    setIsChecking(true);

    try {
      const response = await fetchWithSession("/api/admin/lock-lines", {
        method: "POST",
      });
      const data = await readResponse(response);

      if (!response.ok) {
        setErrorMessage(data.error ?? "The official spread check failed.");
        return;
      }

      setResult(data);
    } catch (error) {
      setErrorMessage(
        error instanceof SessionUnavailableError
          ? error.message
          : "The official spread check failed. Please try again.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  async function requestLatestLock() {
    const response = await fetchWithSession("/api/admin/lock-lines");
    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ?? "The latest official line lock could not be loaded.",
      );
    }

    return data.latestRun as LatestLockRun | null;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialLock() {
      try {
        const latestLock = await requestLatestLock();

        if (!cancelled) {
          setLatestRun(latestLock);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The latest official line lock could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLatest(false);
        }
      }
    }

    void loadInitialLock();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadLatestLock() {
    setErrorMessage("");
    setIsLoadingLatest(true);

    try {
      setLatestRun(await requestLatestLock());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The latest official line lock could not be loaded.",
      );
    } finally {
      setIsLoadingLatest(false);
    }
  }

  return (
    <section className="mt-8 border-y-2 border-zinc-900 py-8" id="official-spread-locks">
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
      <button
        className="ml-3 mt-6 border border-zinc-900 bg-white px-5 py-4 font-bold disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isLoadingLatest}
        onClick={loadLatestLock}
        type="button"
      >
        {isLoadingLatest ? "Loading lock history..." : "Refresh lock history"}
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

      {latestRun ? (
        <div
          className={`mt-6 border bg-white p-5 ${
            latestRun.status === "failed"
              ? "border-red-700"
              : "border-zinc-400"
          }`}
        >
          <p className="font-bold">Most recent official line lock</p>
          <p className="mt-1 text-sm text-zinc-700">
            Status: {latestRun.status === "failed" ? "Needs attention" : "Completed"}
            {" · "}
            Started {new Date(latestRun.started_at).toLocaleString()}
            {latestRun.completed_at
              ? ` · Finished ${new Date(latestRun.completed_at).toLocaleString()}`
              : ""}
          </p>
          {latestRun.details ? (
            <p className="mt-2 text-sm text-zinc-700">
              Games due: {latestRun.details.dueGames} · Lines locked:{" "}
              {latestRun.details.lockedGames} · Fallbacks used:{" "}
              {latestRun.details.fallbackLocks}
            </p>
          ) : null}
          {latestRun.error_message ? (
            <p className="mt-2 text-sm font-semibold text-red-700">
              {latestRun.error_message}
            </p>
          ) : null}
        </div>
      ) : null}

      {!isLoadingLatest && !latestRun && !errorMessage ? (
        <p className="mt-6 text-sm text-zinc-600">
          No official line locks have been recorded yet.
        </p>
      ) : null}
    </section>
  );
}
