import { supabaseAdmin } from "@/lib/supabase-admin";
import { BOWL_INVITATION_CATEGORIES, bowlLastCallMessage, bowlOpeningMessage, firstScheduledBowlGame } from "@/lib/bowl-opening-announcement.js";

export type BowlInvitationCategory = (typeof BOWL_INVITATION_CATEGORIES)[number];

/** The Bowl schedule is not far enough along for the message to be worded yet. The message says what is missing, in plain words. */
export class BowlInvitationUnavailable extends Error {}

/**
 * The opening announcement or the last call as it would be worded if it went out right now: the same words the automatic sweep queues, taken
 * from the current Bowl Pool season's real first game (and, for the opening, its National Championship). Reads only; it queues and sends nothing.
 */
export async function bowlInvitationMessage(category: BowlInvitationCategory) {
  const { data: season, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons")
    .select("id, season_year, championship_game_id").in("status", ["open", "live"]).order("season_year", { ascending: false }).limit(1).maybeSingle();
  if (seasonError) throw new Error("The Bowl Pool season could not be read.");
  if (!season || typeof season.season_year !== "number") throw new BowlInvitationUnavailable("The Bowl Pool season is not set up yet, so there is nothing to preview.");
  const { data: games, error: gamesError } = await supabaseAdmin.from("bowl_pool_games")
    .select("id, kickoff_at, bowl_name, status").eq("season_id", season.id);
  if (gamesError) throw new Error("The Bowl Pool games could not be read.");
  const firstGame = firstScheduledBowlGame(games ?? []);
  if (!firstGame) throw new BowlInvitationUnavailable("The Bowl Pool has no scheduled game yet, so there is nothing to preview.");
  if (category === "bowl_pool_last_call") return bowlLastCallMessage({ firstGame });
  const finalGame = (games ?? []).find((game) => game.id === season.championship_game_id);
  return bowlOpeningMessage({ seasonYear: season.season_year, firstGame, finalGameKickoffAt: finalGame?.kickoff_at ?? null });
}
