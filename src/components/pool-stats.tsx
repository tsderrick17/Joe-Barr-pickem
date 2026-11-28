"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAverage } from "@/lib/all-time-stats.js";
import { formatAdminNumber } from "@/lib/format-admin-number.js";
import { percent, type Bucket, type RecordSummary, type Split, type Splits, type TeamPicked, type TeamSort, type Weeks } from "@/components/stats-blocks";
import { CardHead, Change, DashChart, Sparkline, Tile, ViewSwitch } from "@/components/commissioner/dash-chart";

/**
 * Pick'em performance on the Pool stats page: the league's numbers, or any one player's, chosen from a row of names. Four headline tiles measured
 * against a coin flip, hit rate by season against .500, the weekly 0-2 / 1-1 / 2-0 split against what coin flips would give, then two tables with
 * the bar inside the row: what the league (or the player) picks, five teams picked, and under them five teams faded (picked against). Private to the Commissioner. (Streaks are the Trophy Room's.)
 */
type TeamLists = { teams: TeamPicked[]; teamsByHitRate: TeamPicked[]; teamsLeastPicked: TeamPicked[]; teamsByLowestHitRate: TeamPicked[] };
/** `faded`: the same four lists for the teams picked against (the other side of each pick); the record is the picks' own. */
type Tables = TeamLists & { splits: Splits; faded?: TeamLists };
type View = Tables & { record: RecordSummary; mostPicked: TeamPicked | null; mostPickedTied: number; weeks: Weeks; bySeason: Array<Bucket & { seasonYear: number; net: number }>; thisSeason?: Tables & { seasonYear: number | null } };
type Span = "all" | "season";
const SPANS: Array<[Span, string]> = [["all", "All-time"], ["season", "This season"]];
type PlayerView = View & { playerId: string; name: string };
type Stats = View & { players: PlayerView[] };

const LEAGUE = "league";
const COIN = 0.5;
const average = (value: number) => formatAverage(value);
/** Net pts: points past (+) or short of (−) the number, one decimal at most (spreads come in halves). */
const netPts = (value: number, sign = true) => {
  const text = Math.abs(Number(value.toFixed(1))).toLocaleString("en-US");
  return !sign ? text : value > 0 ? `+${text}` : value < 0 ? `−${text}` : "0";
};
const signed = (value: number) => (value === 0 ? "level with" : `${formatAverage(Math.abs(value))} ${value > 0 ? "over" : "under"}`);

export default function PoolStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(LEAGUE);
  // Which five teams the table shows: the column chosen, most or least (pressing the chosen column again turns it over).
  const [teamSort, setTeamSort] = useState<{ key: TeamSort; descending: boolean }>({ key: "picked", descending: true });
  const chooseTeamSort = (key: TeamSort) => setTeamSort((current) => (current.key === key ? { key, descending: !current.descending } : { key, descending: true }));
  const [fadedSort, setFadedSort] = useState<{ key: TeamSort; descending: boolean }>({ key: "picked", descending: true });
  const chooseFadedSort = (key: TeamSort) => setFadedSort((current) => (current.key === key ? { key, descending: !current.descending } : { key, descending: true }));
  // Each table's own All-time / This season switch (top right of its card).
  const [splitsSpan, setSplitsSpan] = useState<Span>("all");
  const [teamsSpan, setTeamsSpan] = useState<Span>("all");
  const [fadedSpan, setFadedSpan] = useState<Span>("all");

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
  const tablesOf = (span: Span): Tables | null => (!view ? null : span === "season" && view.thisSeason ? view.thisSeason : view);
  const splitsView = tablesOf(splitsSpan);
  const teamsView = tablesOf(teamsSpan);
  const fadedView = tablesOf(fadedSpan)?.faded ?? null;
  const spanSwitch = (label: string, value: Span, onChange: (span: Span) => void) => (view?.thisSeason ? <ViewSwitch label={label} onChange={onChange} options={SPANS} value={value} /> : null);

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
          <CardHead line="Against the spread; a push counts as a loss. Net pts: points past the number, added up" title="Hit rate by season" />
          <SeasonChart label={`${whose} hit rate by season`} seasons={[...view.bySeason].sort((a, b) => a.seasonYear - b.seasonYear)} />
        </div> : null}

        <div className="dash-card">
          <CardHead line={`Regular-season weeks, two picks each · ${formatAdminNumber(view.weeks.total)} ${player ? (view.weeks.total === 1 ? "week" : "weeks") : "player-weeks"}`} title="Weekly records" />
          <WeeksChart label={`${whose} weekly records`} weeks={view.weeks} />
        </div>

        <div className={`dash-pair${view.faded?.teams.length ? " is-three" : ""}`}>
          <div className="dash-card pool-stats-block">
            <CardHead right={spanSwitch(`What ${who} picks: all-time or this season`, splitsSpan, setSplitsSpan)} title={`What ${who} picks`} />
            <SplitsTable splits={(splitsView ?? view).splits} />
          </div>
          {view.teams.length && teamsView ? <div className="dash-card pool-stats-block">
            <CardHead
              right={spanSwitch("Teams: all-time or this season", teamsSpan, setTeamsSpan)}
              title={teamSort.key === "picked" ? (teamSort.descending ? "Most picked teams" : "Least picked teams") : (teamSort.descending ? "Best hit rate teams" : "Lowest hit rate teams")}
            />
            {teamsView.teams.length
              ? <TeamsTable descending={teamSort.descending} onSort={chooseTeamSort} sort={teamSort.key} teams={teamSort.key === "picked" ? (teamSort.descending ? teamsView.teams : teamsView.teamsLeastPicked) : (teamSort.descending ? teamsView.teamsByHitRate : teamsView.teamsByLowestHitRate)} />
              : <p className="dash-empty">No graded picks this season yet.</p>}
          </div> : null}
          {view.faded?.teams.length && fadedView ? <div className="dash-card pool-stats-block pool-stats-under">
            <CardHead
              right={spanSwitch("Faded teams: all-time or this season", fadedSpan, setFadedSpan)}
              title={fadedSort.key === "picked" ? (fadedSort.descending ? "Most faded teams" : "Least faded teams") : (fadedSort.descending ? "Best teams to fade" : "Worst teams to fade")}
            />
            {fadedView.teams.length
              ? <TeamsTable column="Picked against" descending={fadedSort.descending} onSort={chooseFadedSort} sort={fadedSort.key} teams={fadedSort.key === "picked" ? (fadedSort.descending ? fadedView.teams : fadedView.teamsLeastPicked) : (fadedSort.descending ? fadedView.teamsByHitRate : fadedView.teamsByLowestHitRate)} />
              : <p className="dash-empty">No graded picks this season yet.</p>}
          </div> : null}
        </div>
      </> : null}
    </section>
  );
}

function PoolTiles({ view }: { view: View }) {
  const { record, mostPicked, mostPickedTied } = view;
  const perPick = record.picks ? record.net / record.picks : null;
  return <div className="dash-tiles pool-stats-tiles">
    <Tile label="Record" sub={`${formatAdminNumber(record.picks)} graded picks · ${record.pushedGames} push${record.pushedGames === 1 ? "" : "es"}`} value={`${formatAdminNumber(record.wins)}–${formatAdminNumber(record.losses)}`} />
    <Tile
      label="Hit rate"
      sub={record.hitRate === null ? "No graded picks yet" : <Change good={record.hitRate >= COIN} up={record.hitRate >= COIN}>{signed(record.hitRate - COIN)} a coin flip</Change>}
      trend={<Sparkline values={[...view.bySeason].sort((a, b) => a.seasonYear - b.seasonYear).map((season) => season.hitRate)} />}
      value={formatAverage(record.hitRate)}
    />
    <Tile
      label="Net pts"
      sub={perPick === null ? "No graded picks yet" : <Change good={perPick >= 0} up={perPick >= 0}>{netPts(perPick)} avg per game picked</Change>}
      value={netPts(record.net)}
    />
    {mostPicked && mostPickedTied > 1
      ? <Tile label="Most picked team" sub={`${mostPicked.picks} ${mostPicked.picks === 1 ? "pick" : "picks"} each`} value={`${mostPickedTied} teams tied`} />
      : mostPicked ? <Tile label="Most picked team" sub={`${mostPicked.name} · ${mostPicked.picks} picks · ${mostPicked.wins}–${mostPicked.losses}`} value={mostPicked.abbreviation || mostPicked.name} /> : null}
  </div>;
}

function SeasonChart({ seasons, label }: { seasons: Array<Bucket & { seasonYear: number; net: number }>; label: string }) {
  // Both axes are symmetric about their middle line, so .500 and 0 net pts sit on the same line.
  const reach = Math.max(0.06, ...seasons.map((season) => (season.hitRate === null ? 0 : Math.ceil((Math.abs(season.hitRate - COIN) + 0.01) * 50) / 50)));
  const low = COIN - reach, high = COIN + reach;
  const biggest = Math.max(1, ...seasons.map((season) => Math.abs(season.net)));
  const unit = 4 * 10 ** Math.max(0, Math.floor(Math.log10(biggest)) - 1);
  const net = Math.ceil((biggest * 1.05) / unit) * unit;
  const every = seasons.length > 6 ? 2 : 1;
  return <DashChart
    endLabels
    format={average}
    label={label}
    note={(index) => `${formatAdminNumber(seasons[index].wins)}–${formatAdminNumber(seasons[index].losses)}`}
    refs={[{ y: COIN }]}
    secondAxis={{ format: (value) => netPts(value), yMax: net, yMin: -net, yTicks: [-net, -net / 2, 0, net / 2, net] }}
    series={[
      { key: "rate", label: "Hit rate", tone: "s1", values: seasons.map((season) => season.hitRate) },
      { key: "net", label: "Net pts", tone: "s2", values: seasons.map((season) => season.net), axis2: true },
    ]}
    x={seasons.map((season) => String(season.seasonYear))}
    xTicks={seasons.map((season, index) => ({ index, text: String(season.seasonYear) })).filter((tick) => (seasons.length - 1 - tick.index) % every === 0)}
    yMax={high}
    yMin={low}
    yTicks={[low, COIN - reach / 2, COIN, COIN + reach / 2, high]}
  />;
}

function WeeksChart({ weeks, label }: { weeks: Weeks; label: string }) {
  const counts = [weeks.donut, weeks.split, weeks.sweep];
  const shares = counts.map((count) => (weeks.total ? (count / weeks.total) * 100 : 0));
  const top = Math.max(60, Math.ceil(Math.max(...shares) / 20) * 20);
  return <DashChart
    capLabels
    format={(value) => `${Math.round(value)}%`}
    height={206}
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
  return <div className="pool-table-wrap">
    <table className="dash-table">
      <thead><tr><th scope="col">Side</th><th className="is-num" scope="col">Share</th><th className="is-num" scope="col">Record</th><th className="is-num" scope="col">Hit rate</th></tr></thead>
      <tbody>
        {rows.map(([name, split], index) => <tr className={index === 3 ? "dash-break" : undefined} key={name}>
          <th scope="row">{name}</th>
          <td className="is-num">{percent(split.share)}</td>
          <td className="is-num">{split.wins}–{split.losses}</td>
          <td className="is-num">{formatAverage(split.hitRate)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}

/** A team's nickname (Chiefs, 49ers), for the three tables side by side on a wide screen. */
const nickname = (name: string) => (name === "Unknown team" || !name.includes(" ") ? name : name.slice(name.lastIndexOf(" ") + 1));

/**
 * Five teams, with how much of the picking each took and how it did. Picked and Hit rate are buttons: they choose which five (most picked, or best
 * hit rate). Pressing the column that is already chosen turns it over, to the least picked or the lowest hit rate (▲); pressing it again turns it back (▼).
 * `column` names the share column: Picked, or Picked against for the teams picked against (whose record is the record of the picks against them).
 */
function TeamsTable({ teams, sort, descending, onSort, column = "Picked" }: { teams: TeamPicked[]; sort: TeamSort; descending: boolean; onSort: (sort: TeamSort) => void; column?: string }) {
  // The sort headers may take two lines (Picked / against, Hit / rate) and the share column is the same width in both team tables, so team
  // names get the same room, and as much of it as a phone allows, in both.
  const head = (key: TeamSort, label: string) => <th aria-sort={sort === key ? (descending ? "descending" : "ascending") : "none"} className={key === "picked" ? "is-num pool-wrap pool-share" : "is-num pool-wrap pool-rate"} scope="col">
    <button className="pool-sort" onClick={() => onSort(key)} type="button">{label}<span aria-hidden="true">{sort === key ? (descending ? " ▼" : " ▲") : ""}</span></button>
  </th>;
  return <div className="pool-table-wrap">
    <table className="dash-table">
      <thead><tr><th scope="col">Team</th>{head("picked", column)}<th className="is-num pool-record" scope="col">Record</th>{head("rate", "Hit rate")}</tr></thead>
      <tbody>
        {teams.map((team) => <tr key={team.teamId}>
          <th scope="row"><span className="pool-team-full">{team.name}</span><span className="pool-team-short">{nickname(team.name)}</span></th>
          <td className="is-num">{percent(team.share)}</td>
          <td className="is-num">{team.wins}–{team.losses}</td>
          <td className="is-num">{formatAverage(team.hitRate)}</td>
        </tr>)}
      </tbody>
    </table>
  </div>;
}
