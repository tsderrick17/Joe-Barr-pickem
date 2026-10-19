"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAverage } from "@/lib/all-time-stats.js";

/** The group's numbers for the Performance panel: record and hit rate, the weekly histogram, the two streak boards and the pick splits. */
type Bucket = { wins: number; losses: number; picks: number; hitRate: number | null };
type Split = Bucket & { share: number | null };
type Leader = { playerId: string; name: string; longest: number; current: number; endedAt: { seasonYear: number; week: number } | null };
type Stats = {
  record: Bucket & { pushes: number; pushedGames: number; pushShare: number | null };
  bySeason: Array<Bucket & { seasonYear: number }>;
  weeks: { total: number; donut: number; split: number; sweep: number };
  streaks: { sweeps: Leader[]; noDonut: Leader[] };
  splits: { side: { favorite: Split; underdog: Split }; venue: { home: Split; away: Split; neutral: Split } };
  graded: number;
};

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

function Streaks({ title, note, leaders }: { title: string; note: string; leaders: Leader[] }) {
  return (
    <div className="pool-stats-block">
      <h3>{title}</h3>
      <p>{note}</p>
      {leaders.length ? (
        <div className="pool-table-wrap">
          <table className="pool-table">
            <thead><tr><th scope="col">Player</th><th scope="col">Longest</th><th scope="col">Now</th></tr></thead>
            <tbody>
              {leaders.slice(0, 8).map((leader) => (
                <tr key={leader.playerId}>
                  <th scope="row">{leader.name}{leader.endedAt ? <small> {leader.endedAt.seasonYear} wk {leader.endedAt.week}</small> : null}</th>
                  <td>{leader.longest}</td>
                  <td>{leader.current > 0 ? <span className="pool-alive">{leader.current} · alive</span> : "0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="pool-empty">No completed weeks yet.</p>}
    </div>
  );
}

function SplitRows({ label, rows }: { label: string; rows: Array<[string, Split]> }) {
  return (
    <>
      <tr className="pool-table-group"><th colSpan={4} scope="colgroup">{label}</th></tr>
      {rows.map(([name, split]) => (
        <tr key={name}>
          <th scope="row">{name}</th>
          <td>{percent(split.share)}</td>
          <td>{split.wins}–{split.losses}</td>
          <td className="pool-strong">{formatAverage(split.hitRate)}</td>
        </tr>
      ))}
    </>
  );
}

export default function PoolStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const response = await fetchWithSession("/api/admin/pool-stats");
        const body = await response.json() as Stats & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "The group stats could not be loaded.");
        if (!disposed) setStats(body);
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setError(reason instanceof Error ? reason.message : "The group stats could not be loaded.");
      }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  const bars = stats ? [
    { label: "0-2", note: "donut", count: stats.weeks.donut, expected: 0.25 },
    { label: "1-1", note: "split", count: stats.weeks.split, expected: 0.5 },
    { label: "2-0", note: "sweep", count: stats.weeks.sweep, expected: 0.25 },
  ] : [];
  const scale = 0.6;   // the tallest a bar can be is 60% of all weeks

  return (
    <section aria-labelledby="pool-stats-title" className="commissioner-tool pool-stats">
      <h2 className="font-serif text-2xl font-bold" id="pool-stats-title">The group</h2>
      <p className="pool-stats-lede">How the whole pool does against the spread. Pick&rsquo;em picks, every season on record.</p>
      {error ? <p className="font-semibold text-red-700" role="alert">{error}</p> : null}
      {!stats && !error ? <p className="pool-empty">Counting the picks&hellip;</p> : null}
      {stats ? <>
        <dl className="pool-stats-tiles">
          <div><dt>Record</dt><dd>{stats.record.wins.toLocaleString()}–{stats.record.losses.toLocaleString()}</dd></div>
          <div><dt>Hit rate</dt><dd>{formatAverage(stats.record.hitRate)}</dd></div>
          <div><dt>Pushes</dt><dd>{stats.record.pushedGames}<small> {stats.record.pushedGames === 1 ? "game" : "games"} · {percent(stats.record.pushShare)}</small></dd></div>
        </dl>

        <div className="pool-stats-block">
          <h3>Weekly records</h3>
          <p>Every player&rsquo;s regular-season weeks, two picks each. A pick not made is a loss. The dashes mark what coin flips would give (25%, 50%, 25%). {stats.weeks.total.toLocaleString()} player-weeks.</p>
          <div aria-label="Weekly records histogram" className="pool-histogram" role="img">
            {bars.map((bar) => {
              const share = stats.weeks.total ? bar.count / stats.weeks.total : 0;
              return (
                <div className="pool-bar" key={bar.label}>
                  <span className="pool-bar-value">{bar.count.toLocaleString()} <small>{percent(share)}</small></span>
                  <span className="pool-bar-track">
                    <span className="pool-bar-fill" style={{ height: `${Math.min(100, (share / scale) * 100)}%` }} />
                    <span className="pool-bar-expected" style={{ bottom: `${(bar.expected / scale) * 100}%` }} />
                  </span>
                  <span className="pool-bar-label">{bar.label}<small>{bar.note}</small></span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pool-stats-pair">
          <Streaks leaders={stats.streaks.sweeps} note="Consecutive 2-0 weeks, regular season. A streak alive at the end of a season carries into the next." title="Most 2-0 weeks in a row" />
          <Streaks leaders={stats.streaks.noDonut} note="Consecutive weeks without a 0-2, regular season. Carries across seasons the same way." title="Weeks without a donut" />
        </div>

        <div className="pool-stats-block">
          <h3>What the group picks</h3>
          <p>Share of all graded picks and how each side hit. A push counts as a loss.</p>
          <div className="pool-table-wrap">
            <table className="pool-table">
              <thead><tr><th scope="col">Pick</th><th scope="col">Picked</th><th scope="col">Record</th><th scope="col">Hit rate</th></tr></thead>
              <tbody>
                <SplitRows label="Side of the spread" rows={[["Favorites", stats.splits.side.favorite], ["Underdogs", stats.splits.side.underdog]]} />
                <SplitRows label="Where the game is played" rows={[["Home team", stats.splits.venue.home], ["Road team", stats.splits.venue.away], ["Neutral site", stats.splits.venue.neutral]]} />
              </tbody>
            </table>
          </div>
        </div>
      </> : null}
    </section>
  );
}
