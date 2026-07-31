"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
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
  viewerPlayerId: string;
  showSurvivorStandings: boolean;
  showPoolChat: boolean;
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

        setErrorMessage("");
        setData(result);
        hasLoaded = true;

        if (revealTimer !== null) {
          window.clearTimeout(revealTimer);
        }

        if (result.nextRevealAt) {
          const refreshDelay = Math.max(
            250,
            new Date(result.nextRevealAt).getTime() - Date.now() + 250,
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

  const viewerRow = useMemo(() => {
    return data?.rows.find((row) => row.id === data.viewerPlayerId) ?? null;
  }, [data]);

  const viewerPicks = viewerRow?.picks.filter((pick) => Boolean(pick.label)) ?? [];
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
    spread: pick.isLineLocked ? pick.spread ?? null : null,
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
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        Loading the Standings...
      </main>
    );
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
          isPlayoff={data.isPlayoff}
          maxPicks={data.maxPicks}
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
                                  <strong className={`ml-1 font-mono text-sm ${pick.isLineLocked ? "text-teal-700" : "text-slate-700"}`}>
                                    {pick.spread}
                                  </strong>
                                ) : null}

                                {pick.resultMark ? (
                                  <strong
                                    className={`ml-2 ${
                                      pick.resultMark === "W"
                                        ? "text-green-800"
                                        : "text-red-700"
                                    }`}
                                  >
                                    {pick.resultMark}
                                  </strong>
                                ) : null}
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
          <div className="pickem-ledger-masthead survivor-ledger-masthead"><div className="flex items-center gap-2"><h2>Survivor Table</h2><button aria-expanded={data.showSurvivorStandings} aria-label={data.showSurvivorStandings ? "Hide Survivor Table" : "Show Survivor Table"} className="survivor-title-toggle" disabled={savingDisplay} onClick={() => void setSurvivorDisplay(!data.showSurvivorStandings)} title={data.showSurvivorStandings ? "Hide Survivor Table" : "Show Survivor Table"} type="button">{data.showSurvivorStandings ? "−" : "+"}</button></div><p className="pickem-ledger-period">{data.week.toUpperCase()}</p></div>

          {data.showSurvivorStandings && data.survivorAvailable ? (
            <div className="overflow-x-auto border-y-2 border-[#1d1d1f]">
              <div className="min-w-[55.5rem]">
                <div className="survivor-standings-header grid grid-cols-[3rem_7rem_repeat(18,2.5rem)] border-b-2 border-[#1d1d1f] text-center text-[10px] font-black tracking-wide text-slate-600">
                  <span aria-hidden="true" className="survivor-sticky-status py-2" />
                  <span className="survivor-sticky-name px-2 py-2 text-left">PLAYER</span>
                  {Array.from({ length: 18 }, (_, index) => <span className="py-2" key={index}>{index + 1}</span>)}
                </div>
                {data.survivorRows.map((row, rowIndex) => {
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
      </div>
    </main>
  );
}
