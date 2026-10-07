import { NextResponse } from "next/server";
import { bowlWindowIsOpen, currentSeasonPhase } from "@/lib/season-phase";

/**
 * Called by the automation routes after authentication and before anything else: outside their window
 * they answer at once, with no lease, provider call, database write or delivery. Returns the response to
 * send, or null when the worker should run.
 */
export async function skipOutsideSeason(window: "season" | "bowl"): Promise<NextResponse | null> {
  const open = window === "bowl" ? await bowlWindowIsOpen() : (await currentSeasonPhase()) === "in_season";
  if (open) return null;
  return NextResponse.json({ success: true, skipped: true, reason: window === "bowl" ? "bowl_closed" : "off_season", message: window === "bowl" ? "The Bowl Pool is outside its window." : "The season is over; this worker is idle until August 1." });
}

export const SEASON_CLOSED_MESSAGE = "The season is over. The next season opens August 1.";

/** A player-facing save refused in the off-season. Returns the response to send, or null to carry on. */
export async function refuseWhenSeasonClosed(): Promise<NextResponse | null> {
  if ((await currentSeasonPhase()) === "in_season") return null;
  return NextResponse.json({ error: SEASON_CLOSED_MESSAGE, code: "season_closed" }, { status: 409 });
}
