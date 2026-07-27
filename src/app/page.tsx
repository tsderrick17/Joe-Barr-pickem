"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchWithSession,
  SessionUnavailableError,
} from "@/lib/auth-session";

type ScoreboardPick = {
  label: string | null;
  isHidden: boolean;
  resultMark: string;
};

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
    firstName: string;
    status: "active" | "eliminated" | "complete";
    pick: ScoreboardPick | null;
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
        </header>

        <section className="border-b-2 border-[#1d1d1f] py-5 sm:py-6">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-slate-600">
                THIS WEEK
              </p>

              <h2 className="mt-2 font-serif text-3xl font-bold">
                {data.week}
              </h2>

              {picksOwed === 2 ? (
                <p className="mt-2 text-slate-700">
                  You still owe two picks this week.
                </p>
              ) : null}

              {picksOwed === 1 ? (
                <p className="mt-2 text-slate-700">
                  You still owe one pick this week.
                </p>
              ) : null}

              {picksOwed > 2 ? (
                <p className="mt-2 text-slate-700">
                  You still owe {picksOwed} {pickWord(picksOwed)} this week.
                </p>
              ) : null}

              {picksOwed === 0 ? (
                <p className="mt-2 font-semibold text-green-800">
                  Your {data.maxPicks} {pickWord(data.maxPicks)} {data.maxPicks === 1 ? "is" : "are"} submitted.
                </p>
              ) : null}

              {viewerPicks.length ? (
                <div className="mt-4">
                  <p className="text-xs font-bold tracking-[0.16em] text-slate-600">
                    YOUR PICKS
                  </p>
                  <ol className="mt-1 space-y-1 font-serif text-lg">
                    {viewerPicks.map((team, index) => (
                      <li key={`${team}-${index}`}>
                        {index + 1}. {team}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>

            <Link
              className="inline-block min-h-11 bg-[#1d1d1f] px-5 py-3 text-center font-bold text-white sm:px-6"
              href="/board"
            >
              Go to The Slate
            </Link>
          </div>
        </section>

        <section className="py-6 sm:py-7">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-serif text-2xl font-bold sm:text-3xl">
              Picks revealed to others at Kickoff
            </h2>
          </div>

          <div className="mt-5 overflow-x-auto border-y-2 border-[#1d1d1f]">
            <table
              className="w-full border-collapse text-left"
              style={{ minWidth: `${Math.max(650, 240 + data.maxPicks * 140)}px` }}
            >
              <thead>
                <tr className="border-b-2 border-[#1d1d1f] text-xs tracking-[0.14em]">
                  <th className="w-20 px-3 py-3">WINS</th>
                  <th className="w-40 px-3 py-3">PLAYER</th>
                  {Array.from({ length: data.maxPicks }, (_, index) => (
                    <th className="px-3 py-3" key={index}>
                      PICK {index + 1}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {data.rows.map((row) => {
                  const isViewer = row.id === data.viewerPlayerId;

                  return (
                    <tr
                      className={`border-b border-[#91afd0] last:border-b-0 ${
                        isViewer ? "bg-[#fffaf0]" : ""
                      }`}
                      key={row.id}
                    >
                      <td className="px-3 py-4 font-serif text-2xl">
                        {row.wins}
                      </td>

                      <td className="px-3 py-4">
                        <span className="font-serif text-xl">
                          {row.firstName}
                        </span>


                      </td>

                      {Array.from({ length: data.maxPicks }, (_, pickNumber) => {
                        const pick = row.picks[pickNumber];

                        return (
                          <td className="px-3 py-4" key={pickNumber}>
                            {pick?.label ? (
                              <span>
                                {pick.label}

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

        <section className="border-t-2 border-[#1d1d1f] py-6 sm:py-7">
          <p className="text-xs font-bold tracking-[0.2em] text-slate-600">
            SURVIVOR
          </p>

          {data.survivorAvailable ? (
            <div className="mt-4 divide-y border-y-2 border-[#1d1d1f]">
              {data.survivorRows.map((row) => (
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 sm:grid-cols-[1fr_8rem]" key={row.id}>
                  <div>
                    <p className={row.status === "active" ? "font-serif text-lg font-bold" : "font-serif text-lg text-slate-500 line-through"}>{row.firstName}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-700">
                    {row.pick?.label ?? (row.pick?.isHidden ? "Pick locked" : "No pick")}
                    {row.pick?.resultMark ? <strong className={`ml-2 ${row.pick.resultMark === "W" ? "text-green-800" : "text-red-700"}`}>{row.pick.resultMark}</strong> : null}
                    </p>
                  </div>
                  <p className={`text-right text-xs font-black tracking-[0.12em] ${row.status === "active" ? "text-green-800" : "text-slate-500"}`}>{row.status === "active" ? "ACTIVE" : "OUT"}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 border-2 border-amber-700 bg-amber-50 p-4 text-amber-950">
              <p className="font-bold">
                {data.survivorNotice ??
                  "Survivor is temporarily unavailable. ATS standings remain current."}
              </p>
            </div>
          )}
          <Link className="mt-4 inline-block min-h-11 border-2 border-[#1d1d1f] bg-white px-5 py-3 text-center font-bold" href="/survivor">View The Survivor Wire</Link>
        </section>
      </div>
    </main>
  );
}
