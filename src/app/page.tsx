"use client";

import AtsResultStamp from "@/components/ats-result-stamp";
import { useEffect, useMemo, useRef, useState } from "react";
import PickemScoreboard from "@/components/pickem-scoreboard";
import MyTicket, { type TicketPick } from "@/components/my-ticket";
import SurvivorTable from "@/components/survivor-table";
import {
  fetchWithSession,
  SessionUnavailableError,
} from "@/lib/auth-session";
import BowlCard from "@/components/bowl-card";
import SeasonClosedBanner from "@/components/season-closed-banner";
import { useStableCallback } from "@/lib/use-stable-callback";
import { comparePickColumns } from "@/lib/pick-column-order.js";
import type { StandingsResponse as HomeData } from "@/lib/api-contracts";
import FootballLoader from "@/components/football-loader";
type DisplayPreferenceKey =
  | "showSurvivorStandings"
  | "showBowlCard"
  | "hidePickemEliminatedRows"
  | "hideSurvivorEliminatedRows";

/* While the signed-in data arrives, show only the spinning football on the page's own background. */
function StandingsLoadingShell() {
  return (
    <main aria-busy="true" className="grid min-h-screen place-items-center bg-(color:--themed-bg-18) text-(color:--themed-text-18)">
      <FootballLoader />
    </main>
  );
}

function ticketKickoff(value: string | null | undefined) {
  if (!value) return "Kickoff to be announced";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
  return `${date} · ${time}`;
}

const HOME_REFRESH_MS = 5 * 60_000;
const RETURN_REFRESH_GAP_MS = 30_000;

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  // A display choice is being saved (a second tap meanwhile is ignored). A ref, not state: changing it
  // must not redraw the page in the middle of a table rolling open or shut.
  const displaySaveInFlight = useRef(false);
  // The Standings page is revealed once both its own data and the Bowl Card's first load are in (or a
  // short wait has passed), so the Bowl Card never pops in after the rest of the page is already showing.
  const [bowlReady, setBowlReady] = useState(false);
  const markBowlReady = useStableCallback(() => setBowlReady(true));
  const hasData = data !== null;
  useEffect(() => {
    if (!hasData) return;
    const timer = window.setTimeout(() => setBowlReady(true), 2500);
    return () => window.clearTimeout(timer);
  }, [hasData]);
  const [bowlPoolMinimized, setBowlPoolMinimized] = useState(false);
  const serverClockOffset = useRef(0);
  // A background refresh can finish after a display preference save and carry
  // an older profile snapshot. Keep the user's just-saved choice in front of
  // that stale response until the next refresh confirms it from the server.
  const displayPreferenceOverrides = useRef<Partial<Record<DisplayPreferenceKey, boolean>>>({});

  useEffect(() => {
    let revealTimer: number | null = null;
    let activeRequest: AbortController | null = null;
    let hasLoaded = false;
    let lastLoadStartedAt = 0;

    async function loadHome() {
      lastLoadStartedAt = Date.now();
      const request = new AbortController();
      let requestTimedOut = false;
      const requestTimer = window.setTimeout(() => {
        requestTimedOut = true;
        request.abort();
      }, 15_000);

      try {
        activeRequest?.abort();
        activeRequest = request;

        const response = await fetchWithSession("/api/home", {
          signal: request.signal,
        });

        const result = (await response.json()) as HomeData;

        if (!response.ok) {
          setErrorMessage(result.error ?? "The Standings could not be loaded.");
          return;
        }

        const serverTimestamp = new Date(result.serverTime).getTime();
        if (!Number.isFinite(serverTimestamp)) {
          setErrorMessage("The Standings clock could not be verified safely.");
          return;
        }

        serverClockOffset.current = serverTimestamp - Date.now();

        setErrorMessage("");
        const effectiveResult = {
          ...result,
          ...displayPreferenceOverrides.current,
        };
        setData(effectiveResult);
        setBowlPoolMinimized(!effectiveResult.showBowlCard);
        hasLoaded = true;

        if (revealTimer !== null) {
          window.clearTimeout(revealTimer);
        }

        if (result.nextRevealAt) {
          const refreshDelay = Math.max(
            250,
            new Date(result.nextRevealAt).getTime() -
              (Date.now() + serverClockOffset.current) +
              250,
          );

          revealTimer = window.setTimeout(() => {
            void loadHome();
          }, refreshDelay);
        }
      } catch (error) {
        if (request.signal.aborted && !requestTimedOut) {
          return;
        }

        if (error instanceof SessionUnavailableError) {
          window.location.replace("/login");
          return;
        }

        if (!hasLoaded) {
          setErrorMessage(
            "The Standings are taking too long to load. Please try again.",
          );
        }
      } finally {
        window.clearTimeout(requestTimer);
        if (activeRequest === request) {
          activeRequest = null;
        }
      }
    }

    void loadHome();

    // Grades land on the ten-minute score sync and reveals have their own
    // exact timer, so a slow background poll plus a refresh whenever the
    // player returns keeps the page current without constant server work.
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadHome();
      }
    }, HOME_REFRESH_MS);

    const refreshOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadStartedAt < RETURN_REFRESH_GAP_MS) return;
      void loadHome();
    };

    window.addEventListener("focus", refreshOnReturn);
    document.addEventListener("visibilitychange", refreshOnReturn);

    return () => {
      window.clearInterval(refreshInterval);
      if (revealTimer !== null) {
        window.clearTimeout(revealTimer);
      }
      activeRequest?.abort();
      window.removeEventListener("focus", refreshOnReturn);
      document.removeEventListener("visibilitychange", refreshOnReturn);
    };
  }, [retryNonce]);

  const viewerRow = useMemo(() => {
    return data?.rows.find((row) => row.id === data.viewerPlayerId) ?? null;
  }, [data]);

  const viewerPicks = viewerRow?.picks.filter((pick) => Boolean(pick.label)) ?? [];
  const viewerSurvivor =
    data?.survivorRows.find((row) => row.playerId === data.viewerPlayerId) ?? null;
  // Same column order as the Pick'em Pad: kickoff, with the API's order (game id)
  // keeping simultaneous kickoffs where they are.
  const ticketPicks: TicketPick[] = [...viewerPicks]
    .sort((first, second) => comparePickColumns({ kickoffAt: first.kickoffAt }, { kickoffAt: second.kickoffAt }))
    .map((pick, index) => ({
    gameId: `viewer-pick-${index}`,
    team: pick.label ?? "Selection",
    kickoff: ticketKickoff(pick.kickoffAt),
    spread: pick.spread ?? null,
    lineLocked: Boolean(pick.isLineLocked),
    resultMark: pick.resultMark === "W" || pick.resultMark === "L" ? pick.resultMark : "",
  }));
  const survivorResultMark: "W" | "L" | "" = viewerSurvivor?.pick?.resultMark === "W"
    ? "W"
    : viewerSurvivor?.pick?.resultMark === "L"
      ? "L"
      : "";
  const ticketSurvivor = viewerSurvivor?.pick?.label
    ? {
        abbreviation: viewerSurvivor.pick.abbreviation ?? "NFL",
        team: viewerSurvivor.pick.label,
        kickoff: ticketKickoff(viewerSurvivor.pick.kickoffAt),
        resultMark: survivorResultMark,
      }
    : null;

  /**
   * Saves a display choice (show or hide a table, hide eliminated rows). The page changes at once
   * and the save follows in the background: waiting for the server before changing anything made
   * the roll start late, and the page then redrew twice more (saving flag on, then off) in the
   * middle of the animation. If the save fails, the choice is put back and the error shown.
   */
  async function saveDisplayChoice(field: DisplayPreferenceKey, value: boolean, apply: (value: boolean) => void, previous: boolean) {
    if (displaySaveInFlight.current) return;
    displaySaveInFlight.current = true;
    // A refresh that lands before the save finishes must not bring the old choice back.
    displayPreferenceOverrides.current[field] = value;
    apply(value);
    try {
      const response = await fetchWithSession("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error ?? "Unable to save that display choice.");
      }
    } catch (error) {
      displayPreferenceOverrides.current[field] = previous;
      apply(previous);
      setErrorMessage(error instanceof Error && error.message !== "Unable to save that display choice." ? error.message : "That display choice could not be saved. Please try again.");
    } finally {
      displaySaveInFlight.current = false;
    }
  }

  async function setSurvivorDisplay(show: boolean) {
    const apply = (value: boolean) => setData((current) => current ? { ...current, showSurvivorStandings: value } : current);
    await saveDisplayChoice("showSurvivorStandings", show, apply, !show);
  }

  async function setBowlCardDisplay(show: boolean) {
    const apply = (value: boolean) => {
      setBowlPoolMinimized(!value);
      setData((current) => current ? { ...current, showBowlCard: value } : current);
    };
    await saveDisplayChoice("showBowlCard", show, apply, !show);
  }

  async function setEliminatedRowsHidden(pool: "pickem" | "survivor", hidden: boolean) {
    const field = pool === "pickem" ? "hidePickemEliminatedRows" : "hideSurvivorEliminatedRows";
    const apply = (value: boolean) => setData((current) => current ? { ...current, [field]: value } : current);
    await saveDisplayChoice(field, hidden, apply, !hidden);
  }

  if (errorMessage && !data) {
    return (
      <main className="min-h-screen bg-(color:--themed-bg-18) p-8 text-(color:--themed-text-18)">
        <p className="font-semibold text-red-700">{errorMessage}</p>
        <button
          className="mt-5 bg-[#1d1d1f] px-5 py-3 font-bold text-white"
          onClick={() => setRetryNonce((value) => value + 1)}
          type="button"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!data) {
    return <StandingsLoadingShell />;
  }

  // The off-season shows every table whole: the hide and "− OUT" choices (and their buttons) are suspended until August 1.
  const offSeason = data.seasonPhase === "off_season";
  // A player out of the playoff race gets the same quiet page as the off-season: no ticket, a banner, until August 1.
  const viewerEliminated = Boolean(viewerRow?.playoffEliminated);
  const seasonClosedForViewer = offSeason || viewerEliminated;
  const shown = offSeason ? { ...data, showSurvivorStandings: true, hidePickemEliminatedRows: false, hideSurvivorEliminatedRows: false, showBowlCard: true } : data;

  return (
    <>
    {bowlReady ? null : <StandingsLoadingShell />}
    <div className={bowlReady ? undefined : "h-0 overflow-hidden"} inert={!bowlReady} style={bowlReady ? undefined : { visibility: "hidden" }}>
    <main className="min-h-screen bg-(color:--themed-bg-18) text-(color:--themed-text-18)">
      <div className="standings-stack mx-auto max-w-5xl px-4 sm:px-5 md:px-10">
        {errorMessage ? (
          <div className="mb-5 flex flex-col gap-3 border-2 border-(color:--themed-border-24) bg-(color:--themed-bg-24) p-4 text-red-900 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{errorMessage}</p>
            <button
              className="min-h-11 bg-red-800 px-4 py-2 font-bold text-white"
              onClick={() => setRetryNonce((value) => value + 1)}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : null}

        {seasonClosedForViewer ? <SeasonClosedBanner eliminated={!offSeason} /> : <MyTicket
          isPlayoff={data.isPlayoff}
          maxPicks={data.maxPicks}
          picks={ticketPicks}
          readOnly={data.weekStatus === "complete"}
          survivorAvailable={data.survivorAvailable}
          survivorPick={ticketSurvivor}
          survivorRequired={viewerSurvivor?.requiredThisPeriod}
          survivorStatus={data.survivorComplete ? "complete" : viewerSurvivor?.status ?? "active"}
          week={data.week}
        />}

        <PickemScoreboard
          hideEliminatedRows={shown.hidePickemEliminatedRows}
          isCommissioner={data.isCommissioner}
          seasonSnapshotReleased={data.seasonSnapshotReleased ?? false}
          isPlayoff={data.isPlayoff}
          maxPicks={data.maxPicks}
          onToggleEliminatedRows={offSeason ? undefined : () => void setEliminatedRowsHidden("pickem", !data.hidePickemEliminatedRows)}
          rows={data.rows}
          viewerPlayerId={data.viewerPlayerId}
          week={data.week}
        />
        {false ? (
        <section className="py-6 sm:py-7">
          <p className="mb-4 text-xs font-bold tracking-[0.2em] text-slate-600">
            PICK&apos;EM THIS WEEK
          </p>
          <div className="border-y-2 border-(color:--themed-border-10)">
            <table
              className="w-full table-fixed border-collapse text-left"
            >
              <thead>
                <tr className="border-b-2 border-(color:--themed-border-10) text-xs tracking-[0.14em]">
                  <th className="w-12 px-2 py-3 sm:w-20 sm:px-3">WINS</th>
                  <th className="w-20 px-2 py-3 sm:w-40 sm:px-3"><span className="sr-only">Player</span></th>
                   {Array.from({ length: data!.maxPicks }, (_, index) => (
                    <th className="px-2 py-3 sm:px-3" key={index}>
                      PICK {index + 1}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                 {data!.rows.map((row) => {
                   const isViewer = row.id === data!.viewerPlayerId;

                  return (
                    <tr
                      className={`border-b border-(color:--themed-border-11) last:border-b-0 ${
                        isViewer ? "viewer-row bg-(color:--themed-bg-19)" : ""
                      }`}
                      key={row.id}
                    >
                      <td className="px-2 py-3 font-serif text-xl sm:px-3 sm:py-4 sm:text-2xl">
                        {row.wins}
                      </td>

                      <td className="px-2 py-3 sm:px-3 sm:py-4">
                        <span className="font-serif text-base leading-tight sm:text-xl">
                          {row.firstName}
                        </span>


                      </td>

                       {Array.from({ length: data!.maxPicks }, (_, pickNumber) => {
                        const pick = row.picks[pickNumber];

                        return (
                          <td className="break-words px-2 py-3 text-sm leading-tight sm:px-3 sm:py-4 sm:text-base" key={pickNumber}>
                            {pick?.label ? (
                              <span>
                                {pick.label}

                                {pick.spread ? (
                                  <strong className={`ml-1 font-mono text-sm ${pick.isLineLocked ? "official-line-color" : "text-slate-700"}`}>
                                    {pick.spread}
                                  </strong>
                                ) : null}

                                <AtsResultStamp className="ml-1.5" result={pick.resultMark} />
                              </span>
) : pick?.isHidden ? (
  <span
    aria-label="Pick submitted and hidden until kickoff"
    title="Pick submitted — revealed at kickoff"
  >
    🔒
  </span>
) : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        </section>
        ) : null}

        {!data.isPlayoff ? <SurvivorTable data={shown} displayLocked={offSeason} savingDisplay={false} setEliminatedRowsHidden={setEliminatedRowsHidden} setSurvivorDisplay={setSurvivorDisplay} /> : null}
        <BowlCard
          fallbackRows={data.rows}
          isCommissioner={data.isCommissioner}
          displayLocked={offSeason}
          minimized={offSeason ? false : bowlPoolMinimized}
          onError={setErrorMessage}
          onReady={markBowlReady}
          onSetDisplay={setBowlCardDisplay}
          savingDisplay={false}
          viewerPlayerId={data.viewerPlayerId}
        />
      </div>
    </main>
    </div>
    </>
  );
}
