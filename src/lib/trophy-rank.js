/**
 * Places for the Trophy Room's All-Time Table. Players level on what the table is sorted by share a place (standard competition ranking: two players
 * tied for 1st are both 1st and the next player is 3rd), and are marked as tied. Wins are level on wins; under Hit rate, players are level when they
 * are on the same side of the picks threshold and have the same hit rate; the other columns are level on their own number (a streak on its best run).
 * The rows must already be in order.
 * @typedef {"wins" | "rate" | "donut" | "sweeps" | "halfW" | "halfL" | "halfRate" | "pushes" | "perfect" | "name"} SortKey
 * @param {{ h: number, avg: number | null, qualified: boolean, streaks?: { sweeps: { total?: number; longest: number } } | null, halfWins?: number, halfLosses?: number, pushes?: number, streaks?: { noDonut: { longest: number }, sweeps: { longest: number } } | null }[]} rows
 * @param {SortKey} key
 * @returns {{ place: number, tied: boolean }[]}
 */
export function placesFor(rows, key) {
  const same = (a, b) => key === "rate" ? a.qualified === b.qualified && (a.avg ?? null) === (b.avg ?? null)
    : key === "halfRate" ? halfRate(a) === halfRate(b)
    : sortValue(a, key) === sortValue(b, key);
  return rows.map((row, index) => {
    let first = index;
    while (first > 0 && same(rows[first - 1], row)) first -= 1;
    const tied = first !== index || (index + 1 < rows.length && same(rows[index + 1], row));
    return { place: first + 1, tied };
  });
}

/**
 * The All-Time Table's order for one column, highest first when descending (A to Z for the player's name).
 * Hit rate ranks players with enough picks first (so one lucky pick does not top the table), then the rate, then more wins.
 * The half-point hit rate puts players with no game decided by a half point ("—") last whichever way it is sorted (a player 0-1 has a rate,
 * .000, and sits above them); level rates go to more wins, then fewer losses (2-0 above 1-0).
 * Every other column sorts on its number (a streak on the best run); Wins break ties on hit rate. Last ties go A to Z.
 * @param {any} a @param {any} b @param {SortKey} key @param {boolean} descending
 * @returns {number}
 */
export function compareRows(a, b, key, descending) {
  const direction = descending ? 1 : -1;
  const byName = String(a.name ?? "").localeCompare(String(b.name ?? ""));
  if (key === "name") return (descending ? -1 : 1) * byName;
  if (key === "rate") {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    return direction * ((b.avg ?? 0) - (a.avg ?? 0)) || direction * (b.h - a.h) || byName;
  }
  if (key === "halfRate") {
    const rateA = halfRate(a), rateB = halfRate(b);
    if ((rateA === null) !== (rateB === null)) return rateA === null ? 1 : -1;
    return direction * ((rateB ?? 0) - (rateA ?? 0)) || direction * ((b.halfWins ?? 0) - (a.halfWins ?? 0)) || direction * ((a.halfLosses ?? 0) - (b.halfLosses ?? 0)) || byName;
  }
  return direction * (sortValue(b, key) - sortValue(a, key)) || (key === "wins" ? direction * ((b.avg ?? 0) - (a.avg ?? 0)) : 0) || byName;
}

/** The number a column sorts and ranks on (a streak column uses the player's best run). */
export function sortValue(row, key) {
  switch (key) {
    case "wins": return row.h;
    case "perfect": return row.streaks?.sweeps?.total ?? 0;
    case "rate": return row.avg ?? 0;
    case "donut": return row.streaks?.noDonut?.longest ?? 0;
    case "sweeps": return row.streaks?.sweeps?.longest ?? 0;
    case "halfW": return row.halfWins ?? 0;
    case "halfL": return row.halfLosses ?? 0;
    case "halfRate": return halfRate(row) ?? 0;
    case "pushes": return row.pushes ?? 0;
    default: return 0;
  }
}

/** A player's hit rate in games decided by half a point: wins over wins plus losses, or null when none were decided that way. */
export function halfRate(row) {
  const decided = (row.halfWins ?? 0) + (row.halfLosses ?? 0);
  return decided ? (row.halfWins ?? 0) / decided : null;
}
