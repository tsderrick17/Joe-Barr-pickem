/**
 * Builds the schedule fields that are safe to upsert. Status is deliberately
 * omitted so a daily schedule refresh cannot overwrite a final, postponed, or
 * cancelled game.
 */
export function buildScheduleGame({
  externalGameId,
  scoringPeriodId,
  awayTeamId,
  homeTeamId,
  kickoffAt,
  lineLockAt,
  isInternational,
}) {
  return {
    external_game_id: externalGameId,
    scoring_period_id: scoringPeriodId,
    away_team_id: awayTeamId,
    home_team_id: homeTeamId,
    kickoff_at: kickoffAt,
    line_lock_at: lineLockAt,
    is_international: isInternational,
  };
}
