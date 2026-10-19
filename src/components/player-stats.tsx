"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAverage } from "@/lib/all-time-stats.js";
import { RecordTiles, SplitsTable, WeeksHistogram, type Bucket, type RecordSummary, type Splits, type Weeks } from "@/components/stats-blocks";

/** Each player's own full set for the Trophy Room: the same record, weekly histogram, streaks and splits as the group's, from just their picks. */
type Run = { longest: number; current: number; endedAt: { seasonYear: number; week: number } | null };
type PlayerSet = {
  playerId: string;
  name: string;
  record: RecordSummary;
  bySeason: Array<Bucket & { seasonYear: number }>;
  weeks: Weeks;
  streaks: { sweeps: Run; noDonut: Run };
  splits: Splits;
};

function RunTile({ label, run }: { label: string; run: Run }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{run.longest}<small>{run.endedAt ? ` · ${run.endedAt.seasonYear} wk ${run.endedAt.week}` : ""}</small></dd>
      <small>{run.current > 0 ? <span className="pool-alive">{run.current} right now</span> : "not active"}</small>
    </div>
  );
}

export default function PlayerStats() {
  const [players, setPlayers] = useState<PlayerSet[] | null>(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    async function load() {
      try {
        const response = await fetchWithSession("/api/admin/pool-stats");
        const body = await response.json() as { players?: PlayerSet[]; error?: string };
        if (!response.ok) throw new Error(body.error ?? "The player stats could not be loaded.");
        if (!disposed) setPlayers(body.players ?? []);
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (!disposed) setError(reason instanceof Error ? reason.message : "The player stats could not be loaded.");
      }
    }
    void load();
    return () => { disposed = true; };
  }, []);

  const player = players?.find((candidate) => candidate.playerId === chosen) ?? players?.[0] ?? null;

  return (
    <section aria-labelledby="player-stats-title" className="pool-stats py-8">
      <h2 className="font-serif text-2xl font-bold" id="player-stats-title">Player stats</h2>
      <p className="pool-stats-lede">Every player&rsquo;s own numbers against the spread. Pick&rsquo;em picks, every season on record; a push counts as a loss.</p>
      {error ? <p className="font-semibold text-red-700" role="alert">{error}</p> : null}
      {!players && !error ? <p className="pool-empty">Counting the picks&hellip;</p> : null}
      {players && !players.length ? <p className="pool-empty">No picks have been graded yet.</p> : null}
      {players && player ? <>
        <div aria-label="Choose a player" className="pool-picker" role="group">
          {players.map((candidate) => (
            <button aria-pressed={candidate.playerId === player.playerId} key={candidate.playerId} onClick={() => setChosen(candidate.playerId)} type="button">{candidate.name}</button>
          ))}
        </div>

        <RecordTiles record={player.record} />

        <div className="pool-stats-block">
          <h3>Weekly records</h3>
          <p>{player.name}&rsquo;s regular-season weeks, two picks each. A pick not made is a loss. The dashes mark what coin flips would give (25%, 50%, 25%). {player.weeks.total.toLocaleString()} {player.weeks.total === 1 ? "week" : "weeks"}.</p>
          <WeeksHistogram label={`${player.name}'s weekly records histogram`} weeks={player.weeks} />
        </div>

        <div className="pool-stats-block">
          <h3>Streaks</h3>
          <p>Regular season only. A streak alive at the end of a season carries into the next.</p>
          <dl className="pool-stats-tiles">
            <RunTile label="Most 2-0 weeks in a row" run={player.streaks.sweeps} />
            <RunTile label="Weeks without a donut" run={player.streaks.noDonut} />
          </dl>
        </div>

        <div className="pool-stats-block">
          <h3>What {player.name} picks</h3>
          <p>Share of {player.name}&rsquo;s graded picks and how each side hit.</p>
          <SplitsTable splits={player.splits} />
        </div>

        {player.bySeason.length ? (
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
