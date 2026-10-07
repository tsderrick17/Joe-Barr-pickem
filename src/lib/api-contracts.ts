import type { GameStatus } from "@/lib/db-statuses";
// Viewer-safe JSON returned by player routes. Keep database rows and private
// pre-kickoff picks out of these contracts; route shaping owns disclosure.

export type SlateScoringPeriod = {
  id: string;
  display_name: string;
  display_order: number;
  status: "upcoming" | "active" | "complete";
  period_type: "regular" | "playoff";
  max_picks: number;
};

export type SlateGame = {
  id: string;
  kickoffAt: string;
  lineLockAt: string;
  isInternational: boolean;
  awayTeam: string;
  homeTeam: string;
  awayTeamAbbreviation: string;
  homeTeamAbbreviation: string;
  favoriteTeamId: string | null;
  awayTeamId: string;
  homeTeamId: string;
  officialSpread: number | null;
  preliminarySpread: number | null;
  spreadSource: string | null;
  spreadLockedAt: string | null;
  status: GameStatus;
  awayScore: number | null;
  homeScore: number | null;
  awayResult: "win" | "loss" | null;
  homeResult: "win" | "loss" | null;
  awayPickers: string[];
  homePickers: string[];
};

/** In season, or the off-season between the graded Super Bowl and August 1 (see season-phase.ts). */
export type SeasonPhase = "in_season" | "off_season";

export type SlateResponse = {
  serverTime: string;
  games: SlateGame[];
  myPicks: Array<{ gameId: string; teamId: string }>;
  pickem: { playoffEliminated: boolean };
  survivor: {
    available: boolean;
    chipsVisible: boolean;
    notice: string | null;
    status: "active" | "eliminated" | "complete";
    showOnReceipt?: boolean;
    pick: { game_id: string; selected_team_id: string } | null;
    usedTeamIds: string[];
  };
  showPoolAction: boolean;
  /** Sent with the bootstrap request (the first load of the page). */
  seasonPhase?: SeasonPhase;
  bootstrap?: {
    weeks: SlateScoringPeriod[];
    nextWeekAvailableAt: string | null;
  } | null;
  error?: string;
};

export type StandingsPick = {
  label: string | null;
  abbreviation?: string | null;
  isHidden: boolean;
  resultMark: string;
  spread?: string | null;
  isLineLocked?: boolean;
  kickoffAt?: string | null;
};

export type StandingsRow = {
  id: string;
  firstName: string;
  wins: number;
  playoffEliminated?: boolean;
  trophies?: string[];
  picks: StandingsPick[];
};

export type StandingsResponse = {
  seasonPhase: SeasonPhase;
  serverTime: string;
  viewerPlayerId: string;
  isCommissioner: boolean;
  seasonSnapshotReleased?: boolean;
  showSurvivorStandings: boolean;
  showBowlCard: boolean;
  showPoolChat: boolean;
  hidePickemEliminatedRows: boolean;
  hideSurvivorEliminatedRows: boolean;
  isPlayoff: boolean;
  week: string;
  weekStatus: "upcoming" | "active" | "complete";
  maxPicks: number;
  nextRevealAt: string | null;
  rows: StandingsRow[];
  survivorAvailable: boolean;
  survivorNotice: string | null;
  survivorChampionPlayerId: string | null;
  survivorComplete: boolean;
  survivorChampionName: string | null;
  survivorRows: {
    id: string;
    playerId: string;
    firstName: string;
    trophies?: string[];
    status: "active" | "eliminated" | "complete";
    requiredThisPeriod: boolean;
    pick: (StandingsPick & { abbreviation?: string | null }) | null;
    picks: Array<(StandingsPick & { abbreviation: string | null }) | null>;
  }[];
  error?: string;
};

/** Mirrors the survivor_entries status CHECK; a future state needs a UI rule. */
export function survivorEntryStatus(value: string): "active" | "eliminated" | "complete" {
  if (value === "active" || value === "eliminated" || value === "complete") return value;
  throw new Error("Survivor entry has an unsupported status.");
}
