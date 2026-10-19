import { formatAverage } from "@/lib/all-time-stats.js";

/**
 * The pieces the league's stats and each player's stats (both in the Performance panel) are built from, so the two always read alike.
 * The numbers come from `buildGroupStats` in src/lib/group-stats.js.
 */
export type Bucket = { wins: number; losses: number; picks: number; hitRate: number | null };
export type Split = Bucket & { share: number | null };
export type Weeks = { total: number; donut: number; split: number; sweep: number };
export type RecordSummary = Bucket & { pushes: number; pushedGames: number; pushShare: number | null };
export type TeamPicked = Bucket & { teamId: string; name: string; abbreviation: string; share: number | null };
export type Splits = { side: { favorite: Split; underdog: Split }; venue: { home: Split; away: Split } };

export const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

export function RecordTiles({ record, mostPicked, mostPickedTied = 1 }: { record: RecordSummary; mostPicked?: TeamPicked | null; mostPickedTied?: number }) {
  return (
    <dl className="pool-stats-tiles">
      <div><dt>Record</dt><dd>{record.wins.toLocaleString()}–{record.losses.toLocaleString()}</dd></div>
      <div><dt>Hit rate</dt><dd>{formatAverage(record.hitRate)}</dd></div>
      <div><dt>Pushes</dt><dd>{record.pushedGames}<small> {record.pushedGames === 1 ? "game" : "games"} · {percent(record.pushShare)}</small></dd></div>
      {mostPicked && mostPickedTied > 1
        ? <div><dt>Most picked team</dt><dd>{mostPickedTied}<small> teams tied</small></dd><small>{mostPicked.picks} {mostPicked.picks === 1 ? "pick" : "picks"} each</small></div>
        : mostPicked ? <div><dt>Most picked team</dt><dd>{mostPicked.abbreviation || mostPicked.name}<small> {mostPicked.picks} {mostPicked.picks === 1 ? "pick" : "picks"}</small></dd><small>{mostPicked.name} · {mostPicked.wins}–{mostPicked.losses}</small></div> : null}
    </dl>
  );
}

/** 0-2, 1-1 and 2-0 weeks as bars, with a dash where coin flips would land (25%, 50%, 25%). */
export function WeeksHistogram({ weeks, label }: { weeks: Weeks; label: string }) {
  const bars = [
    { label: "0-2", note: "donut", count: weeks.donut, expected: 0.25 },
    { label: "1-1", note: "split", count: weeks.split, expected: 0.5 },
    { label: "2-0", note: "sweep", count: weeks.sweep, expected: 0.25 },
  ];
  // The tallest bar fills the track; 60% of all weeks unless somebody's pattern is lopsided.
  const scale = Math.max(0.6, ...bars.map((bar) => (weeks.total ? bar.count / weeks.total : 0)));
  return (
    <div aria-label={label} className="pool-histogram" role="img">
      {bars.map((bar) => {
        const share = weeks.total ? bar.count / weeks.total : 0;
        return (
          <div className="pool-bar" key={bar.label}>
            <span className="pool-bar-value">{bar.count.toLocaleString()} <small>{percent(share)}</small></span>
            <span className="pool-bar-track">
              <span className="pool-bar-fill" style={{ height: `${(share / scale) * 100}%` }} />
              <span className="pool-bar-expected" style={{ bottom: `${(bar.expected / scale) * 100}%` }} />
            </span>
            <span className="pool-bar-label">{bar.label}<small>{bar.note}</small></span>
          </div>
        );
      })}
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

export function SplitsTable({ splits }: { splits: Splits }) {
  return (
    <div className="pool-table-wrap">
      <table className="pool-table">
        <thead><tr><th scope="col">Pick</th><th scope="col">Picked</th><th scope="col">Record</th><th scope="col">Hit rate</th></tr></thead>
        <tbody>
          <SplitRows label="Side of the spread" rows={[["Favorites", splits.side.favorite], ["Underdogs", splits.side.underdog]]} />
          <SplitRows label="Where the game is played" rows={[["Home team", splits.venue.home], ["Road team", splits.venue.away]]} />
        </tbody>
      </table>
    </div>
  );
}

/** The teams picked most often, with how much of the picking each took and how it did. */
export function TeamsTable({ teams }: { teams: TeamPicked[] }) {
  return (
    <div className="pool-table-wrap">
      <table className="pool-table">
        <thead><tr><th scope="col">Team</th><th scope="col">Picked</th><th scope="col">Record</th><th scope="col">Hit rate</th></tr></thead>
        <tbody>
          {teams.map((team) => (
            <tr key={team.teamId}>
              <th scope="row">{team.name}</th>
              <td>{percent(team.share)}<small>{team.picks}</small></td>
              <td>{team.wins}–{team.losses}</td>
              <td className="pool-strong">{formatAverage(team.hitRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
