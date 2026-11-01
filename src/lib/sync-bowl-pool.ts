import { seasonYearAt } from "@/lib/season";
import type { Database } from "@/lib/database.types";
import { normalizeHexColor } from "@/lib/bowl-pennant.js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getLineLock } from "@/lib/schedule-time.js";
import { checkpoint, providerSignal } from "@/lib/execution-context";
import { favoriteFromEspn, lineIsDueToLock, lockedSpreadFromOdds, lockStampFor, poolSpreadFromEspn } from "@/lib/bowl-line-policy";
import { chronologicalOrder, espnGameIsCancelled, espnGameIsFinal, espnHeadline, espnTeamIsTbd, espnTimeIsConfirmed, headlineIsCfp, headlineIsChampionship, newBowlName, noonEastern, orderIsChronological, planBowlSchedule } from "@/lib/bowl-pool-espn-schedule.js";
import { easternDateKey } from "@/lib/eastern-time.js";
import { cancelQueuedBowlReminders } from "@/lib/bowl-reminders";
import { ProviderUnavailable } from "@/lib/provider-unavailable";
import { easternDateTimeToUtc } from "@/lib/schedule-time.js";

type ProviderEvent = { id: string; commence_time: string; home_team: string; away_team: string; completed?: boolean; scores?: Array<{ name: string; score: string | number | null }>; bookmakers?: Array<{ markets?: Array<{ key: string; outcomes?: Array<{ name: string; point?: number }> }> }> };
import type { EspnEvent } from "@/lib/bowl-pool-espn-schedule.js";
import { noteOperationalWarning } from "@/lib/operational-warnings";

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
      if (colorError) await noteOperationalWarning("bowl_scores", "Bowl Pool school colors could not be saved.", { teamId: existing.id });
    }
    // A team still carrying its long provider name gets the school's short name;
    // a name anyone has already edited is left alone.
    const schoolName = colors?.shortName?.trim();
    if (schoolName && existing.short_name === name && schoolName !== name) {
      const { error: nameError } = await supabaseAdmin.from("bowl_pool_teams").update({ short_name: schoolName }).eq("id", existing.id);
      if (nameError) await noteOperationalWarning("bowl_scores", "Bowl Pool school name could not be saved.", { teamId: existing.id });
    }
    return existing.id;
  }
  const { data, error } = await supabaseAdmin.from("bowl_pool_teams").upsert({ provider_team_id: providerId, display_name: name, short_name: colors?.shortName?.trim() || name, abbreviation: abbreviation ?? null, primary_color: primaryColor, secondary_color: secondaryColor }, { onConflict: "provider_team_id" }).select("id").single();
  return error || !data ? null : data.id;
}

/**
 * ESPN's postseason scoreboard for a season. When ESPN cannot be read, or answers with something unreadable, this throws ProviderUnavailable
 * (rather than returning no games) so the run is recorded as failed with the reason instead of as a success that did nothing.
 */
async function espnPostseasonEvents(seasonYear: number, purpose: string) {
  const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?${new URLSearchParams({ limit: "500", seasontype: "3", dates: String(seasonYear) })}`, { signal: providerSignal(12_000), cache: "no-store" }).catch(() => null);
  if (!response?.ok) throw new ProviderUnavailable("ESPN", `ESPN's ${purpose} could not be read.`);
  const payload = await response.json().catch(() => null) as { events?: EspnEvent[] } | null;
  if (!payload || !Array.isArray(payload.events)) throw new ProviderUnavailable("ESPN", `ESPN's ${purpose} came back unreadable.`);
  return payload.events;
}

type OwnGameRow = { id: string; provider_game_id: string | null; bowl_name: string; kickoff_at: string; order_index: number; time_confirmed: boolean | null; line_lock_at: string | null; is_cfp: boolean | null; away_team_id: string | null; home_team_id: string | null; venue_name: string | null; venue_city: string | null; venue_state: string | null };
const sameTime = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && Date.parse(a) === Date.parse(b);

/**
 * Pulls ESPN's postseason schedule into the pool's rows. A bowl is recognised by its name (sponsors change every year), never
 * by kickoff time alone; FCS and Celebration Bowl games stay out; a time ESPN has not confirmed neither replaces ours nor
 * is trusted for a new row (it waits on its day, "Time TBD", until ESPN gives one); a team ESPN has not set stays empty,
 * never a "TBD" team that a player could pick. A bowl's curated name and display order are never changed, a commissioner-recorded
 * cancellation or postponement is never undone, and a run that finds nothing new writes nothing.
 */
export async function syncAnnualSchedule(now: Date) {
  const year = seasonYearAt(now);
  const { data: season, error: seasonError } = await supabaseAdmin.from("bowl_pool_seasons").upsert({ season_year: year, player_visible_at: `${year}-12-07T08:00:00.000Z` }, { onConflict: "season_year" }).select("id").single();
  if (seasonError || !season) return 0;
  const events = (await espnPostseasonEvents(year, "postseason schedule")).filter((event) => event.season?.type === 3 && event.competitions?.[0]?.competitors?.length === 2);
  const { data: existing, error: existingGamesError } = await supabaseAdmin.from("bowl_pool_games").select("id, provider_game_id, bowl_name, kickoff_at, order_index, time_confirmed, line_lock_at, is_cfp, away_team_id, home_team_id, venue_name, venue_city, venue_state").eq("season_id", season.id).order("order_index");
  if (existingGamesError) throw new Error("Bowl Pool games could not be loaded.");
  const games = (existing ?? []) as OwnGameRow[];
  const plan = planBowlSchedule(events, games);
  if (plan.unmatched.length) await noteOperationalWarning("bowl_scores", "Bowl Pool games ESPN no longer lists.", { games: plan.unmatched.map((game) => game.bowl_name) });

  const teamCache = new Map<string, string | null>();
  // Both teams, or neither: a game with one side still "TBD" has no teams yet.
  async function teamsOf(event: EspnEvent) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const awayTeam = (competitors.find((team) => team.homeAway === "away") ?? competitors[0])?.team;
    const homeTeam = (competitors.find((team) => team.homeAway === "home") ?? competitors[1])?.team;
    if (!awayTeam || !homeTeam || espnTeamIsTbd(awayTeam) || espnTeamIsTbd(homeTeam)) return null;
    const ids = await Promise.all([awayTeam, homeTeam].map(async (team) => {
      const name = team.displayName ?? "";
      if (!teamCache.has(name)) teamCache.set(name, await teamIdFor(name, `espn:${team.id ?? name}`, team.abbreviation, { color: team.color, alternateColor: team.alternateColor, shortName: team.shortDisplayName ?? team.location }));
      return teamCache.get(name) ?? null;
    }));
    return ids[0] && ids[1] ? { away: ids[0], home: ids[1] } : null;
  }

  let imported = 0; let championshipGameId: string | null = null; let inserted = 0; let kickoffMoved = false;
  const lineFor = async (gameId: string, event: EspnEvent, teams: { away: string; home: string } | null, lineLockAt: string | null) => {
    const espnSpread = event.competitions?.[0]?.odds?.find((odds) => Number.isFinite(odds.spread))?.spread;
    if (!teams || !lineLockAt || typeof espnSpread !== "number" || !Number.isFinite(espnSpread)) return;
    const favoriteId = favoriteFromEspn(espnSpread, teams.away, teams.home);
    const poolSpread = poolSpreadFromEspn(espnSpread);
    // A locked line is official and is never replaced. A new game gets its
    // first line; a still-preliminary line may be refreshed.
    const providerName = event.competitions?.[0]?.odds?.[0]?.provider?.name;
    const provisionalLine = { game_id: gameId, favorite_team_id: favoriteId, source_spread: poolSpread, locked_spread: poolSpread, source: `ESPN${providerName ? ` (${providerName})` : ""}`, source_captured_at: now.toISOString(),
      // The line is preliminary (locked_at empty) until the game-day morning lock, then fixed, like an NFL spread.
      locked_at: lockStampFor(lineLockAt, now) as string };
    const { error: newLineError } = await supabaseAdmin.from("bowl_pool_game_lines").upsert(provisionalLine, { onConflict: "game_id", ignoreDuplicates: true });
    if (newLineError) throw new Error("A Bowl Pool line could not be saved.");
    const { error: refreshLineError } = await supabaseAdmin.from("bowl_pool_game_lines").update(provisionalLine).eq("game_id", gameId).is("locked_at", null);
    if (refreshLineError) throw new Error("A preliminary Bowl Pool line could not be refreshed.");
  };

  for (const { game, event } of plan.updates) {
    const competition = event.competitions?.[0];
    const headline = espnHeadline(event);
    const teams = await teamsOf(event);
    // The venue, the CFP flag and the link to ESPN always follow ESPN; a kickoff only once ESPN has confirmed it.
    const wanted: Database["public"]["Tables"]["bowl_pool_games"]["Update"] = { provider_game_id: `espn:${event.id}`, is_cfp: Boolean(game.is_cfp) || headlineIsCfp(headline) };
    if (competition?.venue?.fullName) wanted.venue_name = competition.venue.fullName;
    if (competition?.venue?.address?.city) wanted.venue_city = competition.venue.address.city;
    if (competition?.venue?.address?.state) wanted.venue_state = competition.venue.address.state;
    const confirmed = espnTimeIsConfirmed(event);
    const kickoff = new Date(event.date).toISOString();
    if (confirmed) Object.assign(wanted, { kickoff_at: kickoff, line_lock_at: new Date(getLineLock(new Date(kickoff)).lineLockAt).toISOString(), time_confirmed: true });
    if (teams) Object.assign(wanted, { away_team_id: teams.away, home_team_id: teams.home });
    const row = game as unknown as Record<string, unknown>;
    const patch = Object.fromEntries(Object.entries(wanted).filter(([column, value]) => column === "kickoff_at" || column === "line_lock_at" ? !sameTime(row[column], value) : row[column] !== value)) as typeof wanted;
    if (Object.keys(patch).length) {
      // The kickoff moved: reminders queued for the old time are cancelled and queue again for the new one.
      if (patch.kickoff_at) await cancelQueuedBowlReminders(game.id);
      const { error } = await supabaseAdmin.from("bowl_pool_games").update(patch).eq("id", game.id);
      if (error) { await noteOperationalWarning("bowl_scores", "A Bowl Pool game could not be updated.", { gameId: game.id, code: error.code }); continue; }
      if (patch.kickoff_at) kickoffMoved = true;
    }
    imported += 1;
    if (headlineIsChampionship(headline)) championshipGameId = game.id;
    await lineFor(game.id, event, teams, wanted.line_lock_at ?? game.line_lock_at);
  }

  let nextOrder = games.reduce((highest, game) => Math.max(highest, game.order_index), 0);
  for (const { event, headline } of plan.inserts) {
    const competition = event.competitions?.[0];
    const confirmed = espnTimeIsConfirmed(event);
    const kickoff = (confirmed ? new Date(event.date) : noonEastern(easternDateKey(new Date(event.date)), easternDateTimeToUtc)).toISOString();
    const teams = await teamsOf(event);
    const lineLockAt = new Date(getLineLock(new Date(kickoff)).lineLockAt).toISOString();
    const { data: saved, error } = await supabaseAdmin.from("bowl_pool_games").upsert({
      season_id: season.id, provider_game_id: `espn:${event.id}`, bowl_name: newBowlName(headline), kickoff_at: kickoff, line_lock_at: lineLockAt, order_index: ++nextOrder, status: "scheduled",
      time_confirmed: confirmed, is_cfp: headlineIsCfp(headline), venue_name: competition?.venue?.fullName ?? null, venue_city: competition?.venue?.address?.city ?? null, venue_state: competition?.venue?.address?.state ?? null,
      away_team_id: teams?.away ?? null, home_team_id: teams?.home ?? null,
    }, { onConflict: "provider_game_id" }).select("id").single();
    if (error || !saved) { await noteOperationalWarning("bowl_scores", "A new Bowl Pool game could not be saved.", { code: error?.code }); continue; }
    imported += 1; inserted += 1;
    if (headlineIsChampionship(headline)) championshipGameId = saved.id;
    await lineFor(saved.id, event, teams, lineLockAt);
  }

  // New games, and games whose kickoff ESPN just confirmed or moved, take their place by kickoff, unless the Commissioner has curated an order of their own
  // (`games` is the list as it stood before this run, so it says whether the order was the kickoff order to begin with).
  if ((inserted || kickoffMoved) && orderIsChronological(games)) {
    const { data: all, error: allError } = await supabaseAdmin.from("bowl_pool_games").select("id, kickoff_at, order_index").eq("season_id", season.id);
    if (allError) throw new Error("Bowl Pool games could not be loaded.");
    for (const change of chronologicalOrder(all ?? [])) {
      const { error } = await supabaseAdmin.from("bowl_pool_games").update({ order_index: change.order_index }).eq("id", change.id);
      if (error) throw new Error("The Bowl Pool order could not be saved.");
    }
  }
  if (championshipGameId) {
    const { error: championshipSaveError } = await supabaseAdmin.from("bowl_pool_seasons").update({ championship_game_id: championshipGameId }).eq("id", season.id);
    if (championshipSaveError) throw new Error("The Bowl Pool championship game could not be saved.");
  }
  return imported;
}

function parseScore(value: string | number | null | undefined) {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

/** Matches games to the Odds API (when enabled) and locks each official line once its game-day lock time has come. Exported for tests. */
export async function syncScheduleAndLines(now: Date) {
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
  // Makes a game's preliminary line official. Callers check that its lock time has come; a line that is already locked is left alone, and the history
  // row is written only when this run really locked it (so a repeat run adds nothing).
  const lockProvisional = async (gameId: string) => {
    const provisional = lineByGame.get(gameId);
    if (!provisional || alreadyLocked.has(gameId)) return false;
    const lockedAt = now.toISOString();
    const { data: locked, error: fallbackError } = await supabaseAdmin.from("bowl_pool_game_lines").update({ locked_at: lockedAt }).eq("game_id", gameId).is("locked_at", null).select("game_id");
    if (fallbackError || !locked?.length) return false;
    alreadyLocked.add(gameId);
    const { error: historyError } = await supabaseAdmin.from("bowl_pool_spread_history").insert({ game_id: gameId, favorite_team_id: provisional.favorite_team_id, source_spread: provisional.source_spread, pool_spread: provisional.locked_spread, source: provisional.source, captured_at: provisional.source_captured_at });
    if (historyError) await noteOperationalWarning("bowl_scores", "A Bowl Pool line-history snapshot could not be saved.", { gameId });
    linesLocked += 1;
    return true;
  };
  for (const game of games) {
    const match = events.filter((event) => !used.has(event.id)).map((event) => ({ event, distance: Math.abs(new Date(event.commence_time).getTime() - new Date(game.kickoff_at).getTime()) })).filter(({ event, distance }) => distance <= 6 * 60 * 60 * 1000 && normalizedTeamName(event.away_team) === normalizedTeamName(joinedTeamName(game.away)) && normalizedTeamName(event.home_team) === normalizedTeamName(joinedTeamName(game.home))).sort((a, b) => a.distance - b.distance)[0];
    if (!match || match.distance > 6 * 60 * 60 * 1000) {
      // No odds match (always the case while the Odds API is off): the ESPN line saved by the schedule pull becomes official only on game day.
      if (lineIsDueToLock(game.line_lock_at, now, alreadyLocked.has(game.id))) await lockProvisional(game.id);
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
      if (historyError) await noteOperationalWarning("bowl_scores", "A Bowl Pool line-history snapshot could not be saved.", { gameId: game.id });
      linesLocked += 1;
    }
  }
  return { scheduleGames, linesLocked };
}

/**
 * Settles what ESPN reports for the games still awaiting a result. Only ESPN's "final" status is a result: a cancelled game can carry a 0-0 score, which is never
 * graded. A game ESPN lists as cancelled is cancelled here the way the Commissioner's Cancelled button does it, but only on the second run in a row that sees it so
 * (espn_cancelled_seen_at keeps the first sighting and is cleared as soon as ESPN stops saying it), so one odd answer from ESPN changes nothing. A postponed game is
 * left to the Commissioner; the overdue-final alert names it.
 */
async function syncScores(now: Date) {
  const { data: games, error: gamesReadError } = await supabaseAdmin.from("bowl_pool_games").select("id, provider_game_id, espn_cancelled_seen_at").in("status", ["scheduled", "live"]);
  if (gamesReadError) throw new Error("Bowl Pool games awaiting scores could not be loaded.");
  if (!games?.length) return { finalized: 0, cancelled: 0 };
  // ESPN is the no-cost source of truth for bowl results, and the only one: a score settles a game only when ESPN says it is final.
  const espnEvents = await espnPostseasonEvents(seasonYearAt(now), "scores");
  let finalized = 0; let cancelled = 0;
  for (const game of games) {
    const espnEvent = espnEvents.find((candidate) => `espn:${candidate.id}` === game.provider_game_id);
    if (espnEvent && espnGameIsCancelled(espnEvent)) {
      // Never settled from a score.
      if (!game.espn_cancelled_seen_at) {
        const { error } = await supabaseAdmin.from("bowl_pool_games").update({ espn_cancelled_seen_at: now.toISOString() }).eq("id", game.id).is("espn_cancelled_seen_at", null);
        if (error) await noteOperationalWarning("bowl_scores", "A Bowl Pool game ESPN lists as cancelled could not be marked.", { gameId: game.id, code: error.code });
      } else {
        const { error } = await supabaseAdmin.rpc("record_bowl_game_cancelled_by_espn", { target_game_id: game.id });
        if (error) await noteOperationalWarning("bowl_scores", "A Bowl Pool game ESPN lists as cancelled could not be cancelled.", { gameId: game.id, code: error.code });
        else cancelled += 1;
      }
      continue;
    }
    if (espnEvent && game.espn_cancelled_seen_at) {
      const { error } = await supabaseAdmin.from("bowl_pool_games").update({ espn_cancelled_seen_at: null }).eq("id", game.id);
      if (error) await noteOperationalWarning("bowl_scores", "A Bowl Pool game's cancellation mark could not be cleared.", { gameId: game.id, code: error.code });
    }
    const competition = espnEvent?.competitions?.[0];
    const completed = Boolean(espnEvent && espnGameIsFinal(espnEvent));
    const competitors = competition?.competitors ?? [];
    const away = competitors.find((competitor) => competitor.homeAway === "away") ?? competitors[0];
    const home = competitors.find((competitor) => competitor.homeAway === "home") ?? competitors[1];
    const awayScore = parseScore(away?.score);
    const homeScore = parseScore(home?.score);
    if (!completed || awayScore === null || homeScore === null) continue;
    const { error } = await supabaseAdmin.from("bowl_pool_games").update({ status: "final", away_score: awayScore, home_score: homeScore, finalized_at: now.toISOString() }).eq("id", game.id);
    if (!error) finalized += 1;
  }
  return { finalized, cancelled };
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
  // ESPN being down must not stop what needs no ESPN (games going live, missing-pick losses, grading, line locks). Each ESPN stage notes the failure,
  // the rest of the run carries on, and the run is then recorded as failed with the reason.
  const espnProblems: ProviderUnavailable[] = [];
  const whenEspnAnswers = async <T,>(fallback: T, stage: () => Promise<T>) => {
    try { return await stage(); } catch (error) {
      if (!(error instanceof ProviderUnavailable)) throw error;
      espnProblems.push(error);
      return fallback;
    }
  };
  checkpoint("annual schedule");
  const scheduleImported = await whenEspnAnswers(0, () => syncAnnualSchedule(now));
  checkpoint("schedule and lines");
  const provider = await syncScheduleAndLines(now);
  checkpoint("scores");
  const scores = await whenEspnAnswers({ finalized: 0, cancelled: 0 }, () => syncScores(now));
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
  if (espnProblems.length) throw new ProviderUnavailable("ESPN", [...new Set(espnProblems.map((problem) => problem.message))].join(" "));
  return { checkedAt: evaluatedAt, scheduleImported, gamesStarted: scheduled?.length ?? 0, missingPickLosses: Number(missing ?? 0), picksGraded, finalizedGames: scores.finalized, gamesCancelled: scores.cancelled, ...provider };
}
