import { seasonYearAt } from "@/lib/season";
import { normalizeHexColor } from "@/lib/bowl-pennant.js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getLineLock } from "@/lib/schedule-time.js";
import { checkpoint, providerSignal } from "@/lib/execution-context";
import { favoriteFromEspn, lineIsDueToLock, lockedSpreadFromOdds, lockStampFor, poolSpreadFromEspn } from "@/lib/bowl-line-policy";

type ProviderEvent = { id: string; commence_time: string; home_team: string; away_team: string; completed?: boolean; scores?: Array<{ name: string; score: string | number | null }>; bookmakers?: Array<{ markets?: Array<{ key: string; outcomes?: Array<{ name: string; point?: number }> }> }> };
type EspnEvent = { id: string; name?: string; shortName?: string; date: string; season?: { type?: number }; status?: { type?: { completed?: boolean } }; competitions?: Array<{ status?: { type?: { completed?: boolean } }; odds?: Array<{ spread?: number; details?: string; provider?: { name?: string } }>; venue?: { fullName?: string; address?: { city?: string; state?: string } }; competitors?: Array<{ id?: string; score?: string | number | null; team?: { id?: string; displayName?: string; abbreviation?: string; color?: string; alternateColor?: string; shortDisplayName?: string; location?: string }; homeAway?: "home" | "away" }> }> };

async function providerEvents(path: string, query: Record<string, string>) {
  // The Odds API's free plan does not include college-football markets. Keep
  // Bowl Pool automation from silently consuming paid credits; bowl lines
  // must come from the free schedule/import path or commissioner entry.
  if (path.includes("americanfootball_ncaaf") && process.env.BOWL_POOL_ODDS_API_ENABLED !== "true") return [] as ProviderEvent[];
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [] as ProviderEvent[];
  const response = await fetch(`https://api.the-odds-api.com/v4/${path}?${new URLSearchParams({ apiKey, ...query })}`, { signal: providerSignal(12_000), cache: "no-store" });
  if (!response.ok) return [] as ProviderEvent[];
  const payload = await response.json();
  return Array.isArray(payload) ? payload as ProviderEvent[] : [];
}

function normalizedTeamName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function joinedTeamName(value: { display_name?: string } | Array<{ display_name?: string }> | null | undefined) { return Array.isArray(value) ? value[0]?.display_name ?? "" : value?.display_name ?? ""; }

async function teamIdFor(name: string, providerId: string, abbreviation?: string | null, colors?: { color?: string; alternateColor?: string; shortName?: string | null }) {
  const primaryColor = normalizeHexColor(colors?.color);
  const secondaryColor = normalizeHexColor(colors?.alternateColor);
  const { data: existing, error: existingError } = await supabaseAdmin.from("bowl_pool_teams").select("id, short_name, primary_color, secondary_color").eq("display_name", name).maybeSingle();
  if (existingError) throw new Error("Bowl Pool teams could not be loaded.");
  if (existing?.id) {
    // Teams saved before school colors existed pick them up on the next import.
    if ((primaryColor && primaryColor !== existing.primary_color) || (secondaryColor && secondaryColor !== existing.secondary_color)) {
      const { error: colorError } = await supabaseAdmin.from("bowl_pool_teams").update({ primary_color: primaryColor ?? existing.primary_color, secondary_color: secondaryColor ?? existing.secondary_color }).eq("id", existing.id);
      if (colorError) console.error("Bowl Pool school colors could not be saved.", { teamId: existing.id });
    }
    // A team still carrying its long provider name gets the school's short name;
    // a name anyone has already edited is left alone.
    const schoolName = colors?.shortName?.trim();
    if (schoolName && existing.short_name === name && schoolName !== name) {
      const { error: nameError } = await supabaseAdmin.from("bowl_pool_teams").update({ short_name: schoolName }).eq("id", existing.id);
      if (nameError) console.error("Bowl Pool school name could not be saved.", { teamId: existing.id });
    }
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.from("bowl_pool_teams").upsert({ provider_team_id: providerId, display_name: name, short_name: colors?.shortName?.trim() || name, abbreviation: abbreviation ?? null, primary_color: primaryColor, secondary_color: secondaryColor }, { onConflict: "provider_team_id" }).select("id").single();
  return error || !data ? null : data.id;
}

async function cancelQueuedBowlReminders(gameId: string) {
  const { error } = await supabaseAdmin.from("push_reminders").update({ status: "cancelled", cancelled_at: new Date().toISOString(), suppression_reason: "bowl_schedule_changed" })
    .in("category", ["bowl_pick_due", "bowl_daily_recap"]).eq("status", "scheduled").contains("source_game_ids", [gameId]);
  if (error) throw new Error("Reminders for a rescheduled Bowl game could not be cancelled.");
}

// Fields a provider refresh must never change on a game that already exists.
function existingGameUpdate<T extends { season_id: string; bowl_name: string; order_index: number }>(row: T) {
  const { season_id: _season, bowl_name: _name, order_index: _order, ...provider } = row;
  void _season; void _name; void _order;
  return provider;
}

async function syncAnnualSchedule(now: Date) {
  const year = seasonYearAt(now);
  const { data: season, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons").upsert({ season_year: year, player_visible_at: `${year}-12-07T08:00:00.000Z` }, { onConflict: "season_year" }).select("id").single();
  if (seasonError || !season) return 0;
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?${new URLSearchParams({ limit: "500", seasontype: "3", dates: String(year) })}`, { signal: providerSignal(12_000), cache: "no-store" }).catch(() => null);
  if (!response?.ok) return 0;
  const payload = await response.json().catch(() => null) as { events?: EspnEvent[] } | null;
  const events = (payload?.events ?? []).filter((event) => event.season?.type === 3 && event.competitions?.[0]?.competitors?.length === 2);
  const { data: existing, error: existingGamesError } = await supabaseAdmin.from("bowl_pool_games").select("id, provider_game_id, bowl_name, kickoff_at, order_index").eq("season_id", season.id).order("order_index");
  if (existingGamesError) throw new Error("Bowl Pool games could not be loaded.");
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
    // A game already linked to this ESPN event is the same game even if its kickoff
    // moved by more than the proximity window (a postponement). Matching it by id
    // keeps it on the protected update path instead of the upsert, which would
    // rename it and reset a commissioner-recorded status.
    const linked = (existing ?? []).find((candidate) => candidate.provider_game_id === `espn:${event.id}` && !used.has(candidate.id));
    const matched = linked ?? (match && match.distance <= 6 * 60 * 60 * 1000 ? match.candidate : undefined);
    const gameId = matched?.id;
    const teamIds = await Promise.all([away, home].map(async (competitor) => {
      const name = competitor.team?.displayName ?? "Team TBD";
      const id = competitor.team?.id ?? name;
      return teamIdFor(name, `espn:${id}`, competitor.team?.abbreviation, { color: competitor.team?.color, alternateColor: competitor.team?.alternateColor, shortName: competitor.team?.shortDisplayName ?? competitor.team?.location });
    }));
    if (!teamIds[0] || !teamIds[1]) continue;
    // A provider refresh may correct a kickoff or matchup, but it must never
    // resurrect a commissioner-recorded cancellation, postponement, or
    // no-contest. New rows start scheduled; existing rows keep their status.
    // An existing game also keeps its curated bowl name and display order; the
    // provider only links it (provider_game_id) and corrects timing and teams.
    const row = { season_id: season.id, provider_game_id: `espn:${event.id}`, bowl_name: bowlName, kickoff_at: kickoff, line_lock_at: getLineLock(new Date(kickoff)).lineLockAt, order_index: ++order, is_cfp: /playoff|championship|quarter|semi|first round/i.test(`${event.name} ${event.shortName}`), venue_name: competition?.venue?.fullName ?? null, venue_city: competition?.venue?.address?.city ?? null, venue_state: competition?.venue?.address?.state ?? null, away_team_id: teamIds[0], home_team_id: teamIds[1] };
    if (gameId && matched && matched.kickoff_at !== kickoff) await cancelQueuedBowlReminders(gameId);
    const { data: saved, error } = gameId
      ? await supabaseAdmin.from("bowl_pool_games").update(existingGameUpdate(row)).eq("id", gameId).select("id").single()
      : await supabaseAdmin.from("bowl_pool_games").upsert({ ...row, status: "scheduled" }, { onConflict: "provider_game_id" }).select("id").single();
    if (!error && saved) { used.add(saved.id); imported += 1; if (/national championship|championship game/i.test(bowlName)) championshipGameId = saved.id; }
    const espnSpread = competition?.odds?.find((odds) => Number.isFinite(odds.spread))?.spread;
    if (!error && saved && typeof espnSpread === "number" && Number.isFinite(espnSpread)) {
      const favoriteId = favoriteFromEspn(espnSpread, teamIds[0], teamIds[1]);
      const poolSpread = poolSpreadFromEspn(espnSpread);
      // A locked line is official and is never replaced. A new game gets its
      // first line; a still-preliminary line may be refreshed.
      const provisionalLine = { game_id: saved.id, favorite_team_id: favoriteId, source_spread: poolSpread, locked_spread: poolSpread, source: `ESPN${competition?.odds?.[0]?.provider?.name ? ` (${competition.odds[0].provider.name})` : ""}`, source_captured_at: now.toISOString(), 
      // The line is preliminary (locked_at empty) until the game-day morning lock, then fixed, like an NFL spread.
      locked_at: lockStampFor(row.line_lock_at, now) as string };
      const { error: newLineError } = await supabaseAdmin.from("bowl_pool_game_lines").upsert(provisionalLine, { onConflict: "game_id", ignoreDuplicates: true });
      if (newLineError) throw new Error("A Bowl Pool line could not be saved.");
      const { error: refreshLineError } = await supabaseAdmin.from("bowl_pool_game_lines").update(provisionalLine).eq("game_id", saved.id).is("locked_at", null);
      if (refreshLineError) throw new Error("A preliminary Bowl Pool line could not be refreshed.");
    }
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
  const seasonYear = seasonYearAt(now);
  const { data: season, error: seasonReadError } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", seasonYear).maybeSingle();
  if (seasonReadError) throw new Error("The Bowl Pool season could not be loaded.");
  if (!season) return { scheduleGames: 0, linesLocked: 0 };
  const { data: games, error: gamesReadError } = await supabaseAdmin.from("bowl_pool_games").select("id, kickoff_at, line_lock_at, odds_event_id, away_team_id, home_team_id, away:bowl_pool_teams!bowl_pool_games_away_team_id_fkey(display_name), home:bowl_pool_teams!bowl_pool_games_home_team_id_fkey(display_name)").eq("season_id", season.id).in("status", ["scheduled", "live"]);
  if (gamesReadError) throw new Error("Bowl Pool games could not be loaded.");
  if (!games?.length) return { scheduleGames: 0, linesLocked: 0 };
  const events = await providerEvents("sports/americanfootball_ncaaf/odds", { regions: "us", markets: "spreads", oddsFormat: "american", dateFormat: "iso" });
  const { data: lockedLines, error: lockedLinesReadError } = await supabaseAdmin.from("bowl_pool_game_lines").select("game_id, favorite_team_id, source_spread, locked_spread, source, source_captured_at, locked_at").in("game_id", games.map((game) => game.id));
  if (lockedLinesReadError) throw new Error("Bowl Pool lines could not be loaded.");
  const lineByGame = new Map((lockedLines ?? []).map((line) => [line.game_id, line]));
  const alreadyLocked = new Set((lockedLines ?? []).filter((line) => line.locked_at).map((line) => line.game_id));
  const used = new Set<string>(); let scheduleGames = 0; let linesLocked = 0;
  const lockProvisional = async (gameId: string) => {
    const provisional = lineByGame.get(gameId);
    if (!provisional) return false;
    const lockedAt = now.toISOString();
    const { error: fallbackError } = await supabaseAdmin.from("bowl_pool_game_lines").update({ locked_at: lockedAt }).eq("game_id", gameId).is("locked_at", null);
    if (fallbackError) return false;
    const { error: historyError } = await supabaseAdmin.from("bowl_pool_spread_history").insert({ game_id: gameId, favorite_team_id: provisional.favorite_team_id, source_spread: provisional.source_spread, pool_spread: provisional.locked_spread, source: provisional.source, captured_at: provisional.source_captured_at });
    if (historyError) console.error("A Bowl Pool line-history snapshot could not be saved.", { gameId });
    linesLocked += 1;
    return true;
  };
  for (const game of games) {
    const match = events.filter((event) => !used.has(event.id)).map((event) => ({ event, distance: Math.abs(new Date(event.commence_time).getTime() - new Date(game.kickoff_at).getTime()) })).filter(({ event, distance }) => distance <= 6 * 60 * 60 * 1000 && normalizedTeamName(event.away_team) === normalizedTeamName(joinedTeamName(game.away)) && normalizedTeamName(event.home_team) === normalizedTeamName(joinedTeamName(game.home))).sort((a, b) => a.distance - b.distance)[0];
    if (!match || match.distance > 6 * 60 * 60 * 1000) {
      await lockProvisional(game.id);
      continue;
    }
    used.add(match.event.id);
    const event = match.event;
    const teamRows = await Promise.all([event.away_team, event.home_team].map(async (name) => {
      return teamIdFor(name, `ncaaf:${name}`);
    }));
    if (!teamRows[0] || !teamRows[1]) continue;
    const { error: gameError } = await supabaseAdmin.from("bowl_pool_games").update({ odds_event_id: event.id, away_team_id: teamRows[0], home_team_id: teamRows[1] }).eq("id", game.id);
    if (gameError) continue;
    scheduleGames += 1;
    if (!lineIsDueToLock(game.line_lock_at, now, alreadyLocked.has(game.id))) continue;
    const outcome = event.bookmakers?.flatMap((bookmaker) => bookmaker.markets ?? []).find((market) => market.key === "spreads")?.outcomes ?? [];
    const favorite = outcome.find((row) => typeof row.point === "number" && row.point < 0) ?? outcome.find((row) => typeof row.point === "number" && row.point === 0 && row.name === event.home_team);
    if (!favorite || typeof favorite.point !== "number") {
      await lockProvisional(game.id);
      continue;
    }
    const favoriteId = favorite.name === event.away_team ? teamRows[0] : favorite.name === event.home_team ? teamRows[1] : null;
    if (!favoriteId) continue;
    const sourceSpread = Math.abs(favorite.point);
    const lockedSpread = lockedSpreadFromOdds(sourceSpread);
    const { error: lineError } = await supabaseAdmin.from("bowl_pool_game_lines").upsert({ game_id: game.id, favorite_team_id: favoriteId, source_spread: sourceSpread, locked_spread: lockedSpread, source: "The Odds API", source_captured_at: now.toISOString(), locked_at: now.toISOString() }, { onConflict: "game_id" });
    if (!lineError) {
      const { error: historyError } = await supabaseAdmin.from("bowl_pool_spread_history").insert({ game_id: game.id, favorite_team_id: favoriteId, source_spread: sourceSpread, pool_spread: lockedSpread, source: "The Odds API", captured_at: now.toISOString() });
      if (historyError) console.error("A Bowl Pool line-history snapshot could not be saved.", { gameId: game.id });
      linesLocked += 1;
    }
  }
  return { scheduleGames, linesLocked };
}

async function syncScores(now: Date) {
  const { data: games, error: gamesReadError } = await supabaseAdmin.from("bowl_pool_games").select("id, provider_game_id, odds_event_id").in("status", ["scheduled", "live"]);
  if (gamesReadError) throw new Error("Bowl Pool games awaiting scores could not be loaded.");
  if (!games?.length) return 0;
  // ESPN is the no-cost source of truth for bowl results. The Odds API score
  // feed remains an optional fallback when explicitly enabled, but score
  // settlement must not depend on a paid NCAAF entitlement.
  const seasonYear = seasonYearAt(now);
  const espnResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?${new URLSearchParams({ limit: "500", seasontype: "3", dates: String(seasonYear) })}`, { signal: providerSignal(12_000), cache: "no-store" }).catch(() => null);
  const espnPayload = espnResponse?.ok ? await espnResponse.json().catch(() => null) as { events?: EspnEvent[] } | null : null;
  const espnEvents = espnPayload?.events ?? [];
  const oddsEvents = process.env.BOWL_POOL_ODDS_API_ENABLED === "true"
    ? await providerEvents("sports/americanfootball_ncaaf/scores", { daysFrom: "30" })
    : [];
  let finalized = 0;
  for (const game of games) {
    const espnEvent = espnEvents.find((candidate) => `espn:${candidate.id}` === game.provider_game_id);
    const competition = espnEvent?.competitions?.[0];
    const completed = Boolean(espnEvent?.status?.type?.completed || competition?.status?.type?.completed);
    const competitors = competition?.competitors ?? [];
    const away = competitors.find((competitor) => competitor.homeAway === "away") ?? competitors[0];
    const home = competitors.find((competitor) => competitor.homeAway === "home") ?? competitors[1];
    let awayScore = parseScore(away?.score);
    let homeScore = parseScore(home?.score);
    if (!completed || awayScore === null || homeScore === null) {
      const oddsEvent = oddsEvents.find((candidate) => candidate.id === game.odds_event_id);
      if (!oddsEvent?.completed || oddsEvent.scores?.length !== 2) continue;
      awayScore = parseScore(oddsEvent.scores.find((score) => score.name === oddsEvent.away_team)?.score);
      homeScore = parseScore(oddsEvent.scores.find((score) => score.name === oddsEvent.home_team)?.score);
    }
    if (awayScore === null || homeScore === null) continue;
    const { error } = await supabaseAdmin.from("bowl_pool_games").update({ status: "final", away_score: awayScore, home_score: homeScore, finalized_at: now.toISOString() }).eq("id", game.id);
    if (!error) finalized += 1;
  }
  return finalized;
}

async function refreshSeasonStatus(now: Date) {
  const year = seasonYearAt(now);
  const { data: season, error: seasonReadError } = await supabaseAdmin.from("bowl_pool_seasons").select("id, player_visible_at, first_kickoff_at").eq("season_year", year).maybeSingle();
  if (seasonReadError) throw new Error("The Bowl Pool season could not be loaded.");
  if (!season) return;
  const { data: games, error: gamesReadError } = await supabaseAdmin.from("bowl_pool_games").select("status").eq("season_id", season.id);
  if (gamesReadError) throw new Error("Bowl Pool game statuses could not be loaded.");
  const allTerminal = Boolean(games?.length) && games!.every((game) => ["final", "cancelled", "no_contest"].includes(game.status));
  const status = allTerminal ? "complete" : season.first_kickoff_at && now >= new Date(season.first_kickoff_at) ? "live" : now >= new Date(season.player_visible_at) ? "open" : "scheduled";
  const { error: statusError } = await supabaseAdmin.from("bowl_pool_seasons").update({ status, completed_at: status === "complete" ? now.toISOString() : null }).eq("id", season.id);
  if (statusError) throw new Error("The Bowl Pool season status could not be saved.");
}

export async function syncBowlPool(now = new Date()) {
  const evaluatedAt = now.toISOString();
  // A checkpoint before each stage lets a run past its deadline stop instead of starting more work; every stage
  // is idempotent, so the next run simply repeats what was left.
  checkpoint("annual schedule");
  const scheduleImported = await syncAnnualSchedule(now);
  checkpoint("schedule and lines");
  const provider = await syncScheduleAndLines(now);
  checkpoint("scores");
  const finalizedGames = await syncScores(now);
  checkpoint("kickoff transitions");
  const { data: scheduled, error: scheduleError } = await supabaseAdmin.from("bowl_pool_games").select("id").eq("status", "scheduled").lte("kickoff_at", evaluatedAt);
  if (scheduleError) throw new Error("Bowl Pool kickoff transitions could not be loaded.");
  if (scheduled?.length) {
    const { error } = await supabaseAdmin.from("bowl_pool_games").update({ status: "live" }).in("id", scheduled.map((game) => game.id));
    if (error) throw new Error("Bowl Pool kickoff transitions could not be saved.");
  }
  checkpoint("missing-pick losses");
  const { data: missing, error: missingError } = await supabaseAdmin.rpc("settle_bowl_pool_missing_picks", { evaluated_at: evaluatedAt });
  if (missingError) throw new Error("Bowl Pool missing-pick losses could not be settled.");
  checkpoint("withdrawn drafts");
  const { error: purgeError } = await supabaseAdmin.rpc("purge_withdrawn_bowl_pool_drafts", { evaluated_at: evaluatedAt });
  if (purgeError) throw new Error("Withdrawn Bowl Pool drafts could not be purged.");

  // Grades and their result receipts are saved together in one database call.
  checkpoint("grade final picks");
  const { data: gradedCount, error: gradeError } = await supabaseAdmin.rpc("grade_bowl_pool_final_picks", { evaluated_at: evaluatedAt });
  if (gradeError) throw new Error("Bowl Pool grades could not be saved.");
  const picksGraded = Number(gradedCount ?? 0);

  checkpoint("champion refresh");
  const { data: currentSeason, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons").select("id").eq("season_year", seasonYearAt(now)).maybeSingle();
  if (seasonError) throw new Error("The Bowl Pool season could not be loaded.");
  if (currentSeason) {
    const { error: championError } = await supabaseAdmin.rpc("refresh_bowl_pool_champion", { target_season_id: currentSeason.id, evaluated_at: evaluatedAt });
    if (championError) throw new Error("The Bowl Pool champion could not be refreshed.");
  }
  await refreshSeasonStatus(now);
  return { checkedAt: evaluatedAt, scheduleImported, gamesStarted: scheduled?.length ?? 0, missingPickLosses: Number(missing ?? 0), picksGraded, finalizedGames, ...provider };
}
