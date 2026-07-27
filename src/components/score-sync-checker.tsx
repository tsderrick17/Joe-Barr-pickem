"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type ScoreSyncResult = {
  message: string;
  eligibleGames: number;
  providerChecked: boolean;
  finalScoresImported: number;
  picksGraded: number;
  picksAwaitingLine: number;
  warnings: string[];
  weekRollover?: {
    action: "activated" | "waiting" | "completed" | "blocked" | "none";
    currentWeek: string | null;
    nextWeek: string | null;
    rolloverAt: string | null;
    reason: string | null;
  };
};

type ScoreSyncDetails = Omit<ScoreSyncResult, "message">;

type LatestRun = {
  status: "success" | "failed" | "started";
  started_at: string;
  completed_at: string | null;
  details: ScoreSyncDetails | null;
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

export default function ScoreSyncChecker() {
  const [result, setResult] = useState<ScoreSyncResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [latestRun, setLatestRun] = useState<LatestRun | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);

  async function checkFinalScores() {
    setErrorMessage("");
    setResult(null);
    setIsChecking(true);

    try {
      const response = await fetchWithSession("/api/admin/sync-scores", {
        method: "POST",
      });
      const data = await readResponse(response);

      if (!response.ok) {
        setErrorMessage(data.error ?? "The final score check failed.");
        return;
      }

      setResult(data);
    } catch (error) {
      setErrorMessage(
        error instanceof SessionUnavailableError
          ? error.message
          : "The final score check failed. Please try again.",
      );
    } finally {
      setIsChecking(false);
    }
  }

  async function requestLatestCheck() {
    const response = await fetchWithSession("/api/admin/sync-scores");
    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(
        data.error ?? "The latest score check could not be loaded.",
      );
    }

    return data.latestRun as LatestRun | null;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialCheck() {
      try {
        const latestCheck = await requestLatestCheck();

        if (!cancelled) {
          setLatestRun(latestCheck);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "The latest score check could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingLatest(false);
        }
      }
    }

    void loadInitialCheck();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadLatestCheck() {
    setErrorMessage("");
    setIsLoadingLatest(true);

    try {
      setLatestRun(await requestLatestCheck());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The latest score check could not be loaded.",
      );
    } finally {
      setIsLoadingLatest(false);
    }
  }

  return (
    <section className="border-b-2 border-zinc-900 py-8" id="final-score-check">
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
      <button
        className="ml-3 mt-5 border border-zinc-900 bg-white px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40"
        disabled={isLoadingLatest}
        onClick={loadLatestCheck}
        type="button"
      >
        {isLoadingLatest ? "Loading score history..." : "View most recent check"}
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
          {result.warnings.length > 0 ? (
            <div className="mt-3 text-sm font-semibold text-amber-900">
              {result.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {result?.weekRollover && result.weekRollover.action !== "none" ? (
        <div className="mt-5 border border-zinc-400 bg-white p-4 text-zinc-900">
          <p className="font-bold">Weekly handoff</p>
          <p className="mt-1 text-sm">
            {result.weekRollover.action === "completed"
              ? `${result.weekRollover.currentWeek} was rubber-stamped${
                  result.weekRollover.nextWeek
                    ? ` and ${result.weekRollover.nextWeek} is now active.`
                    : "."
                }`
              : result.weekRollover.action === "activated"
                ? `${result.weekRollover.currentWeek} is now active.`
              : result.weekRollover.reason}
          </p>
          {result.weekRollover.rolloverAt ? (
            <p className="mt-1 text-sm text-zinc-700">
              Scheduled handoff: {new Date(result.weekRollover.rolloverAt).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {latestRun ? (
        <div className={`mt-5 border p-4 ${latestRun.status === "failed" ? "border-red-700 bg-red-50 text-red-950" : "border-zinc-400 bg-white"}`}>
          <p className="font-bold">
            Most recent check: {latestRun.status === "success" ? "completed" : latestRun.status}
          </p>
          <p className="mt-1 text-sm">
            Started {new Date(latestRun.started_at).toLocaleString()}
            {latestRun.completed_at ? ` · Finished ${new Date(latestRun.completed_at).toLocaleString()}` : ""}
          </p>
          {latestRun.details ? (
            <p className="mt-2 text-sm">
              Eligible games: {latestRun.details.eligibleGames} · Finals
              saved: {latestRun.details.finalScoresImported} · Picks graded:{" "}
              {latestRun.details.picksGraded}
              {latestRun.details.picksAwaitingLine > 0
                ? ` · Picks awaiting an official line: ${latestRun.details.picksAwaitingLine}`
                : ""}
            </p>
          ) : null}
          {latestRun.details?.weekRollover &&
          latestRun.details.weekRollover.action !== "none" ? (
            <p className="mt-2 text-sm">
              Weekly handoff: {latestRun.details.weekRollover.reason ?? "completed"}
            </p>
          ) : null}
          {latestRun.details?.warnings?.map((warning) => (
            <p className="mt-2 text-sm font-semibold text-amber-900" key={warning}>
              {warning}
            </p>
          ))}
          {latestRun.error_message ? <p className="mt-1 text-sm font-semibold">{latestRun.error_message}</p> : null}
        </div>
      ) : null}

      {!isLoadingLatest && !latestRun && !errorMessage ? (
        <p className="mt-5 text-sm text-zinc-600">
          No final score checks have been recorded yet.
        </p>
      ) : null}
    </section>
  );
}
