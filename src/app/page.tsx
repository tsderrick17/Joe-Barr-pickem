"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type LedgerPick = {
  label: string | null;
  isHidden: boolean;
  resultMark: string;
};

type LedgerRow = {
  id: string;
  firstName: string;
  wins: number;
  picks: LedgerPick[];
};

type HomeData = {
  viewerPlayerId: string;
  week: string;
  rows: LedgerRow[];
  error?: string;
};

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function loadHome() {
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
      });

      const result = (await response.json()) as HomeData;

      if (!response.ok) {
        setErrorMessage(result.error ?? "The pool could not be loaded.");
        return;
      }

      setData(result);
    }

    void loadHome();
  }, []);

  const viewerRow = useMemo(() => {
    return data?.rows.find((row) => row.id === data.viewerPlayerId) ?? null;
  }, [data]);

  const picksOwed = Math.max(0, 2 - (viewerRow?.picks.length ?? 0));

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        <p className="font-semibold text-red-700">{errorMessage}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">
        Loading the pool...
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
            Best Bets Pick&apos;em
          </h1>

          <p className="mt-3 text-lg">
            Honor the tradition. Eliminate the paperwork.
          </p>
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

              {picksOwed === 0 ? (
                <p className="mt-2 font-semibold text-green-800">
                  Your two picks are submitted.
                </p>
              ) : null}
            </div>

            <Link
              className="inline-block bg-[#1d1d1f] px-6 py-3 text-center font-bold text-white"
              href="/board"
            >
              Go to The Board
            </Link>
          </div>
        </section>

        <section className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-slate-600">
                STANDINGS
              </p>

              <h2 className="mt-2 font-serif text-3xl font-bold">
                The Ledger
              </h2>
            </div>

            <p className="text-right text-xs text-slate-600">
              Picks appear when each game begins.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto border-y-2 border-[#1d1d1f]">
            <table className="w-full min-w-[650px] border-collapse text-left">
              <thead>
                <tr className="border-b-2 border-[#1d1d1f] text-xs tracking-[0.14em]">
                  <th className="w-20 px-3 py-3">WINS</th>
                  <th className="w-40 px-3 py-3">PLAYER</th>
                  <th className="px-3 py-3">PICK 1</th>
                  <th className="px-3 py-3">PICK 2</th>
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

                      {[0, 1].map((pickNumber) => {
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

          <p className="mt-3 text-sm text-slate-600">
Your own picks remain visible to you. Everyone else&apos;s picks stay
hidden until kickoff.
          </p>
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
