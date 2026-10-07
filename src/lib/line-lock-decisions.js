import { isFallbackLineFresh } from "./line-fallback-policy.js";

/** @typedef {{ id: string; odds_event_id: string | null; away_team_id: string; home_team_id: string }} DueGame */
/** @typedef {{ favorite_team_id: string | null; spread: number | string; source: string; captured_at: string }} HistoryRow */
/** @typedef {{ name: string; point?: number }} OddsOutcome */
/** @typedef {{ id: string; bookmakers?: Array<{ key: string; markets?: Array<{ key: string; outcomes?: OddsOutcome[] }> }> }} OddsEvent */
/**
 * @typedef {{
 *   gameId: string;
 *   favoriteTeamId: string;
 *   spread: number;
 *   source: string;
 *   sourceCapturedAt: string;
 *   usedFallback: boolean;
 *   wasPickEm: boolean;
 *   recordHistory: boolean;
 * }} LineLockDecision
 */

/**
 * Select official-line writes without making provider or database calls. The
 * caller still commits the decisions atomically and records the run outcome.
 *
 * @param {{
 *   dueGames: DueGame[];
 *   oddsEvents: OddsEvent[];
 *   latestHistoryByGameId: Map<string, HistoryRow>;
 *   teamNameById: Map<string, string>;
 *   teamIdByName: Map<string, string>;
 *   checkedAt: string;
 * }} input
 * @returns {{ decisions: LineLockDecision[]; missingGames: string[]; warnings: string[] }}
 */
export function selectLineLockDecisions(input) {
  const {
    dueGames,
    oddsEvents,
    latestHistoryByGameId,
    teamNameById,
    teamIdByName,
    checkedAt,
  } = input;
  const eventByExternalId = new Map(oddsEvents.map((event) => [event.id, event]));
  /** @type {LineLockDecision[]} */
  const decisions = [];
  /** @type {string[]} */
  const missingGames = [];
  /** @type {string[]} */
  const warnings = [];

  for (const game of dueGames) {
    /** @param {string | null | undefined} teamId */
    const isCurrentTeamId = (teamId) =>
      teamId === game.away_team_id || teamId === game.home_team_id;
    const event = game.odds_event_id
      ? eventByExternalId.get(game.odds_event_id)
      : undefined;
    const draftKings = event?.bookmakers?.find(
      (bookmaker) => bookmaker.key === "draftkings",
    );
    const spreadMarket = draftKings?.markets?.find(
      (market) => market.key === "spreads",
    );
    const outcomes = spreadMarket?.outcomes ?? [];
    const validMatchupMarket =
      outcomes.length === 2 &&
      outcomes.some((outcome) => teamIdByName.get(outcome.name) === game.away_team_id) &&
      outcomes.some((outcome) => teamIdByName.get(outcome.name) === game.home_team_id) &&
      outcomes.every(
        (outcome) =>
          typeof outcome.point === "number" && Number.isFinite(outcome.point),
      ) &&
      Number(outcomes[0].point) === -Number(outcomes[1].point);
    const favorite = validMatchupMarket
      ? outcomes.find((outcome) => typeof outcome.point === "number" && outcome.point < 0)
      : undefined;
    const isPickEm = validMatchupMarket && outcomes.every((outcome) => outcome.point === 0);

    if (favorite) {
      const favoriteTeamId = teamIdByName.get(favorite.name);
      if (favoriteTeamId && isCurrentTeamId(favoriteTeamId)) {
        decisions.push({
          gameId: game.id,
          favoriteTeamId,
          spread: Math.abs(favorite.point ?? 0),
          source: "DraftKings",
          sourceCapturedAt: checkedAt,
          usedFallback: false,
          wasPickEm: false,
          recordHistory: true,
        });
        continue;
      }
    }

    if (isPickEm) {
      // The pool's PK convention is home-team left.
      decisions.push({
        gameId: game.id,
        favoriteTeamId: game.home_team_id,
        spread: 0,
        source: "DraftKings",
        sourceCapturedAt: checkedAt,
        usedFallback: false,
        wasPickEm: true,
        recordHistory: true,
      });
      continue;
    }

    const previousLine = latestHistoryByGameId.get(game.id);
    const previousSpread = Number(previousLine?.spread);
    const validPreviousSpread =
      (typeof previousLine?.spread === "number" ||
        (typeof previousLine?.spread === "string" && previousLine.spread.trim() !== "")) &&
      Number.isFinite(previousSpread) &&
      previousSpread >= 0;
    const validPreviousFavorite =
      !!previousLine?.favorite_team_id && isCurrentTeamId(previousLine.favorite_team_id);
    if (
      previousLine?.favorite_team_id &&
      validPreviousFavorite &&
      validPreviousSpread &&
      isFallbackLineFresh(previousLine.captured_at, checkedAt)
    ) {
      decisions.push({
        gameId: game.id,
        favoriteTeamId: previousLine.favorite_team_id,
        spread: previousSpread,
        source: `${previousLine.source} - last known`,
        sourceCapturedAt: previousLine.captured_at,
        usedFallback: true,
        wasPickEm: previousSpread === 0,
        recordHistory: false,
      });
      continue;
    }

    const awayTeam = teamNameById.get(game.away_team_id) ?? "Unknown team";
    const homeTeam = teamNameById.get(game.home_team_id) ?? "Unknown team";
    missingGames.push(`${awayTeam} at ${homeTeam}`);
    if (previousLine?.favorite_team_id) {
      const ageMilliseconds = Date.parse(checkedAt) - Date.parse(previousLine.captured_at);
      const ageDescription = !validPreviousFavorite || !validPreviousSpread
        ? "invalid or did not match this game"
        : Number.isFinite(ageMilliseconds)
          ? `${Math.max(0, Math.floor(ageMilliseconds / (60 * 60 * 1000)))} hours old`
          : "too old to verify";
      warnings.push(
        `${awayTeam} at ${homeTeam} was not locked because its last known line was ${ageDescription}. Commissioner review is required.`,
      );
    }
  }

  return { decisions, missingGames, warnings };
}
