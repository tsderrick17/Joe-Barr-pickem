import { supabaseAdmin } from "@/lib/supabase-admin";
import { calculatePlayoffEligibility } from "@/lib/playoff-math.js";
import { findLatestSettledWeeklyRecapPeriod } from "@/lib/weekly-recap-period";
import { shouldShowPoolActionMatchup } from "@/lib/pool-action-visibility";

export type WeeklyRecapSnapshot = {
  kind: "weekly_recap";
  week: string;
  weekNumber: number;
  generatedAt: string;
  games: Array<{ away: string; home: string; awayScore: number; homeScore: number; favorite: "away" | "home"; spread: number }>;
  standings: Array<{ name: string; wins: number }>;
  weeklySummary: Array<{ name: string; wins: number; picks: string[] }>;
  survivor: { in: number; out: number; latest: string | null; championName: string | null; championCrownedInRecapWeek: boolean; visibleWeeks: number; rows: Array<{ name: string; status: "IN" | "OUT"; eliminatedAt: string | null; eliminatedInRecapWeek: boolean; picks: Array<string | null> }> };
};

export type PlayoffDayRecapSnapshot = {
  kind: "playoff_day_recap";
  week: string;
  day: string;
  generatedAt: string;
  standings: Array<{ name: string; wins: number }>;
  weeklySummary: Array<{ name: string; wins: number; picks: string[] }>;
  eliminatedToday: string[];
  // Kept empty: it makes recap-image's shared summary shape safe while
  // playoff-day recaps intentionally contain Pick'em only.
  survivor: WeeklyRecapSnapshot["survivor"];
};

export type SundayRevealSnapshot = {
  kind: "sunday_reveal";
  window: "early" | "late";
  week: string;
  generatedAt: string;
  rows: Array<{ name: string; wins: number; picks: string[] }>;
};

export type PlayoffPublicRevealSnapshot = {
  kind: "playoff_public_reveal";
  round: string;
  window: string;
  generatedAt: string;
  rows: Array<{ name: string; wins: number; picks: string[] }>;
};

export type FeaturedWindowRevealSnapshot = {
  kind: "featured_window_reveal";
  week: string;
  window: string;
  generatedAt: string;
  rows: Array<{ name: string; wins: number; picks: string[] }>;
};

type PublicPickRow = SundayRevealSnapshot["rows"][number];

function onlyRowsWithPublicPicks(rows: PublicPickRow[]) {
  return rows.filter((row) => row.picks.length > 0);
}

export type GameDaySlateSnapshot = {
  kind: "game_day";
  day: string;
  generatedAt: string;
  games: Array<{ time: string; away: string; home: string; favorite: "away" | "home"; spread: number }>;
};

export type FreshSlateSnapshot = {
  kind: "fresh_slate";
  week: string;
  generatedAt: string;
  games: Array<{ day: string; time: string; away: string; home: string; favorite: "away" | "home" | null; spread: number | null }>;
};

export type EarlyLockSnapshot = {
  kind: "early_lock";
  day: string;
  generatedAt: string;
  games: GameDaySlateSnapshot["games"];
};

export async function buildPlayoffDayRecapSnapshot({ sourcePeriodId = null, sourceGameIds = [] }: { sourcePeriodId?: string | null; sourceGameIds?: string[] } = {}): Promise<PlayoffDayRecapSnapshot> {
  let periodQuery = supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, display_name, display_order, period_type, status, max_picks")
    .eq("period_type", "playoff")
    .in("status", ["active", "complete"]);
  if (sourcePeriodId) periodQuery = periodQuery.eq("id", sourcePeriodId);
  else periodQuery = periodQuery.order("display_order", { ascending: false }).limit(1);
  const { data: period, error: periodError } = await periodQuery.maybeSingle();
  if (periodError || !period) throw new Error("A playoff round is not available for this recap.");

  const { data: periods, error: periodsError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_order, period_type, status, max_picks")
    .eq("season_id", period.season_id)
    .order("display_order");
  if (periodsError || !periods) throw new Error("Playoff records could not be prepared for this recap.");
  const periodIds = periods.map((item) => item.id);
  const [{ data: games, error: gamesError }, { data: picks, error: picksError }, { data: players, error: playersError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, scoring_period_id, kickoff_at, status").in("scoring_period_id", periodIds).order("kickoff_at"),
    supabaseAdmin.from("picks").select("player_id, game_id, selected_team_id, result").in("scoring_period_id", periodIds).neq("result", "void"),
    supabaseAdmin.from("players").select("id, first_name").eq("active", true),
  ]);
  if (gamesError || picksError || playersError) throw new Error("The playoff recap could not be prepared.");

  const now = new Date();
  const sourceIds = new Set(sourceGameIds);
  const playedGames = (games ?? []).filter((game) => game.scoring_period_id === period.id && new Date(game.kickoff_at) <= now);
  if (!playedGames.length) throw new Error("A completed playoff day is not available for this recap.");
  const latestDay = playedGames.reduce((latest, game) => easternDate(new Date(game.kickoff_at)) > latest ? easternDate(new Date(game.kickoff_at)) : latest, easternDate(new Date(playedGames[0].kickoff_at)));
  const dayGames = sourceIds.size
    ? (games ?? []).filter((game) => sourceIds.has(game.id) && game.scoring_period_id === period.id)
    : playedGames.filter((game) => easternDate(new Date(game.kickoff_at)) === latestDay);
  if (!dayGames.length) throw new Error("This playoff recap does not have a scheduled game day.");
  if (dayGames.some((game) => game.status !== "final")) throw new Error("This playoff day is still being finalized.");

  // A day may be fully graded just before the round status flips to complete.
  // Evaluate it as the day began, while its remaining games were still live.
  const dayStartPeriods = periods.map((item) => item.id === period.id ? { ...item, status: "active" } : item);
  const eligibilityAtDayStart = calculatePlayoffEligibility({
    players: players ?? [],
    periods: dayStartPeriods,
    games: games ?? [],
    picks: picks ?? [],
    targetPeriodId: period.id,
    now: new Date(dayGames[0].kickoff_at),
  });
  // Check the next Eastern day after every result from this scheduled card is
  // final. That turns the day-end email into a durable record of who was
  // newly eliminated by those results, while the pre-day snapshot remains the
  // rule that governed which players could make selections that day.
  const latestKickoff = Math.max(...dayGames.map((game) => new Date(game.kickoff_at).getTime()));
  const eligibilityAfterDay = calculatePlayoffEligibility({
    players: players ?? [],
    periods: dayStartPeriods,
    games: games ?? [],
    picks: picks ?? [],
    targetPeriodId: period.id,
    now: new Date(latestKickoff + 18 * 60 * 60_000),
  });
  const eliminatedToday = (players ?? [])
    .filter((player) => eligibilityAfterDay.eliminatedPlayerIds.has(player.id) && !eligibilityAtDayStart.eliminatedPlayerIds.has(player.id))
    .map((player) => player.first_name)
    .sort((left, right) => left.localeCompare(right));
  const includedPlayers = (players ?? []).filter((player) => !eligibilityAfterDay.eliminatedPlayerIds.has(player.id));
  const includedIds = new Set(includedPlayers.map((player) => player.id));
  const dayGameIds = new Set(dayGames.map((game) => game.id));
  const teamIds = [...new Set((picks ?? []).filter((pick) => dayGameIds.has(pick.game_id)).map((pick) => pick.selected_team_id))];
  const { data: teams, error: teamsError } = teamIds.length
    ? await supabaseAdmin.from("teams").select("id, abbreviation").in("id", teamIds)
    : { data: [], error: null };
  if (teamsError) throw new Error("Playoff pick labels could not be prepared.");
  const abbreviations = new Map((teams ?? []).map((team) => [team.id, team.abbreviation]));
  const seasonWins = new Map<string, number>();
  for (const pick of picks ?? []) if (pick.result === "win") seasonWins.set(pick.player_id, (seasonWins.get(pick.player_id) ?? 0) + 1);
  const dayPicks = new Map<string, Array<{ selected_team_id: string; result: string }>>();
  for (const pick of picks ?? []) {
    if (dayGameIds.has(pick.game_id) && includedIds.has(pick.player_id)) dayPicks.set(pick.player_id, [...(dayPicks.get(pick.player_id) ?? []), pick]);
  }

  return {
    kind: "playoff_day_recap",
    week: period.display_name,
    day: easternDayLabel(new Date(dayGames[0].kickoff_at)),
    generatedAt: now.toISOString(),
    standings: includedPlayers.map((player) => ({ name: player.first_name, wins: seasonWins.get(player.id) ?? 0 })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
    weeklySummary: includedPlayers.map((player) => ({ name: player.first_name, wins: (dayPicks.get(player.id) ?? []).filter((pick) => pick.result === "win").length, picks: (dayPicks.get(player.id) ?? []).map((pick) => `${abbreviations.get(pick.selected_team_id) ?? "NFL"} ${pick.result === "win" ? "W" : "L"}`) })),
    eliminatedToday,
    survivor: { in: 0, out: 0, latest: null, championName: null, championCrownedInRecapWeek: false, visibleWeeks: 10, rows: [] },
  };
}

export async function buildWeeklyRecapSnapshot(targetPeriodId?: string | null): Promise<WeeklyRecapSnapshot> {
  let period;
  if (targetPeriodId) {
    const { data, error } = await supabaseAdmin
      .from("scoring_periods")
      .select("id, season_id, display_name, display_order")
      .eq("id", targetPeriodId)
      .maybeSingle();
    if (error) throw new Error("The weekly recap source week could not be loaded.");
    period = data;
  } else {
    period = await findLatestSettledWeeklyRecapPeriod();
  }
  if (!period) throw new Error("A settled week is not available for the recap.");

  const { data: seasonPeriods, error: seasonPeriodsError } = await supabaseAdmin.from("scoring_periods").select("id, display_order").eq("season_id", period.season_id);
  if (seasonPeriodsError) throw new Error("Season records could not be prepared for the recap.");
  const seasonPeriodIds = (seasonPeriods ?? []).map((item) => item.id);
  const [{ data: games, error: gamesError }, { data: lines, error: linesError }, { data: players, error: playersError }, { data: picks, error: picksError }, { data: entries, error: entriesError }, { data: survivorPicks, error: survivorPicksError }, { data: season, error: seasonError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, away_team_id, home_team_id, away_score, home_score").eq("scoring_period_id", period.id).eq("status", "final").order("kickoff_at"),
    supabaseAdmin.from("game_lines").select("game_id, favorite_team_id, locked_spread"),
    supabaseAdmin.from("players").select("id, first_name").eq("active", true),
    seasonPeriodIds.length ? supabaseAdmin.from("picks").select("player_id, selected_team_id, result, scoring_period_id, submitted_at").in("scoring_period_id", seasonPeriodIds).neq("result", "void").order("submitted_at") : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("survivor_entries").select("id, player_id, status, eliminated_at, eliminated_scoring_period_id").eq("season_id", period.season_id),
    seasonPeriodIds.length ? supabaseAdmin.from("survivor_picks").select("survivor_entry_id, scoring_period_id, selected_team_id, result").in("scoring_period_id", seasonPeriodIds).neq("result", "void") : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("seasons").select("survivor_champion_player_id").eq("id", period.season_id).maybeSingle(),
  ]);
  if (gamesError || linesError || playersError || picksError || entriesError || survivorPicksError || seasonError) throw new Error("The completed-week recap could not be prepared.");

  const teamIds = [...new Set([...(games ?? []).flatMap((game) => [game.away_team_id, game.home_team_id]), ...(picks ?? []).map((pick) => pick.selected_team_id), ...(survivorPicks ?? []).map((pick) => pick.selected_team_id)])];
  const { data: teams, error: teamsError } = teamIds.length ? await supabaseAdmin.from("teams").select("id, full_name, abbreviation").in("id", teamIds) : { data: [], error: null };
  if (teamsError) throw new Error("The recap team names could not be prepared.");
  const names = new Map((teams ?? []).map((team) => [team.id, team.full_name]));
  const abbreviations = new Map((teams ?? []).map((team) => [team.id, team.abbreviation]));
  const lineByGame = new Map((lines ?? []).map((line) => [line.game_id, line]));

  const wins = new Map<string, number>();
  for (const pick of picks ?? []) if (pick.result === "win") wins.set(pick.player_id, (wins.get(pick.player_id) ?? 0) + 1);
  const latest = (survivorPicks ?? []).filter(
    (pick) => pick.scoring_period_id === period.id && pick.result === "win",
  ).length;
  const weeklyPicksByPlayer = new Map<string, Array<{ selected_team_id: string; result: string }>>();
  for (const pick of picks ?? []) if (pick.scoring_period_id === period.id) weeklyPicksByPlayer.set(pick.player_id, [...(weeklyPicksByPlayer.get(pick.player_id) ?? []), pick]);
  const orderByPeriod = new Map((seasonPeriods ?? []).map((item) => [item.id, item.display_order]));
  const visibleWeeks = Math.max(10, period.display_order);
  const entryById = new Map((entries ?? []).map((entry) => [entry.id, entry]));
  const championName = season?.survivor_champion_player_id
    ? (players ?? []).find((player) => player.id === season.survivor_champion_player_id)?.first_name ?? "Survivor champion"
    : null;
  const championCrownedInRecapWeek = Boolean(
    championName && (entries ?? []).some((entry) => entry.eliminated_scoring_period_id === period.id),
  );
  const survivorPicksByEntry = new Map<string, Array<{ scoring_period_id: string; selected_team_id: string }>>();
  for (const pick of survivorPicks ?? []) survivorPicksByEntry.set(pick.survivor_entry_id, [...(survivorPicksByEntry.get(pick.survivor_entry_id) ?? []), pick]);

  return {
    kind: "weekly_recap",
    week: period.display_name,
    weekNumber: period.display_order,
    generatedAt: new Date().toISOString(),
    games: (games ?? []).filter((game) => Number.isInteger(game.away_score) && Number.isInteger(game.home_score)).map((game) => {
      const line = lineByGame.get(game.id);
      return { away: names.get(game.away_team_id) ?? "Away", home: names.get(game.home_team_id) ?? "Home", awayScore: game.away_score!, homeScore: game.home_score!, favorite: line?.favorite_team_id === game.home_team_id ? "home" : "away", spread: Number(line?.locked_spread ?? 0) };
    }),
    standings: (players ?? []).map((player) => ({ name: player.first_name, wins: wins.get(player.id) ?? 0 })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
    weeklySummary: (players ?? []).map((player) => ({ name: player.first_name, wins: (weeklyPicksByPlayer.get(player.id) ?? []).filter((pick) => pick.result === "win").length, picks: (weeklyPicksByPlayer.get(player.id) ?? []).map((pick) => `${abbreviations.get(pick.selected_team_id) ?? "NFL"} ${pick.result === "win" ? "W" : "L"}`) })).filter((row) => row.picks.length > 0),
    survivor: { in: (entries ?? []).filter((entry) => entry.status === "active").length, out: (entries ?? []).filter((entry) => entry.status === "eliminated").length, latest: latest ? `${latest} Survivor pick${latest === 1 ? "" : "s"} advanced` : null, championName, championCrownedInRecapWeek, visibleWeeks, rows: (players ?? []).map((player) => {
      const entry = [...entryById.values()].find((item) => item.player_id === player.id);
      const entryPicks = entry ? survivorPicksByEntry.get(entry.id) ?? [] : [];
      const byWeek = new Map(entryPicks.map((pick) => [orderByPeriod.get(pick.scoring_period_id), abbreviations.get(pick.selected_team_id) ?? "NFL"]));
      const status: "IN" | "OUT" = entry?.status === "eliminated" ? "OUT" : "IN";
      return { name: player.first_name, status, eliminatedAt: entry?.eliminated_at ?? null, eliminatedInRecapWeek: entry?.eliminated_scoring_period_id === period.id, picks: Array.from({ length: visibleWeeks }, (_, index) => byWeek.get(index + 1) ?? null) };
    }).filter((row) => row.status === "IN" || row.eliminatedInRecapWeek).sort((first, second) => {
      if (first.status !== second.status) return first.status === "IN" ? -1 : 1;
      if (first.status === "IN") return first.name.localeCompare(second.name);
      return new Date(second.eliminatedAt ?? 0).getTime() - new Date(first.eliminatedAt ?? 0).getTime() || first.name.localeCompare(second.name);
    }) },
  };
}

function easternDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

function easternDayLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }).format(value);
}

function easternTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(value)).replace(" AM", " AM ET").replace(" PM", " PM ET");
}

export async function ensureGameDaySlateSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object" && "kind" in existing && existing.kind === "game_day") return existing as GameDaySlateSnapshot;
  const now = new Date();
  const day = easternDate(now);
  const [{ data: period, error: periodError }, { data: reminder, error: reminderError }] = await Promise.all([
    supabaseAdmin.from("scoring_periods").select("id").eq("status", "active").order("display_order").limit(1).maybeSingle(),
    supabaseAdmin.from("push_reminders").select("source_game_ids").eq("id", reminderId).maybeSingle(),
  ]);
  if (periodError || !period) throw new Error("An active week is not available for the gameday Slate.");
  if (reminderError) throw new Error("The gameday Slate source could not be loaded.");
  const { data: games, error: gamesError } = await supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at").eq("scoring_period_id", period.id).order("kickoff_at");
  if (gamesError) throw new Error("Today’s Slate could not be prepared.");
  const sourceIds = new Set(reminder?.source_game_ids ?? []);
  const dayGames = sourceIds.size
    ? (games ?? []).filter((game) => sourceIds.has(game.id))
    : (games ?? []).filter((game) => easternDate(new Date(game.kickoff_at)) === day);
  if (!dayGames.length) throw new Error("There are no games on today’s Slate.");
  const ids = [...new Set(dayGames.flatMap((game) => [game.away_team_id, game.home_team_id]))];
  const [{ data: teams, error: teamsError }, { data: lines, error: linesError }] = await Promise.all([
    supabaseAdmin.from("teams").select("id, full_name").in("id", ids),
    supabaseAdmin.from("game_lines").select("game_id, favorite_team_id, locked_spread").in("game_id", dayGames.map((game) => game.id)),
  ]);
  if (teamsError || linesError) throw new Error("Today’s official lines could not be prepared.");
  const names = new Map((teams ?? []).map((team) => [team.id, team.full_name]));
  const lineByGame = new Map((lines ?? []).map((line) => [line.game_id, line]));
  const snapshot: GameDaySlateSnapshot = { kind: "game_day", day: easternDayLabel(now), generatedAt: now.toISOString(), games: dayGames.map((game) => {
    const line = lineByGame.get(game.id);
    return { time: easternTime(game.kickoff_at), away: names.get(game.away_team_id) ?? "Away", home: names.get(game.home_team_id) ?? "Home", favorite: line?.favorite_team_id === game.home_team_id ? "home" : "away", spread: Number(line?.locked_spread ?? 0) };
  }) };
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: now.toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The gameday Slate receipt could not be saved.");
  return snapshot;
}

export async function ensureFreshSlateSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object" && "kind" in existing && existing.kind === "fresh_slate") return existing as FreshSlateSnapshot;
  const now = new Date();
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, display_name")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (periodError || !period) throw new Error("An active week is not available for the fresh Slate.");
  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select("id, away_team_id, home_team_id, kickoff_at")
    .eq("scoring_period_id", period.id)
    .not("status", "in", "(postponed,cancelled,no_contest)")
    .order("kickoff_at");
  if (gamesError || !(games ?? []).length) throw new Error("The fresh Slate could not be prepared.");
  const teamIds = [...new Set((games ?? []).flatMap((game) => [game.away_team_id, game.home_team_id]))];
  const [{ data: teams, error: teamsError }, { data: preliminaryLines, error: linesError }] = await Promise.all([
    supabaseAdmin.from("teams").select("id, full_name").in("id", teamIds),
    supabaseAdmin.from("spread_history").select("game_id, favorite_team_id, spread, captured_at").in("game_id", (games ?? []).map((game) => game.id)).order("captured_at", { ascending: false }),
  ]);
  if (teamsError || linesError) throw new Error("The fresh Slate details could not be prepared.");
  const names = new Map((teams ?? []).map((team) => [team.id, team.full_name]));
  const lineByGame = new Map<string, { favorite_team_id: string | null; spread: number | string }>();
  for (const line of preliminaryLines ?? []) {
    if (!lineByGame.has(line.game_id)) lineByGame.set(line.game_id, line);
  }
  const snapshot: FreshSlateSnapshot = {
    kind: "fresh_slate",
    week: period.display_name,
    generatedAt: now.toISOString(),
    games: (games ?? []).map((game) => {
      const line = lineByGame.get(game.id);
      return {
        day: easternDayLabel(new Date(game.kickoff_at)),
        time: easternTime(game.kickoff_at),
        away: names.get(game.away_team_id) ?? "Away",
        home: names.get(game.home_team_id) ?? "Home",
        favorite: !line?.favorite_team_id ? null : line.favorite_team_id === game.home_team_id ? "home" : "away",
        spread: line?.spread == null ? null : Number(line.spread),
      };
    }),
  };
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: now.toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The fresh Slate receipt could not be saved.");
  return snapshot;
}

export async function ensureEarlyLockSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object" && "kind" in existing && existing.kind === "early_lock") return existing as EarlyLockSnapshot;
  const now = new Date();
  const { data: period, error: periodError } = await supabaseAdmin.from("scoring_periods").select("id").eq("status", "active").order("display_order").limit(1).maybeSingle();
  if (periodError || !period) throw new Error("An active week is not available for the early-lock reminder.");
  const { data: reminder, error: reminderError } = await supabaseAdmin.from("push_reminders").select("source_game_ids").eq("id", reminderId).maybeSingle();
  if (reminderError) throw new Error("The international-game source could not be loaded.");
  let gameQuery = supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at").eq("scoring_period_id", period.id).eq("is_international", true).lte("line_lock_at", now.toISOString());
  if (reminder?.source_game_ids?.length) gameQuery = gameQuery.in("id", reminder.source_game_ids);
  const { data: game, error: gameError } = await gameQuery.order("line_lock_at", { ascending: false }).limit(1).maybeSingle();
  if (gameError || !game) throw new Error("A recently locked international game is not available.");
  const [{ data: teams, error: teamsError }, { data: line, error: lineError }] = await Promise.all([
    supabaseAdmin.from("teams").select("id, full_name").in("id", [game.away_team_id, game.home_team_id]),
    supabaseAdmin.from("game_lines").select("favorite_team_id, locked_spread").eq("game_id", game.id).maybeSingle(),
  ]);
  if (teamsError || lineError || !line) throw new Error("The international official line could not be prepared.");
  const names = new Map((teams ?? []).map((team) => [team.id, team.full_name]));
  const snapshot: EarlyLockSnapshot = { kind: "early_lock", day: easternDayLabel(new Date(game.kickoff_at)), generatedAt: now.toISOString(), games: [{ time: easternTime(game.kickoff_at), away: names.get(game.away_team_id) ?? "Away", home: names.get(game.home_team_id) ?? "Home", favorite: line.favorite_team_id === game.home_team_id ? "home" : "away", spread: Number(line.locked_spread) }] };
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: now.toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The early-lock Slate receipt could not be saved.");
  return snapshot;
}

export async function ensureWeeklyRecapSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object") return existing as WeeklyRecapSnapshot;
  const { data: reminder, error: reminderError } = await supabaseAdmin
    .from("push_reminders")
    .select("source_scoring_period_id")
    .eq("id", reminderId)
    .maybeSingle();
  if (reminderError) throw new Error("The weekly recap source week could not be loaded.");
  const snapshot = await buildWeeklyRecapSnapshot(reminder?.source_scoring_period_id);
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: new Date().toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The weekly recap receipt could not be saved.");
  return snapshot;
}

export async function ensurePlayoffDayRecapSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object" && "kind" in existing && existing.kind === "playoff_day_recap") return existing as PlayoffDayRecapSnapshot;
  const { data: reminder, error: reminderError } = await supabaseAdmin
    .from("push_reminders")
    .select("source_scoring_period_id, source_game_ids")
    .eq("id", reminderId)
    .maybeSingle();
  if (reminderError) throw new Error("The playoff recap source games could not be loaded.");
  const snapshot = await buildPlayoffDayRecapSnapshot({
    sourcePeriodId: reminder?.source_scoring_period_id,
    sourceGameIds: reminder?.source_game_ids ?? [],
  });
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: new Date().toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The playoff day recap receipt could not be saved.");
  return snapshot;
}

function easternWeekday(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date(value));
}

function easternHour(value: string) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(value)));
}

export async function ensureSundayRevealSnapshot(reminderId: string, existing: unknown, window: "early" | "late") {
  if (existing && typeof existing === "object" && "kind" in existing && existing.kind === "sunday_reveal") return existing as SundayRevealSnapshot;
  const now = new Date();
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, display_name, display_order, max_picks")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (periodError || !period) throw new Error("An active week is not available for the Sunday reveal.");

  const [{ data: games, error: gamesError }, { data: seasonPeriods, error: periodsError }, { data: players, error: playersError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at, status").eq("scoring_period_id", period.id),
    supabaseAdmin.from("scoring_periods").select("id, display_order, max_picks, status").eq("season_id", period.season_id),
    supabaseAdmin.from("players").select("id, first_name").eq("active", true),
  ]);
  if (gamesError || periodsError || playersError) throw new Error("The Sunday reveal could not be prepared.");

  const range = window === "early" ? [12, 16] : [16, 20];
  const revealGames = (games ?? []).filter((game) => {
    const kickoff = new Date(game.kickoff_at);
    const hour = easternHour(game.kickoff_at);
    return easternWeekday(game.kickoff_at) === "Sunday" && hour >= range[0] && hour < range[1] && kickoff <= now && !["postponed", "cancelled", "no_contest"].includes(game.status);
  });
  if (!revealGames.length) throw new Error("The selected Sunday kickoff window is not public yet.");

  const seasonPeriodIds = (seasonPeriods ?? []).map((item) => item.id);
  const [{ data: picks, error: picksError }, { data: teams, error: teamsError }] = await Promise.all([
    seasonPeriodIds.length ? supabaseAdmin.from("picks").select("player_id, game_id, selected_team_id, result, scoring_period_id").in("scoring_period_id", seasonPeriodIds).neq("result", "void") : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("teams").select("id, abbreviation").in("id", [...new Set(revealGames.flatMap((game) => [game.away_team_id, game.home_team_id]))]),
  ]);
  if (picksError || teamsError) throw new Error("Public Sunday selections could not be prepared.");

  const playerWins = new Map<string, number>();
  for (const pick of picks ?? []) if (pick.result === "win") playerWins.set(pick.player_id, (playerWins.get(pick.player_id) ?? 0) + 1);
  const leaderWins = Math.max(0, ...(players ?? []).map((player) => playerWins.get(player.id) ?? 0));
  // This intentionally overestimates each player's remaining opportunity. A
  // player is omitted only when they cannot even tie the leader, never sooner.
  const remainingSlots = (seasonPeriods ?? []).filter((item) => item.status !== "complete").reduce((total, item) => total + item.max_picks, 0);
  const contenderIds = new Set((players ?? []).filter((player) => (playerWins.get(player.id) ?? 0) + remainingSlots >= leaderWins).map((player) => player.id));
  const pickedRevealGameIds = new Set((picks ?? []).filter((pick) => pick.scoring_period_id === period.id).map((pick) => pick.game_id));
  const revealGameIds = new Set(revealGames.filter((game) => shouldShowPoolActionMatchup({ kickoffAt: game.kickoff_at, now, hasSelections: pickedRevealGameIds.has(game.id) })).map((game) => game.id));
  if (!revealGameIds.size) throw new Error("No selected Sunday matchup is ready for a public receipt.");
  const abbreviationById = new Map((teams ?? []).map((team) => [team.id, team.abbreviation]));
  const picksByPlayer = new Map<string, string[]>();
  for (const pick of picks ?? []) {
    if (pick.scoring_period_id !== period.id || !revealGameIds.has(pick.game_id) || !contenderIds.has(pick.player_id)) continue;
    picksByPlayer.set(pick.player_id, [...(picksByPlayer.get(pick.player_id) ?? []), abbreviationById.get(pick.selected_team_id) ?? "NFL"]);
  }
  const snapshot: SundayRevealSnapshot = {
    kind: "sunday_reveal",
    window,
    week: period.display_name,
    generatedAt: now.toISOString(),
    rows: onlyRowsWithPublicPicks((players ?? []).filter((player) => contenderIds.has(player.id)).map((player) => ({ name: player.first_name, wins: playerWins.get(player.id) ?? 0, picks: picksByPlayer.get(player.id) ?? [] }))).sort((first, second) => second.wins - first.wins || first.name.localeCompare(second.name)),
  };
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: now.toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The Sunday reveal receipt could not be saved.");
  return snapshot;
}

function isFeaturedGame(game: { is_international: boolean; kickoff_at: string }) {
  if (game.is_international) return true;
  const weekday = easternWeekday(game.kickoff_at);
  const hour = easternHour(game.kickoff_at);
  return weekday === "Wednesday" || weekday === "Thursday" || weekday === "Monday" || (weekday === "Sunday" && hour >= 20);
}

export async function ensureFeaturedWindowRevealSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object" && "kind" in existing && existing.kind === "featured_window_reveal") return existing as FeaturedWindowRevealSnapshot;

  const now = new Date();
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, display_name")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (periodError || !period) throw new Error("An active week is not available for the featured-game reveal.");

  const [{ data: games, error: gamesError }, { data: periods, error: periodsError }, { data: players, error: playersError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at, is_international, status").eq("scoring_period_id", period.id).order("kickoff_at"),
    supabaseAdmin.from("scoring_periods").select("id").eq("season_id", period.season_id),
    supabaseAdmin.from("players").select("id, first_name").eq("active", true),
  ]);
  if (gamesError || periodsError || playersError) throw new Error("The featured-game reveal could not be prepared.");

  const featuredGames = (games ?? []).filter((game) => isFeaturedGame(game) && new Date(game.kickoff_at) <= now && !["postponed", "cancelled", "no_contest"].includes(game.status));
  if (!featuredGames.length) throw new Error("No featured game has reached kickoff yet.");
  const publicGameIds = new Set((games ?? []).filter((game) => new Date(game.kickoff_at) <= now && !["postponed", "cancelled", "no_contest"].includes(game.status)).map((game) => game.id));
  const periodIds = (periods ?? []).map((item) => item.id);
  const { data: picks, error: picksError } = periodIds.length
    ? await supabaseAdmin.from("picks").select("player_id, game_id, selected_team_id, result, scoring_period_id").in("scoring_period_id", periodIds).neq("result", "void")
    : { data: [], error: null };
  if (picksError) throw new Error("Public featured-game selections could not be prepared.");

  const pickedPublicGameIds = new Set((picks ?? []).filter((pick) => pick.scoring_period_id === period.id).map((pick) => pick.game_id));
  const selectedPublicGameIds = new Set((games ?? []).filter((game) => publicGameIds.has(game.id) && shouldShowPoolActionMatchup({ kickoffAt: game.kickoff_at, now, hasSelections: pickedPublicGameIds.has(game.id) })).map((game) => game.id));
  const selectedFeaturedGames = featuredGames.filter((game) => selectedPublicGameIds.has(game.id));
  if (!selectedFeaturedGames.length) throw new Error("No selected featured matchup is ready for a public receipt.");
  const selectedTeamIds = [...new Set((picks ?? []).filter((pick) => pick.scoring_period_id === period.id && selectedPublicGameIds.has(pick.game_id)).map((pick) => pick.selected_team_id))];
  const { data: teams, error: teamsError } = selectedTeamIds.length
    ? await supabaseAdmin.from("teams").select("id, abbreviation").in("id", selectedTeamIds)
    : { data: [], error: null };
  if (teamsError) throw new Error("Featured-game team labels could not be prepared.");

  const abbreviationById = new Map((teams ?? []).map((team) => [team.id, team.abbreviation]));
  const wins = new Map<string, number>();
  const picksByPlayer = new Map<string, string[]>();
  for (const pick of picks ?? []) {
    if (pick.result === "win") wins.set(pick.player_id, (wins.get(pick.player_id) ?? 0) + 1);
    if (pick.scoring_period_id === period.id && selectedPublicGameIds.has(pick.game_id)) {
      picksByPlayer.set(pick.player_id, [...(picksByPlayer.get(pick.player_id) ?? []), abbreviationById.get(pick.selected_team_id) ?? "NFL"]);
    }
  }

  const latestFeatured = selectedFeaturedGames[selectedFeaturedGames.length - 1];
  const snapshot: FeaturedWindowRevealSnapshot = {
    kind: "featured_window_reveal",
    week: period.display_name,
    window: `${easternDayLabel(new Date(latestFeatured.kickoff_at))} featured window`,
    generatedAt: now.toISOString(),
    rows: onlyRowsWithPublicPicks((players ?? []).map((player) => ({ name: player.first_name, wins: wins.get(player.id) ?? 0, picks: picksByPlayer.get(player.id) ?? [] }))).sort((first, second) => second.wins - first.wins || first.name.localeCompare(second.name)),
  };
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: now.toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The featured-game public receipt could not be saved.");
  return snapshot;
}

export async function ensurePlayoffPublicRevealSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object" && "kind" in existing && existing.kind === "playoff_public_reveal") return existing as PlayoffPublicRevealSnapshot;

  const now = new Date();
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, display_name")
    .eq("period_type", "playoff")
    .eq("status", "active")
    .order("display_order")
    .limit(1)
    .maybeSingle();
  if (periodError || !period) throw new Error("An active playoff round is not available for this public-pick update.");

  const [{ data: games, error: gamesError }, { data: seasonPeriods, error: periodsError }, { data: players, error: playersError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at, status").eq("scoring_period_id", period.id).order("kickoff_at"),
    supabaseAdmin.from("scoring_periods").select("id").eq("season_id", period.season_id),
    supabaseAdmin.from("players").select("id, first_name").eq("active", true),
  ]);
  if (gamesError || periodsError || playersError) throw new Error("The playoff public-pick update could not be prepared.");

  const publicGames = (games ?? []).filter((game) => new Date(game.kickoff_at) <= now && !["postponed", "cancelled", "no_contest"].includes(game.status));
  if (!publicGames.length) throw new Error("No playoff games have reached kickoff yet.");

  const periodIds = (seasonPeriods ?? []).map((item) => item.id);
  const { data: picks, error: picksError } = periodIds.length
    ? await supabaseAdmin.from("picks").select("player_id, game_id, selected_team_id, result, scoring_period_id").in("scoring_period_id", periodIds).neq("result", "void")
    : { data: [], error: null };
  if (picksError) throw new Error("Public playoff selections could not be prepared.");

  const pickedPublicGameIds = new Set((picks ?? []).filter((pick) => pick.scoring_period_id === period.id).map((pick) => pick.game_id));
  const selectedPublicGames = publicGames.filter((game) => shouldShowPoolActionMatchup({ kickoffAt: game.kickoff_at, now, hasSelections: pickedPublicGameIds.has(game.id) }));
  const selectedPublicGameIds = new Set(selectedPublicGames.map((game) => game.id));
  if (!selectedPublicGames.length) throw new Error("No selected playoff matchup is ready for a public receipt.");
  const selectedTeamIds = [...new Set((picks ?? []).filter((pick) => pick.scoring_period_id === period.id && selectedPublicGameIds.has(pick.game_id)).map((pick) => pick.selected_team_id))];
  const { data: teams, error: teamsError } = selectedTeamIds.length
    ? await supabaseAdmin.from("teams").select("id, abbreviation").in("id", selectedTeamIds)
    : { data: [], error: null };
  if (teamsError) throw new Error("Public playoff team labels could not be prepared.");

  const abbreviationById = new Map((teams ?? []).map((team) => [team.id, team.abbreviation]));
  const wins = new Map<string, number>();
  const picksByPlayer = new Map<string, string[]>();
  for (const pick of picks ?? []) {
    if (pick.result === "win") wins.set(pick.player_id, (wins.get(pick.player_id) ?? 0) + 1);
    if (pick.scoring_period_id === period.id && selectedPublicGameIds.has(pick.game_id)) {
      picksByPlayer.set(pick.player_id, [...(picksByPlayer.get(pick.player_id) ?? []), abbreviationById.get(pick.selected_team_id) ?? "NFL"]);
    }
  }

  const snapshot: PlayoffPublicRevealSnapshot = {
    kind: "playoff_public_reveal",
    round: period.display_name,
    window: easternDayLabel(new Date(selectedPublicGames[selectedPublicGames.length - 1].kickoff_at)),
    generatedAt: now.toISOString(),
    rows: onlyRowsWithPublicPicks((players ?? []).map((player) => ({ name: player.first_name, wins: wins.get(player.id) ?? 0, picks: picksByPlayer.get(player.id) ?? [] }))).sort((first, second) => second.wins - first.wins || first.name.localeCompare(second.name)),
  };
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: now.toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The playoff public-pick receipt could not be saved.");
  return snapshot;
}
