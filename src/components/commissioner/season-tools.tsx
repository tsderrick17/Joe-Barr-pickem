"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { currentSeasonYear } from "@/lib/season";

const SeasonBootstrapStatus = dynamic(() => import("@/components/season-bootstrap-status"));
const SeasonReadiness = dynamic(() => import("@/components/season-readiness"));
const OpeningWeekChecklist = dynamic(() => import("@/components/opening-week-checklist"));

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

/** The Season page: set-up status, the readiness checks, the odds feed check and the game imports. */
export default function SeasonTools() {
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
      `Import ${importPreview.games.length} scheduled games into the ${currentSeasonYear()} season?\n\nThis adds games and preliminary DraftKings spread history. It does not lock any official lines.`,
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
    <>
      <SeasonBootstrapStatus />
      <section className="cw-section" aria-labelledby="cw-season-readiness">
        <h2 id="cw-season-readiness">Season readiness checks</h2>
        <p className="cw-section-line">Before the opener, or for a rare lifecycle recovery</p>
        <SeasonReadiness />
        <OpeningWeekChecklist />
      </section>
        <section className="commissioner-tool-card mt-8">
          <p className="commissioner-tool-eyebrow">READ-ONLY PROVIDER CHECK</p>
          <h2 className="font-serif text-2xl font-bold">Odds feed</h2>

          <p className="mt-2 text-(color:--themed-text-29)">
            This is a read-only preview. It does not add games or lock lines.
          </p>

          <button
            className="mt-5 desk-button-solid px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40"
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
              <p className="text-sm text-(color:--themed-text-28)">
                API requests remaining this month:{" "}
                <span className="font-bold">
                  {preview.requestsRemaining ?? "Not reported"}
                </span>
              </p>

              {preview.events.length === 0 ? (
                <p className="mt-4 text-(color:--themed-text-29)">
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
                        className="border border-zinc-400 bg-(color:--themed-bg-26) p-4"
                        key={event.id}
                      >
                        <p className="text-sm text-(color:--themed-text-28)">
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
                          <p className="mt-2 text-sm text-(color:--themed-text-28)">
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

          <div className="desk-panel mt-5 p-5">
            <h3 className="font-serif text-xl font-bold">Preseason full-schedule bootstrap</h3>
            <p className="mt-2 text-sm text-(color:--themed-text-29)">Run once during preseason. It validates every regular-season game and week (272 games over 18 weeks today; a longer season is read from the feed) before saving anything, then permanently pins every matchup to its pool week.</p>
            <button className="mt-4 desk-button-solid px-4 py-2 font-bold disabled:opacity-40" disabled={fullScheduleBusy} onClick={previewFullSchedule}>{fullScheduleBusy ? "Checking..." : "Validate full season"}</button>
            {fullSchedulePreview ? <div className="mt-4"><p className="font-semibold">{fullSchedulePreview.games} games across {fullSchedulePreview.weeks} weeks passed provider validation. {fullSchedulePreview.note}</p><button className="mt-3 bg-(color:--fill-danger-solid) px-4 py-2 font-bold text-white disabled:opacity-40" disabled={fullScheduleBusy} onClick={importFullSchedule}>Load and pin full season</button></div> : null}
            {fullScheduleMessage ? <p className="mt-4 font-semibold text-green-800">{fullScheduleMessage}</p> : null}
            {fullScheduleError ? <p className="mt-4 font-semibold text-red-700">{fullScheduleError}</p> : null}
          </div>

          <p className="mt-2 text-(color:--themed-text-29)">
            During the season, each import checks the complete canonical NFL schedule first, then refreshes current DraftKings line history. Safe future kickoff changes apply automatically; anything locked, settled, or cross-week is held for review without stopping the rest of the refresh.
          </p>

          <button
            className="mt-5 desk-button-solid px-5 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-40"
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
              <p className="text-(color:--themed-text-29)">
                Signed in as Commissioner {importPreview.commissioner}.{" "}
                {importPreview.note}
              </p>

              <p className="mt-2 text-sm text-(color:--themed-text-28)">
                Live games found:{" "}
                <span className="font-bold">{importPreview.games.length}</span>
                {" · "}API requests remaining:{" "}
                <span className="font-bold">
                  {importPreview.requestsRemaining ?? "Not reported"}
                </span>
              </p>

              <button
                className="mt-5 bg-(color:--fill-danger-solid) px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={isImporting}
                onClick={importGames}
              >
                {isImporting
                  ? "Importing games..."
                  : `Import ${importPreview.games.length} games`}
              </button>

              {importResult ? (
                <div className="mt-5 desk-status is-ok p-4">
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
                    className="border border-zinc-400 bg-(color:--themed-bg-26) p-4"
                    key={game.externalGameId}
                  >
                    <p className="text-sm text-(color:--themed-text-28)">
                      {new Date(game.kickoff).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm font-bold uppercase tracking-wide text-(color:--themed-text-28)">
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
                      <p className="mt-2 text-sm text-(color:--themed-text-28)">
                        DraftKings has not posted a spread for this game yet.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </section>
    </>
  );
}
