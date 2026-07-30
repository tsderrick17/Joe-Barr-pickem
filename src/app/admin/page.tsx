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
import GameDayPlaybook from "@/components/game-day-playbook";
import AutomationPreflight from "@/components/automation-preflight";
import FinalScoreReconciliation from "@/components/final-score-reconciliation";
import SentryVerification from "@/components/sentry-verification";

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

const commissionerPanels = [
  ["overview", "Overview", "Daily status, player tools, and connected services"],
  ["game-day", "Game day", "Readiness, official lines, final scores, and reconciliation"],
  ["season-setup", "Season setup", "Review odds and bring in a new schedule"],
  ["integrity", "Integrity", "Read-only audits and rare game exceptions"],
] as const;

type CommissionerPanel = (typeof commissionerPanels)[number][0];

export default function AdminPage() {
  const [activePanel, setActivePanel] = useState<CommissionerPanel>("overview");
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
            <Link href="/preview">Season rehearsal</Link>
            <Link href="/admin/players">Players</Link>
            <Link href="/admin/reminders">Reminders</Link>
          </div>
        </header>

        <nav aria-label="Commissioner sections" className="mt-6 grid grid-cols-2 gap-2 border-b-2 border-zinc-900 pb-6 sm:grid-cols-4">
          {commissionerPanels.map(([panel, label, description]) => (
            <button
              aria-pressed={activePanel === panel}
              className={`min-h-20 border px-4 py-3 text-left transition ${activePanel === panel ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-400 bg-white hover:border-zinc-900"}`}
              key={panel}
              onClick={() => setActivePanel(panel)}
              type="button"
            >
              <span className="block font-serif text-xl font-bold">{label}</span>
              <span className={`mt-1 block text-xs leading-4 ${activePanel === panel ? "text-zinc-200" : "text-zinc-600"}`}>{description}</span>
            </button>
          ))}
        </nav>

        {activePanel === "overview" ? <>
        <section className="border-b-2 border-zinc-900 py-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl font-bold">Pool controls</h2>
              <p className="mt-1 text-sm text-zinc-700">Start here for routine work and a quick view of the systems supporting the pool.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link className="border border-zinc-400 bg-white px-4 py-3 transition hover:border-zinc-900 hover:bg-[#fffaf0]" href="/admin/players"><span className="block font-bold">Player setup</span><span className="mt-1 block text-sm text-zinc-700">Manage the roster and commissioner access.</span></Link>
            <Link className="border border-zinc-400 bg-white px-4 py-3 transition hover:border-zinc-900 hover:bg-[#fffaf0]" href="/admin/reminders"><span className="block font-bold">Player reminders</span><span className="mt-1 block text-sm text-zinc-700">Review preferences and reminder delivery.</span></Link>
            <Link className="border border-zinc-400 bg-white px-4 py-3 transition hover:border-zinc-900 hover:bg-[#fffaf0]" href="/preview"><span className="block font-bold">Season rehearsal</span><span className="mt-1 block text-sm text-zinc-700">Preview game states without live records.</span></Link>
          </div>
        </section>
        <AutomationHealth />
        <section className="border-b-2 border-zinc-900 py-7">
          <h2 className="font-serif text-2xl font-bold">Connected systems</h2>
          <p className="mt-1 text-sm text-zinc-700">Open a service only when you need to inspect its own dashboard.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Vercel", "Live site and deployments", "https://vercel.com/tsderrick/pickem"],
              ["Supabase", "Database, sign-in, and scheduled automation", "https://supabase.com/dashboard/project/qtuycmgjiizrahfchsxe"],
              ["GitHub Actions", "Migration deployment history", "https://github.com/tsderrick17/Joe-Barr-pickem/actions"],
              ["Brevo", "Reminder email delivery", "https://app.brevo.com/"],
              ["Sentry", "Application error reports", "https://sentry.io/"],
              ["UptimeRobot", "External health alerts", "https://dashboard.uptimerobot.com/"],
              ["The Odds API", "NFL odds source", "https://the-odds-api.com/"],
            ].map(([name, description, href]) => (
              <a className="border border-zinc-400 bg-white px-4 py-3 transition hover:border-zinc-900 hover:bg-[#fffaf0]" href={href} key={name} rel="noreferrer" target="_blank">
                <span className="block font-bold">{name} ↗</span>
                <span className="mt-1 block text-sm text-zinc-700">{description}</span>
              </a>
            ))}
          </div>
          <SentryVerification />
        </section>
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

        {activePanel === "integrity" ? <>
          <section className="border-b-2 border-zinc-900 py-7">
            <h2 className="font-serif text-2xl font-bold">Integrity and exceptions</h2>
            <p className="mt-1 text-zinc-700">Read-only checks come first. Record an exception only after it has been verified.</p>
          </section>
          <IntegrityRehearsal />
          <GameExceptions />
        </> : null}

        {activePanel === "season-setup" ? <>
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
        </> : null}
      </div>
    </main>
  );
}
