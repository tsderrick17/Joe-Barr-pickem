import { supabaseAdmin } from "@/lib/supabase-admin";
import { EASTERN_TIME_ZONE } from "@/lib/season";
import type { SeasonPhase } from "@/lib/api-contracts";

export type { SeasonPhase };

/**
 * The pool's season runs from August 1 (Eastern) until the Super Bowl is final and graded. The database
 * decides this in `season_phase()` and `bowl_window_open()` (migration 20261007010000); the functions
 * below are the same rules for the application and for tests, and the two are checked against one table
 * of scenarios.
 */

/** The season row for the Eastern season year of the moment being asked about, if there is one. */
export type SeasonFacts = { state: string; superBowlStatus: string | null } | null;

export function seasonPhaseAt(season: SeasonFacts): SeasonPhase {
  return season?.state === "complete" && season.superBowlStatus === "complete" ? "off_season" : "in_season";
}

/** The phase from rows a route has already read: the season row and its scoring periods. */
export function seasonPhaseFromRows(season: { state: string } | null, periods: Array<{ display_name: string; status: string }>): SeasonPhase {
  return seasonPhaseAt(season ? { state: season.state, superBowlStatus: periods.find((period) => period.display_name === "Super Bowl")?.status ?? null } : null);
}

function easternMonth(at: Date) {
  const month = new Intl.DateTimeFormat("en-US", { timeZone: EASTERN_TIME_ZONE, month: "numeric" }).formatToParts(at).find((part) => part.type === "month")?.value;
  return Number(month);
}

/** The Bowl Pool is live from December 1 (Eastern) until its champion is crowned, never in the NFL off-season. */
export function bowlWindowOpenAt({ at, phase, bowlComplete }: { at: Date; phase: SeasonPhase; bowlComplete: boolean }) {
  const month = easternMonth(at);
  return phase === "in_season" && (month >= 12 || month < 8) && !bowlComplete;
}

/**
 * Asks the database for the current phase. A read failure counts as in season: a skipped worker during
 * live games costs far more than one wasted run in the summer.
 */
export async function currentSeasonPhase(at = new Date()): Promise<SeasonPhase> {
  const { data, error } = await supabaseAdmin.rpc("season_phase", { evaluated_at: at.toISOString() });
  if (error || (data !== "in_season" && data !== "off_season")) {
    console.warn("The season phase could not be read; treating it as in season.");
    return "in_season";
  }
  return data;
}

export async function bowlWindowIsOpen(at = new Date()): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("bowl_window_open", { evaluated_at: at.toISOString() });
  if (error || typeof data !== "boolean") {
    console.warn("The Bowl window could not be read; treating it as open.");
    return true;
  }
  return data;
}
