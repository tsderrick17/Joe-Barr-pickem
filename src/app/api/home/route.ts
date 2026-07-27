"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type LedgerPick = {
  label: string | null;
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
        Loading the pool…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f0e6] text-[#171719]">
      <div className="mx-auto max-w-5xl px-5 py-9 md:px-10">
        <header className="border-b-2 border-[#1d1d1f] pb-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-sm font-bold tracking-[0.28em] text-slate-600">
                JOE BARR MEMORIAL
              </p>

              <h1 className="mt-2 font-serif text-4xl font-bold md:text-5xl">
                Best Bets Pick&apos;em
              </h1>

              <p className="mt-3 text-lg">
                Honor the tradition. Eliminate the paperwork.
              </p>
            </div>

            <Link className="pt-2 font-bold underline" href="/admin">
              Commissioner
            </Link>
          </div>
        </header>

        <section className="border-b-2 border-[#1d1d1f] py-8">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-bold tracking-[0.2em] text-slate-600">
                THIS WEEK
              </p>

              <h2 className="mt-2 font-serif text-3xl font-bold">
                {data.week}
              </h2>

              <p className="mt-3 text-slate-700">
                Make one pick now or save both at once.
              </p>
            </div>

            <Link
              className="inline-block bg-[#1d1d1f] px-6 py-3 text-center font-bold text-white"
              href="/board"
            >
              Go to The Board
            </Link>
          </div>
        </section>

        <section className="py-8">
          <p className="text-sm font-bold tracking-[0.2em] text-slate-600">
            STANDINGS
          </p>

          <h2 className="mt-2 font-serif text-3xl font-bold">
            {data.week} ledger
          </h2>

          <p className="mt-3 text-sm text-slate-700">
            Picks stay private until each game begins. Your own picks are always
            visible to you.
          </p>

          <div className="mt-6 overflow-x-auto border border-slate-400 bg-white">
            <table className="w-full min-w-[650px] border-collapse text-left">
              <thead className="border-b border-slate-400 text-xs tracking-[0.14em] text-slate-700">
                <tr>
                  <th className="w-20 px-4 py-3">WINS</th>
                  <th className="min-w-36 px-4 py-3">PLAYER</th>
                  <th className="min-w-48 px-4 py-3">PICK 1</th>
                  <th className="min-w-48 px-4 py-3">PICK 2</th>
                </tr>
              </thead>

              <tbody>
                {data.rows.map((row) => (
                  <tr
                    className={`border-b border-slate-200 last:border-b-0 ${
                      row.id === data.viewerPlayerId ? "bg-[#fbf6e8]" : ""
                    }`}
                    key={row.id}
                  >
                    <td className="px-4 py-4 font-serif text-2xl">
                      {row.wins}
                    </td>

                    <td className="px-4 py-4 font-serif text-xl">
                      {row.firstName}
                    </td>

                    {[0, 1].map((pickNumber) => {
                      const pick = row.picks[pickNumber];

                      return (
                        <td className="px-4 py-4" key={pickNumber}>
                          {pick?.label ? (
                            <span>
                              {pick.label}{" "}
                              {pick.resultMark ? (
                                <strong
                                  className={
                                    pick.resultMark === "✓"
                                      ? "text-green-700"
                                      : "text-red-700"
                                  }
                                >
                                  {pick.resultMark}
                                </strong>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border-t-2 border-[#1d1d1f] py-8">
          <p className="text-sm font-bold tracking-[0.2em] text-slate-600">
            SURVIVOR
          </p>

          <p className="mt-3 text-slate-700">
            Survivor will join the ledger once Pick&apos;em is fully tested.
          </p>
        </section>
      </div>
    </main>
  );
}