"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { RecordTiles, SplitsTable, WeeksHistogram, type RecordSummary, type Splits, type Weeks } from "@/components/stats-blocks";

/** The group's numbers for the Performance panel: record and hit rate, the weekly histogram, the two streak boards and the pick splits. */
type Leader = { playerId: string; name: string; longest: number; current: number; endedAt: { seasonYear: number; week: number } | null };
type Stats = {
  record: RecordSummary;
  weeks: Weeks;
  streaks: { sweeps: Leader[]; noDonut: Leader[] };
  splits: Splits;
};

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

  return (
    <section aria-labelledby="pool-stats-title" className="commissioner-tool pool-stats">
      <h2 className="font-serif text-2xl font-bold" id="pool-stats-title">The group</h2>
      <p className="pool-stats-lede">How the whole pool does against the spread. Pick&rsquo;em picks, every season on record. Each player&rsquo;s own numbers are in the Trophy Room.</p>
      {error ? <p className="font-semibold text-red-700" role="alert">{error}</p> : null}
      {!stats && !error ? <p className="pool-empty">Counting the picks&hellip;</p> : null}
      {stats ? <>
        <RecordTiles record={stats.record} />

        <div className="pool-stats-block">
          <h3>Weekly records</h3>
          <p>Every player&rsquo;s regular-season weeks, two picks each. A pick not made is a loss. The dashes mark what coin flips would give (25%, 50%, 25%). {stats.weeks.total.toLocaleString()} player-weeks.</p>
          <WeeksHistogram label="Weekly records histogram" weeks={stats.weeks} />
        </div>

        <div className="pool-stats-pair">
          <Streaks leaders={stats.streaks.sweeps} note="Consecutive 2-0 weeks, regular season. A streak alive at the end of a season carries into the next." title="Most 2-0 weeks in a row" />
          <Streaks leaders={stats.streaks.noDonut} note="Consecutive weeks without a 0-2, regular season. Carries across seasons the same way." title="Weeks without a donut" />
        </div>

        <div className="pool-stats-block">
          <h3>What the group picks</h3>
          <p>Share of all graded picks and how each side hit. A push counts as a loss.</p>
          <SplitsTable splits={stats.splits} />
        </div>
      </> : null}
    </section>
  );
}
