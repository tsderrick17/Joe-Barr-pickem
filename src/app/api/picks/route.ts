import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Selection = {
  gameId: string;
  teamId: string;
};

type GameRow = {
  id: string;
  scoring_period_id: string;
  away_team_id: string;
  home_team_id: string;
  line_lock_at: string;
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !supabasePublishableKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "You must be signed in to save picks." },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    scoringPeriodId?: string;
    selections?: Selection[];
  };

  const scoringPeriodId = body.scoringPeriodId;
  const selections = body.selections;

  if (!scoringPeriodId || !Array.isArray(selections)) {
    return NextResponse.json(
      { error: "Your pick submission was incomplete." },
      { status: 400 },
    );
  }

  if (selections.length < 1 || selections.length > 2) {
    return NextResponse.json(
      { error: "Choose one or two teams." },
      { status: 400 },
    );
  }

  const uniqueGameIds = new Set(selections.map((selection) => selection.gameId));

  if (uniqueGameIds.size !== selections.length) {
    return NextResponse.json(
      { error: "You may only select one team from each game." },
      { status: 400 },
    );
  }

  const authClient = createClient(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Your sign-in session could not be verified." },
      { status: 401 },
    );
  }

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("id, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!player?.active) {
    return NextResponse.json(
      { error: "Your player profile is not active in this pool." },
      { status: 403 },
    );
  }

  const { data: period } = await supabaseAdmin
    .from("scoring_periods")
    .select("max_picks")
    .eq("id", scoringPeriodId)
    .maybeSingle();

  if (!period) {
    return NextResponse.json(
      { error: "That week could not be found." },
      { status: 404 },
    );
  }

  if (selections.length > period.max_picks) {
    return NextResponse.json(
      { error: "You cannot submit more than two picks." },
      { status: 400 },
    );
  }

  const { data: existingPicks, error: existingError } = await supabaseAdmin
    .from("picks")
    .select("id, game_id, selected_team_id")
    .eq("player_id", player.id)
    .eq("scoring_period_id", scoringPeriodId);

  if (existingError) {
    return NextResponse.json(
      { error: "Your existing picks could not be loaded." },
      { status: 500 },
    );
  }

  const allGameIds = [
    ...new Set([
      ...selections.map((selection) => selection.gameId),
      ...(existingPicks ?? []).map((pick) => pick.game_id),
    ]),
  ];

  const { data: games, error: gamesError } = await supabaseAdmin
    .from("games")
    .select(
      "id, scoring_period_id, away_team_id, home_team_id, line_lock_at",
    )
    .in("id", allGameIds);

  if (gamesError || !games) {
    return NextResponse.json(
      { error: "The selected games could not be loaded." },
      { status: 500 },
    );
  }

  const gameById = new Map(
    (games as GameRow[]).map((game) => [game.id, game]),
  );

  for (const selection of selections) {
    const game = gameById.get(selection.gameId);

    if (!game || game.scoring_period_id !== scoringPeriodId) {
      return NextResponse.json(
        { error: "One of your selected games does not belong to this week." },
        { status: 400 },
      );
    }

    if (
      selection.teamId !== game.away_team_id &&
      selection.teamId !== game.home_team_id
    ) {
      return NextResponse.json(
        { error: "One of your selected teams does not belong to that game." },
        { status: 400 },
      );
    }

    if (new Date() >= new Date(game.line_lock_at)) {
      return NextResponse.json(
        { error: "One of your selected games is already locked." },
        { status: 400 },
      );
    }
  }

  const lockedExistingPicks = (existingPicks ?? []).filter((pick) => {
    const game = gameById.get(pick.game_id);
    return game && new Date() >= new Date(game.line_lock_at);
  });

  for (const lockedPick of lockedExistingPicks) {
    const matchingSelection = selections.find(
      (selection) =>
        selection.gameId === lockedPick.game_id &&
        selection.teamId === lockedPick.selected_team_id,
    );

    if (!matchingSelection) {
      return NextResponse.json(
        {
          error:
            "One of your existing picks is already locked and cannot be changed or removed.",
        },
        { status: 400 },
      );
    }
  }

  const unlockedExistingPickIds = (existingPicks ?? [])
    .filter((pick) => !lockedExistingPicks.some((locked) => locked.id === pick.id))
    .map((pick) => pick.id);

  if (unlockedExistingPickIds.length) {
    const { error: deleteError } = await supabaseAdmin
      .from("picks")
      .delete()
      .in("id", unlockedExistingPickIds);

    if (deleteError) {
      return NextResponse.json(
        { error: "Your previous picks could not be updated." },
        { status: 500 },
      );
    }
  }

  const picksToInsert = selections
    .filter(
      (selection) =>
        !lockedExistingPicks.some(
          (lockedPick) =>
            lockedPick.game_id === selection.gameId &&
            lockedPick.selected_team_id === selection.teamId,
        ),
    )
    .map((selection) => ({
      player_id: player.id,
      scoring_period_id: scoringPeriodId,
      game_id: selection.gameId,
      selected_team_id: selection.teamId,
    }));

  if (picksToInsert.length) {
    const { error: insertError } = await supabaseAdmin
      .from("picks")
      .insert(picksToInsert);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 400 },
      );
    }
  }

const message =
  selections.length === 1
    ? "Your first pick has been saved."
    : "Your two picks have been saved.";

  return NextResponse.json({ message });
}