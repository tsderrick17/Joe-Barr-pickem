/**
 * How a game reads in the pool, wherever it is shown: its kickoff in Eastern time, each side's line as a pick of that side reads it,
 * and how far a side finished past its line. Shared by the clubhouse room, its ticket and the Big Board.
 */

export const ET = "America/New_York";

/** "Sun 1:00 PM", Eastern. */
export function kickoffLabel(iso) {
  if (!iso) return "TBA";
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "short" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" }).format(date);
  return `${day} ${time}`;
}

/** A team's line as its pick reads it: "-3.5" for the favorite, "+3.5" for the other side, "PK" for none, "—" before there is a line. */
export function lineFor(game, teamId) {
  const spread = game.officialSpread ?? game.preliminarySpread;
  if (spread === null || spread === undefined) return "—";
  const size = Math.abs(Number(spread));
  if (size === 0 || !game.favoriteTeamId) return "PK";
  return `${teamId === game.favoriteTeamId ? "-" : "+"}${size}`;
}

/** A line as a number: "-3.5" is -3.5, "+3" is 3, "PK" is 0, no line yet is null. */
const spreadOf = (line) => (line === "PK" ? 0 : /^[+-]?\d/.test(line) ? Number(line) : null);

/** How far a team finished past its spread: its margin of victory plus its line. Positive covered it, zero is a push (a loss), negative missed it. */
export function coverMargin(score, other, line) {
  const spread = spreadOf(line);
  return score === null || other === null || spread === null ? null : score - other + spread;
}
