"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import TrophyTurntable from "@/components/trophy-turntable";
import { formatAverage, QUALIFYING_AB } from "@/lib/all-time-stats.js";

type Champion = { playerId: string; name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };
type Row = { playerId: string; name: string; ab: number; h: number; avg: number | null; qualified: boolean; streaks: { noDonut: Run; sweeps: Run } | null };
type Run = { longest: number; current: number };

export default function TrophyRoomPage() {
  const [data, setData] = useState<{ trophies: Season[]; players: Row[] } | null>(null);
  const [notYet, setNotYet] = useState(false);   // before the Trophy Room opens, a player is told when
  const [error, setError] = useState("");
  const [sort, setSort] = useState<{ key: "wins" | "rate"; descending: boolean }>({ key: "rate", descending: true });

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const response = await fetchWithSession("/api/trophy-room");
        const body = await response.json() as { trophies?: Season[]; players?: Row[]; error?: string };
        if (response.status === 404) { if (!disposed) setNotYet(true); return; }
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
    <th aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"} rowSpan={2} scope="col">
      <button className="trophy-sort" onClick={() => choose(key)} type="button">{label}<span aria-hidden="true">{sort.key === key ? (sort.descending ? " ▼" : " ▲") : ""}</span></button>
    </th>
  );

  const streakCell = (run: Run | undefined, label: string) => (
    <td aria-label={run ? `${label}: ${run.current} now, ${run.longest} best` : `${label}: none yet`}>{run ? <>{run.current}<small>/{run.longest}</small></> : "—"}</td>
  );

  function line(row: Row, rank: number) {
    const own = row.streaks ?? undefined;
    return (
      <tr key={row.playerId}>
        <td className="trophy-rank">{rank}</td>
        <th scope="row">{row.name}</th>
        <td>{row.ab ? row.h : "—"}</td>
        <td className="trophy-avg">{formatAverage(row.avg)}</td>
        {streakCell(own?.noDonut, "Weeks with at least 1 win")}
        {streakCell(own?.sweeps, "2-0 weeks")}
      </tr>
    );
  }

  return (
    <main className="commissioner-subpage min-h-screen px-4 py-7 text-(color:--themed-text-31) sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-4 desk-rule-bottom pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-(color:--themed-text-28)">LEAD PIPE LOCKS</p>
            <h1 className="mt-2 font-serif text-4xl font-bold">Trophy room</h1>
            <p className="mt-2 max-w-xl text-(color:--themed-text-29)">Every season’s champions, and every player’s all-time record.</p>
          </div>
          <Link className="font-bold underline underline-offset-4" href="/">Back to Standings</Link>
        </header>

        {error ? <p className="mt-6 font-semibold text-red-700" role="alert">{error}</p> : null}
        {notYet ? <p className="mt-6 text-lg">The Trophy Room is not open yet.</p> : null}
        {!data && !error && !notYet ? <p className="mt-6 text-sm text-(color:--themed-text-28)">Loading the Trophy Room…</p> : null}

        <section aria-labelledby="trophy-display" className="desk-rule-bottom py-8">
          <h2 className="font-serif text-2xl font-bold" id="trophy-display">The trophies</h2>
          <div className="mt-4"><TrophyTurntable seasons={data?.trophies ?? []} /></div>
        </section>

        {data ? <>
          <section aria-labelledby="all-time" className="py-8">
            <h2 className="font-serif text-2xl font-bold" id="all-time">All-time record</h2>
            <p className="mt-1 text-sm text-(color:--themed-text-29)">Tap Wins or Hit rate to sort. Hit rate ranks players with at least {QUALIFYING_AB} picks first. Streaks are consecutive regular-season weeks, shown as now / best.</p>
            <div className="trophy-table-wrap mt-4">
              <table className="trophy-table">
                <thead>
                  <tr><th rowSpan={2} scope="col"><span className="sr-only">Rank</span></th><th rowSpan={2} scope="col">Player</th>{header("wins", "Wins")}{header("rate", "Hit rate")}<th colSpan={2} scope="colgroup">Streaks</th></tr>
                  <tr><th scope="col" title="Weeks in a row with at least 1 win: now / best">1+ win</th><th scope="col" title="2-0 weeks in a row: now / best">2-0</th></tr>
                </thead>
                <tbody>
                  {sorted.map((row, index) => (
                    firstUnqualified === index
                      ? [<tr className="trophy-divider" key="divider"><td colSpan={6}>Under {QUALIFYING_AB} picks</td></tr>, line(row, index + 1)]
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
                <li><b>Streaks</b>: weeks in a row with at least 1 win (never a 0-2), and 2-0 weeks in a row, regular season only. A streak still alive at the end of a season carries into the next. A pick not made counts as a loss; a week with a voided pick is left out.</li>
                <li>A champion from a season with no pick history on file still appears, with dashes.</li>
              </ul>
            </details>
          </section>
        </> : null}

      </div>
    </main>
  );
}
