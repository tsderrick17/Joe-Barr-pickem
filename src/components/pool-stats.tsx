"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAverage } from "@/lib/all-time-stats.js";
import { formatAdminNumber } from "@/lib/format-admin-number.js";
import { percent, type Bucket, type RecordSummary, type Split, type Splits, type TeamPicked, type TeamSort, type Weeks } from "@/components/stats-blocks";
import { CardHead, Change, DashChart, Sparkline, Tile } from "@/components/commissioner/dash-chart";

/**
 * Pick'em performance on the Pool stats page: the league's numbers, or any one player's, chosen from a row of names. Four headline tiles measured
 * against a coin flip, hit rate by season against .500, the weekly 0-2 / 1-1 / 2-0 split against what coin flips would give, then two tables with
 * the bar inside the row: what the league (or the player) picks, and five teams. Private to the Commissioner. (Streaks are the Trophy Room's.)
 */
type View = { record: RecordSummary; mostPicked: TeamPicked | null; mostPickedTied: number; teams: TeamPicked[]; teamsByHitRate: TeamPicked[]; teamsLeastPicked: TeamPicked[]; teamsByLowestHitRate: TeamPicked[]; weeks: Weeks; splits: Splits; bySeason: Array<Bucket & { seasonYear: number }> };
type PlayerView = View & { playerId: string; name: string };
type Stats = View & { players: PlayerView[] };

const LEAGUE = "league";
const COIN = 0.5;
const average = (value: number) => formatAverage(value);
/** How far a hit rate sits from a coin flip, as a bar either side of a centre line: green over .500, cognac under. Full width is 60 points. */
function Diverge({ rate }: { rate: number | null }) {
  if (rate === null) return <span aria-hidden="true" className="dash-diverge" />;
  const width = Math.min(50, (Math.abs(rate - COIN) / 0.06) * 50);
  return <span aria-hidden="true" className="dash-diverge"><u className={rate >= COIN ? "is-over" : "is-under"} style={{ width: `${width}%` }} /></span>;
}
/** A share as a short grey bar beside its number. */
function Share({ share, scale }: { share: number | null; scale: number }) {
  return <span className="dash-share"><u aria-hidden="true" style={{ width: `${Math.round(((share ?? 0) / scale) * 60)}px` }} />{percent(share)}</span>;
}
const signed = (value: number) => (value === 0 ? "level with" : `${formatAverage(Math.abs(value))} ${value > 0 ? "over" : "under"}`);

export default function PoolStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(LEAGUE);
  // Which five teams the table shows: the column chosen, most or least (pressing the chosen column again turns it over).
  const [teamSort, setTeamSort] = useState<{ key: TeamSort; descending: boolean }>({ key: "picked", descending: true });
  const chooseTeamSort = (key: TeamSort) => setTeamSort((current) => (current.key === key ? { key, descending: !current.descending } : { key, descending: true }));

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
  const whose = player ? `${player.name}’s` : "The league’s";

  return (
    <section aria-labelledby="pool-stats-title" className="pool-stats dash-page">
      <h2 className="sr-only" id="pool-stats-title">Pick&rsquo;em performance</h2>
      {error ? <p className="dash-error" role="alert">{error}</p> : null}
      {!stats && !error ? <div aria-label="Counting the picks" className="dash-loading" /> : null}
      {stats && view ? <>
        <div aria-label="Show" className="dash-chips" role="group">
          {[{ id: LEAGUE, name: "The league" }, ...stats.players.map((candidate) => ({ id: candidate.playerId, name: candidate.name }))].map((choice) => (
            <button aria-pressed={(player ? player.playerId : LEAGUE) === choice.id} key={choice.id} onClick={() => setChosen(choice.id)} type="button">{choice.name}</button>
          ))}
        </div>

        <PoolTiles view={view} />

        {view.bySeason.length ? <div className="dash-card">
          <CardHead line="Against the spread; a push counts as a loss" title="Hit rate by season" />
          <SeasonChart label={`${whose} hit rate by season`} seasons={[...view.bySeason].sort((a, b) => a.seasonYear - b.seasonYear)} />
        </div> : null}

        <div className="dash-card">
          <CardHead line={`Regular-season weeks, two picks each · ${formatAdminNumber(view.weeks.total)} ${player ? (view.weeks.total === 1 ? "week" : "weeks") : "player-weeks"}`} title="Weekly records" />
          <WeeksChart label={`${whose} weekly records`} weeks={view.weeks} />
        </div>

        <div className="dash-pair">
          <div className="dash-card pool-stats-block">
            <CardHead line="Share of graded picks, and how each side hit against .500" title={`What ${who} picks`} />
            <SplitsTable splits={view.splits} />
          </div>
          {view.teams.length ? <div className="dash-card pool-stats-block">
            <CardHead
              line={teamSort.key === "picked" ? `The five teams ${who} took ${teamSort.descending ? "most" : "least"} often` : `The five teams ${who === "the league" ? "the league" : `${who}’s picks`} hit ${teamSort.descending ? "most" : "least"} often`}
              title={teamSort.key === "picked" ? (teamSort.descending ? "Most picked teams" : "Least picked teams") : (teamSort.descending ? "Best hit rate teams" : "Lowest hit rate teams")}
            />
            <TeamsTable descending={teamSort.descending} onSort={chooseTeamSort} sort={teamSort.key} teams={teamSort.key === "picked" ? (teamSort.descending ? view.teams : view.teamsLeastPicked) : (teamSort.descending ? view.teamsByHitRate : view.teamsByLowestHitRate)} />
          </div> : null}
        </div>
      </> : null}
    </section>
  );
}

function PoolTiles({ view }: { view: View }) {
  const { record, weeks, mostPicked, mostPickedTied } = view;
  const sweeps = weeks.total ? weeks.sweep / weeks.total : null;
  return <div className="dash-tiles pool-stats-tiles">
    <Tile label="Record" sub={`${formatAdminNumber(record.picks)} graded picks · ${record.pushedGames} push${record.pushedGames === 1 ? "" : "es"}`} value={`${formatAdminNumber(record.wins)}–${formatAdminNumber(record.losses)}`} />
    <Tile
      label="Hit rate"
      sub={record.hitRate === null ? "No graded picks yet" : <Change good={record.hitRate >= COIN} up={record.hitRate >= COIN}>{signed(record.hitRate - COIN)} a coin flip</Change>}
      trend={<Sparkline values={[...view.bySeason].sort((a, b) => a.seasonYear - b.seasonYear).map((season) => season.hitRate)} />}
      value={formatAverage(record.hitRate)}
    />
    <Tile
      label="Perfect weeks"
      sub={sweeps === null ? "No weeks yet" : <Change good={sweeps >= 0.25} up={sweeps >= 0.25}>{Math.abs(Math.round((sweeps - 0.25) * 100))} pts {sweeps >= 0.25 ? "over" : "under"} a coin flip</Change>}
      value={percent(sweeps)}
    />
    {mostPicked && mostPickedTied > 1
      ? <Tile label="Most picked team" sub={`${mostPicked.picks} ${mostPicked.picks === 1 ? "pick" : "picks"} each`} value={`${mostPickedTied} teams tied`} />
      : mostPicked ? <Tile label="Most picked team" sub={`${mostPicked.name} · ${mostPicked.picks} picks · ${mostPicked.wins}–${mostPicked.losses}`} value={mostPicked.abbreviation || mostPicked.name} /> : null}
  </div>;
}

function SeasonChart({ seasons, label }: { seasons: Array<Bucket & { seasonYear: number }>; label: string }) {
  const rates = seasons.map((season) => season.hitRate).filter((rate): rate is number => rate !== null);
  const low = Math.min(0.46, Math.floor((Math.min(...rates, COIN) - 0.01) * 50) / 50);
  const high = Math.max(0.58, Math.ceil((Math.max(...rates, COIN) + 0.01) * 50) / 50);
  const step = (high - low) / 3;
  const every = seasons.length > 6 ? 2 : 1;
  return <DashChart
    endLabels
    format={average}
    label={label}
    note={(index) => `${formatAdminNumber(seasons[index].wins)}–${formatAdminNumber(seasons[index].losses)}`}
    refs={[{ y: COIN, label: "Coin flip" }]}
    series={[{ key: "rate", label: "Hit rate", tone: "s1", values: seasons.map((season) => season.hitRate) }]}
    x={seasons.map((season) => String(season.seasonYear))}
    xTicks={seasons.map((season, index) => ({ index, text: String(season.seasonYear) })).filter((tick) => (seasons.length - 1 - tick.index) % every === 0)}
    yMax={high}
    yMin={low}
    yTicks={[low, low + step, low + 2 * step, high]}
  />;
}

function WeeksChart({ weeks, label }: { weeks: Weeks; label: string }) {
  const counts = [weeks.donut, weeks.split, weeks.sweep];
  const shares = counts.map((count) => (weeks.total ? (count / weeks.total) * 100 : 0));
  const top = Math.max(60, Math.ceil(Math.max(...shares) / 20) * 20);
  return <DashChart
    capLabels
    format={(value) => `${Math.round(value)}%`}
    height={190}
    kind="columns"
    label={label}
    markLabel="Coin flip"
    marks={[25, 50, 25]}
    note={(index) => `${formatAdminNumber(counts[index])} ${counts[index] === 1 ? "week" : "weeks"}`}
    series={[{ key: "share", label: "Share of weeks", tone: "s1", values: shares }]}
    x={["0–2", "1–1", "2–0"]}
    xTicks={[{ index: 0, text: "0–2" }, { index: 1, text: "1–1" }, { index: 2, text: "2–0" }]}
    yMax={top}
    yTicks={[0, top / 3, (top * 2) / 3, top]}
  />;
}

/** Favorites, underdogs and pick'em games (no favorite at all), then home and away, one list; a heavier line sits between the two groups. */
function SplitsTable({ splits }: { splits: Splits }) {
  const rows: Array<[string, Split]> = [["Favorites", splits.side.favorite], ["Underdogs", splits.side.underdog], ["Pick’em", splits.side.pickem], ["Home", splits.venue.home], ["Away", splits.venue.away]];
  const scale = Math.max(0.01, ...rows.map(([, split]) => split.share ?? 0));
  return <div className="pool-table-wrap">
    <table className="dash-table">
      <thead><tr><th scope="col">Side</th><th className="is-num" scope="col">Share</th><th className="is-num" scope="col">Record</th><th className="is-num" scope="col">Hit rate</th></tr></thead>
      <tbody>
        {rows.map(([name, split], index) => <tr className={index === 3 ? "dash-break" : undefined} key={name}>
          <th scope="row">{name}</th>
          <td className="is-num"><Share scale={scale} share={split.share} /></td>
          <td className="is-num">{split.wins}–{split.losses}</td>
          <td className="is-num"><Diverge rate={split.hitRate} />{formatAverage(split.hitRate)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

/**
 * Five teams, with how much of the picking each took and how it did. Picked and Hit rate are buttons: they choose which five (most picked, or best
 * hit rate). Pressing the column that is already chosen turns it over, to the least picked or the lowest hit rate (▲); pressing it again turns it back (▼).
 */
function TeamsTable({ teams, sort, descending, onSort }: { teams: TeamPicked[]; sort: TeamSort; descending: boolean; onSort: (sort: TeamSort) => void }) {
  const scale = Math.max(0.01, ...teams.map((team) => team.share ?? 0));
  const head = (key: TeamSort, label: string) => <th aria-sort={sort === key ? (descending ? "descending" : "ascending") : "none"} className="is-num" scope="col">
    <button className="pool-sort" onClick={() => onSort(key)} type="button">{label}<span aria-hidden="true">{sort === key ? (descending ? " ▼" : " ▲") : ""}</span></button>
  </th>;
  return <div className="pool-table-wrap">
    <table className="dash-table">
      <thead><tr><th scope="col">Team</th>{head("picked", "Picked")}<th className="is-num" scope="col">Record</th>{head("rate", "Hit rate")}</tr></thead>
      <tbody>
        {teams.map((team) => <tr key={team.teamId}>
          <th scope="row">{team.name}</th>
          <td className="is-num"><Share scale={scale} share={team.share} /></td>
          <td className="is-num">{team.wins}–{team.losses}</td>
          <td className="is-num"><Diverge rate={team.hitRate} />{formatAverage(team.hitRate)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
