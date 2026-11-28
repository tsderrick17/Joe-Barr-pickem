import { espnVenue } from "@/lib/international-venues.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Venue = { city: string; country: string };
type FeedGame = { providerEventId: string; venue?: Venue | null; neutral?: boolean; espnId?: string | null };

const ESPN_SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary";

/** ESPN's record of where a game is played, as a place abroad, or null (at home, unknown, or ESPN unreachable). */
export async function espnGameVenue(espnId: string, fetcher: typeof fetch = fetch): Promise<Venue | null | undefined> {
  try {
    const response = await fetcher(`${ESPN_SUMMARY}?${new URLSearchParams({ event: espnId })}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return undefined;
    const body = await response.json() as { gameInfo?: { venue?: { address?: { city?: string; country?: string } } } };
    const address = body?.gameInfo?.venue?.address;
    return address ? espnVenue(address) : undefined;
  } catch {
    return undefined;   // unreachable: undefined, so a place already saved is kept
  }
}

/**
 * Where each game should be: ESPN's place for a neutral-site game (so a city abroad that is not on the stadium list is still picked up,
 * and a feed that names the wrong stadium is corrected), else the stadium list's. ESPN is asked only for neutral-site games, and only
 * when no place is saved yet (the season's first load asks for every one); when ESPN cannot answer, the stadium list's place stands.
 */
export async function resolveGameVenues(games: FeedGame[], saved: Map<string, Venue | null>, fetcher: typeof fetch = fetch) {
  const placed = new Map<string, Venue | null>();
  const unplaced: string[] = [];
  for (const game of games) {
    let venue: Venue | null = game.venue ?? null;
    if (game.neutral) {
      const already = saved.get(game.providerEventId) ?? null;
      const asked = already || !game.espnId ? undefined : await espnGameVenue(game.espnId, fetcher);
      venue = asked === undefined ? venue ?? already : asked ?? venue;
      if (!venue && asked === undefined && !already) unplaced.push(game.providerEventId);
    }
    placed.set(game.providerEventId, venue);
  }
  return { placed, unplaced };
}

/**
 * Saves where each of a season's NFL games abroad is played (games.venue_city / venue_country) after the schedule is imported or
 * reconciled, so the clubhouse ticket can pin it ("📍 London, England"). It is shown only, never used to grade, lock or schedule, so
 * it is written directly, and only for games whose place has changed (a game the NFL moves home again is cleared). A failure here is
 * reported but never fails the schedule run it follows. `unplaced` lists neutral-site games no source could place (ESPN unreachable
 * and the stadium not on the list).
 */
export async function syncGameVenues(seasonId: string, games: FeedGame[], fetcher: typeof fetch = fetch) {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from("games")
      .select("id, schedule_source_event_id, venue_city, venue_country, scoring_periods!inner(season_id)")
      .eq("schedule_source", "nflverse")
      .eq("scoring_periods.season_id", seasonId);
    if (error) throw error;
    const saved = new Map((rows ?? []).flatMap((row) => row.schedule_source_event_id
      ? [[row.schedule_source_event_id, row.venue_city && row.venue_country ? { city: row.venue_city, country: row.venue_country } : null] as const]
      : []));
    const { placed, unplaced } = await resolveGameVenues(games, new Map(saved), fetcher);
    const changes = (rows ?? []).flatMap((row) => {
      if (!row.schedule_source_event_id || !placed.has(row.schedule_source_event_id)) return [];
      const venue = placed.get(row.schedule_source_event_id) ?? null;
      const city = venue?.city ?? null, country = venue?.country ?? null;
      return row.venue_city === city && row.venue_country === country ? [] : [{ id: row.id, city, country }];
    });
    for (const change of changes) {
      const { error: updateError } = await supabaseAdmin.from("games").update({ venue_city: change.city, venue_country: change.country }).eq("id", change.id);
      if (updateError) throw updateError;
    }
    return { updated: changes.length, unplaced };
  } catch (reason) {
    console.error("Game venues could not be saved.", { message: reason instanceof Error ? reason.message : String((reason as { message?: string })?.message ?? reason) });
    return { updated: 0, unplaced: [] as string[], failed: true };
  }
}
