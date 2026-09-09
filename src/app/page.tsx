"use client";

import Image from "next/image";
import AtsResultStamp from "@/components/ats-result-stamp";
import { useEffect, useMemo, useRef, useState } from "react";
import PickemScoreboard from "@/components/pickem-scoreboard";
import MyTicket, { type TicketPick } from "@/components/my-ticket";
import PlayerTrophyName from "@/components/player-trophy-name";
import {
  fetchWithSession,
  SessionUnavailableError,
} from "@/lib/auth-session";

type ScoreboardPick = {
  label: string | null;
  abbreviation?: string | null;
  isHidden: boolean;
  resultMark: string;
  spread?: string | null;
  isLineLocked?: boolean;
  kickoffAt?: string;
};

function MiniLogo({ abbreviation, muted, resultMark }: { abbreviation: string; muted?: boolean; resultMark?: string }) {
  return <span title={`${abbreviation}${resultMark ? ` ${resultMark}` : ""}`} className={`relative inline-flex h-7 w-7 items-center justify-center ${muted ? "grayscale opacity-60" : ""}`}><Image alt={abbreviation} className="h-full w-full object-contain" height={28} src={`/team-logos/${abbreviation}.png`} width={28} />{resultMark === "W" ? <span aria-label="Survivor win" className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-700 text-[10px] font-black leading-none text-white">✓</span> : null}{resultMark === "L" ? <span aria-label="Survivor loss" className="absolute inset-0 flex items-center justify-center text-4xl font-black leading-none text-red-700 drop-shadow-[0_0_1px_white]">×</span> : null}</span>;
}

type ScoreboardRow = {
  id: string;
  firstName: string;
  wins: number;
  playoffEliminated?: boolean;
  trophies?: string[];
  picks: ScoreboardPick[];
};

type HomeData = {
  serverTime: string;
  viewerPlayerId: string;
  isCommissioner: boolean;
  showSurvivorStandings: boolean;
  showPoolChat: boolean;
  hidePickemEliminatedRows: boolean;
  hideSurvivorEliminatedRows: boolean;
  isPlayoff: boolean;
  week: string;
  weekStatus: "upcoming" | "active" | "complete";
  maxPicks: number;
  nextRevealAt: string | null;
  rows: ScoreboardRow[];
  survivorAvailable: boolean;
  survivorNotice: string | null;
  survivorChampionPlayerId: string | null;
  survivorComplete: boolean;
  survivorChampionName: string | null;
  survivorRows: {
    id: string;
    playerId: string;
    firstName: string;
    trophies?: string[];
    status: "active" | "eliminated" | "complete";
    pick: (ScoreboardPick & { abbreviation?: string | null }) | null;
    picks: Array<(ScoreboardPick & { abbreviation: string | null }) | null>;
  }[];
  error?: string;
};
type BowlStandingsData = {
  season?: { season_year: number };
  games: Array<{ id: string; bowl_name: string; provider_game_id?: string; kickoff_at?: string; away_team_id?: string | null; home_team_id?: string | null; awayTeam?: { id: string; full_name: string; short_name?: string | null; abbreviation?: string | null } | null; homeTeam?: { id: string; full_name: string; short_name?: string | null; abbreviation?: string | null } | null; line?: { favorite_team_id?: string | null; locked_spread?: number | string | null; locked_at?: string | null } | null }>;
  standings: Array<{ playerId: string; playerName: string; wins: number; losses: number; tiebreakerTotal: number | null; trophies?: string[] }>;
  championships?: Array<{ playerId: string; seasonYear: number; playerName: string }>;
  publicPicks: Array<{ playerId: string | null; game_id: string; selected_team_id: string; result: string }>;
  privatePickMarkers?: Array<{ playerId: string | null; game_id: string }>;
};
type BowlMatrixGame = BowlStandingsData["games"][number];

const BOWL_MATRIX_GAMES = [
  "Frisco", "LA", "Salute to Veterans", "Cure", "68 Ventures", "Xbox", "Myrtle Beach", "Gasparilla",
  "Playoff Game #1", "Playoff Game #2", "Playoff Game #3", "Playoff Game #4", "Potato", "Boca Raton", "New Orleans", "Frisco",
  "Hawai'i", "GameAbove Sports", "Rate", "First Responder", "Military", "Pinstripe", "Fenway", "Pop-Tarts", "Arizona", "New Mexico", "Gator",
  "Birmingham", "Independence", "Music City", "Alamo", "ReliaQuest", "Sun", "Citrus", "Las Vegas", "Armed Forces", "Liberty", "Duke's Mayo", "Holiday",
];

/* Keep the first paint shaped like the real Standings page while its signed-in
   data arrives. This reserves the ticket and both score surfaces up front,
   avoiding a visible jump without changing any pool behavior. */
function StandingsLoadingShell() {
  return (
    <main aria-busy="true" className="min-h-screen bg-[#f5f0e6] text-[#171719]">
      <div className="mx-auto max-w-5xl px-4 pb-0 pt-5 sm:px-5 sm:pt-8 md:px-10">
        <section className="standings-loading-ticket mx-auto w-full max-w-[var(--standings-module-width)] border border-[#756b5b] bg-[#f3ead6] p-4 shadow-[0_4px_14px_rgba(44,36,24,.14)]">
          <div className="mx-auto h-3 w-44 bg-[#d9ceb8]" />
          <div className="mx-auto mt-3 h-8 w-72 max-w-full bg-[#cfc1a8]" />
          <div className="mt-7 h-px bg-[#756b5b]" />
          <div className="grid grid-cols-2 gap-5 py-5">
            <div className="space-y-3"><div className="h-4 w-4/5 bg-[#dbcdb4]" /><div className="h-4 w-3/5 bg-[#e4d9c5]" /></div>
            <div className="space-y-3"><div className="h-4 w-4/5 bg-[#dbcdb4]" /><div className="h-4 w-3/5 bg-[#e4d9c5]" /></div>
          </div>
          <div className="h-px bg-[#756b5b]" />
          <div className="mt-4 grid grid-cols-3 gap-4"><div className="h-4 bg-[#d7c8ae]" /><div className="h-4 bg-[#d7c8ae]" /><div className="h-4 bg-[#d7c8ae]" /></div>
        </section>
        <section className="mx-auto mt-6 w-full max-w-[var(--standings-module-width)]">
          <div className="h-12 border-y-2 border-[#1d1d1f] bg-[#fffdf8]" />
          <div className="standings-loading-rows" />
        </section>
        <section className="mx-auto mt-6 w-full max-w-[var(--standings-module-width)]">
          <div className="h-12 border-y-2 border-[#1d1d1f] bg-[#fffdf8]" />
          <div className="standings-loading-rows standings-loading-rows-short" />
        </section>
      </div>
    </main>
  );
}

function ticketKickoff(value: string | undefined) {
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

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [bowlPoolMinimized, setBowlPoolMinimized] = useState(false);
  const [bowlStandings, setBowlStandings] = useState<BowlStandingsData | null>(null);
  const bowlScrollRef = useRef<HTMLDivElement | null>(null);
  const serverClockOffset = useRef(0);

  useEffect(() => {
    let revealTimer: number | null = null;
    let activeRequest: AbortController | null = null;
    let hasLoaded = false;

    async function loadHome() {
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
        setData(result);
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

    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadHome();
      }
    }, 60_000);

    const refreshOnFocus = () => {
      void loadHome();
    };

    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(refreshInterval);
      if (revealTimer !== null) {
        window.clearTimeout(revealTimer);
      }
      activeRequest?.abort();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [retryNonce]);

  useEffect(() => {
    if (!data?.isCommissioner) return;
    void fetchWithSession("/api/bowl-pool").then(async (response) => {
      if (response.ok) setBowlStandings(await response.json() as BowlStandingsData);
    }).catch(() => undefined);
  }, [data?.isCommissioner]);

  const viewerRow = useMemo(() => {
    return data?.rows.find((row) => row.id === data.viewerPlayerId) ?? null;
  }, [data]);

  const viewerPicks = viewerRow?.picks.filter((pick) => Boolean(pick.label)) ?? [];
  const bowlGames: BowlMatrixGame[] = bowlStandings?.games ?? BOWL_MATRIX_GAMES.map((bowlName, index) => ({ id: `placeholder-${index}`, bowl_name: bowlName }));
  const bowlScheduleReady = Boolean(bowlStandings?.games);
  const bowlRows = [...(bowlStandings?.standings ?? data?.rows.map((row) => ({ playerId: row.id, playerName: row.firstName, wins: 0, losses: 0, tiebreakerTotal: null, trophies: [] })) ?? [])].sort((first, second) => second.wins - first.wins || first.losses - second.losses || first.playerName.localeCompare(second.playerName));
  const bowlChampion = bowlStandings?.championships?.find((championship) => championship.seasonYear === bowlStandings.season?.season_year);
  const bowlGradedGames = bowlStandings?.publicPicks ? new Set(bowlStandings.publicPicks.filter((pick) => pick.result === "win" || pick.result === "loss").map((pick) => pick.game_id)).size : 0;
  const bowlName = (game: (typeof bowlGames)[number]) => {
    const name = (game.bowl_name || "Bowl").replace(/ Football Classic$/i, "");
    if (/quarterfinal|quarter/i.test(name)) return `${name.replace(/\s*\([^)]*\)$/, "")} (QF)`;
    if (/semifinal|semi/i.test(name)) return `${name.replace(/\s*\([^)]*\)$/, "")} (SF)`;
    if (/first[- ]round/i.test(name)) return `${name.replace(/\s*\([^)]*\)$/, "")} (1st round)`;
    return name;
  };
  const bowlTeamLabel = (team: { full_name: string; short_name?: string | null; abbreviation?: string | null } | null | undefined) => {
    if (!team) return "TBD";
    if (team.abbreviation) return team.abbreviation.toUpperCase();
    if (team.short_name) return team.short_name;
    const words = team.full_name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
    return words.length > 1 ? words.map((word) => word[0]).join("").slice(0, 4).toUpperCase() : team.full_name.slice(0, 4).toUpperCase();
  };
  const bowlDateKey = (game: (typeof bowlGames)[number]) => game.kickoff_at ? new Date(game.kickoff_at).toLocaleDateString("en-US", { timeZone: "America/New_York" }) : "Date TBD";
  const bowlDateGroups = bowlGames.reduce<Array<{ key: string; count: number }>>((groups, game) => { const key = bowlDateKey(game); const last = groups[groups.length - 1]; if (last?.key === key) last.count += 1; else groups.push({ key, count: 1 }); return groups; }, []);
  // Keep the grid's containing block as wide as its generated tracks. Without
  // this, CSS grid tracks overflow the 80rem shell while row borders stop at
  // the shell's edge (which made the table appear to end mid-schedule).
  const bowlTableMinWidth = `${12.5 + bowlGames.length * 7.5}rem`;
  const bowlGameBoundaryClass = (index: number) => {
    const key = bowlDateKey(bowlGames[index]);
    const previousKey = index > 0 ? bowlDateKey(bowlGames[index - 1]) : null;
    const nextKey = index < bowlGames.length - 1 ? bowlDateKey(bowlGames[index + 1]) : null;
    return `${previousKey !== key ? "border-l-2" : ""} ${nextKey !== key ? "border-r-2" : ""} border-[#8d877d]`;
  };
  const bowlTeam = (game: (typeof bowlGames)[number], side: "favorite" | "underdog") => {
    const away = game.awayTeam; const home = game.homeTeam; const favoriteId = game.line?.favorite_team_id;
    const favorite = favoriteId && away?.id === favoriteId ? away : favoriteId && home?.id === favoriteId ? home : away;
    const underdog = favorite?.id === away?.id ? home : away;
    return side === "favorite" ? favorite : underdog;
  };
  const bowlCell = (playerId: string, gameId: string) => {
    const result = bowlStandings?.publicPicks.find((pick) => pick.playerId === playerId && pick.game_id === gameId)?.result;
    return result === "win" ? "W" : result === "loss" ? "L" : "·";
  };
  const bowlCellClass = (result: string) => result === "W" ? "text-green-800" : result === "L" ? "text-red-700" : result === "🔒" ? "text-slate-500" : "text-slate-400";

  // Keep the active slate in view when the standings are opened. This uses
  // Eastern time, matching the pool's kickoff and lock rules, and falls back
  // to the next scheduled game when today's slate has already passed.
  useEffect(() => {
    if (!data?.isCommissioner || bowlPoolMinimized || !bowlGames.length) return;
    const frame = window.requestAnimationFrame(() => {
      const container = bowlScrollRef.current;
      if (!container) return;
      const todayKey = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(new Date());
      const now = Date.now();
      const currentDayIndex = bowlGames.findIndex((game) => game.kickoff_at && new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" }).format(new Date(game.kickoff_at)) === todayKey);
      const nextGameIndex = bowlGames.findIndex((game) => game.kickoff_at && new Date(game.kickoff_at).getTime() >= now);
      const targetIndex = currentDayIndex >= 0 ? currentDayIndex : nextGameIndex;
      if (targetIndex < 0) return;
      const target = container.querySelector<HTMLElement>(`[data-bowl-game-index="${targetIndex}"]`);
      if (target) container.scrollLeft = Math.max(0, target.offsetLeft - 128);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [bowlGames, bowlPoolMinimized, data?.isCommissioner]);
  const viewerSurvivor =
    data?.survivorRows.find((row) => row.playerId === data.viewerPlayerId) ?? null;
  const ticketPicks: TicketPick[] = [...viewerPicks]
    .sort((first, second) => {
      const firstKickoff = first.kickoffAt ? new Date(first.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
      const secondKickoff = second.kickoffAt ? new Date(second.kickoffAt).getTime() : Number.MAX_SAFE_INTEGER;
      return firstKickoff - secondKickoff || (first.label ?? "").localeCompare(second.label ?? "");
    })
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

  async function setSurvivorDisplay(show: boolean) {
    setSavingDisplay(true);
    try {
      const response = await fetchWithSession("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showSurvivorStandings: show }),
      });
      if (!response.ok) throw new Error("Unable to save that display choice.");
      setData((current) => current ? { ...current, showSurvivorStandings: show } : current);
    } catch {
      setErrorMessage("That display choice could not be saved. Please try again.");
    } finally {
      setSavingDisplay(false);
    }
  }

  async function setEliminatedRowsHidden(pool: "pickem" | "survivor", hidden: boolean) {
    setSavingDisplay(true);
    const field = pool === "pickem" ? "hidePickemEliminatedRows" : "hideSurvivorEliminatedRows";
    try {
      const response = await fetchWithSession("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: hidden }),
      });
      if (!response.ok) throw new Error("Unable to save that display choice.");
      setData((current) => current ? { ...current, [field]: hidden } : current);
    } catch {
      setErrorMessage("That display choice could not be saved. Please try again.");
    } finally {
      setSavingDisplay(false);
    }
  }

  if (errorMessage && !data) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
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

  return (
    <main className="min-h-screen bg-[#f5f0e6] text-[#171719]">
      <div className="mx-auto max-w-5xl px-4 pb-0 pt-5 sm:px-5 sm:pb-0 sm:pt-8 md:px-10">
        {errorMessage ? (
          <div className="mb-5 flex flex-col gap-3 border-2 border-red-700 bg-red-50 p-4 text-red-900 sm:flex-row sm:items-center sm:justify-between">
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

        <MyTicket
          isPlayoff={data.isPlayoff}
          maxPicks={data.maxPicks}
          picks={ticketPicks}
          readOnly={data.weekStatus === "complete"}
          survivorAvailable={data.survivorAvailable}
          survivorPick={ticketSurvivor}
          survivorStatus={data.survivorComplete ? "complete" : viewerSurvivor?.status ?? "active"}
          week={data.week}
        />

        <PickemScoreboard
          hideEliminatedRows={data.hidePickemEliminatedRows}
          isPlayoff={data.isPlayoff}
          maxPicks={data.maxPicks}
          onToggleEliminatedRows={() => void setEliminatedRowsHidden("pickem", !data.hidePickemEliminatedRows)}
          rows={data.rows}
          viewerPlayerId={data.viewerPlayerId}
          week={data.week}
        />
        {false ? (
        <section className="py-6 sm:py-7">
          <p className="mb-4 text-xs font-bold tracking-[0.2em] text-slate-600">
            PICK&apos;EM THIS WEEK
          </p>
          <div className="border-y-2 border-[#1d1d1f]">
            <table
              className="w-full table-fixed border-collapse text-left"
            >
              <thead>
                <tr className="border-b-2 border-[#1d1d1f] text-xs tracking-[0.14em]">
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
                      className={`border-b border-[#91afd0] last:border-b-0 ${
                        isViewer ? "viewer-row bg-[#fffaf0]" : ""
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

        {!data.isPlayoff ? <section className="pickem-ledger survivor-ledger py-6 sm:py-7">
          <div className="pickem-ledger-masthead survivor-ledger-masthead"><div className="flex items-center gap-2"><h2>Survivor Table</h2><button aria-expanded={data.showSurvivorStandings} aria-label={data.showSurvivorStandings ? "Hide Survivor Table" : "Show Survivor Table"} className="survivor-title-toggle" disabled={savingDisplay} onClick={() => void setSurvivorDisplay(!data.showSurvivorStandings)} title={data.showSurvivorStandings ? "Hide Survivor Table" : "Show Survivor Table"} type="button">{data.showSurvivorStandings ? "−" : "+"}</button>{data.survivorRows.some((row) => row.status === "eliminated") ? <button aria-label={data.hideSurvivorEliminatedRows ? "Show eliminated Survivor players" : "Hide eliminated Survivor players"} className="survivor-title-toggle survivor-elimination-toggle" disabled={savingDisplay} onClick={() => void setEliminatedRowsHidden("survivor", !data.hideSurvivorEliminatedRows)} title={data.hideSurvivorEliminatedRows ? "Show eliminated players" : "Hide eliminated players"} type="button">{data.hideSurvivorEliminatedRows ? "+ OUT" : "− OUT"}</button> : null}</div><p className="pickem-ledger-period">{data.week.toUpperCase()}</p></div>

          {data.showSurvivorStandings && data.survivorAvailable ? (
            <div className="overflow-x-auto border-y-2 border-[#1d1d1f]">
              <div className="min-w-[55.5rem]">
                <div className="survivor-standings-header grid grid-cols-[3rem_7rem_repeat(18,2.5rem)] border-b-2 border-[#1d1d1f] text-center text-[10px] font-black tracking-wide text-slate-600">
                  <span aria-hidden="true" className="survivor-sticky-status py-2" />
                  <span className="survivor-sticky-name px-2 py-2 text-left">PLAYER</span>
                  {Array.from({ length: 18 }, (_, index) => <span className="py-2" key={index}>{index + 1}</span>)}
                </div>
                {data.survivorRows.filter((row) => !data.hideSurvivorEliminatedRows || row.status !== "eliminated").map((row, rowIndex) => {
                  const isViewer = row.playerId === data.viewerPlayerId;

                  return (
                  <div className={`survivor-standings-row grid grid-cols-[3rem_7rem_repeat(18,2.5rem)] items-center border-b border-[#91afd0] last:border-b-0 ${rowIndex % 2 ? "is-alt" : ""} ${isViewer ? "viewer-row" : ""}`} key={row.id}>
                    <span className={`survivor-sticky-status text-center text-[10px] font-black ${row.status === "active" ? "text-green-800" : "text-red-700"}`}>{row.status === "active" ? "IN" : "OUT"}</span>
                    <span className={`survivor-sticky-name truncate px-2 py-[0.4rem] font-serif text-sm font-bold ${row.status === "active" ? "" : "text-slate-500 line-through"}`}><PlayerTrophyName name={row.firstName} showTrophy={row.trophies?.some((title) => title.includes("Survivor Champion"))} titles={row.trophies} /></span>
                    {Array.from({ length: 18 }, (_, index) => {
                      const pick = row.picks[index];
                      return <span className="flex h-[2.3rem] items-center justify-center" key={index}>{pick?.abbreviation ? <MiniLogo abbreviation={pick.abbreviation} muted={row.status !== "active" && pick.resultMark !== "L"} resultMark={pick.resultMark} /> : pick?.isHidden ? <span aria-label="Selection submitted and hidden until kickoff" className="text-xs" title="Selection submitted — revealed at kickoff">🔒</span> : <span className="text-slate-400">·</span>}</span>;
                    })}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : data.showSurvivorStandings ? (
            <div className="border-2 border-amber-700 bg-amber-50 p-4 text-amber-950">
              <p className="font-bold">
                {data.survivorNotice ??
                  "Survivor is temporarily unavailable. ATS standings remain current."}
              </p>
            </div>
          ) : null}
        </section> : null}

        {data.isCommissioner ? <section className="pickem-ledger py-6 sm:py-7" aria-label="Bowl Card">
          <div className="pickem-ledger-masthead survivor-ledger-masthead">
            <div className="flex items-center gap-2"><h2>Bowl Card</h2><button aria-expanded={!bowlPoolMinimized} aria-label={bowlPoolMinimized ? "Show Bowl Card" : "Hide Bowl Card"} className="survivor-title-toggle" onClick={() => setBowlPoolMinimized((current) => !current)} title={bowlPoolMinimized ? "Show Bowl Card" : "Hide Bowl Card"} type="button">{bowlPoolMinimized ? "+" : "−"}</button></div>
          </div>
          {!bowlPoolMinimized ? <>
            {bowlChampion ? <div className="border-b-2 border-[#1d1d1f] bg-[#ecfdf5] px-3 py-3 text-center font-bold text-green-900">🏆 {bowlChampion.playerName} — Bowl Pool Champion</div> : null}
            <div className="bowl-standings-scroll overflow-x-auto border-b-2 border-[#1d1d1f]" ref={bowlScrollRef}>
              <div style={{ minWidth: bowlTableMinWidth }}>
                <div className="grid" style={{ gridTemplateColumns: `3rem 5rem repeat(${bowlGames.length}, minmax(7.5rem, 1fr)) minmax(4.5rem, .55fr)` }}><span aria-hidden="true" className="bowl-standings-sticky sticky left-0 z-30 bg-[#f5f0e6]" style={{ gridColumn: "span 2" }} />{bowlDateGroups.map((group) => <span className="border-x-2 border-t-2 border-[#8d877d] bg-[#334155] px-2 py-2 text-center text-[10px] font-black uppercase tracking-wide text-white" key={group.key} style={{ gridColumn: `span ${group.count} / span ${group.count}` }}>{group.key}</span>)}<span aria-hidden="true" className="border-l-2 border-t-2 border-[#8d877d] bg-transparent" /></div>
                <div className="grid" style={{ gridTemplateColumns: `3rem 5rem repeat(${bowlGames.length}, minmax(7.5rem, 1fr)) minmax(4.5rem, .55fr)` }}><span className="bowl-standings-sticky sticky left-0 z-30 flex min-h-28 flex-col items-center justify-center bg-[#f5f0e6] px-1 text-center uppercase text-slate-700" style={{ gridColumn: "span 2" }}><span className="text-[9px] font-black tracking-wide">Games remaining</span>{bowlScheduleReady ? <strong className="mt-1 text-3xl font-black leading-none text-slate-950">{Math.max(0, bowlGames.length - bowlGradedGames)}</strong> : null}</span>{bowlGames.map((game, index) => <span className={`border-b-2 border-[#1d1d1f] bg-[#f7f3ea] px-2 py-2 text-center text-[10px] leading-4 text-slate-700 ${bowlGameBoundaryClass(index)}`} data-bowl-game-index={index} key={`${game.id}-${index}`}><b className="block text-xs uppercase tracking-wide text-slate-900">{bowlName(game)}</b><span className="mt-1 block break-words font-bold text-slate-950" title={bowlTeam(game, "favorite")?.full_name}>{bowlTeamLabel(bowlTeam(game, "favorite"))}</span><span className={`block font-mono font-black ${game.line?.locked_at ? "text-[#007e72]" : "text-slate-950"}`}>{game.line?.locked_spread ?? "—"}</span><span className="block break-words font-bold text-slate-950" title={bowlTeam(game, "underdog")?.full_name}>{bowlTeamLabel(bowlTeam(game, "underdog"))}</span></span>)}<span className="flex items-center justify-center border-b-2 border-l-2 border-[#8d877d] bg-[#f5f0e6] px-1 py-2 text-center text-[10px] font-black uppercase tracking-wide text-slate-700">Tiebreaker</span></div>
                {bowlRows.map((row, rowIndex) => { const rowFill = rowIndex % 2 ? "bg-[#e9eef4]" : "bg-[#f5f0e6]"; return <div className={`grid border-b border-[#91afd0] text-center text-xs ${rowIndex === 0 ? "border-t-2 border-t-[#1d1d1f]" : ""} ${rowFill}`} style={{ gridTemplateColumns: `3rem 5rem repeat(${bowlGames.length}, minmax(7.5rem, 1fr)) minmax(4.5rem, .55fr)` }} key={row.playerId}><span className={`bowl-standings-sticky sticky left-0 z-30 px-1 py-2 text-center font-mono font-black tabular-nums ${rowFill}`}>{row.wins}</span><span className={`bowl-standings-sticky sticky left-[3rem] z-30 truncate px-1 py-2 text-left font-serif font-bold ${rowFill}`} title={row.playerName}><PlayerTrophyName name={row.playerName} showTrophy={row.trophies?.some((title) => title.includes("Bowl Pool Champion"))} titles={row.trophies} /></span>{bowlGames.map((game, index) => { const result = bowlCell(row.playerId, game.id); const locked = bowlStandings?.privatePickMarkers?.some((pick) => pick.playerId === row.playerId && pick.game_id === game.id); const display = result === "·" && locked ? "🔒" : result; return <span className={`px-1 py-2 font-black ${bowlCellClass(display)} ${bowlGameBoundaryClass(index)}`} key={`${row.playerId}-${game.id}-${index}`}>{display}</span>; })}<span className="flex items-center justify-center border-l-2 border-[#8d877d] px-1 py-2 font-mono text-xs font-black tabular-nums text-slate-700">{row.tiebreakerTotal ?? "—"}</span></div>; })}
              </div>
            </div>
          </> : null}
        </section> : null}
      </div>
    </main>
  );
}
