import { supabaseAdmin } from "@/lib/supabase-admin";

type FeedGame = { providerEventId: string; venue?: { city: string; country: string } | null };

/**
 * Saves where each of a season's NFL games abroad is played (games.venue_city / venue_country) after the schedule is imported or
 * reconciled, so the clubhouse ticket can pin it ("📍 London, England"). It is shown only, never used to grade, lock or schedule, so
 * it is written directly, and only for games whose place has changed (a game the NFL moves home again is cleared). A failure here is
 * reported but never fails the schedule run it follows.
 */
export async function syncGameVenues(seasonId: string, games: FeedGame[]) {
  try {
    const { data: saved, error } = await supabaseAdmin
      .from("games")
      .select("id, schedule_source_event_id, venue_city, venue_country, scoring_periods!inner(season_id)")
      .eq("schedule_source", "nflverse")
      .eq("scoring_periods.season_id", seasonId);
    if (error) throw error;
    const wanted = new Map(games.map((game) => [game.providerEventId, game.venue ?? null]));
    const changes = (saved ?? []).flatMap((row) => {
      if (!row.schedule_source_event_id || !wanted.has(row.schedule_source_event_id)) return [];
      const venue = wanted.get(row.schedule_source_event_id) ?? null;
      const city = venue?.city ?? null, country = venue?.country ?? null;
      return row.venue_city === city && row.venue_country === country ? [] : [{ id: row.id, city, country }];
    });
    for (const change of changes) {
      const { error: updateError } = await supabaseAdmin.from("games").update({ venue_city: change.city, venue_country: change.country }).eq("id", change.id);
      if (updateError) throw updateError;
    }
    return { updated: changes.length };
  } catch (reason) {
    console.error("Game venues could not be saved.", { message: reason instanceof Error ? reason.message : String((reason as { message?: string })?.message ?? reason) });
    return { updated: 0, failed: true };
  }
}
