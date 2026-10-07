import { idValue, integerValue, oneOf, optional, textValue, type JsonObject } from "@/lib/request-validation";

/**
 * One parser per mutation route that reads a JSON body. Each takes the already-read object and returns the
 * typed fields or null; the route answers 400 with its own wording on null. None of them touches the database.
 */

export const GAME_DISRUPTION_STATUSES = ["postponed", "cancelled", "no_contest"] as const;
export const BOWL_EXCEPTION_STATUSES = ["postponed", "cancelled", "no_contest", "rescheduled"] as const;

export function parseGameDisruption(input: JsonObject) {
  const gameId = idValue(input.gameId);
  const status = oneOf(input.status, GAME_DISRUPTION_STATUSES);
  return gameId && status ? { gameId, status } : null;
}

export function parseBowlException(input: JsonObject) {
  const gameId = idValue(input.gameId);
  const status = oneOf(input.status, BOWL_EXCEPTION_STATUSES);
  const kickoffAt = optional(input.kickoffAt, (value) => textValue(value, 64));
  const changeId = optional(input.changeId, idValue);
  if (!gameId || !status || !kickoffAt.ok || !changeId.ok) return null;
  return { gameId, status, kickoffAt: kickoffAt.value, changeId: changeId.value };
}

/** The new-player form. Missing or mistyped fields become empty strings so the route's own messages apply. */
export function parseNewPlayer(input: JsonObject) {
  return {
    firstName: typeof input.firstName === "string" ? input.firstName.trim() : "",
    pin: typeof input.pin === "string" ? input.pin.trim() : "",
  };
}

export function parseTemplateSave(input: JsonObject) {
  return {
    id: typeof input.id === "string" ? input.id : "",
    title: typeof input.title === "string" ? input.title.trim() : "",
    message: typeof input.message === "string" ? input.message.trim() : "",
    imageOptions: input.imageOptions,
  };
}

export function parseTestEmail(input: JsonObject) {
  return { selectionPreview: input.template === "selections" };
}

const MAX_SCHEDULE_CSV_CHARACTERS = 500_000;

export function parseBowlSchedule(input: JsonObject) {
  // A four-digit year as a number, or as text (the import has always accepted either).
  const seasonYear = integerValue(typeof input.seasonYear === "string" && /^\d{4}$/.test(input.seasonYear) ? Number(input.seasonYear) : input.seasonYear, 2000, 2200);
  const csv = textValue(input.csv, MAX_SCHEDULE_CSV_CHARACTERS);
  return seasonYear !== null && csv ? { seasonYear, csv } : null;
}

/**
 * Survivor pick: both ids choose a team; both absent (or null) clear an unlocked pick. Anything in between, such
 * as one id, a wrong type, or an empty string, is rejected instead of being treated as a clear.
 */
export function parseSurvivorSubmission(input: JsonObject) {
  const hasGame = input.gameId !== undefined && input.gameId !== null;
  const hasTeam = input.teamId !== undefined && input.teamId !== null;
  if (!hasGame && !hasTeam) return { clear: true as const };
  const gameId = idValue(input.gameId);
  const teamId = idValue(input.teamId);
  return gameId && teamId ? { clear: false as const, gameId, teamId } : null;
}

export function parseChatMessage(input: JsonObject) {
  return typeof input.message === "string" ? input.message.trim().replace(/\s+/g, " ") : "";
}

export function parseChatDelete(input: JsonObject) {
  return idValue(input.messageId);
}
