import { withPick, withoutGame } from "./slate-view";

export type SlatePick = { gameId: string; teamId: string };

export type SlateSelectionState = {
  selectedPicks: SlatePick[];
  savedPicks: SlatePick[];
  survivorPick: SlatePick | null;
  savedSurvivorPick: SlatePick | null;
};

export type SlateSelectionAction =
  | { type: "hydrate"; picks: SlatePick[]; survivorPick: SlatePick | null }
  | { type: "choose-pick"; gameId: string; teamId: string }
  | { type: "remove-pick"; gameId: string }
  | { type: "choose-survivor"; pick: SlatePick | null }
  | { type: "reconcile-picks"; picks: SlatePick[] }
  | { type: "reconcile-survivor"; pick: SlatePick | null }
  | { type: "observe-server-state"; picks: SlatePick[]; survivorPick?: SlatePick | null }
  | { type: "save-succeeded"; submittedPicks: SlatePick[]; submittedSurvivorPick?: SlatePick | null };

export const initialSlateSelectionState: SlateSelectionState = {
  selectedPicks: [],
  savedPicks: [],
  survivorPick: null,
  savedSurvivorPick: null,
};

/**
 * Owns the editable slate draft and the last server-confirmed picks together.
 * A save records the submitted snapshot as durable without overwriting newer
 * edits made while its request was in flight.
 */
export function slateSelectionReducer(
  state: SlateSelectionState,
  action: SlateSelectionAction,
): SlateSelectionState {
  switch (action.type) {
    case "hydrate":
      return {
        selectedPicks: action.picks,
        savedPicks: action.picks,
        survivorPick: action.survivorPick,
        savedSurvivorPick: action.survivorPick,
      };
    case "choose-pick":
      return {
        ...state,
        selectedPicks: withPick(state.selectedPicks, action.gameId, action.teamId),
      };
    case "remove-pick":
      return { ...state, selectedPicks: withoutGame(state.selectedPicks, action.gameId) };
    case "choose-survivor":
      return { ...state, survivorPick: action.pick };
    case "reconcile-picks":
      return { ...state, selectedPicks: action.picks };
    case "reconcile-survivor":
      return { ...state, survivorPick: action.pick };
    case "observe-server-state":
      return {
        ...state,
        savedPicks: action.picks,
        ...(Object.hasOwn(action, "survivorPick") ? { savedSurvivorPick: action.survivorPick ?? null } : {}),
      };
    case "save-succeeded":
      return {
        ...state,
        savedPicks: action.submittedPicks,
        ...(Object.hasOwn(action, "submittedSurvivorPick")
          ? { savedSurvivorPick: action.submittedSurvivorPick ?? null }
          : {}),
      };
  }
}
