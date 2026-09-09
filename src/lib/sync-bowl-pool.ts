import { gradeBowlPoolPick } from "@/lib/bowl-pool.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ProviderEvent = { id: string; commence_time: string; home_team: string; away_team: string; completed?: boolean; scores?: Array<{ name: string; score: string | number | null }>; bookmakers?: Array<{ markets?: Array<{ key: string; outcomes?: Array<{ name: string; point?: number }> }> }> };
type EspnEvent = { id: string; name?: string; shortName?: string; date: string; season?: { type?: number }; competitions?: Array<{ venue?: { fullName?: string; address?: { city?: string; state?: string } }; competitors?: Array<{ id?: string; team?: { id?: string; displayName?: string; abbreviation?: string }; homeAway?: "home" | "away" }> }> };

async function providerEvents(path: string, query: Record<string, string>) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [] as ProviderEvent[];
  const response = await fetch(`https://api.the-odds-api.com/v4/${path}?${new URLSearchParams({ apiKey, ...query })}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" });
  if (!response.ok) return [] as ProviderEvent[];
  const payload = await response.json();
  return Array.isArray(payload) ? payload as ProviderEvent[] : [];
}

function normalizedTeamName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function joinedTeamName(value: { display_name?: string } | Array<{ display_name?: string }> | null | undefined) { return Array.isArray(value) ? value[0]?.display_name ?? "" : value?.display_name ?? ""; }

async function teamIdFor(name: string, providerId: string, abbreviation?: string | null) {
  const { data: existing } = await supabaseAdmin.from("bowl_pool_teams").select("id").eq("display_name", name).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabaseAdmin.from("bowl_pool_teams").upsert({ provider_team_id: providerId, display_name: name, short_name: name, abbreviation: abbreviation ?? null }, { onConflict: "provider_team_id" }).select("id").single();
  return error || !data ? null : data.id;
}

async function syncAnnualSchedule(now: Date) {
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const { data: season, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons").upsert({ season_year: year, player_visible_at: `${year}-12-07T08:00:00.000Z` }, { onConflict: "season_year" }).select("id").single();
  if (seasonError || !season) return 0;
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?${new URLSearchParams({ limit: "500", seasontype: "3", dates: String(year) })}`, { signal: AbortSignal.timeout(12_000), cache: "no-store" }).catch(() => null);
  if (!response?.ok) return 0;
  const payload = await response.json().catch(() => null) as { events?: EspnEvent[] } | null;
  const events = (payload?.events ?? []).filter((event) => event.season?.type === 3 && event.competitions?.[0]?.competitors?.length === 2);
  const { data: existing } = await supabaseAdmin.from("bowl_pool_games").select("id, provider_game_id, bowl_name, kickoff_at, order_index").eq("season_id", season.id).order("order_index");
  const used = new Set<string>(); let imported = 0; let order = 0; let championshipGameId: string | null = null;
  for (const event of events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
    const competition = event.competitions?.[0];
    const competitors = competition?.competitors ?? [];
    const away = competitors.find((team) => team.homeAway === "away") ?? competitors[0];
    const home = competitors.find((team) => team.homeAway === "home") ?? competitors[1];
    const awayName = away?.team?.displayName; const homeName = home?.team?.displayName;
    if (!awayName || !homeName) continue;
    const bowlName = (event.name ?? event.shortName ?? "Bowl").replace(/\s+\((?:CFP|College Football Playoff)[^)]*\)/gi, "").replace(/\s+Bowl Classic$/i, "").trim();
    const kickoff = new Date(event.date).toISOString();
    const match = (existing ?? []).filter((candidate) => !used.has(candidate.id)).map((candidate) => ({ candidate, distance: Math.abs(new Date(candidate.kickoff_at).getTime() - new Date(kickoff).getTime()) })).sort((a, b) => a.distance - b.distance)[0];
    const gameId = match && match.distance <= 6 * 60 * 60 * 1000 ? match.candidate.id : undefined;
    const teamIds = await Promise.all([away, home].map(async (competitor) => {
      const name = competitor.team?.displayName ?? "Team TBD";
      const id = competitor.team?.id ?? name;
      return teamIdFor(name, `espn:${id}`, competitor.team?.abbreviation);
    }));
    if (!teamIds[0] || !teamIds[1]) continue;
    // A provider refresh may correct a kickoff or matchup, but it must never
    // resurrect a commissioner-recorded cancellation, postponement, or
    // no-contest. New rows start scheduled; existing rows keep their status.
    const row = { season_id: season.id, provider_game_id: `espn:${event.id}`, bowl_name: bowlName, kickoff_at: kickoff, line_lock_at: kickoff, order_index: ++order, is_cfp: /playoff|championship|quarter|semi|first round/i.test(`${event.name} ${event.shortName}`), venue_name: competition?.venue?.fullName ?? null, venue_city: competition?.venue?.address?.city ?? null, venue_state: competition?.venue?.address?.state ?? null, away_team_id: teamIds[0], home_team_id: teamIds[1] };
    const { data: saved, error } = gameId
      ? await supabaseAdmin.from("bowl_pool_games").update(row).eq("id", gameId).select("id").single()
      : await supabaseAdmin.from("bowl_pool_games").upsert({ ...row, status: "scheduled" }, { onConflict: "provider_game_id" }).select("id").single();
    if (!error && saved) { used.add(saved.id); imported += 1; if (/national championship|championship game/i.test(bowlName)) championshipGameId = saved.id; }
  }
  if (championshipGameId) await supabaseAdmin.from("bowl_pool_seasons").update({ championship_game_id: championshipGameId }).eq("id", season.id);
  return imported;
}

function parseScore(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

async function syncScheduleAndLines(now: Date) {
  const seasonYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const { data: season } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", seasonYear).maybeSingle();
  if (!season) return { scheduleGames: 0, linesLocked: 0 };
  const { data: games } = await supabaseAdmin.from("bowl_pool_games").select("id, kickoff_at, line_lock_at, odds_event_id, away_team_id, home_team_id, away:bowl_pool_teams!bowl_pool_games_away_team_id_fkey(display_name), home:bowl_pool_teams!bowl_pool_games_home_team_id_fkey(display_name)").eq("season_id", season.id).in("status", ["scheduled", "live"]);
  if (!games?.length) return { scheduleGames: 0, linesLocked: 0 };
  const events = await providerEvents("sports/americanfootball_ncaaf/odds", { regions: "us", markets: "spreads", oddsFormat: "american", dateFormat: "iso" });
  const { data: lockedLines } = await supabaseAdmin.from("bowl_pool_game_lines").select("game_id").in("game_id", games.map((game) => game.id));
  const alreadyLocked = new Set((lockedLines ?? []).map((line) => line.game_id));
  const used = new Set<string>(); let scheduleGames = 0; let linesLocked = 0;
  for (const game of games) {
    const match = events.filter((event) => !used.has(event.id)).map((event) => ({ event, distance: Math.abs(new Date(event.commence_time).getTime() - new Date(game.kickoff_at).getTime()) })).filter(({ event, distance }) => distance <= 6 * 60 * 60 * 1000 && normalizedTeamName(event.away_team) === normalizedTeamName(joinedTeamName(game.away)) && normalizedTeamName(event.home_team) === normalizedTeamName(joinedTeamName(game.home))).sort((a, b) => a.distance - b.distance)[0];
    if (!match || match.distance > 6 * 60 * 60 * 1000) continue;
    used.add(match.event.id);
    const event = match.event;
    const teamRows = await Promise.all([event.away_team, event.home_team].map(async (name) => {
      return teamIdFor(name, `ncaaf:${name}`);
    }));
    if (!teamRows[0] || !teamRows[1]) continue;
    const { error: gameError } = await supabaseAdmin.from("bowl_pool_games").update({ odds_event_id: event.id, away_team_id: teamRows[0], home_team_id: teamRows[1] }).eq("id", game.id);
    if (gameError) continue;
    scheduleGames += 1;
    if (new Date(game.line_lock_at) > now || alreadyLocked.has(game.id)) continue;
    const outcome = event.bookmakers?.flatMap((bookmaker) => bookmaker.markets ?? []).find((market) => market.key === "spreads")?.outcomes ?? [];
    const favorite = outcome.find((row) => typeof row.point === "number" && row.point < 0) ?? outcome.find((row) => typeof row.point === "number" && row.point === 0 && row.name === event.home_team);
    if (!favorite || typeof favorite.point !== "number") continue;
    const favoriteId = favorite.name === event.away_team ? teamRows[0] : favorite.name === event.home_team ? teamRows[1] : null;
    if (!favoriteId) continue;
    const sourceSpread = Math.abs(favorite.point);
    const lockedSpread = Number.isInteger(sourceSpread) && sourceSpread !== 0 ? sourceSpread + 0.5 : sourceSpread;
    const { error: lineError } = await supabaseAdmin.from("bowl_pool_game_lines").upsert({ game_id: game.id, favorite_team_id: favoriteId, source_spread: sourceSpread, locked_spread: lockedSpread, source: "The Odds API", source_captured_at: now.toISOString(), locked_at: now.toISOString() }, { onConflict: "game_id" });
    if (!lineError) {
      await supabaseAdmin.from("bowl_pool_spread_history").insert({ game_id: game.id, favorite_team_id: favoriteId, source_spread: sourceSpread, pool_spread: lockedSpread, source: "The Odds API", captured_at: now.toISOString() });
      linesLocked += 1;
    }
  }
  return { scheduleGames, linesLocked };
}

async function syncScores(now: Date) {
  const { data: games } = await supabaseAdmin.from("bowl_pool_games").select("id, odds_event_id").not("odds_event_id", "is", null).in("status", ["scheduled", "live"]);
  if (!games?.length) return 0;
  const events = await providerEvents("sports/americanfootball_ncaaf/scores", { daysFrom: "30" });
  let finalized = 0;
  for (const game of games) {
    const event = events.find((candidate) => candidate.id === game.odds_event_id);
    if (!event?.completed || event.scores?.length !== 2) continue;
    const awayScore = parseScore(event.scores.find((score) => score.name === event.away_team)?.score);
    const homeScore = parseScore(event.scores.find((score) => score.name === event.home_team)?.score);
    if (awayScore === null || homeScore === null) continue;
    const { error } = await supabaseAdmin.from("bowl_pool_games").update({ status: "final", away_score: awayScore, home_score: homeScore, finalized_at: now.toISOString() }).eq("id", game.id);
    if (!error) finalized += 1;
  }
  return finalized;
}

async function refreshSeasonStatus(now: Date) {
  const year = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const { data: season } = await supabaseAdmin.from("bowl_pool_seasons").select("id, player_visible_at, first_kickoff_at").eq("season_year", year).maybeSingle();
  if (!season) return;
  const { data: games } = await supabaseAdmin.from("bowl_pool_games").select("status").eq("season_id", season.id);
  const allTerminal = Boolean(games?.length) && games!.every((game) => ["final", "cancelled", "no_contest"].includes(game.status));
  const status = allTerminal ? "complete" : season.first_kickoff_at && now >= new Date(season.first_kickoff_at) ? "live" : now >= new Date(season.player_visible_at) ? "open" : "scheduled";
  await supabaseAdmin.from("bowl_pool_seasons").update({ status, completed_at: status === "complete" ? now.toISOString() : null }).eq("id", season.id);
}

export async function syncBowlPool(now = new Date()) {
  const evaluatedAt = now.toISOString();
  const scheduleImported = await syncAnnualSchedule(now);
  const provider = await syncScheduleAndLines(now);
  const finalizedGames = await syncScores(now);
  const { data: scheduled, error: scheduleError } = await supabaseAdmin.from("bowl_pool_games").select("id").eq("status", "scheduled").lte("kickoff_at", evaluatedAt);
  if (scheduleError) throw new Error("Bowl Pool kickoff transitions could not be loaded.");
  if (scheduled?.length) {
    const { error } = await supabaseAdmin.from("bowl_pool_games").update({ status: "live" }).in("id", scheduled.map((game) => game.id));
    if (error) throw new Error("Bowl Pool kickoff transitions could not be saved.");
  }
  const { data: missing, error: missingError } = await supabaseAdmin.rpc("settle_bowl_pool_missing_picks", { evaluated_at: evaluatedAt });
  if (missingError) throw new Error("Bowl Pool missing-pick losses could not be settled.");
  const { error: purgeError } = await supabaseAdmin.rpc("purge_withdrawn_bowl_pool_drafts", { evaluated_at: evaluatedAt });
  if (purgeError) throw new Error("Withdrawn Bowl Pool drafts could not be purged.");

  const { data: pending, error: pendingError } = await supabaseAdmin.from("bowl_pool_picks").select("id, entry_id, game_id, selected_team_id").eq("result", "pending");
  if (pendingError) throw new Error("Bowl Pool pending picks could not be loaded.");
  const gameIds = [...new Set((pending ?? []).map((pick) => pick.game_id))];
  if (!gameIds.length) { const { data: currentSeason } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1).maybeSingle(); if (currentSeason) await supabaseAdmin.rpc("refresh_bowl_pool_champion", { target_season_id: currentSeason.id, evaluated_at: evaluatedAt }); await refreshSeasonStatus(now); return { checkedAt: evaluatedAt, scheduleImported, gamesStarted: scheduled?.length ?? 0, missingPickLosses: Number(missing ?? 0), picksGraded: 0, finalizedGames, ...provider }; }
  const [{ data: games, error: gamesError }, { data: lines, error: linesError }] = await Promise.all([
    supabaseAdmin.from("bowl_pool_games").select("id, away_team_id, home_team_id, kickoff_at, status, away_score, home_score").in("id", gameIds).eq("status", "final"),
    supabaseAdmin.from("bowl_pool_game_lines").select("game_id, favorite_team_id, locked_spread").in("game_id", gameIds),
  ]);
  if (gamesError || linesError) throw new Error("Bowl Pool final grades could not be prepared.");
  const gameById = new Map((games ?? []).map((game) => [game.id, game]));
  const lineById = new Map((lines ?? []).map((line) => [line.game_id, line]));
  let picksGraded = 0;
  for (const pick of pending ?? []) {
    const game = gameById.get(pick.game_id);
    const line = lineById.get(pick.game_id);
    if (!game || !line || !Number.isInteger(game.away_score) || !Number.isInteger(game.home_score)) continue;
    const result = gradeBowlPoolPick({ selectedTeamId: pick.selected_team_id, favoriteTeamId: line.favorite_team_id, lockedSpread: Number(line.locked_spread), awayTeamId: game.away_team_id, homeTeamId: game.home_team_id, awayScore: game.away_score, homeScore: game.home_score });
    if (result === "pending") continue;
    const { error } = await supabaseAdmin.from("bowl_pool_picks").update({ result, graded_at: evaluatedAt }).eq("id", pick.id).eq("result", "pending");
    if (error) throw new Error("Bowl Pool grades could not be saved.");
    const { error: receiptError } = await supabaseAdmin.from("bowl_pool_game_results").upsert({ entry_id: pick.entry_id, game_id: pick.game_id, result, reason: "graded", graded_at: evaluatedAt }, { onConflict: "entry_id,game_id" });
    if (receiptError) throw new Error("Bowl Pool result receipts could not be saved.");
    picksGraded += 1;
  }
  const { data: currentSeason } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1).maybeSingle();
  if (currentSeason) await supabaseAdmin.rpc("refresh_bowl_pool_champion", { target_season_id: currentSeason.id, evaluated_at: evaluatedAt });
  await refreshSeasonStatus(now);
  return { checkedAt: evaluatedAt, scheduleImported, gamesStarted: scheduled?.length ?? 0, missingPickLosses: Number(missing ?? 0), picksGraded, finalizedGames, ...provider };
}
