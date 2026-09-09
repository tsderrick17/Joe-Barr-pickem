import { bowlRecapCopy } from "@/lib/bowl-recap-copy.js";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type BowlDailyRecapSnapshot = {
  kind: "bowl_daily_recap";
  day: string;
  games: Array<{ name: string; favorite: string; underdog: string; line: string; favoriteScore: number | null; underdogScore: number | null; status: string }>;
  rows: Array<{ name: string; wins: number; results: string[] }>;
  eliminatedToday: string[];
  remaining: number;
  championsCrowned: string[];
  copy: string;
};

type PlayerName = { first_name: string | null; last_name: string | null } | null;
type BowlEntry = { id: string; player_id: string; players: PlayerName };
type BowlGame = { id: string; season_id: string; bowl_name: string; kickoff_at: string; status: string; away_score: number | null; home_score: number | null; away_team_id: string | null; home_team_id: string | null; away: { short_name: string | null } | null; home: { short_name: string | null } | null; bowl_pool_game_lines: { favorite_team_id: string | null; locked_spread: number | null }[] | null };
type BowlChampion = { player_id: string; players: PlayerName };

function lineText(value: number | null) { return value === null ? "—" : value === 0 ? "PK" : `-${value}`; }

export async function ensureBowlDailyRecapSnapshot(reminderId: string, current: unknown): Promise<BowlDailyRecapSnapshot> {
  if (current && typeof current === "object" && "kind" in current && current.kind === "bowl_daily_recap") return current as BowlDailyRecapSnapshot;
  const { data: reminder, error: reminderError } = await supabaseAdmin.from("push_reminders")
    .select("source_game_ids").eq("id", reminderId).maybeSingle();
  if (reminderError || !reminder?.source_game_ids?.length) throw new Error("Bowl recap games could not be identified.");
  const gameIds = reminder.source_game_ids as string[];
  const { data: games, error: gameError } = await supabaseAdmin.from("bowl_pool_games")
    .select("id, season_id, bowl_name, kickoff_at, status, away_score, home_score, away_team_id, home_team_id, away:bowl_pool_teams!bowl_pool_games_away_team_id_fkey(short_name), home:bowl_pool_teams!bowl_pool_games_home_team_id_fkey(short_name), bowl_pool_game_lines(favorite_team_id, locked_spread)")
    .in("id", gameIds);
  if (gameError || !(games ?? []).length) throw new Error("Bowl recap results could not be read.");
  const seasonId = games![0].season_id as string;
  const [{ data: entries, error: entryError }, { data: results, error: resultError }, { data: champions, error: championError }, { data: seasonGames, error: seasonGamesError }, { data: priorRecaps, error: priorRecapError }] = await Promise.all([
    supabaseAdmin.from("bowl_pool_entries").select("id, player_id, players(first_name, last_name)").eq("season_id", seasonId).in("status", ["active", "complete"]),
    supabaseAdmin.from("bowl_pool_game_results").select("entry_id, game_id, result"),
    supabaseAdmin.from("bowl_pool_championships").select("player_id, players(first_name, last_name)").eq("season_id", seasonId),
    supabaseAdmin.from("bowl_pool_games").select("id,status").eq("season_id", seasonId),
    supabaseAdmin.from("push_reminders").select("id, source_game_ids, recap_snapshot").eq("category", "bowl_daily_recap").neq("id", reminderId).not("recap_snapshot", "is", null),
  ]);
  if (entryError || resultError || championError || seasonGamesError || priorRecapError) throw new Error("Bowl recap standings could not be read.");
  const resultsByEntry = new Map<string, Map<string, string>>();
  for (const result of results ?? []) {
    const entryResults = resultsByEntry.get(result.entry_id) ?? new Map<string, string>();
    entryResults.set(result.game_id, result.result); resultsByEntry.set(result.entry_id, entryResults);
  }
  const rows = ((entries ?? []) as unknown as BowlEntry[]).map((entry) => {
    const entryResults = resultsByEntry.get(entry.id) ?? new Map<string, string>();
    const all = [...entryResults.values()];
    return { name: [entry.players?.first_name, entry.players?.last_name].filter(Boolean).join(" ") || "Player", wins: all.filter((result) => result === "win").length, results: gameIds.map((id) => entryResults.get(id) === "win" ? "W" : entryResults.get(id) === "loss" ? "L" : "—") };
  }).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  const gamesView = (games! as unknown as BowlGame[]).map((game) => {
    const line = Array.isArray(game.bowl_pool_game_lines) ? game.bowl_pool_game_lines[0] : game.bowl_pool_game_lines;
    const favoriteAway = line?.favorite_team_id && line.favorite_team_id === game.away_team_id;
    const favorite = favoriteAway ? game.away?.short_name : game.home?.short_name;
    const underdog = favoriteAway ? game.home?.short_name : game.away?.short_name;
    return { name: game.bowl_name, favorite: favorite ?? "TBD", underdog: underdog ?? "TBD", line: lineText(line?.locked_spread ?? null), favoriteScore: favoriteAway ? game.away_score : game.home_score, underdogScore: favoriteAway ? game.home_score : game.away_score, status: game.status };
  });
  const championsCrowned = ((champions ?? []) as unknown as BowlChampion[]).map((champion) => [champion.players?.first_name, champion.players?.last_name].filter(Boolean).join(" ")).filter(Boolean);
  const leaderWins = rows[0]?.wins ?? 0;
  const remainingGames = (seasonGames ?? []).filter((game) => !["final", "cancelled", "no_contest"].includes(game.status)).length;
  const seasonGameIds = new Set((seasonGames ?? []).map((game) => game.id));
  const previouslyEliminated = new Set<string>((priorRecaps ?? []).filter((recap) => (recap.source_game_ids ?? []).some((id: string) => seasonGameIds.has(id))).flatMap((recap) => {
    const snapshot = recap.recap_snapshot as { eliminatedToday?: unknown } | null;
    return Array.isArray(snapshot?.eliminatedToday) ? snapshot.eliminatedToday.filter((name): name is string => typeof name === "string") : [];
  }));
  const eliminatedToday = rows.filter((row) => row.wins + remainingGames < leaderWins && !previouslyEliminated.has(row.name)).map((row) => row.name);
  const recapText = bowlRecapCopy({ eliminated: eliminatedToday, remaining: rows.length - eliminatedToday.length, champions: championsCrowned } as { eliminated: string[]; remaining: number; champions: string[] });
  const snapshot: BowlDailyRecapSnapshot = { kind: "bowl_daily_recap", day: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date((games![0] as unknown as BowlGame).kickoff_at)), games: gamesView, rows, eliminatedToday, remaining: rows.length - eliminatedToday.length, championsCrowned, copy: recapText };
  const { error: updateError } = await supabaseAdmin.from("push_reminders").update({ recap_snapshot: snapshot, recap_snapshot_at: new Date().toISOString() }).eq("id", reminderId);
  if (updateError) throw new Error("The Bowl recap snapshot could not be preserved.");
  return snapshot;
}
