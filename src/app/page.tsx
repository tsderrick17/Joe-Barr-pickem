"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import PickemScoreboard from "@/components/pickem-scoreboard";
import {
  fetchWithSession,
  SessionUnavailableError,
} from "@/lib/auth-session";

type ScoreboardPick = {
  label: string | null;
  isHidden: boolean;
  resultMark: string;
  spread?: string | null;
  isLineLocked?: boolean;
};

function MiniLogo({ abbreviation, muted, resultMark }: { abbreviation: string; muted?: boolean; resultMark?: string }) {
  return <span title={`${abbreviation}${resultMark ? ` ${resultMark}` : ""}`} className={`relative inline-flex h-7 w-7 items-center justify-center ${muted ? "grayscale opacity-60" : ""}`}><Image alt={abbreviation} className="h-full w-full object-contain" height={28} src={`/team-logos/${abbreviation}.png`} width={28} />{resultMark === "W" ? <span aria-label="Survivor win" className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-700 text-[10px] font-black leading-none text-white">✓</span> : null}{resultMark === "L" ? <span aria-label="Survivor loss" className="absolute inset-0 flex items-center justify-center text-4xl font-black leading-none text-red-700 drop-shadow-[0_0_1px_white]">×</span> : null}</span>;
}

type ScoreboardRow = {
  id: string;
  firstName: string;
  wins: number;
  picks: ScoreboardPick[];
};

type HomeData = {
  viewerPlayerId: string;
  week: string;
  maxPicks: number;
  nextRevealAt: string | null;
  rows: ScoreboardRow[];
  survivorAvailable: boolean;
  survivorNotice: string | null;
  survivorRows: {
    id: string;
    playerId: string;
    firstName: string;
    status: "active" | "eliminated" | "complete";
    pick: ScoreboardPick | null;
    picks: Array<(ScoreboardPick & { abbreviation: string | null }) | null>;
  }[];
  error?: string;
};

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryNonce, setRetryNonce] = useState(0);

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

  const maxPicks = data?.maxPicks ?? 2;
  const picksOwed = Math.max(0, maxPicks - (viewerRow?.picks.length ?? 0));
  const viewerPicks =
    viewerRow?.picks
      .map((pick) => pick.label)
      .filter((label): label is string => Boolean(label)) ?? [];
  const viewerSurvivor =
    data?.survivorRows.find((row) => row.playerId === data.viewerPlayerId) ?? null;

  const pickWord = (count: number) => (count === 1 ? "pick" : "picks");

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
      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-8 md:px-10">
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

        <header className="border-b-2 border-[#1d1d1f] pb-4 sm:pb-6">
          <h1 className="font-serif text-3xl font-bold sm:text-4xl md:text-5xl">
            Lead Pipe Locks
          </h1>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-600 sm:text-sm">
            Picks revealed to others at kickoff
          </p>
          <p className="mt-1 text-xs text-slate-600"><span className="font-semibold text-teal-700">Teal lines</span> are official and will not change.</p>
        </header>

        <section className="border-b-2 border-[#1d1d1f] py-5 sm:py-6">
          <div className={`grid gap-5 ${data.survivorAvailable ? "md:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)]" : "md:grid-cols-[10rem_minmax(0,1fr)]"}`}>
            <div className="md:pt-1">
              <p className="text-xs font-bold tracking-[0.2em] text-slate-600">THIS WEEK</p>
              <h2 className="mt-1 font-serif text-2xl font-bold sm:text-3xl">{data.week}</h2>
            </div>

            <div className="flex flex-col border-t border-[#b9b09d] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-1">
              <p className="text-xs font-bold tracking-[0.2em] text-slate-600">PICK&apos;EM</p>
              {picksOwed === 0 ? <h3 className="mt-1 font-serif text-xl font-bold leading-tight text-green-800 sm:text-2xl">{data.maxPicks} {pickWord(data.maxPicks)} submitted</h3> : <h3 className="mt-1 font-serif text-xl font-bold leading-tight sm:text-2xl">{picksOwed} {pickWord(picksOwed)} due</h3>}
              {picksOwed > 0 ? <p className="mt-2 text-base leading-6 text-slate-700">Make your selections before kickoff.</p> : null}
              {viewerPicks.length ? <ol className="mt-2 space-y-1 font-serif text-base leading-6 sm:text-lg">{viewerPicks.map((team, index) => <li key={`${team}-${index}`}>{index + 1}. {team}</li>)}</ol> : null}
              <Link className="mt-4 inline-block min-h-11 w-full bg-[#1d1d1f] px-5 py-3 text-center font-bold text-white md:mt-auto" href="/board">View The Slate</Link>
            </div>

            {data.survivorAvailable ? <div className="flex flex-col border-t border-[#b9b09d] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-1">
              <p className="text-xs font-bold tracking-[0.2em] text-slate-600">SURVIVOR</p>
              {viewerSurvivor?.status === "eliminated" ? <><h3 className="mt-1 font-serif text-xl font-bold leading-tight text-red-700 sm:text-2xl">Eliminated</h3><p className="mt-2 text-base leading-6 text-slate-700">Follow the remaining pool on The Survivor Wire.</p></> : viewerSurvivor?.pick?.label ? <><h3 className="mt-1 font-serif text-xl font-bold leading-tight text-green-800 sm:text-2xl">Pick made: {viewerSurvivor.pick.label}</h3><p className="mt-2 text-base leading-6 text-slate-700">You can change it until that game begins.</p></> : viewerSurvivor?.pick?.isHidden ? <><h3 className="mt-1 font-serif text-xl font-bold leading-tight text-green-800 sm:text-2xl">Pick made</h3><p className="mt-2 text-base leading-6 text-slate-700">Your Survivor selection is submitted.</p></> : <><h3 className="mt-1 font-serif text-xl font-bold leading-tight sm:text-2xl">1 pick due</h3><p className="mt-2 text-base leading-6 text-slate-700">Choose one straight-up winner before kickoff.</p></>}
              <Link className="mt-4 inline-block min-h-11 w-full bg-[#1d1d1f] px-5 py-3 text-center font-bold text-white md:mt-auto" href="/survivor">View Survivor Wire</Link>
            </div> : null}
          </div>
        </section>

        <PickemScoreboard
          maxPicks={data.maxPicks}
          rows={data.rows}
          viewerPlayerId={data.viewerPlayerId}
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
                        isViewer ? "bg-[#fffaf0]" : ""
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

        <section className="border-t-2 border-[#1d1d1f] py-6 sm:py-7">
          <p className="text-xs font-bold tracking-[0.2em] text-slate-600">
            SURVIVOR
          </p>

          {data.survivorAvailable ? (
            <div className="mt-4 overflow-x-auto border-y-2 border-[#1d1d1f]">
              <div className="min-w-[55.5rem]">
                <div className="grid grid-cols-[3rem_7rem_repeat(18,2.5rem)] border-b-2 border-[#1d1d1f] text-center text-[10px] font-black tracking-wide text-slate-600">
                  <span aria-hidden="true" className="py-2" />
                  <span className="px-2 py-2 text-left">PLAYER</span>
                  {Array.from({ length: 18 }, (_, index) => <span className="py-2" key={index}>{index + 1}</span>)}
                </div>
                {data.survivorRows.map((row) => {
                  const isViewer = row.playerId === data.viewerPlayerId;

                  return (
                  <div className={`grid grid-cols-[3rem_7rem_repeat(18,2.5rem)] items-center border-b border-[#91afd0] last:border-b-0 ${isViewer ? "bg-[#fffaf0]" : ""}`} key={row.id}>
                    <span className={`text-center text-[10px] font-black ${row.status === "active" ? "text-green-800" : "text-red-700"}`}>{row.status === "active" ? "IN" : "OUT"}</span>
                    <span className={`truncate px-2 py-2 font-serif text-sm font-bold ${row.status === "active" ? "" : "text-slate-500 line-through"}`}>{row.firstName}</span>
                    {Array.from({ length: 18 }, (_, index) => {
                      const pick = row.picks[index];
                      return <span className="flex h-10 items-center justify-center" key={index}>{pick?.abbreviation ? <MiniLogo abbreviation={pick.abbreviation} muted={row.status !== "active" && pick.resultMark !== "L"} resultMark={pick.resultMark} /> : pick?.isHidden ? <span title="Pick submitted" className="text-xs">🔒</span> : <span className="text-slate-400">·</span>}</span>;
                    })}
                  </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mt-4 border-2 border-amber-700 bg-amber-50 p-4 text-amber-950">
              <p className="font-bold">
                {data.survivorNotice ??
                  "Survivor is temporarily unavailable. ATS standings remain current."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
