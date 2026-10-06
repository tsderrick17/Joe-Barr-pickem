import type { PickSelection } from "@/lib/api-contracts";

export type SlateSaveVerification =
  | { kind: "confirmed" }
  | { kind: "different"; savedPicks: PickSelection[]; savedSurvivorPick?: PickSelection | null }
  | { kind: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPick(value: unknown): value is PickSelection {
  return isRecord(value) &&
    typeof value.gameId === "string" &&
    typeof value.teamId === "string";
}

function readPicks(actual: unknown): PickSelection[] | null {
  if (!Array.isArray(actual) || !actual.every(isPick)) return null;
  const seenGames = new Set<string>();
  for (const pick of actual) {
    if (seenGames.has(pick.gameId)) return null;
    seenGames.add(pick.gameId);
  }
  return actual;
}

function samePickSet(actual: readonly PickSelection[], expected: readonly PickSelection[]): boolean {
  if (actual.length !== expected.length) return false;
  const actualByGame = new Map(actual.map((pick) => [pick.gameId, pick.teamId]));
  return expected.every((pick) => actualByGame.get(pick.gameId) === pick.teamId);
}

/**
 * Inspects a possibly interrupted save using the viewer's own board response.
 * `survivorSelection === undefined` means the request intentionally omitted
 * Survivor and therefore must not use it as part of the confirmation test.
 */
export function confirmsSlateSubmission(
  response: unknown,
  submittedPicks: readonly PickSelection[],
  survivorSelection?: PickSelection | null,
): SlateSaveVerification {
  if (!isRecord(response)) return { kind: "unavailable" };
  const savedPicks = readPicks(response.myPicks);
  if (!savedPicks) return { kind: "unavailable" };
  if (survivorSelection === undefined) {
    return samePickSet(savedPicks, submittedPicks)
      ? { kind: "confirmed" }
      : { kind: "different", savedPicks };
  }

  if (!isRecord(response.survivor)) return { kind: "unavailable" };
  const savedSurvivor = response.survivor.pick;
  const normalizedSurvivor = savedSurvivor === null
    ? null
    : isRecord(savedSurvivor) && typeof savedSurvivor.game_id === "string" && typeof savedSurvivor.selected_team_id === "string"
      ? { gameId: savedSurvivor.game_id, teamId: savedSurvivor.selected_team_id }
      : undefined;
  if (normalizedSurvivor === undefined) return { kind: "unavailable" };

  const matches = samePickSet(savedPicks, submittedPicks) &&
    (survivorSelection === null
      ? normalizedSurvivor === null
      : normalizedSurvivor?.gameId === survivorSelection.gameId && normalizedSurvivor.teamId === survivorSelection.teamId);
  return matches
    ? { kind: "confirmed" }
    : { kind: "different", savedPicks, savedSurvivorPick: normalizedSurvivor };
}
