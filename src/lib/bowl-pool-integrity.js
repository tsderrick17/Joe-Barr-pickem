export function assessBowlPoolIntegrity(games, lines, now = new Date()) {
  const problems = [];
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
    if (!game.away_team_id || !game.home_team_id) problems.push(`Bowl Pool game ${game.id} is missing a team.`);
    if (game.away_team_id && game.away_team_id === game.home_team_id) problems.push(`Bowl Pool game ${game.id} has the same team twice.`);
  }
  for (let index = 1; index < ordered.length; index += 1) {
    if (new Date(ordered[index - 1].kickoff_at).getTime() > new Date(ordered[index].kickoff_at).getTime()) {
      problems.push("Bowl Pool games are not in chronological order.");
      break;
    }
  }
  const lineIds = new Set(lines.map((line) => line.game_id));
  const missingLines = games.filter((game) => ["scheduled", "live"].includes(game.status) && new Date(game.kickoff_at).getTime() <= now.getTime() && !lineIds.has(game.id));
  if (missingLines.length) problems.push(`${missingLines.length} started Bowl Pool game${missingLines.length === 1 ? " is" : "s are"} missing a locked line.`);
  const validStatuses = new Set(["scheduled", "live", "final", "postponed", "cancelled", "no_contest"]);
  const invalidStatus = games.filter((game) => !validStatuses.has(game.status));
  if (invalidStatus.length) problems.push(`${invalidStatus.length} Bowl Pool game${invalidStatus.length === 1 ? " has" : "s have"} an invalid status.`);
  return { healthy: problems.length === 0, problems, missingLines: missingLines.length, gameCount: games.length };
}
