"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import TrophyTurntable from "@/components/trophy-turntable";
import { formatAverage } from "@/lib/all-time-stats.js";
import { halfRate, placesFor, sortValue, type SortKey } from "@/lib/trophy-rank.js";

type Champion = { playerId: string; name: string };
type Season = { seasonYear: number; pickem: Champion[] | null; survivor: Champion[] | null; bowl: Champion[] | null };
type Row = { playerId: string; name: string; ab: number; h: number; avg: number | null; qualified: boolean; halfWins?: number; halfLosses?: number; pushes?: number; titles?: { pickem: number; survivor: number }; streaks: { noDonut: Run; sweeps: Run } | null };
type View = "record" | "more";
type Run = { longest: number; current: number };

export default function TrophyRoomPage() {
  const [data, setData] = useState<{ trophies: Season[]; players: Row[] } | null>(null);
  const [notYet, setNotYet] = useState(false);   // before the Trophy Room opens, a player is told when
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("record");   // two views: wins and hit rate, or streaks and the other statistics
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "rate", descending: true });

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
  // Every column sorts on its own number (a streak column on the best run). Hit rate ranks players with enough picks first (so one lucky pick
  // does not top the table); the rest rank everyone. Ties share a place (see placesFor).
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  const sorted = [...players].sort((a, b) => {
    const direction = sort.descending ? 1 : -1;
    if (sort.key === "rate") {
      if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
      return direction * ((b.avg ?? 0) - (a.avg ?? 0)) || direction * (b.h - a.h) || byName(a, b);
    }
    return direction * (sortValue(b, sort.key) - sortValue(a, sort.key)) || (sort.key === "wins" ? direction * ((b.avg ?? 0) - (a.avg ?? 0)) : 0) || byName(a, b);
  });
  const choose = (key: SortKey) => setSort((current) => current.key === key ? { key, descending: !current.descending } : { key, descending: true });
  const switchView = (next: View) => { setView(next); setSort({ key: next === "record" ? "rate" : "donut", descending: true }); };
  const flipView = () => switchView(view === "record" ? "more" : "record");   // a two-way switch: either half flips to the other view
  const header = (key: SortKey, label: ReactNode, rowSpan = 2) => (
    <th aria-sort={sort.key === key ? (sort.descending ? "descending" : "ascending") : "none"} rowSpan={rowSpan} scope="col">
      <button className="trophy-sort" onClick={() => choose(key)} type="button">{label}<span aria-hidden="true">{sort.key === key ? (sort.descending ? " ▼" : " ▲") : ""}</span></button>
    </th>
  );

  /** A streak cell: the all-time best big, and the current streak small under it. */
  const streakCell = (run: Run | undefined, label: string) => {
    if (!run) return <td aria-label={`${label}: none yet`} className="trophy-streak"><span className="trophy-streak-best">—</span></td>;
    return (
      <td aria-label={`${label}: ${run.current} now, ${run.longest} best`} className="trophy-streak">
        <span className="trophy-streak-best">{run.longest}</span>
        <span className="trophy-streak-now">now {run.current}</span>
      </td>
    );
  };
  const count = (row: Row, value: number | undefined) => (row.ab ? value ?? 0 : "—");

  function line(row: Row, rank: number, tied: boolean) {
    const own = row.streaks ?? undefined;
    return (
      <tr key={row.playerId}>
        <td className="trophy-rank">{tied ? <small>T</small> : null}{rank}</td>
        <th scope="row">{row.name}</th>
        {view === "record" ? <>
          <td>{row.ab ? row.h : "—"}</td>
          <td className="trophy-avg">{formatAverage(row.avg)}</td>
          <td>{row.titles?.pickem ? row.titles.pickem : "—"}</td>
        </> : <>
          {streakCell(own?.noDonut, "Weeks in a Row With a Win")}
          {streakCell(own?.sweeps, "Consecutive 2-0 Weeks")}
          <td>{count(row, row.halfWins)}</td>
          <td>{count(row, row.halfLosses)}</td>
          <td>{formatAverage(halfRate(row))}</td>
          <td>{count(row, row.pushes)}</td>
        </>}
      </tr>
    );
  }

  return (
    <main className="commissioner-subpage min-h-screen px-4 py-7 text-(color:--themed-text-31) sm:px-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-start justify-between gap-4 desk-rule-bottom pb-6">
          <div>
            <p className="text-sm font-semibold tracking-[0.2em] text-(color:--themed-text-28)">LEAD PIPE LOCKS</p>
            <h1 className="mt-2 font-serif text-4xl font-bold">Trophy Room</h1>
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
            <div className="trophy-table-head">
              <h2 className="font-serif text-2xl font-bold" id="all-time">All-Time Table</h2>
              <div aria-label="Table view" className="trophy-view-switch" role="group">
                <button aria-pressed={view === "record"} className={view === "record" ? "is-active" : ""} onClick={flipView} type="button">Record</button>
                <button aria-pressed={view === "more"} className={view === "more" ? "is-active" : ""} onClick={flipView} type="button">Other <br />Stats</button>
              </div>
            </div>
            <div className="trophy-table-wrap mt-4">
              <table className="trophy-table" data-view={view}>
                {view === "record"
                  ? <colgroup><col style={{ width: "9%" }} /><col style={{ width: "33%" }} /><col style={{ width: "19%" }} /><col style={{ width: "22%" }} /><col style={{ width: "17%" }} /></colgroup>
                  : <colgroup><col className="trophy-col-rank" /><col className="trophy-col-player" /><col className="trophy-col-donut" /><col className="trophy-col-sweeps" /><col className="trophy-col-wins" /><col className="trophy-col-losses" /><col className="trophy-col-rate" /><col className="trophy-col-pushes" /></colgroup>}
                <thead>
                  {view === "record" ? (
                    <tr><th scope="col"><span className="sr-only">Rank</span></th><th className="trophy-player-head" scope="col">Player</th>{header("wins", "Wins", 1)}{header("rate", "Hit rate", 1)}{header("titles", "Titles", 1)}</tr>
                  ) : <>
                    <tr>
                      <th rowSpan={2} scope="col"><span className="sr-only">Rank</span></th><th className="trophy-player-head" rowSpan={2} scope="col">Player</th>
                      <th colSpan={2} scope="colgroup"><span className="trophy-group">Regular Season Streaks</span></th><th colSpan={3} scope="colgroup"><span className="trophy-group">Decided by a half point</span></th><th aria-hidden="true" />
                    </tr>
                    <tr className="trophy-subheads">
                      {header("donut", <>Weeks in a Row <br />With a Win</>, 1)}{header("sweeps", <>Consecutive <br />2-0 Weeks</>, 1)}{header("halfW", "Wins", 1)}{header("halfL", "Losses", 1)}{header("halfRate", "Hit rate", 1)}{header("pushes", "Pushes picked", 1)}
                    </tr>
                  </>}
                </thead>
                <tbody>
                  {(() => { const places = placesFor(sorted, sort.key); return sorted.map((row, index) => line(row, places[index].place, places[index].tied)); })()}
                </tbody>
              </table>
            </div>
          </section>
        </> : null}

      </div>
    </main>
  );
}
