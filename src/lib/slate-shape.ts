import { gradeAtsPick } from "@/lib/ats-grading";
import { shouldShowSurvivorOnReceipt } from "@/lib/survivor-receipt-visibility";

// The Slate's response, shaped from rows the route has already read. Nothing here touches
// the database, so what a player may see (above all, that other players' picks are public
// only once a game has kicked off) is decided in one small, testable place.

export type TeamRow = { id: string; full_name: string; abbreviation: string };

export type PreliminaryLineRow = { game_id: string; favorite_team_id: string | null; spread: number | string; captured_at: string };

export type LockedLineRow = { game_id: string; favorite_team_id: string | null; locked_spread: number | string; source: string; locked_at: string };

export type GameRow = {
  id: string;
  away_team_id: string;
  home_team_id: string;
  kickoff_at: string;
  line_lock_at: string;
  is_international: boolean;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
  away_score: number | null;
  home_score: number | null;
};

export type SurvivorPickRow = { game_id: string; selected_team_id: string };
export type PublicPickRow = { player_id: string; game_id: string; selected_team_id: string };

export type SlateSurvivor = {
  available: boolean;
  chipsVisible: boolean;
  notice: string | null;
  status: "active" | "eliminated" | "complete";
  requiredThisPeriod: boolean;
  showOnReceipt: boolean;
  pick: SurvivorPickRow | null;
  usedTeamIds: string[];
};

export function atsResultForTeam(game: GameRow, lockedLine: LockedLineRow | undefined, teamId: string) {
  if (game.status !== "final" || !lockedLine) return null;

  const result = gradeAtsPick({
    selectedTeamId: teamId,
    favoriteTeamId: lockedLine.favorite_team_id,
    lockedSpread: Number(lockedLine.locked_spread),
    awayTeamId: game.away_team_id,
    homeTeamId: game.home_team_id,
    awayScore: game.away_score,
    homeScore: game.home_score,
  });

  return result === "pending" ? null : result;
}

/**
 * The games on the Slate, with their lines, scores, results and pickers.
 * Pickers are named only for a game that has already kicked off (`now` is the
 * response's own clock), and only from the started games' public picks the route
 * fetched, so an upcoming selection can never appear here.
 */
export function shapeSlateGames({
  games,
  teams,
  history,
  lockedLines,
  publicPicks,
  players,
  now,
}: {
  games: GameRow[];
  teams: TeamRow[];
  history: PreliminaryLineRow[] | null | undefined;
  lockedLines: LockedLineRow[] | null | undefined;
  publicPicks: PublicPickRow[] | null | undefined;
  players: Array<{ id: string; first_name: string }>;
  now: Date;
}) {
  const teamNameById = new Map(teams.map((team) => [team.id, team.full_name]));
  const teamAbbreviationById = new Map(teams.map((team) => [team.id, team.abbreviation]));

  // History arrives newest first; the first row seen per game is its latest preliminary line.
  const preliminaryLineByGameId = new Map<string, PreliminaryLineRow>();
  for (const line of history ?? []) {
    if (!preliminaryLineByGameId.has(line.game_id)) preliminaryLineByGameId.set(line.game_id, line);
  }

  const lockedLineByGameId = new Map((lockedLines ?? []).map((line) => [line.game_id, line]));
  const playerNameById = new Map(players.map((item) => [item.id, item.first_name]));
  const pickersByGameAndTeam = new Map<string, string[]>();
  for (const pick of publicPicks ?? []) {
    const key = `${pick.game_id}:${pick.selected_team_id}`;
    const names = pickersByGameAndTeam.get(key) ?? [];
    const name = playerNameById.get(pick.player_id);
    if (name) names.push(name);
    pickersByGameAndTeam.set(key, names);
  }

  return games.map((game) => {
    const lockedLine = lockedLineByGameId.get(game.id);
    const started = new Date(game.kickoff_at) <= now;

    return {
      id: game.id,
      kickoffAt: game.kickoff_at,
      lineLockAt: game.line_lock_at,
      isInternational: game.is_international,
      awayTeam: teamNameById.get(game.away_team_id) ?? "Unknown team",
      homeTeam: teamNameById.get(game.home_team_id) ?? "Unknown team",
      awayTeamAbbreviation: teamAbbreviationById.get(game.away_team_id) ?? "NFL",
      homeTeamAbbreviation: teamAbbreviationById.get(game.home_team_id) ?? "NFL",
      favoriteTeamId: lockedLine?.favorite_team_id ?? preliminaryLineByGameId.get(game.id)?.favorite_team_id ?? null,
      awayTeamId: game.away_team_id,
      homeTeamId: game.home_team_id,
      officialSpread: lockedLine ? Number(lockedLine.locked_spread) : null,
      preliminarySpread: lockedLine ? null : preliminaryLineByGameId.has(game.id) ? Number(preliminaryLineByGameId.get(game.id)?.spread) : null,
      spreadSource: lockedLine?.source ?? null,
      spreadLockedAt: lockedLine?.locked_at ?? null,
      status: game.status,
      awayScore: game.away_score,
      homeScore: game.home_score,
      awayResult: atsResultForTeam(game, lockedLine, game.away_team_id),
      homeResult: atsResultForTeam(game, lockedLine, game.home_team_id),
      awayPickers: started ? pickersByGameAndTeam.get(`${game.id}:${game.away_team_id}`) ?? [] : [],
      homePickers: started ? pickersByGameAndTeam.get(`${game.id}:${game.home_team_id}`) ?? [] : [],
    };
  });
}

/** What the Slate shows for Survivor before (or without) the player's entry being read. */
export function unavailableSurvivor(chipsVisible: boolean): SlateSurvivor {
  return {
    available: false,
    chipsVisible,
    notice: "Survivor is temporarily unavailable. ATS picks remain available.",
    status: "active",
    requiredThisPeriod: false,
    showOnReceipt: false,
    pick: null,
    usedTeamIds: [],
  };
}

/** Survivor is a regular-season competition: playoff rounds show it as concluded. */
export function concludedSurvivor(): SlateSurvivor {
  return {
    available: false,
    chipsVisible: false,
    notice: "Survivor has concluded for the season.",
    status: "complete",
    requiredThisPeriod: false,
    showOnReceipt: false,
    pick: null,
    usedTeamIds: [],
  };
}

/** The player's Survivor state for a regular-season week, from their entry and picks. */
export function activeSurvivor({
  entry,
  pick,
  usedPicks,
  season,
  scoringPeriodId,
  periodType,
  periodFirstKickoffAt,
  chipsVisible,
}: {
  entry: { status: "active" | "eliminated"; eliminated_scoring_period_id: string | null };
  pick: SurvivorPickRow | null;
  usedPicks: Array<{ selected_team_id: string }> | null | undefined;
  season: { survivor_champion_player_id: string | null; survivor_champion_crowned_at: string | null };
  scoringPeriodId: string;
  periodType: "regular" | "playoff";
  periodFirstKickoffAt: string | null;
  chipsVisible: boolean;
}): SlateSurvivor {
  const requiredThisPeriod = entry.status === "active" || entry.eliminated_scoring_period_id === scoringPeriodId;
  const championCrownedAt = season.survivor_champion_player_id ? season.survivor_champion_crowned_at : null;
  return {
    available: true,
    chipsVisible,
    notice: null,
    requiredThisPeriod,
    showOnReceipt: shouldShowSurvivorOnReceipt({ periodType, available: true, requiredThisPeriod, championCrownedAt, periodFirstKickoffAt }),
    status: season.survivor_champion_player_id ? "complete" : entry.status,
    pick,
    usedTeamIds: (usedPicks ?? []).map((used) => used.selected_team_id),
  };
}
