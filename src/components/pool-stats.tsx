"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAverage } from "@/lib/all-time-stats.js";
import { RecordTiles, SplitsTable, TeamsTable, WeeksHistogram, type Bucket, type RecordSummary, type Splits, type TeamPicked, type Weeks } from "@/components/stats-blocks";

/**
 * Pick'em performance for the Performance panel: the league's numbers, or any one player's, chosen from a dropdown. Each view has the
 * record and hit rate, the most picked team, the weekly 0-2 / 1-1 / 2-0 histogram, the two streaks, the teams picked most and the
 * favorite/underdog and home/road splits. Private to the Commissioner.
 */
type Run = { longest: number; current: number; endedAt: { seasonYear: number; week: number } | null };
type Leader = Run & { playerId: string; name: string };
type View = { record: RecordSummary; mostPicked: TeamPicked | null; teams: TeamPicked[]; weeks: Weeks; splits: Splits; bySeason: Array<Bucket & { seasonYear: number }> };
type PlayerView = View & { playerId: string; name: string; streaks: { sweeps: Run; noDonut: Run } };
type Stats = View & { streaks: { sweeps: Leader[]; noDonut: Leader[] }; players: PlayerView[] };

const LEAGUE = "league";

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

function RunTile({ label, run }: { label: string; run: Run }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{run.longest}<small>{run.endedAt ? ` · ${run.endedAt.seasonYear} wk ${run.endedAt.week}` : ""}</small></dd>
      <small>{run.current > 0 ? <span className="pool-alive">{run.current} right now</span> : "not active"}</small>
    </div>
  );
}

export default function PoolStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(LEAGUE);

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const response = await fetchWithSession("/api/admin/pool-stats");
        const body = await response.json() as Stats & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "The performance stats could not be loaded.");
        if (!disposed) setStats(body);
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setError(reason instanceof Error ? reason.message : "The performance stats could not be loaded.");
      }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  const player = stats?.players.find((candidate) => candidate.playerId === chosen) ?? null;
  const view: View | null = player ?? stats;
  const who = player ? player.name : "the league";

  return (
    <section aria-labelledby="pool-stats-title" className="commissioner-tool pool-stats">
      <h2 className="font-serif text-2xl font-bold" id="pool-stats-title">Pick&rsquo;em performance</h2>
      <p className="pool-stats-lede">How picks do against the spread. Pick&rsquo;em picks, every season on record; a push counts as a loss.</p>
      {error ? <p className="font-semibold text-red-700" role="alert">{error}</p> : null}
      {!stats && !error ? <p className="pool-empty">Counting the picks&hellip;</p> : null}
      {stats && view ? <>
        <label className="pool-select">
          <span>Show</span>
          <select onChange={(event) => setChosen(event.target.value)} value={player ? player.playerId : LEAGUE}>
            <option value={LEAGUE}>The league</option>
            {stats.players.map((candidate) => <option key={candidate.playerId} value={candidate.playerId}>{candidate.name}</option>)}
          </select>
        </label>

        <RecordTiles mostPicked={view.mostPicked} record={view.record} />

        <div className="pool-stats-block">
          <h3>Weekly records</h3>
          <p>{player ? `${player.name}’s` : "Every player’s"} regular-season weeks, two picks each. A pick not made is a loss. The dashes mark what coin flips would give (25%, 50%, 25%). {view.weeks.total.toLocaleString()} {player ? (view.weeks.total === 1 ? "week" : "weeks") : "player-weeks"}.</p>
          <WeeksHistogram label={`${who === "the league" ? "The league’s" : `${who}’s`} weekly records histogram`} weeks={view.weeks} />
        </div>

        {player ? (
          <div className="pool-stats-block">
            <h3>Streaks</h3>
            <p>Regular season only. A streak alive at the end of a season carries into the next.</p>
            <dl className="pool-stats-tiles">
              <RunTile label="Weeks with at least 1 win" run={player.streaks.noDonut} />
              <RunTile label="2-0 weeks in a row" run={player.streaks.sweeps} />
            </dl>
          </div>
        ) : (
          <div className="pool-stats-pair">
            <Streaks leaders={stats.streaks.noDonut} note="Consecutive weeks with at least 1 win (no 0-2), regular season. A streak alive at the end of a season carries into the next." title="Weeks with at least 1 win" />
            <Streaks leaders={stats.streaks.sweeps} note="Consecutive 2-0 weeks, regular season. Carries across seasons the same way." title="2-0 weeks in a row" />
          </div>
        )}

        {view.teams.length ? (
          <div className="pool-stats-block">
            <h3>Most picked teams</h3>
            <p>The teams {who} took most often, and how those picks did.</p>
            <TeamsTable teams={view.teams} />
          </div>
        ) : null}

        <div className="pool-stats-block">
          <h3>What {who} picks</h3>
          <p>Share of {player ? `${player.name}’s` : "all"} graded picks and how each side hit. A push counts as a loss.</p>
          <SplitsTable splits={view.splits} />
        </div>

        {player && player.bySeason.length ? (
          <div className="pool-stats-block">
            <h3>Season by season</h3>
            <div className="pool-table-wrap">
              <table className="pool-table">
                <thead><tr><th scope="col">Season</th><th scope="col">Record</th><th scope="col">Hit rate</th></tr></thead>
                <tbody>
                  {player.bySeason.map((season) => (
                    <tr key={season.seasonYear}>
                      <th scope="row">{season.seasonYear}</th>
                      <td>{season.wins}–{season.losses}</td>
                      <td className="pool-strong">{formatAverage(season.hitRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </> : null}
    </section>
  );
}
