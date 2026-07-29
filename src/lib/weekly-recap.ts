import { supabaseAdmin } from "@/lib/supabase-admin";

export type WeeklyRecapSnapshot = {
  kind: "weekly_recap";
  week: string;
  generatedAt: string;
  games: Array<{ away: string; home: string; awayScore: number; homeScore: number; favorite: "away" | "home"; spread: number }>;
  standings: Array<{ name: string; wins: number }>;
  survivor: { in: number; out: number; latest: string | null };
};

export type GameDaySlateSnapshot = {
  kind: "game_day";
  day: string;
  generatedAt: string;
  games: Array<{ time: string; away: string; home: string; favorite: "away" | "home"; spread: number }>;
};

export async function buildWeeklyRecapSnapshot(): Promise<WeeklyRecapSnapshot> {
  const { data: period, error: periodError } = await supabaseAdmin
    .from("scoring_periods")
    .select("id, season_id, display_name")
    .eq("status", "complete")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (periodError || !period) throw new Error("A completed week is not available for the recap.");

  const { data: seasonPeriods, error: seasonPeriodsError } = await supabaseAdmin.from("scoring_periods").select("id").eq("season_id", period.season_id);
  if (seasonPeriodsError) throw new Error("Season records could not be prepared for the recap.");
  const seasonPeriodIds = (seasonPeriods ?? []).map((item) => item.id);
  const [{ data: games, error: gamesError }, { data: lines, error: linesError }, { data: players, error: playersError }, { data: picks, error: picksError }, { data: entries, error: entriesError }, { data: survivorPicks, error: survivorPicksError }] = await Promise.all([
    supabaseAdmin.from("games").select("id, away_team_id, home_team_id, away_score, home_score").eq("scoring_period_id", period.id).eq("status", "final").order("kickoff_at"),
    supabaseAdmin.from("game_lines").select("game_id, favorite_team_id, locked_spread"),
    supabaseAdmin.from("players").select("id, first_name").eq("active", true),
    seasonPeriodIds.length ? supabaseAdmin.from("picks").select("player_id, result, scoring_period_id").in("scoring_period_id", seasonPeriodIds).neq("result", "void") : Promise.resolve({ data: [], error: null }),
    supabaseAdmin.from("survivor_entries").select("id, status").eq("season_id", period.season_id),
    supabaseAdmin.from("survivor_picks").select("survivor_entry_id, result").eq("scoring_period_id", period.id).neq("result", "void"),
  ]);
  if (gamesError || linesError || playersError || picksError || entriesError || survivorPicksError) throw new Error("The completed-week recap could not be prepared.");

  const teamIds = [...new Set((games ?? []).flatMap((game) => [game.away_team_id, game.home_team_id]))];
  const { data: teams, error: teamsError } = teamIds.length ? await supabaseAdmin.from("teams").select("id, full_name").in("id", teamIds) : { data: [], error: null };
  if (teamsError) throw new Error("The recap team names could not be prepared.");
  const names = new Map((teams ?? []).map((team) => [team.id, team.full_name]));
  const lineByGame = new Map((lines ?? []).map((line) => [line.game_id, line]));

  const wins = new Map<string, number>();
  for (const pick of picks ?? []) if (pick.result === "win") wins.set(pick.player_id, (wins.get(pick.player_id) ?? 0) + 1);
  const survivorByEntry = new Map((survivorPicks ?? []).map((pick) => [pick.survivor_entry_id, pick.result]));
  const latest = [...survivorByEntry.values()].filter((result) => result === "win").length;

  return {
    kind: "weekly_recap",
    week: period.display_name,
    generatedAt: new Date().toISOString(),
    games: (games ?? []).filter((game) => Number.isInteger(game.away_score) && Number.isInteger(game.home_score)).map((game) => {
      const line = lineByGame.get(game.id);
      return { away: names.get(game.away_team_id) ?? "Away", home: names.get(game.home_team_id) ?? "Home", awayScore: game.away_score!, homeScore: game.home_score!, favorite: line?.favorite_team_id === game.home_team_id ? "home" : "away", spread: Number(line?.locked_spread ?? 0) };
    }),
    standings: (players ?? []).map((player) => ({ name: player.first_name, wins: wins.get(player.id) ?? 0 })).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name)),
    survivor: { in: (entries ?? []).filter((entry) => entry.status === "active").length, out: (entries ?? []).filter((entry) => entry.status === "eliminated").length, latest: latest ? `${latest} Survivor pick${latest === 1 ? "" : "s"} advanced` : null },
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

export async function ensureWeeklyRecapSnapshot(reminderId: string, existing: unknown) {
  if (existing && typeof existing === "object") return existing as WeeklyRecapSnapshot;
  const snapshot = await buildWeeklyRecapSnapshot();
  const { error } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: new Date().toISOString() }).eq("id", reminderId);
  if (error) throw new Error("The weekly recap receipt could not be saved.");
  return snapshot;
}
