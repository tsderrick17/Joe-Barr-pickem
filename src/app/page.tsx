"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  error?: string;
};

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.href = "/login";
          return;
        }

        const response = await fetch("/api/home", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
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
      } catch {
        if (request.signal.aborted && !requestTimedOut) {
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
  }, []);

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

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        <p className="font-semibold text-red-700">{errorMessage}</p>
        <button
          className="mt-5 bg-[#1d1d1f] px-5 py-3 font-bold text-white"
          onClick={() => window.location.reload()}
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
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-10">
        <header className="border-b-2 border-[#1d1d1f] pb-6">
          <p className="text-sm font-bold tracking-[0.28em] text-slate-600">
            JOE BARR MEMORIAL
          </p>

          <h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">
            Lead Pipe Locks
          </h1>
        </header>

        <section className="border-b-2 border-[#1d1d1f] py-6">
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
              className="inline-block bg-[#1d1d1f] px-6 py-3 text-center font-bold text-white"
              href="/board"
            >
              Go to The Slate
            </Link>
          </div>
        </section>

        <section className="py-7">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-serif text-3xl font-bold">Scoreboard</h2>

            <p className="text-right text-xs text-slate-600">
              Others&apos; picks revealed at kickoff.
            </p>
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

        <section className="border-t-2 border-[#1d1d1f] py-7">
          <p className="text-xs font-bold tracking-[0.2em] text-slate-600">
            SURVIVOR
          </p>

          <p className="mt-3 text-slate-700">
            Survivor standings will appear here when Survivor is activated.
          </p>
        </section>
      </div>
    </main>
  );
}
