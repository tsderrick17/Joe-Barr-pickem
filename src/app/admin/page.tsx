"use client";

import Link from "next/link";
import { useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import GameExceptions from "@/components/game-exceptions";
import LineLockChecker from "@/components/line-lock-checker";
import ScoreSyncChecker from "@/components/score-sync-checker";
import AutomationHealth from "@/components/automation-health";
import IntegrityRehearsal from "@/components/integrity-rehearsal";
import SeasonRecoveryRehearsal from "@/components/season-recovery-rehearsal";
import GameDayPlaybook from "@/components/game-day-playbook";
import AutomationPreflight from "@/components/automation-preflight";
import FinalScoreReconciliation from "@/components/final-score-reconciliation";
import SentryVerification from "@/components/sentry-verification";
import SeasonReadiness from "@/components/season-readiness";
import OpeningWeekChecklist from "@/components/opening-week-checklist";
import CommissionerHandbook from "@/components/commissioner-handbook";
import AutomationWatchdog from "@/components/automation-watchdog";
import SeasonBootstrapStatus from "@/components/season-bootstrap-status";
import CommissionerOperationsMap from "@/components/commissioner-operations-map";
import AccountCapacityPanel from "@/components/account-capacity";

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

type FullSchedulePreview = {
  season: number;
  games: number;
  weeks: number;
  weekCounts: Record<string, number>;
  source: string;
  note: string;
};

const commissionerPanels = [
  ["overview", "Today", "Start here: launch status and common tasks"],
  ["game-day", "Game day", "Locks, scores, and the normal operating order"],
  ["season-setup", "Schedule", "Preview odds and bring in a new season"],
  ["safeguards", "Safeguards", "Integrity checks, exceptions, and the runbook"],
] as const;

type CommissionerPanel = (typeof commissionerPanels)[number][0];

export default function AdminPage() {
  const [activePanel, setActivePanel] = useState<CommissionerPanel>("overview");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [preview, setPreview] = useState<OddsPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [importPreview, setImportPreview] =
    useState<ImportPreview | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState("");
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [fullSchedulePreview, setFullSchedulePreview] = useState<FullSchedulePreview | null>(null);
  const [fullScheduleMessage, setFullScheduleMessage] = useState("");
  const [fullScheduleError, setFullScheduleError] = useState("");
  const [fullScheduleBusy, setFullScheduleBusy] = useState(false);

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
      `Import ${importPreview.games.length} scheduled games into the ${CURRENT_SEASON_YEAR} season?\n\nThis adds games and preliminary DraftKings spread history. It does not lock any official lines.`,
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

  async function previewFullSchedule() {
    setFullScheduleBusy(true); setFullScheduleError(""); setFullScheduleMessage("");
    try {
      const response = await fetchWithSession("/api/admin/import-full-schedule");
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error ?? "The full-season schedule could not be validated.");
      setFullSchedulePreview(data);
    } catch (error) {
      setFullScheduleError(error instanceof Error ? error.message : "The full-season schedule could not be validated.");
    } finally { setFullScheduleBusy(false); }
  }

  async function importFullSchedule() {
    if (!fullSchedulePreview || !window.confirm(`Load and permanently pin all ${fullSchedulePreview.games} regular-season games for ${fullSchedulePreview.season}?`)) return;
    setFullScheduleBusy(true); setFullScheduleError(""); setFullScheduleMessage("");
    try {
      const response = await fetchWithSession("/api/admin/import-full-schedule", { method: "POST" });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error ?? "The full-season schedule could not be imported.");
      setFullScheduleMessage(data.message);
    } catch (error) {
      setFullScheduleError(error instanceof Error ? error.message : "The full-season schedule could not be imported.");
    } finally { setFullScheduleBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#f7f3e8] px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-col gap-6 border-b-2 border-zinc-900 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">
              COMMISSIONER
            </p>

            <h1 className="mt-2 font-serif text-4xl font-bold">
              Commissioner Desk
            </h1>

            <p className="mt-2 text-zinc-700">
              Run the pool from one place. Routine work is separated from season setup and rare recovery tools.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold underline sm:justify-end">
            <Link href="/admin/players">Players</Link>
            <Link href="/admin/reminders">Emails</Link>
            <Link href="/archive">Archive</Link>
            <Link href="/preview">Rehearsal</Link>
          </div>
        </header>

        <nav aria-label="Commissioner sections" className="mt-5 border-b-2 border-zinc-900 pb-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
          {commissionerPanels.map(([panel, label]) => (
            <button
              aria-pressed={activePanel === panel}
              className={`border-b-4 px-1 py-2 text-left font-serif text-xl font-bold transition ${activePanel === panel ? "border-zinc-900 text-zinc-950" : "border-transparent text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"}`}
              key={panel}
              onClick={() => setActivePanel(panel)}
              type="button"
            >
              {label}
            </button>
          ))}
          </div>
          <p className="mt-2 text-sm text-zinc-600">{commissionerPanels.find(([panel]) => panel === activePanel)?.[2]}</p>
        </nav>

        {activePanel === "overview" ? <>
        <CommissionerOperationsMap />
        <section className="border-b-2 border-zinc-900 py-7">
          <details onToggle={(event) => setShowDiagnostics(event.currentTarget.open)}>
            <summary className="cursor-pointer font-serif text-xl font-bold">Detailed diagnostics and manual recovery</summary>
            <p className="mt-2 text-sm text-zinc-700">Open this only when the operations map points to a hold, or when you want the full launch and season-readiness reports.</p>
            {showDiagnostics ? <>
              <OpeningWeekChecklist />
              <AutomationWatchdog />
              <AutomationHealth />
              <SeasonReadiness />
            </> : null}
          </details>
        </section>
        <AccountCapacityPanel />
        <SentryVerification />
        </> : null}

        {activePanel === "game-day" ? <>
          <section className="border-b-2 border-zinc-900 py-7">
            <h2 className="font-serif text-2xl font-bold">Game day operations</h2>
            <p className="mt-1 text-zinc-700">Use these checks in order. Scheduled automation remains the primary path.</p>
          </section>
          <GameDayPlaybook />
          <AutomationPreflight />
          <LineLockChecker />
          <ScoreSyncChecker />
          <FinalScoreReconciliation />
        </> : null}

        {activePanel === "safeguards" ? <>
          <section className="border-b-2 border-zinc-900 py-7">
            <p className="text-xs font-black tracking-[0.16em] text-zinc-600">RARELY NEEDED</p>
            <h2 className="mt-1 font-serif text-2xl font-bold">Safeguards and recovery</h2>
            <p className="mt-1 text-zinc-700">Read-only checks come first. Record an exception only after it has been verified.</p>
          </section>
          <IntegrityRehearsal />
          <SeasonRecoveryRehearsal />
          <GameExceptions />
          <CommissionerHandbook />
        </> : null}

        {activePanel === "season-setup" ? <>
        <SeasonBootstrapStatus />
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

          <div className="mt-5 border-2 border-zinc-900 bg-white p-5">
            <h3 className="font-serif text-xl font-bold">Preseason full-schedule bootstrap</h3>
            <p className="mt-2 text-sm text-zinc-700">Run once during preseason. It validates all 272 regular-season games and all 18 weeks before saving anything, then permanently pins every matchup to its pool week.</p>
            <button className="mt-4 bg-zinc-900 px-4 py-2 font-bold text-white disabled:opacity-40" disabled={fullScheduleBusy} onClick={previewFullSchedule}>{fullScheduleBusy ? "Checking..." : "Validate full season"}</button>
            {fullSchedulePreview ? <div className="mt-4"><p className="font-semibold">{fullSchedulePreview.games} games across {fullSchedulePreview.weeks} weeks passed provider validation. {fullSchedulePreview.note}</p><button className="mt-3 bg-red-800 px-4 py-2 font-bold text-white disabled:opacity-40" disabled={fullScheduleBusy} onClick={importFullSchedule}>Load and pin full season</button></div> : null}
            {fullScheduleMessage ? <p className="mt-4 font-semibold text-green-800">{fullScheduleMessage}</p> : null}
            {fullScheduleError ? <p className="mt-4 font-semibold text-red-700">{fullScheduleError}</p> : null}
          </div>

          <p className="mt-2 text-zinc-700">
            During the season, each import checks the complete canonical NFL schedule first, then refreshes current DraftKings line history. Safe future kickoff changes apply automatically; anything locked, settled, or cross-week is held for review without stopping the rest of the refresh.
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
        </> : null}

      </div>
    </main>
  );
}
