import type { SlateGame as BoardGame, SlateResponse as BoardResponse, SlateScoringPeriod as ScoringPeriod } from "@/lib/api-contracts";
import { withPick, withoutGame } from "@/lib/slate-view";

/**
 * The Slate page's state, as one reducer with five separate parts instead of a score of unrelated flags:
 *
 *  - loaded: what the server last said (games, week list, Survivor facts, playoff status, season phase);
 *  - draft: what the player is editing (ATS picks and the Survivor pick);
 *  - saved: what the server last confirmed for this player;
 *  - requests: which load is current (a slower, older read can never replace a newer one), and whether one is running;
 *  - submission: whether a save is in flight, plus the warning and the "sweep" highlight shown to the player.
 *
 * Every transition is a named action, pure and testable. The rules that used to live in scattered effects are here:
 * only the latest load may apply, a kickoff refresh replaces the games but never the draft, and a save records the
 * picks that were sent (not whatever the draft became while it was in flight).
 */
export type SelectedPick = { gameId: string; teamId: string };
export type SurvivorStatus = "active" | "eliminated" | "complete";
export type SelectionFeedback = { gameId: string; teamId: string; type: "sweep"; token: number };

export type SlateState = {
  // loaded
  weeks: ScoringPeriod[];
  week: ScoringPeriod | null;
  nextWeekAvailableAt: number | null;
  games: BoardGame[];
  showActionOnly: boolean;
  seasonOver: boolean;
  playoffEliminated: boolean;
  survivorUsedTeamIds: string[];
  survivorAvailable: boolean;
  survivorChipsVisible: boolean;
  survivorOnReceipt: boolean;
  survivorStatus: SurvivorStatus;
  clockSynchronized: boolean;
  // draft
  draftPicks: SelectedPick[];
  draftSurvivor: SelectedPick | null;
  // saved
  savedPicks: SelectedPick[];
  savedSurvivor: SelectedPick | null;
  // requests
  latestLoadId: number;
  isLoading: boolean;
  errorMessage: string;
  // submission and feedback
  isSubmitting: boolean;
  warning: string;
  feedback: SelectionFeedback | null;
  feedbackToken: number;
};

export const initialSlateState: SlateState = {
  weeks: [], week: null, nextWeekAvailableAt: null, games: [], showActionOnly: false, seasonOver: false, playoffEliminated: false,
  survivorUsedTeamIds: [], survivorAvailable: true, survivorChipsVisible: true, survivorOnReceipt: true, survivorStatus: "active", clockSynchronized: false,
  draftPicks: [], draftSurvivor: null, savedPicks: [], savedSurvivor: null,
  latestLoadId: 0, isLoading: true, errorMessage: "",
  isSubmitting: false, warning: "", feedback: null, feedbackToken: 0,
};

export type SlateAction =
  | { type: "load-started"; loadId: number; week: ScoringPeriod }
  | { type: "bootstrap-loaded"; loadId: number; weeks: ScoringPeriod[]; nextWeekAvailableAt: number | null; week: ScoringPeriod; board: BoardResponse }
  | { type: "board-loaded"; loadId: number; board: BoardResponse }
  | { type: "load-failed"; loadId: number; message: string }
  | { type: "load-finished"; loadId: number }
  | { type: "kickoff-refreshed"; loadId: number; board: BoardResponse }
  | { type: "saved-state-read"; loadId: number; board: BoardResponse }
  | { type: "pick-added"; gameId: string; teamId: string }
  /** clearFeedback: choosing the team again clears the highlight; removing from the receipt leaves it. */
  | { type: "pick-removed"; gameId: string; clearFeedback: boolean }
  | { type: "survivor-chosen"; pick: SelectedPick }
  | { type: "draft-reconciled"; picks: SelectedPick[] | null; survivor: { pick: SelectedPick | null } | null; warning: string | null }
  | { type: "warned"; message: string }
  | { type: "warning-cleared" }
  | { type: "display-changed"; showActionOnly: boolean }
  | { type: "submit-started" }
  | { type: "submit-succeeded"; picks: SelectedPick[]; survivor: { pick: SelectedPick | null } | null }
  | { type: "submit-failed"; message: string };

/** What a board response sets: the loaded facts, and the draft and saved picks starting equal. */
function fromBoard(state: SlateState, data: BoardResponse): SlateState {
  const pick = data.survivor.pick ? { gameId: data.survivor.pick.game_id, teamId: data.survivor.pick.selected_team_id } : null;
  return {
    ...state,
    seasonOver: data.seasonPhase ? data.seasonPhase === "off_season" : state.seasonOver,
    games: data.games,
    showActionOnly: Boolean(data.showPoolAction),
    playoffEliminated: data.pickem.playoffEliminated,
    draftPicks: data.myPicks,
    savedPicks: data.myPicks,
    draftSurvivor: pick,
    savedSurvivor: pick,
    survivorUsedTeamIds: data.survivor.usedTeamIds,
    survivorAvailable: data.survivor.available,
    survivorChipsVisible: data.survivor.chipsVisible !== false,
    survivorOnReceipt: data.survivor.showOnReceipt !== false,
    survivorStatus: data.survivor.status,
    clockSynchronized: true,
  };
}

export function slateReducer(state: SlateState, action: SlateAction): SlateState {
  switch (action.type) {
    case "load-started":
      return { ...state, latestLoadId: action.loadId, week: action.week, isLoading: true, errorMessage: "", warning: "", playoffEliminated: false, clockSynchronized: false };
    case "bootstrap-loaded":
      return { ...fromBoard({ ...state, latestLoadId: action.loadId }, action.board), weeks: action.weeks, nextWeekAvailableAt: action.nextWeekAvailableAt, week: action.week };
    case "board-loaded":
      // A slower, older read can never replace a newer one.
      return action.loadId === state.latestLoadId ? fromBoard(state, action.board) : state;
    case "load-failed":
      return action.loadId === state.latestLoadId ? { ...state, errorMessage: action.message } : state;
    case "load-finished":
      return action.loadId === state.latestLoadId ? { ...state, isLoading: false } : state;
    case "kickoff-refreshed":
      // Public picks appear at kickoff: replace the games and the playoff flag, never the player's draft.
      return action.loadId === state.latestLoadId ? { ...state, games: action.board.games, playoffEliminated: action.board.pickem.playoffEliminated } : state;
    case "saved-state-read": {
      // After an uncertain save: take what the server holds as the saved picks, leave the draft alone.
      if (action.loadId !== state.latestLoadId) return state;
      const pick = action.board.survivor.pick ? { gameId: action.board.survivor.pick.game_id, teamId: action.board.survivor.pick.selected_team_id } : null;
      return { ...state, games: action.board.games, savedPicks: action.board.myPicks, savedSurvivor: state.survivorAvailable ? pick : state.savedSurvivor };
    }
    case "pick-added":
      return { ...state, warning: "", draftPicks: withPick(state.draftPicks, action.gameId, action.teamId), feedback: { gameId: action.gameId, teamId: action.teamId, type: "sweep", token: state.feedbackToken + 1 }, feedbackToken: state.feedbackToken + 1 };
    case "pick-removed":
      return { ...state, warning: "", draftPicks: withoutGame(state.draftPicks, action.gameId), feedback: action.clearFeedback ? null : state.feedback };
    case "survivor-chosen":
      return { ...state, warning: "", draftSurvivor: action.pick };
    case "draft-reconciled":
      return {
        ...state,
        draftPicks: action.picks ?? state.draftPicks,
        draftSurvivor: action.survivor ? action.survivor.pick : state.draftSurvivor,
        warning: action.warning ?? state.warning,
      };
    case "warned":
      return { ...state, warning: action.message };
    case "warning-cleared":
      return { ...state, warning: "" };
    case "display-changed":
      return { ...state, showActionOnly: action.showActionOnly };
    case "submit-started":
      return { ...state, warning: "", isSubmitting: true };
    case "submit-succeeded":
      // Record what was sent, not what the draft has become since: an edit made while the save was in flight stays unsaved.
      return { ...state, isSubmitting: false, savedPicks: action.picks, savedSurvivor: action.survivor ? action.survivor.pick : state.savedSurvivor };
    case "submit-failed":
      return { ...state, isSubmitting: false, warning: action.message };
  }
}
