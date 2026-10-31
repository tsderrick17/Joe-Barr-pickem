import { dateFormat } from "./date-format.js";
import { FINAL_OVERDUE_HOURS, finalIsOverdue } from "./final-overdue.js";

/** How long before kickoff a game must have both teams. Playoff rounds wait on earlier rounds, so until then a team-less playoff game is expected. */
export const BOWL_TEAMS_DUE_HOURS = 36;

const dayOf = (iso) => dateFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(iso));
/** A game as a person names it: "Rose Bowl (Jan 1)". */
export function bowlGameLabel(game) {
  return game.bowl_name ? `${game.bowl_name} (${dayOf(game.kickoff_at)})` : `The Bowl Pool game on ${dayOf(game.kickoff_at)}`;
}

/**
 * Whether a team-less game is a problem now. An ordinary bowl has its teams once the bowl matchups are announced, so a missing team is always a problem.
 * A College Football Playoff game after the first round waits for the earlier rounds to finish, so it needs its teams only close to kickoff
 * (or once it should have started).
 */
export function bowlGameNeedsTeams(game, now) {
  if (!game.is_cfp) return true;
  if (!["scheduled", "live"].includes(game.status)) return false;
  return new Date(game.kickoff_at).getTime() - now.getTime() <= BOWL_TEAMS_DUE_HOURS * 3_600_000;
}

export function countMissingBowlTeamSlots(games) {
  return games.reduce(
    (total, game) => total + (game.away_team_id ? 0 : 1) + (game.home_team_id ? 0 : 1),
    0,
  );
}

/**
 * Problems come back as plain sentences in `problems` and as `issues` ({ kind, message }) so the watchdog can alert on each kind on its own:
 * "structure" (duplicates, same team twice, bad status), "teams", "line" and "final" (a game with no final score long after kickoff). Games out of kickoff order are only a `warnings` entry: the schedule pull and a Reschedule
 * keep the list in date order on their own, so a game out of place means the Commissioner arranged it, which is worth a look but is not a failure.
 */
export function assessBowlPoolIntegrity(games, lines, now = new Date()) {
  const issues = [];
  const warnings = [];
  const problems = { push: (message) => issues.push({ kind: "structure", message }) };
  const add = (kind, message) => issues.push({ kind, message });
  const ordered = [...games].sort((a, b) => a.order_index - b.order_index);
  const ids = new Set();
  const duplicateIds = new Set();
  for (const game of games) {
    if (ids.has(game.id)) duplicateIds.add(game.id);
    ids.add(game.id);
  }
  if (duplicateIds.size) problems.push(`${duplicateIds.size} duplicate Bowl Pool game record${duplicateIds.size === 1 ? "" : "s"}.`);
  const orderValues = new Set();
  for (const game of games) {
    if (orderValues.has(game.order_index)) problems.push(`Duplicate Bowl Pool order index ${game.order_index}.`);
    orderValues.add(game.order_index);
    if ((!game.away_team_id || !game.home_team_id) && bowlGameNeedsTeams(game, now)) add("teams", `${bowlGameLabel(game)} is missing a team.`);
    if (game.away_team_id && game.away_team_id === game.home_team_id) problems.push(`${bowlGameLabel(game)} has the same team twice.`);
  }
  for (let index = 1; index < ordered.length; index += 1) {
    if (new Date(ordered[index - 1].kickoff_at).getTime() > new Date(ordered[index].kickoff_at).getTime()) {
      warnings.push("Bowl Pool games are not in chronological order.");
      break;
    }
  }
  const lineIds = new Set(lines.map((line) => line.game_id));
  const missingLines = games.filter((game) => ["scheduled", "live"].includes(game.status) && new Date(game.kickoff_at).getTime() <= now.getTime() && !lineIds.has(game.id));
  if (missingLines.length) add("line", `${missingLines.map(bowlGameLabel).join(", ")} ${missingLines.length === 1 ? "has" : "have"} started without a locked line.`);
  const overdueFinals = games.filter((game) => finalIsOverdue(game, now));
  if (overdueFinals.length) add("final", `${overdueFinals.map(bowlGameLabel).join(", ")} ${overdueFinals.length === 1 ? "has" : "have"} no final score yet, more than ${FINAL_OVERDUE_HOURS} hours after kickoff.`);
  const validStatuses = new Set(["scheduled", "live", "final", "postponed", "cancelled", "no_contest"]);
  const invalidStatus = games.filter((game) => !validStatuses.has(game.status));
  if (invalidStatus.length) problems.push(`${invalidStatus.length} Bowl Pool game${invalidStatus.length === 1 ? " has" : "s have"} an invalid status.`);
  return { healthy: issues.length === 0, problems: issues.map((issue) => issue.message), issues, warnings, missingLines: missingLines.length, gameCount: games.length };
}
