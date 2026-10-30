import { supabaseAdmin } from "@/lib/supabase-admin";
import { easternDay, visitDetails } from "@/lib/player-presence.js";

// Activity is intentionally coarse: it records that a player used Pick'em,
// which day, and what kind of device and browser it was, not which screen they
// viewed, what they picked, or where they were.
const ACTIVITY_WRITE_INTERVAL_MS = 15 * 60_000;
const lastAttemptByPlayer = new Map<string, number>();
const lastDayByPlayer = new Map<string, string>();
const lastSeenByPlayer = new Map<string, string>();

/** What a request says about where the visit came from. The installed app marks its requests with `X-Pickem-App`. */
export type ActivityDetails = { userAgent: string | null; viaApp: boolean };

/** The two facts of a request that the Players page shows. */
export function activityDetails(request: { headers: Headers }): ActivityDetails {
  return { userAgent: request.headers.get("user-agent"), viaApp: request.headers.get("x-pickem-app") === "1" };
}

function deviceColumns(details: ActivityDetails, timestamp: string) {
  const { device, browser, viaApp } = visitDetails(details);
  return {
    signature: `${device}|${browser}|${viaApp}`,
    columns: { last_device: device, last_browser: browser, last_via_app: viaApp, ...(viaApp ? { app_seen_at: timestamp } : {}) },
  };
}

/** One row per player per Eastern day: the Players page counts them over the last week. */
async function recordVisitDay(playerId: string, now: number) {
  const day = easternDay(now);
  if (lastDayByPlayer.get(playerId) === day) return;
  lastDayByPlayer.set(playerId, day);
  try {
    const { error } = await supabaseAdmin.from("player_visit_days").upsert({ player_id: playerId, day }, { onConflict: "player_id,day", ignoreDuplicates: true });
    if (error) {
      lastDayByPlayer.delete(playerId);
      console.error("Player visit day could not be recorded.", error.code);
    }
  } catch {
    lastDayByPlayer.delete(playerId);
  }
}

/** Where a player was last seen, written when it changes even if the time was written a moment ago by a request that did not carry it. */
async function recordDevice(playerId: string, details: ActivityDetails, now: number) {
  const { signature, columns } = deviceColumns(details, new Date(now).toISOString());
  if (lastSeenByPlayer.get(playerId) === signature) return;
  lastSeenByPlayer.set(playerId, signature);
  try {
    const { error } = await supabaseAdmin.from("players").update(columns).eq("id", playerId);
    if (error) {
      lastSeenByPlayer.delete(playerId);
      console.error("Player device could not be recorded.", error.code);
    }
  } catch {
    lastSeenByPlayer.delete(playerId);
  }
}

export async function recordPlayerActivity(playerId: string, details?: ActivityDetails) {
  const now = Date.now();
  const lastAttempt = lastAttemptByPlayer.get(playerId) ?? 0;
  if (now - lastAttempt < ACTIVITY_WRITE_INTERVAL_MS) {
    if (details) await recordDevice(playerId, details, now);
    return;
  }

  lastAttemptByPlayer.set(playerId, now);
  if (lastAttemptByPlayer.size > 256) {
    for (const [id, attemptedAt] of lastAttemptByPlayer) {
      if (now - attemptedAt >= ACTIVITY_WRITE_INTERVAL_MS) lastAttemptByPlayer.delete(id);
    }
  }

  const timestamp = new Date(now).toISOString();
  const cutoff = new Date(now - ACTIVITY_WRITE_INTERVAL_MS).toISOString();
  const seen = details ? deviceColumns(details, timestamp) : null;
  try {
    const { error } = await supabaseAdmin
      .from("players")
      .update({ last_active_at: timestamp, ...seen?.columns })
      .eq("id", playerId)
      // The database condition also coalesces writes from separate serverless
      // instances that happen to see the same activity at once.
      .or(`last_active_at.is.null,last_active_at.lte.${cutoff}`);

    // Presence is a Commissioner convenience, never a reason to make a player
    // lose access or fail a saved selection during a transient database issue.
    if (error) {
      lastAttemptByPlayer.delete(playerId);
      console.error("Player activity could not be recorded.", error.code);
      return;
    }
    if (seen) lastSeenByPlayer.set(playerId, seen.signature);
  } catch {
    lastAttemptByPlayer.delete(playerId);
    return;
  }
  await recordVisitDay(playerId, now);
}
