import type { PickSaveRequest, PickSelection } from "@/lib/api-contracts";

export type Selection = PickSelection;
export type BowlSelection = { gameId: string; teamId?: string; side?: "favorite" | "underdog" };

export type PickSubmission = PickSaveRequest;

export type BowlSubmission = {
  optedIn: boolean;
  selections: BowlSelection[];
  championshipTotalGuess: number | null;
};

type ParseResult<T> = { value: T; error: null } | { value: null; error: string };

const MAX_ID_LENGTH = 128;
const MAX_PICK_SELECTIONS = 64;
const MAX_BOWL_SELECTIONS = 256;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH && value.trim() === value;
}

function isSelection(value: unknown): value is Selection {
  return isRecord(value) && isId(value.gameId) && isId(value.teamId);
}

function duplicateGameId(selections: Array<{ gameId: string }>) {
  return new Set(selections.map((selection) => selection.gameId)).size !== selections.length;
}

export function parsePickSubmission(input: unknown): ParseResult<PickSubmission> {
  if (!isRecord(input) || !isId(input.scoringPeriodId) || !Array.isArray(input.selections)
    || input.selections.length > MAX_PICK_SELECTIONS || !input.selections.every(isSelection)) {
    return { value: null, error: "Your pick submission was incomplete." };
  }
  if (duplicateGameId(input.selections)) {
    return { value: null, error: "You may only select one team from each game." };
  }
  if (Object.hasOwn(input, "survivorSelection") && input.survivorSelection !== null
    && !isSelection(input.survivorSelection)) {
    return { value: null, error: "Your Survivor selection was incomplete." };
  }
  return {
    value: {
      scoringPeriodId: input.scoringPeriodId,
      selections: input.selections,
      ...(Object.hasOwn(input, "survivorSelection") ? { survivorSelection: input.survivorSelection as Selection | null } : {}),
    },
    error: null,
  };
}

function isBowlSelection(value: unknown): value is BowlSelection {
  if (!isRecord(value) || !isId(value.gameId)) return false;
  if (value.teamId !== undefined && value.teamId !== "" && !isId(value.teamId)) return false;
  if (value.side !== undefined && value.side !== "favorite" && value.side !== "underdog") return false;
  return isId(value.teamId) || value.side === "favorite" || value.side === "underdog";
}

export function parseBowlSubmission(input: unknown): ParseResult<BowlSubmission> {
  if (!isRecord(input) || typeof input.optedIn !== "boolean" || !Array.isArray(input.selections)) {
    return { value: null, error: "Opt-in status and selections are required." };
  }
  // Opting out does not submit selections or a tiebreaker. Preserve that escape
  // path even if the browser still holds an incomplete draft.
  if (!input.optedIn) return { value: { optedIn: false, selections: [], championshipTotalGuess: null }, error: null };
  if (input.selections.length > MAX_BOWL_SELECTIONS || !input.selections.every(isBowlSelection)) {
    return { value: null, error: "Opt-in status and selections are required." };
  }
  if (duplicateGameId(input.selections)) {
    return { value: null, error: "You may only select one team from each game." };
  }
  const guess = input.championshipTotalGuess;
  if (guess !== undefined && guess !== null
    && (typeof guess !== "number" || !Number.isInteger(guess) || guess < 0 || guess > 200)) {
    return { value: null, error: "The championship total guess must be a whole number from 0 to 200." };
  }
  return {
    value: {
      optedIn: input.optedIn,
      selections: input.selections,
      championshipTotalGuess: guess === undefined ? null : guess as number | null,
    },
    error: null,
  };
}
