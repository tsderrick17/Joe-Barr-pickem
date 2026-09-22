"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { CURRENT_SEASON_YEAR } from "@/lib/season";

const GameExceptions = dynamic(() => import("@/components/game-exceptions"));
const BowlPoolExceptions = dynamic(() => import("@/components/bowl-pool-exceptions"));
const LineLockChecker = dynamic(() => import("@/components/line-lock-checker"));
const ScoreSyncChecker = dynamic(() => import("@/components/score-sync-checker"));
const AutomationHealth = dynamic(() => import("@/components/automation-health"));
const GameDayPlaybook = dynamic(() => import("@/components/game-day-playbook"));
const AutomationPreflight = dynamic(() => import("@/components/automation-preflight"));
const FinalScoreReconciliation = dynamic(() => import("@/components/final-score-reconciliation"));
const SentryVerification = dynamic(() => import("@/components/sentry-verification"));
const SeasonReadiness = dynamic(() => import("@/components/season-readiness"));
const OpeningWeekChecklist = dynamic(() => import("@/components/opening-week-checklist"));
const CommissionerHandbook = dynamic(() => import("@/components/commissioner-handbook"));
const AutomationWatchdog = dynamic(() => import("@/components/automation-watchdog"));
const SeasonBootstrapStatus = dynamic(() => import("@/components/season-bootstrap-status"));
const CommissionerOperationsMap = dynamic(() => import("@/components/commissioner-operations-map"));
const AccountCapacityPanel = dynamic(() => import("@/components/account-capacity"));
const BowlPoolReadiness = dynamic(() => import("@/components/bowl-pool-readiness"));
const GradingDashboard = dynamic(() => import("@/components/grading-dashboard"));

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
  ["overview", "Overview", "Live pool status, priorities, and the next safe move.", "01"],
  ["grading", "Grading", "Settlement, freshness, provider efficiency, and exceptions.", "02"],
  ["game-day", "Game day", "The focused checklist for locks, finals, and integrity holds.", "03"],
  ["season-setup", "Season", "Schedule preparation and change control.", "04"],
  ["system", "System", "Capacity, automation health, and carefully contained recovery tools.", "05"],
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
    <main className="commissioner-desk min-h-screen bg-[#f7f3e8] px-4 py-5 text-zinc-900 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="commissioner-command-bar">
          <div className="commissioner-command-title">
            <p className="text-[11px] font-black tracking-[0.22em] text-emerald-200">JOE BARR PICK’EM · COMMISSIONER</p>
            <h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">Operations desk</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base">One calm place to see the pool’s live state, understand the next move, and act without disturbing scheduled automation.</p>
          </div>

          <div className="commissioner-command-links" aria-label="Commissioner shortcuts">
            <Link href="/admin/players"><span>Roster</span><strong>Players</strong></Link>
            <Link href="/admin/reminders"><span>Delivery</span><strong>Email center</strong></Link>
          </div>
        </header>

        <nav aria-label="Commissioner sections" className="commissioner-panel-nav">
          <div className="commissioner-panel-tabs">
          {commissionerPanels.map(([panel, label, description, number]) => (
            <button
              aria-pressed={activePanel === panel}
              aria-label={`${label}. ${description}`}
              className={`commissioner-panel-tab ${activePanel === panel ? "is-active" : ""}`}
              key={panel}
              onClick={() => setActivePanel(panel)}
              type="button"
            >
              <span>{number}</span>{label}
            </button>
          ))}
          </div>
          <p className="commissioner-panel-description">{commissionerPanels.find(([panel]) => panel === activePanel)?.[2]}</p>
        </nav>

        {activePanel === "overview" ? <>
        <CommissionerOperationsMap onOpenWorkspace={setActivePanel} />
        <section className="commissioner-workspace-section">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[.16em] text-zinc-600">QUICK ROUTES</p>
              <h2 className="mt-1 font-serif text-2xl font-bold">Common commissioner work</h2>
              <p className="mt-1 max-w-2xl text-sm text-zinc-700">Use the live map above for the pool’s status. These routes are for the work around it.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <Link className="commissioner-route-card" href="/admin/players"><span>ROSTER CONTROL</span><p>Players</p><small>Add players, review activity, and manage private PINs.</small><strong>OPEN PLAYERS →</strong></Link>
            <Link className="commissioner-route-card" href="/admin/reminders"><span>PLAYER DELIVERY</span><p>Email center</p><small>Check delivery, send a private test, or update future wording.</small><strong>OPEN EMAILS →</strong></Link>
            <button className="commissioner-route-card text-left" onClick={() => setActivePanel("season-setup")} type="button"><span>SEASON CONTROL</span><p>Season work</p><small>Review the schedule and imports before the season begins.</small><strong>OPEN SEASON →</strong></button>
          </div>
        </section>
        </> : null}

        {activePanel === "grading" ? <GradingDashboard /> : null}

        {activePanel === "game-day" ? <>
          <section className="commissioner-workspace-intro">
            <p>LIVE RUNBOOK</p>
            <h2>Game day operations</h2>
            <span>Use the playbook first. Open the manual groups only when a check is late, a game needs intervention, or an audit correction is required.</span>
          </section>
          <GameDayPlaybook />
          <section className="commissioner-diagnostics">
            <details>
              <summary>Automation checks and manual runs <span>Use when a scheduled lock or score sync needs verification</span></summary>
              <AutomationPreflight />
              <LineLockChecker />
              <ScoreSyncChecker />
            </details>
            <details>
              <summary>Exceptions and score corrections <span>Use for postponements, no contests, or a verified mismatch</span></summary>
              <FinalScoreReconciliation />
              <GameExceptions />
              <BowlPoolExceptions />
            </details>
          </section>
        </> : null}

        {activePanel === "system" ? <>
          <section className="commissioner-workspace-intro">
            <p>QUIET BY DESIGN</p>
            <h2>System health & safety</h2>
            <span>Use this page when the overview shows a hold, a provider limit is unclear, or an automation needs recovery. Most of it should stay green and untouched.</span>
          </section>
          <AccountCapacityPanel />
          <BowlPoolReadiness />
          <SentryVerification />
          <section className="commissioner-diagnostics">
            <details onToggle={(event) => setShowDiagnostics(event.currentTarget.open)}>
              <summary>Diagnostics and manual recovery <span>Open only when a live status flags a hold</span></summary>
              <p className="mt-2 max-w-2xl text-sm text-zinc-700">Open this when the operations map identifies a hold, or when you specifically need a full readiness report.</p>
              {showDiagnostics ? <>
                <OpeningWeekChecklist />
                <AutomationWatchdog />
                <AutomationHealth />
                <SeasonReadiness />
                <CommissionerHandbook />
              </> : null}
            </details>
          </section>
        </> : null}

        {activePanel === "season-setup" ? <>
        <section className="commissioner-workspace-intro">
          <p>SEASON CONTROL</p>
          <h2>Prepare carefully. Preserve forever.</h2>
          <span>Use this before opening a season or changing its schedule. Validate first, write once, and leave routine game-day work to the live runbook.</span>
        </section>
        <SeasonBootstrapStatus />
        <section className="commissioner-workspace-section">
          <p className="text-xs font-black tracking-[.16em] text-zinc-600">PRACTICE & CONTROL</p>
          <h2 className="mt-1 font-serif text-2xl font-bold">Rehearse safely, then publish</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-700">Use the live Slate and its receipts for settled history; this workspace stays focused on season setup.</p>
        </section>
        <section className="commissioner-tool-card mt-8">
          <p className="commissioner-tool-eyebrow">READ-ONLY PROVIDER CHECK</p>
          <h2 className="font-serif text-2xl font-bold">Odds feed</h2>

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

        <section className="commissioner-tool-card commissioner-tool-card--write">
          <p className="commissioner-tool-eyebrow">VALIDATE BEFORE WRITING</p>
          <h2 className="font-serif text-2xl font-bold">Import games</h2>

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
