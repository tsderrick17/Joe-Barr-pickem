"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAverage, QUALIFYING_AB } from "@/lib/all-time-stats.js";

type Champion = { playerId: string; name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };
type Row = { playerId: string; name: string; ab: number; h: number; avg: number | null; qualified: boolean };

const pools: Array<{ key: "pickem" | "survivor" | "bowl"; label: string }> = [
  { key: "pickem", label: "Pick’em" },
  { key: "survivor", label: "Survivor" },
  { key: "bowl", label: "Bowl Pool" },
];

function names(champions: Champion[] | null) {
  return champions?.length ? champions.map((champion) => champion.name).join(", ") : null;
}

export default function TrophyRoomPage() {
  const [data, setData] = useState<{ trophies: Season[]; players: Row[] } | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<{ key: "wins" | "rate"; descending: boolean }>({ key: "rate", descending: true });

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

  const players = data?.players ?? [];
  // Wins and hit rate sort on their own. Hit rate ranks players with enough picks first (so one lucky pick does not top the table);
  // wins ranks everyone.
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  const sorted = [...players].sort((a, b) => {
    const direction = sort.descending ? 1 : -1;
    if (sort.key === "wins") return direction * (b.h - a.h) || direction * ((b.avg ?? 0) - (a.avg ?? 0)) || byName(a, b);
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    return direction * ((b.avg ?? 0) - (a.avg ?? 0)) || direction * (b.h - a.h) || byName(a, b);
  });
  const firstUnqualified = sort.key === "rate" ? sorted.findIndex((row) => !row.qualified) : -1;
  const choose = (key: "wins" | "rate") => setSort((current) => current.key === key ? { key, descending: !current.descending } : { key, descending: true });
  const header = (key: "wins" | "rate", label: string) => (
    <th aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"} scope="col">
      <button className="trophy-sort" onClick={() => choose(key)} type="button">{label}<span aria-hidden="true">{sort.key === key ? (sort.descending ? " ▼" : " ▲") : ""}</span></button>
    </th>
  );

  function line(row: Row, rank: number) {
    return (
      <tr key={row.playerId}>
        <td className="trophy-rank">{rank}</td>
        <th scope="row">{row.name}</th>
        <td>{row.ab ? row.h : "—"}</td>
        <td className="trophy-avg">{formatAverage(row.avg)}</td>
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
            <p className="mt-2 max-w-xl text-(color:--themed-text-29)">Every season’s champions, and every player’s all-time record.</p>
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
                        return <div key={pool.key}><dt>{pool.label}</dt><dd className={winners ? "" : "is-open"}>{winners ?? "Not recorded"}</dd></div>;
                      })}
                    </dl>
                  </article>
                ))}
              </div>
            ) : <p className="mt-3 text-(color:--themed-text-29)">No champions have been crowned yet.</p>}
          </section>

          <section aria-labelledby="all-time" className="py-8">
            <h2 className="font-serif text-2xl font-bold" id="all-time">All-time record</h2>
            <p className="mt-1 text-sm text-(color:--themed-text-29)">Tap Wins or Hit rate to sort. Hit rate ranks players with at least {QUALIFYING_AB} picks first.</p>
            <div className="trophy-table-wrap mt-4">
              <table className="trophy-table">
                <thead>
                  <tr><th scope="col"><span className="sr-only">Rank</span></th><th scope="col">Player</th>{header("wins", "Wins")}{header("rate", "Hit rate")}</tr>
                </thead>
                <tbody>
                  {sorted.map((row, index) => (
                    firstUnqualified === index
                      ? [<tr className="trophy-divider" key="divider"><td colSpan={4}>Under {QUALIFYING_AB} picks</td></tr>, line(row, index + 1)]
                      : line(row, index + 1)
                  ))}
                </tbody>
              </table>
            </div>
            <details className="desk-card mt-5 p-4 text-sm">
              <summary className="cursor-pointer font-bold">How these are figured</summary>
              <ul className="mt-3 space-y-1 text-(color:--themed-text-29)">
                <li><b>Wins</b>: Pick’em picks that covered the spread, across every season on record.</li>
                <li><b>Hit rate</b>: wins divided by graded picks, written like a batting average (.599 is 59.9%). A push counts as a loss; voided picks never count.</li>
                <li>A champion from a season with no pick history on file still appears, with dashes.</li>
              </ul>
            </details>
          </section>
        </> : null}
      </div>
    </main>
  );
}
