"use client";

import Link from "next/link";
import { useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import GameExceptions from "@/components/game-exceptions";
import LineLockChecker from "@/components/line-lock-checker";
import ScoreSyncChecker from "@/components/score-sync-checker";
import AutomationHealth from "@/components/automation-health";
import IntegrityRehearsal from "@/components/integrity-rehearsal";
import GameDayPlaybook from "@/components/game-day-playbook";
import AutomationPreflight from "@/components/automation-preflight";
import FinalScoreReconciliation from "@/components/final-score-reconciliation";

type Spread = {
  team: string;
  spread: number | null;
};

type BookmakerSpread = {
  source: string;
  outcomes: Spread[];
};

type OddsEvent = {
  id: string;
  kickoffAt: string;
  awayTeam: string;
  homeTeam: string;
  bookmakerSpreads: BookmakerSpread[];
};

type OddsPreview = {
  requestsRemaining: string | null;
  events: OddsEvent[];
};

type ImportGame = {
  externalGameId: string;
  kickoff: string;
  scoringWeek: string;
  awayTeam: string;
  homeTeam: string;
  spread: Array<{
    team: string;
    point: number | null;
  }>;
};

type ImportPreview = {
  commissioner: string;
  requestsRemaining: string | null;
  games: ImportGame[];
  note: string;
};

type ImportResult = {
  message: string;
  importedGames: number;
  preliminarySpreadsSaved: number;
  weeksUpdated: number;
  requestsRemaining: string | null;
};

export default function AdminPage() {
  const [preview, setPreview] = useState<OddsPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [importPreview, setImportPreview] =
    useState<ImportPreview | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState("");
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  async function readResponse(response: Response) {
    const text = await response.text();

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return {};
    }
  }

  async function previewOdds() {
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetchWithSession("/api/admin/odds-preview");
      const data = await readResponse(response);

      if (!response.ok) {
        setErrorMessage(data.error ?? "The odds preview could not load.");
        return;
      }

      setPreview(data);
    } catch (error) {
      setErrorMessage(
        error instanceof SessionUnavailableError
          ? error.message
          : "The odds preview could not load. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function previewImport() {
    setImportErrorMessage("");
    setImportResult(null);
    setIsImportLoading(true);

    try {
      const response = await fetchWithSession("/api/admin/import-preview");
      const data = await readResponse(response);

      if (!response.ok) {
        setImportErrorMessage(data.error ?? "The import preview could not load.");
        return;
      }

      setImportPreview(data);
    } catch (error) {
      setImportErrorMessage(
        error instanceof SessionUnavailableError
          ? error.message
          : "The import preview could not load. Please try again.",
      );
    } finally {
      setIsImportLoading(false);
    }
  }

  async function importGames() {
    if (!importPreview) {
      setImportErrorMessage("Preview the game import before importing.");
      return;
    }

    const confirmed = window.confirm(
      `Import ${importPreview.games.length} scheduled games into the 2026 season?\n\nThis adds games and preliminary DraftKings spread history. It does not lock any official lines.`,
    );

    if (!confirmed) {
      return;
    }

    setImportErrorMessage("");
    setImportResult(null);
    setIsImporting(true);

    try {
      const response = await fetchWithSession("/api/admin/import-games", {
        method: "POST",
      });
      const data = await readResponse(response);

      if (!response.ok) {
        setImportErrorMessage(data.error ?? "The game import could not run.");
        return;
      }

      setImportResult(data);
    } catch (error) {
      setImportErrorMessage(
        error instanceof SessionUnavailableError
          ? error.message
          : "The game import could not run. Please try again.",
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
              COMMISSIONER
            </p>

            <h1 className="mt-2 font-serif text-4xl font-bold">
              System Health
            </h1>

            <p className="mt-2 text-zinc-700">
              Check the live NFL data source before automation is turned on.
            </p>
          </div>

<div className="flex flex-col items-end gap-2">
  <Link className="border border-zinc-900 bg-zinc-900 px-3 py-2 text-sm font-bold text-white" href="/preview">
    Open season rehearsal
  </Link>

  <Link className="font-semibold underline" href="/login">
    Commissioner sign in
  </Link>

  <Link className="font-semibold underline" href="/admin/players">
    Player setup
  </Link>

  <Link className="font-semibold underline" href="/admin/reminders">
    Browser reminders
  </Link>

  <Link className="font-semibold underline" href="/">
    Back to Standings
  </Link>
</div>
        </header>
        <GameDayPlaybook />
        <AutomationPreflight />
        <AutomationHealth />
        <IntegrityRehearsal />
        <LineLockChecker />
        <ScoreSyncChecker />
        <FinalScoreReconciliation />
        <GameExceptions />

        <section className="mt-8 border-y-2 border-zinc-900 py-8">
          <h2 className="font-serif text-2xl font-bold">Odds Feed</h2>

          <p className="mt-2 text-zinc-700">
            This is a read-only preview. It does not add games or lock lines.
          </p>

          <button
            className="mt-5 bg-zinc-900 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isLoading}
            onClick={previewOdds}
          >
            {isLoading ? "Checking feed..." : "Check NFL odds feed"}
          </button>

          {errorMessage ? (
            <p className="mt-4 font-semibold text-red-700">{errorMessage}</p>
          ) : null}

          {preview ? (
            <div className="mt-8">
              <p className="text-sm text-zinc-600">
                API requests remaining this month:{" "}
                <span className="font-bold">
                  {preview.requestsRemaining ?? "Not reported"}
                </span>
              </p>

              {preview.events.length === 0 ? (
                <p className="mt-4 text-zinc-700">
                  No NFL games are listed right now.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  {preview.events.map((event) => {
                    const exampleLine = event.bookmakerSpreads.find(
                      (bookmaker) => bookmaker.outcomes.length === 2,
                    );

                    return (
                      <article
                        className="border border-zinc-400 bg-white p-4"
                        key={event.id}
                      >
                        <p className="text-sm text-zinc-600">
                          {new Date(event.kickoffAt).toLocaleString()}
                        </p>

                        <h3 className="mt-1 font-serif text-xl font-bold">
                          {event.awayTeam} at {event.homeTeam}
                        </h3>

                        {exampleLine ? (
                          <p className="mt-2 text-sm">
                            Example line from{" "}
                            <span className="font-semibold">
                              {exampleLine.source}
                            </span>
                            :{" "}
                            {exampleLine.outcomes
                              .map((outcome) => {
                                const sign =
                                  outcome.spread !== null &&
                                  outcome.spread > 0
                                    ? "+"
                                    : "";

                                return `${outcome.team} ${sign}${outcome.spread}`;
                              })
                              .join(" / ")}
                          </p>
                        ) : (
                          <p className="mt-2 text-sm text-zinc-600">
                            No spread is currently available.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </section>

        <section className="border-b-2 border-zinc-900 py-8">
          <h2 className="font-serif text-2xl font-bold">Import Games</h2>

          <p className="mt-2 text-zinc-700">
            Preview the live schedule first. Importing adds scheduled games and
            preliminary DraftKings line history, but never locks official lines.
          </p>

          <button
            className="mt-5 bg-zinc-900 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            disabled={isImportLoading || isImporting}
            onClick={previewImport}
          >
            {isImportLoading
              ? "Preparing preview..."
              : "Preview game import"}
          </button>

          {importErrorMessage ? (
            <p className="mt-4 font-semibold text-red-700">
              {importErrorMessage}
            </p>
          ) : null}

          {importPreview ? (
            <div className="mt-8">
              <p className="text-zinc-700">
                Signed in as Commissioner {importPreview.commissioner}.{" "}
                {importPreview.note}
              </p>

              <p className="mt-2 text-sm text-zinc-600">
                Live games found:{" "}
                <span className="font-bold">{importPreview.games.length}</span>
                {" · "}API requests remaining:{" "}
                <span className="font-bold">
                  {importPreview.requestsRemaining ?? "Not reported"}
                </span>
              </p>

              <button
                className="mt-5 bg-red-800 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isImporting}
                onClick={importGames}
              >
                {isImporting
                  ? "Importing games..."
                  : `Import ${importPreview.games.length} games`}
              </button>

              {importResult ? (
                <div className="mt-5 border border-green-800 bg-green-50 p-4 text-green-950">
                  <p className="font-bold">{importResult.message}</p>
                  <p className="mt-1 text-sm">
                    Games saved: {importResult.importedGames}
                    {" · "}Preliminary spreads saved:{" "}
                    {importResult.preliminarySpreadsSaved}
                    {" · "}Weeks updated: {importResult.weeksUpdated}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {importPreview.games.map((game) => (
                  <article
                    className="border border-zinc-400 bg-white p-4"
                    key={game.externalGameId}
                  >
                    <p className="text-sm text-zinc-600">
                      {new Date(game.kickoff).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm font-bold uppercase tracking-wide text-zinc-600">
  {game.scoringWeek}
</p>

                    <h3 className="mt-1 font-serif text-xl font-bold">
                      {game.awayTeam} at {game.homeTeam}
                    </h3>

                    {game.spread.length === 2 ? (
                      <p className="mt-2 text-sm">
                        DraftKings:{" "}
                        {game.spread
                          .map((outcome) => {
                            const sign =
                              outcome.point !== null && outcome.point > 0
                                ? "+"
                                : "";

                            return `${outcome.team} ${sign}${outcome.point}`;
                          })
                          .join(" / ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-600">
                        DraftKings has not posted a spread for this game yet.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
