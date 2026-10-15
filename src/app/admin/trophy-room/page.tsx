"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAverage, QUALIFYING_AB } from "@/lib/all-time-stats.js";

type Champion = { playerId: string; name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };
type Row = {
  playerId: string; name: string; seasons: number; ab: number; h: number; avg: number | null; slg: number | null;
  bestSeason: { year: number; avg: number; ab: number } | null; longestStreak: number;
  survivorExit: { averageWeek: number; exits: number } | null;
  titles: { pickem: number; survivor: number }; qualified: boolean;
};

const pools: Array<{ key: "pickem" | "survivor" | "bowl"; label: string }> = [
  { key: "pickem", label: "Pick’em" },
  { key: "survivor", label: "Survivor" },
  { key: "bowl", label: "Bowl Pool" },
];

function names(champions: Champion[] | null) {
  return champions?.length ? champions.map((champion) => champion.name).join(", ") : null;
}

function titleCount(titles: Row["titles"]) {
  if (!titles.pickem && !titles.survivor) return "—";
  return [titles.pickem ? `${titles.pickem} Pick’em` : "", titles.survivor ? `${titles.survivor} Survivor` : ""].filter(Boolean).join(" · ");
}

function survivorExit(exit: Row["survivorExit"]) {
  return exit ? `Wk ${exit.averageWeek.toFixed(1)} (${exit.exits}×)` : "—";
}

export default function TrophyRoomPage() {
  const [data, setData] = useState<{ trophies: Season[]; players: Row[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const response = await fetchWithSession("/api/admin/trophy-room");
        const body = await response.json() as { trophies?: Season[]; players?: Row[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "The Trophy Room could not be loaded.");
        if (!disposed) setData({ trophies: body.trophies ?? [], players: body.players ?? [] });
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setError(reason instanceof Error ? reason.message : "The Trophy Room could not be loaded.");
      }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  const qualified = data?.players.filter((row) => row.qualified) ?? [];
  const others = data?.players.filter((row) => !row.qualified) ?? [];

  function line(row: Row, rank: number | null) {
    return (
      <tr key={row.playerId}>
        <td className="trophy-rank">{rank ?? ""}</td>
        <th scope="row">{row.name}</th>
        <td>{row.ab || "—"}</td>
        <td>{row.ab ? row.h : "—"}</td>
        <td className="trophy-avg">{formatAverage(row.avg)}</td>
        <td>{formatAverage(row.slg)}</td>
        <td>{row.bestSeason ? `${formatAverage(row.bestSeason.avg)} (${row.bestSeason.year})` : "—"}</td>
        <td>{row.longestStreak || "—"}</td>
        <td>{survivorExit(row.survivorExit)}</td>
        <td className="trophy-titles">{titleCount(row.titles)}</td>
      </tr>
    );
  }

  return (
    <main className="commissioner-subpage min-h-screen px-4 py-7 text-(color:--themed-text-31) sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-4 desk-rule-bottom pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-(color:--themed-text-28)">COMMISSIONER</p>
            <h1 className="mt-2 font-serif text-4xl font-bold">Trophy room</h1>
            <p className="mt-2 max-w-xl text-(color:--themed-text-29)">Every season’s champions, and every player’s all-time record scored like a batting average.</p>
          </div>
          <Link className="font-bold underline underline-offset-4" href="/admin">Back to Commissioner</Link>
        </header>

        {error ? <p className="mt-6 font-semibold text-red-700" role="alert">{error}</p> : null}
        {!data && !error ? <p className="mt-6 text-sm text-(color:--themed-text-28)">Loading the Trophy Room…</p> : null}

        {data ? <>
          <section aria-labelledby="past-champions" className="desk-rule-bottom py-8">
            <h2 className="font-serif text-2xl font-bold" id="past-champions">Past champions</h2>
            {data.trophies.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.trophies.map((season) => (
                  <article className="trophy-season desk-panel p-4" key={season.seasonYear}>
                    <h3>{season.seasonYear}</h3>
                    <dl>
                      {pools.map((pool) => {
                        const winners = names(season[pool.key]);
                        return <div key={pool.key}><dt>{pool.label}</dt><dd className={winners ? "" : "is-open"}>{winners ?? "Not crowned"}</dd></div>;
                      })}
                    </dl>
                  </article>
                ))}
              </div>
            ) : <p className="mt-3 text-(color:--themed-text-29)">No champions have been crowned yet.</p>}
          </section>

          <section aria-labelledby="all-time" className="py-8">
            <h2 className="font-serif text-2xl font-bold" id="all-time">All-time batting</h2>
            <p className="mt-1 text-sm text-(color:--themed-text-29)">Ranked by average among players with at least {QUALIFYING_AB} at bats; everyone else follows.</p>
            <div className="trophy-table-wrap mt-4">
              <table className="trophy-table">
                <thead>
                  <tr><th scope="col"><span className="sr-only">Rank</span></th><th scope="col">Player</th><th scope="col">AB</th><th scope="col">H</th><th scope="col">AVG</th><th scope="col">SLG</th><th scope="col">Best season</th><th scope="col">Streak</th><th scope="col">Survivor exit</th><th scope="col">Titles</th></tr>
                </thead>
                <tbody>
                  {qualified.map((row, index) => line(row, index + 1))}
                  {others.length ? <tr className="trophy-divider"><td colSpan={10}>Under {QUALIFYING_AB} at bats</td></tr> : null}
                  {others.map((row) => line(row, null))}
                </tbody>
              </table>
            </div>
            <details className="desk-card mt-5 p-4 text-sm">
              <summary className="cursor-pointer font-bold">How these are figured</summary>
              <ul className="mt-3 space-y-1 text-(color:--themed-text-29)">
                <li><b>AB</b> (at bats): graded Pick’em picks. A push counts as a loss; voided picks never count.</li>
                <li><b>H</b> (hits): picks that covered the spread. <b>AVG</b>: H divided by AB.</li>
                <li><b>SLG</b> (slugging): a cover on the favorite is a single, a cover on the underdog is a double. SLG is total bases divided by AB.</li>
                <li><b>Best season</b>: highest average in one season of at least 20 picks.</li>
                <li><b>Streak</b>: the longest run of covers in a row, in the order the games kicked off.</li>
                <li><b>Survivor exit</b>: the average week a player was knocked out of Survivor, and how many times (Wk 7.0 (3×) means three exits averaging Week 7). A season still alive or won is not an exit.</li>
                <li><b>Titles</b>: Pick’em and Survivor championships; co-champions each get one. The Bowl Pool is a separate game: its champions appear in the season plaques only.</li>
              </ul>
            </details>
          </section>
        </> : null}
      </div>
    </main>
  );
}
