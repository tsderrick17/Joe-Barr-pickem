import { supabaseAdmin } from "@/lib/supabase-admin";

export type WeeklyRecapSnapshot = {
  kind: "weekly_recap";
  week: string;
  weekNumber: number;
  generatedAt: string;
  games: Array<{ away: string; home: string; awayScore: number; homeScore: number; favorite: "away" | "home"; spread: number }>;
  standings: Array<{ name: string; wins: number }>;
  weeklySummary: Array<{ name: string; wins: number; picks: string[] }>;
  survivor: { in: number; out: number; latest: string | null; visibleWeeks: number; rows: Array<{ name: string; status: "IN" | "OUT"; picks: Array<string | null> }> };
};

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

export async function buildWeeklyRecapSnapshot(): Promise<WeeklyRecapSnapshot> {
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, display_name, display_order")
    .eq("status", "complete")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (periodError || !period) throw new Error("A completed week is not available for the recap.");

  const { data: seasonPeriods, error: seasonPeriodsError } = await supabaseAdmin.from("scoring_periods").select("id, display_order").eq("season_id", period.season_id);
  if (seasonPeriodsError) throw new Error("Season records could not be prepared for the recap.");
  const seasonPeriodIds = (seasonPeriods ?? []).map((item) => item.id);
  const [{ data: games, error: gamesError }, { data: lines, error: linesError }, { data: players, error: playersError }, { data: picks, error: picksError }, { data: entries, error: entriesError }, { data: survivorPicks, error: survivorPicksError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, away_team_id, home_team_id, away_score, home_score").eq("scoring_period_id", period.id).eq("status", "final").order("kickoff_at"),
    supabaseAdmin.from("game_lines").select("game_id, favorite_team_id, locked_spread"),
    supabaseAdmin.from("players").select("id, first_name").eq("active", true),
    seasonPeriodIds.length ? supabaseAdmin.from("picks").select("player_id, selected_team_id, result, scoring_period_id, submitted_at").in("scoring_period_id", seasonPeriodIds).neq("result", "void").order("submitted_at") : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("survivor_entries").select("id, player_id, status").eq("season_id", period.season_id),
    seasonPeriodIds.length ? supabaseAdmin.from("survivor_picks").select("survivor_entry_id, scoring_period_id, selected_team_id, result").in("scoring_period_id", seasonPeriodIds).neq("result", "void") : Promise.resolve({ data: [], error: null }),
  ]);
  if (gamesError || linesError || playersError || picksError || entriesError || survivorPicksError) throw new Error("The completed-week recap could not be prepared.");

  const teamIds = [...new Set([...(games ?? []).flatMap((game) => [game.away_team_id, game.home_team_id]), ...(picks ?? []).map((pick) => pick.selected_team_id), ...(survivorPicks ?? []).map((pick) => pick.selected_team_id)])];
  const { data: teams, error: teamsError } = teamIds.length ? await supabaseAdmin.from("teams").select("id, full_name, abbreviation").in("id", teamIds) : { data: [], error: null };
  if (teamsError) throw new Error("The recap team names could not be prepared.");
  const names = new Map((teams ?? []).map((team) => [team.id, team.full_name]));
  const abbreviations = new Map((teams ?? []).map((team) => [team.id, team.abbreviation]));
  const lineByGame = new Map((lines ?? []).map((line) => [line.game_id, line]));

  const wins = new Map<string, number>();
  for (const pick of picks ?? []) if (pick.result === "win") wins.set(pick.player_id, (wins.get(pick.player_id) ?? 0) + 1);
  const survivorByEntry = new Map((survivorPicks ?? []).map((pick) => [pick.survivor_entry_id, pick.result]));
  const latest = [...survivorByEntry.values()].filter((result) => result === "win").length;
  const weeklyPicksByPlayer = new Map<string, Array<{ selected_team_id: string; result: string }>>();
  for (const pick of picks ?? []) if (pick.scoring_period_id === period.id) weeklyPicksByPlayer.set(pick.player_id, [...(weeklyPicksByPlayer.get(pick.player_id) ?? []), pick]);
  const orderByPeriod = new Map((seasonPeriods ?? []).map((item) => [item.id, item.display_order]));
  const visibleWeeks = Math.max(10, period.display_order);
  const entryById = new Map((entries ?? []).map((entry) => [entry.id, entry]));
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
    survivor: { in: (entries ?? []).filter((entry) => entry.status === "active").length, out: (entries ?? []).filter((entry) => entry.status === "eliminated").length, latest: latest ? `${latest} Survivor pick${latest === 1 ? "" : "s"} advanced` : null, visibleWeeks, rows: (players ?? []).map((player) => {
      const entry = [...entryById.values()].find((item) => item.player_id === player.id);
      const entryPicks = entry ? survivorPicksByEntry.get(entry.id) ?? [] : [];
      const byWeek = new Map(entryPicks.map((pick) => [orderByPeriod.get(pick.scoring_period_id), abbreviations.get(pick.selected_team_id) ?? "NFL"]));
      return { name: player.first_name, status: entry?.status === "eliminated" ? "OUT" : "IN", picks: Array.from({ length: visibleWeeks }, (_, index) => byWeek.get(index + 1) ?? null) };
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
  const { data: period, error: periodError } = await supabaseAdmin.from("scoring_periods").select("id").eq("status", "active").order("display_order").limit(1).maybeSingle();
  if (periodError || !period) throw new Error("An active week is not available for the game-day Slate.");
  const { data: games, error: gamesError } = await supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at").eq("scoring_period_id", period.id).order("kickoff_at");
  if (gamesError) throw new Error("Today’s Slate could not be prepared.");
  const dayGames = (games ?? []).filter((game) => easternDate(new Date(game.kickoff_at)) === day);
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
  if (error) throw new Error("The game-day Slate receipt could not be saved.");
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
    .not("status", "in", "(postponed,cancelled)")
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
  const { data: game, error: gameError } = await supabaseAdmin.from("games").select("id, away_team_id, home_team_id, kickoff_at").eq("scoring_period_id", period.id).eq("is_international", true).lte("line_lock_at", now.toISOString()).order("line_lock_at", { ascending: false }).limit(1).maybeSingle();
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
  const snapshot = await buildWeeklyRecapSnapshot();
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: new Date().toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The weekly recap receipt could not be saved.");
  return snapshot;
}
