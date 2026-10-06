// Viewer-safe JSON returned by player routes. Keep database rows and private
// pre-kickoff picks out of these contracts; route shaping owns disclosure.

export type PickSelection = { gameId: string; teamId: string };

/** JSON accepted by the authenticated Pick'em save route. */
export type PickSaveRequest = {
  scoringPeriodId: string;
  selections: PickSelection[];
  /** Omitted when Survivor was not changed; null explicitly clears the pick. */
  survivorSelection?: PickSelection | null;
};

export type PickSaveResponse = {
  message?: string;
  error?: string;
  code?: string;
};

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
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
  awayScore: number | null;
  homeScore: number | null;
  awayResult: "win" | "loss" | null;
  homeResult: "win" | "loss" | null;
  awayPickers: string[];
  homePickers: string[];
};

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

export type EfficiencyPoint = {
  slateStartedAt: string;
  creditsPerFinal: number | null;
  creditsPerGame: number | null;
  latencyMinutes: number | null;
  settledGames: number;
  productiveRate: number | null;
  credits: number;
  finals: number;
  games: number;
  calls: number;
  attribution: string;
};

export type EfficiencySummary = {
  totalCredits: number;
  scoreCredits: number;
  spreadCredits: number;
  finalizedGames: number;
  creditsPerFinal: number | null;
  productiveRate: number | null;
  trend: string;
};

export type CreditUsage = {
  monthLabel: string;
  trackedCredits: number;
  forecastCredits: number;
  forecastTotal: number;
  forecastFrom: string | null;
  forecastAssumptions: string;
  reportedUsed: number | null;
  providerLimit: number | null;
  sundayAverageCredits: number | null;
  regularSundaysElapsed?: number;
  remaining: number | null;
  reportedAt: string | null;
  days: Array<{ date: string; credits: number; cumulative: number; scores: number; lines: number; other: number; estimatedCalls: number }>;
  calendarDays: Array<{ date: string; credits: number; cumulative: number; scores: number; lines: number; other: number; estimatedCalls: number; forecast: number; forecastCumulative: number | null; forecastScores: number; forecastLines: number; forecastOther: number; forecastGames: number; forecastSlates: number }>;
};

export type GradingDashboardReady = {
  checkedAt: string;
  status: "healthy" | "attention";
  periods: Array<{ id: string; displayName: string; status: string; type: string }>;
  period: { id: string; displayName: string; type: string; status: string };
  metrics: {
    games: number;
    live: number;
    settled: number;
    awaitingGrade: number;
    gradeEligibleGames: number;
    gradeCompleteGames: number;
    pendingGradeGames: number;
    attention: number;
    activePlayers: number;
    lastScoreSyncAt: string | null;
    lastScoreSyncAgeMinutes: number | null;
    latestScoreSyncStatus: string;
    providerAllowance: number | null;
    pickOutcomes: { win: number; loss: number; void: number; pending: number };
    survivorEntries: { active: number; eliminated: number; complete: number };
    reminders: { scheduled: number; sending: number; sent: number; cancelled: number; test: number };
    efficiency: EfficiencySummary & { history: EfficiencyPoint[] };
    settlementLatency: { averageMinutes: number | null; slowestMinutes: number | null; samples: number; history: Array<{ label: string; shortLabel: string; minutes: number }> };
    comparison: { previousPeriod: string | null; previousAverageMinutes: number | null; deltaMinutes: number | null; history: Array<{ id: string; label: string; shortLabel: string; averageMinutes: number | null; samples: number }> };
    readiness: { scheduleLoaded: boolean; linesLocked: number; lineTotal: number; nextKickoffAt: string | null; nextLineLockAt: string | null };
  } | null;
  games: Array<{ id: string; away: string; home: string; awayName: string; homeName: string; kickoffAt: string; finalizedAt: string | null; status: string; state: string; score: string | null; needsAttention: boolean; picks: { total: number; pending: number; graded: number; visible: boolean }; survivor: { total: number; pending: number } }>;
  attention: Array<{ id: string; severity: string; title: string; detail: string }>;
  audit: Array<{ id: string; action: string; entityType: string; entityId: string | null; details: Record<string, unknown>; createdAt: string }>;
  workerRuns: Array<{ jobType: string; status: string; startedAt: string; completedAt: string | null; error: string | null }>;
  cadence: { firstCheckMinutesAfterKickoff: number; cronIntervalMinutes: number; regularRetryMinutes: number[]; playoffRetryMinutes: number[]; note: string };
  scorePolls: Array<{ startedAt: string; completedAt: string | null; status: string; eligibleGames: number; completedGamesFound: number; finalScoresImported: number; newFinals: number; requestsLast: number; pollingMode: string; quotaProtected: boolean; ladderRungs: Record<string, unknown> }>;
  ladderSummary: Array<{ rung: number; windowMinutes: number; newFinals: number; pickedUp: number; percentage: number; newFinalsPercentage: number }>;
  ladderCoverage: { since: string | null; runs: number };
  creditUsage: CreditUsage;
  incidents: Array<{ id: string; title: string; severity: string; detectedAt: string; lastSeenAt: string; resolvedAt: string | null }>;
  reminders: Array<{ id: string; category: string; title: string; scheduledFor: string; status: string; sentAt: string | null }>;
};

export type GradingDashboardUnavailable = {
  checkedAt: string;
  status: "attention";
  periods: Array<{ id: string; displayName: string; status: string; type: string }>;
  errorSummary: string[];
  period: null;
  metrics: null;
  games: [];
  attention: [];
  reminders: [];
};

export type GradingDashboardResponse = GradingDashboardReady | GradingDashboardUnavailable;

/** Mirrors the survivor_entries status CHECK; a future state needs a UI rule. */
export function survivorEntryStatus(value: string): "active" | "eliminated" | "complete" {
  if (value === "active" || value === "eliminated" || value === "complete") return value;
  throw new Error("Survivor entry has an unsupported status.");
}
