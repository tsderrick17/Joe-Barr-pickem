import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { prepareAtsReplacements } from "@/lib/slate-submission";
import { loadPlayoffEligibility } from "@/lib/playoff-eligibility";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { voidDisruptedPicks } from "@/lib/void-disrupted-picks";
import { recordPlayerActivity } from "@/lib/player-activity";

type Selection = { gameId: string; teamId: string };
type GameRow = { id: string; scoring_period_id: string; away_team_id: string; home_team_id: string; kickoff_at: string; status: string };

function pickSaveMessage(selectionCount: number) {
  return selectionCount === 0 ? "Your unlocked selections have been cleared."
    : selectionCount === 1 ? "Your first pick has been saved."
    : `Your ${selectionCount} picks have been saved.`;
}

export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key) return NextResponse.json({ error: "The server is missing required configuration." }, { status: 500 });
  if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "You must be signed in to save picks." }, { status: 401 });
  try {
    await voidDisruptedPicks();
  } catch {
    return NextResponse.json({ error: "Disrupted-game checks could not be completed." }, { status: 503 });
  }

  let body: {
    scoringPeriodId?: string;
    selections?: Selection[];
    survivorSelection?: Selection | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "Your pick submission was incomplete." },
      { status: 400 },
    );
  }
  const scoringPeriodId = body.scoringPeriodId;
  const selections = body.selections;
  const includesSurvivor = Object.hasOwn(body, "survivorSelection");
  if (!scoringPeriodId || !Array.isArray(selections)) return NextResponse.json({ error: "Your pick submission was incomplete." }, { status: 400 });
  if (new Set(selections.map((selection) => selection.gameId)).size !== selections.length) return NextResponse.json({ error: "You may only select one team from each game." }, { status: 400 });

  const authClient = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await authClient.auth.getUser(
    authorization.slice("Bearer ".length),
  );
  if (!user) return NextResponse.json({ error: "Your sign-in session could not be verified." }, { status: 401 });

  const { data: player } = await supabaseAdmin.from("players").select("id, active").eq("auth_user_id", user.id).maybeSingle();
  if (!player?.active) return NextResponse.json({ error: "Your player profile is not active in this Pick'em." }, { status: 403 });
  await recordPlayerActivity(player.id);

  const { data: period } = await supabaseAdmin.from("scoring_periods").select("max_picks, season_id, status, period_type").eq("id", scoringPeriodId).maybeSingle();
  if (!period) return NextResponse.json({ error: "That week could not be found." }, { status: 404 });
  if (period.status === "complete") return NextResponse.json({ error: "This completed week is read-only." }, { status: 400 });
  if (selections.length > period.max_picks) return NextResponse.json({ error: `You cannot submit more than ${period.max_picks} picks for this scoring period.` }, { status: 400 });
  const { error: pickWindowError } = await supabaseAdmin.rpc(
    "assert_scoring_period_accepts_picks",
    { target_scoring_period_id: scoringPeriodId },
  );
  if (pickWindowError) {
    return NextResponse.json(
      { error: "That Slate is not open for selections yet." },
      { status: 400 },
    );
  }

  if (period.period_type === "playoff" && period.status === "active") {
    const { data: activePlayers, error: activePlayersError } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("active", true);
    if (activePlayersError || !activePlayers) return NextResponse.json({ error: "Playoff eligibility could not be verified safely." }, { status: 503 });
    try {
      const eligibility = await loadPlayoffEligibility(period.season_id, scoringPeriodId, activePlayers);
      if (eligibility.eliminatedPlayerIds.has(player.id)) {
        return NextResponse.json({ error: "You are mathematically eliminated from the playoff race. Your existing selections remain available for audit." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Playoff eligibility could not be verified safely." }, { status: 503 });
    }
  }

  const { data: existingPicks, error: existingError } = await supabaseAdmin.from("picks").select("id, game_id, selected_team_id").eq("player_id", player.id).eq("scoring_period_id", scoringPeriodId).neq("result", "void");
  if (existingError) return NextResponse.json({ error: "Your existing picks could not be loaded." }, { status: 500 });

  const survivorSelection = body.survivorSelection;
  const gameIds = [...new Set([...selections.map((selection) => selection.gameId), ...(existingPicks ?? []).map((pick) => pick.game_id), ...(survivorSelection ? [survivorSelection.gameId] : [])])];
  const { data: games, error: gamesError } = await supabaseAdmin.from("games").select("id, scoring_period_id, away_team_id, home_team_id, kickoff_at, status").in("id", gameIds);
  if (gamesError || !games) return NextResponse.json({ error: "The selected games could not be loaded." }, { status: 500 });
  const gameById = new Map((games as GameRow[]).map((game) => [game.id, game]));

  if (selections.some((selection) => gameById.get(selection.gameId)?.scoring_period_id !== scoringPeriodId)) {
    return NextResponse.json({ error: "One of your selected games does not belong to this week." }, { status: 400 });
  }
  const submittedGameIds = new Set([
    ...selections.map((selection) => selection.gameId),
    ...(survivorSelection ? [survivorSelection.gameId] : []),
  ]);
  if ([...submittedGameIds].some((gameId) => gameById.get(gameId)?.status !== "scheduled")) {
    return NextResponse.json(
      { error: "One of those games is no longer open for selections." },
      { status: 400 },
    );
  }
  const preparedPicks = prepareAtsReplacements({ selections, existingPicks: existingPicks ?? [], games: games as GameRow[] });
  if (preparedPicks.error) return NextResponse.json({ error: preparedPicks.error }, { status: 400 });
  const picksToInsert = preparedPicks.replacements ?? [];

  if (!includesSurvivor) {
    const { error } = await supabaseAdmin.rpc("replace_unlocked_picks", { target_player_id: player.id, target_scoring_period_id: scoringPeriodId, replacement_picks: picksToInsert });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: pickSaveMessage(selections.length) });
  }

  const ensured = await supabaseAdmin.rpc("ensure_survivor_entries", { target_season_id: period.season_id });
  if (ensured.error) return NextResponse.json({ error: "Survivor entries could not be prepared." }, { status: 500 });
  const { data: entry, error: entryError } = await supabaseAdmin.from("survivor_entries").select("id, status").eq("player_id", player.id).eq("season_id", period.season_id).maybeSingle();
  if (entryError || !entry) return NextResponse.json({ error: "Your Survivor entry could not be loaded." }, { status: 500 });
  if (survivorSelection && entry.status !== "active") return NextResponse.json({ error: "Your Survivor entry is no longer active." }, { status: 400 });

  const { data: existingSurvivor, error: survivorError } = await supabaseAdmin.from("survivor_picks").select("game_id, selected_team_id").eq("survivor_entry_id", entry.id).eq("scoring_period_id", scoringPeriodId).neq("result", "void").maybeSingle();
  if (survivorError) return NextResponse.json({ error: "Your existing Survivor pick could not be loaded." }, { status: 500 });
  const existingSurvivorGame = existingSurvivor ? gameById.get(existingSurvivor.game_id) : undefined;
  const { data: survivorGameOutsideSelections, error: survivorGameError } = existingSurvivor && !existingSurvivorGame
    ? await supabaseAdmin.from("games").select("id, scoring_period_id, away_team_id, home_team_id, kickoff_at").eq("id", existingSurvivor.game_id).maybeSingle()
    : { data: null, error: null };
  if (survivorGameError) return NextResponse.json({ error: "Your existing Survivor game could not be loaded." }, { status: 500 });
  const survivorGame = existingSurvivorGame ?? survivorGameOutsideSelections;
  const survivorLocked = Boolean(survivorGame && new Date() >= new Date(survivorGame.kickoff_at));
  const survivorMatchesLocked = survivorSelection?.gameId === existingSurvivor?.game_id && survivorSelection?.teamId === existingSurvivor?.selected_team_id;
  const survivorChanged = survivorSelection?.gameId !== existingSurvivor?.game_id || survivorSelection?.teamId !== existingSurvivor?.selected_team_id;
  if (survivorLocked && !survivorMatchesLocked) return NextResponse.json({ error: "Your Survivor pick has already started and cannot be changed or removed." }, { status: 400 });

  let survivorPickToInsert: { game_id: string; selected_team_id: string } | null = null;
  if (survivorSelection && !survivorLocked) {
    const game = gameById.get(survivorSelection.gameId);
    if (!game || game.scoring_period_id !== scoringPeriodId) return NextResponse.json({ error: "Your Survivor team must play in this week." }, { status: 400 });
    if (survivorSelection.teamId !== game.away_team_id && survivorSelection.teamId !== game.home_team_id) return NextResponse.json({ error: "Your Survivor team does not belong to that game." }, { status: 400 });
    if (new Date() >= new Date(game.kickoff_at)) return NextResponse.json({ error: "That Survivor game has already started." }, { status: 400 });
    survivorPickToInsert = { game_id: survivorSelection.gameId, selected_team_id: survivorSelection.teamId };
  }

  const { error } = await supabaseAdmin.rpc("save_slate_selections", {
    target_player_id: player.id,
    target_survivor_entry_id: entry.id,
    target_scoring_period_id: scoringPeriodId,
    replacement_picks: picksToInsert,
    replacement_survivor_pick: survivorPickToInsert,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!survivorChanged) return NextResponse.json({ message: pickSaveMessage(selections.length) });

  const survivorMessage = survivorSelection
    ? "Your straight-up Survivor pick has been saved."
    : "Your Survivor pick has been cleared.";
  return NextResponse.json({ message: `${pickSaveMessage(selections.length)} ${survivorMessage}` });
}
