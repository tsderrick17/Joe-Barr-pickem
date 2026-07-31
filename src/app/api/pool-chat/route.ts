import { NextRequest, NextResponse } from "next/server";
import { authenticatedProfilePlayer } from "@/lib/authenticated-profile-player";
import { CURRENT_SEASON_YEAR } from "@/lib/season";
import { supabaseAdmin } from "@/lib/supabase-admin";

type ChatMessageRow = {
  id: string;
  player_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
};

async function currentSeason() {
  const { data, error } = await supabaseAdmin
    .from("seasons")
    .select("id")
    .eq("year", CURRENT_SEASON_YEAR)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

async function loadMessages(seasonId: string, viewer: { id: string; is_commissioner: boolean }) {
  let query = supabaseAdmin
    .from("pool_chat_messages")
    .select("id, player_id, body, created_at, deleted_at")
    .eq("season_id", seasonId);
  if (!viewer.is_commissioner) query = query.is("deleted_at", null);
  const { data: messages, error } = await query.order("created_at", { ascending: false }).limit(50);

  if (error) return { error: true as const, messages: [] };
  const rows = (messages ?? []) as ChatMessageRow[];
  const playerIds = [...new Set(rows.map((message) => message.player_id))];
  const { data: players, error: playersError } = playerIds.length
    ? await supabaseAdmin.from("players").select("id, first_name").in("id", playerIds)
    : { data: [], error: null };

  if (playersError) return { error: true as const, messages: [] };
  const names = new Map((players ?? []).map((player) => [player.id, player.first_name]));

  return {
    error: false as const,
    messages: rows.reverse().map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.created_at,
      isDeleted: Boolean(message.deleted_at),
      playerName: names.get(message.player_id) ?? "Player",
      canDelete: !message.deleted_at && (message.player_id === viewer.id || viewer.is_commissioner),
    })),
  };
}

export async function GET(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });

  const season = await currentSeason();
  if (!season) return NextResponse.json({ error: "The current season could not be loaded." }, { status: 503 });

  const result = await loadMessages(season.id, player);
  if (result.error) return NextResponse.json({ error: "The Rail could not be loaded yet." }, { status: 503 });
  return NextResponse.json({ messages: result.messages });
}

export async function POST(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Write a message before sending." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim().replace(/\s+/g, " ") : "";
  if (!message || message.length > 280) {
    return NextResponse.json({ error: "Write a message of up to 280 characters before sending." }, { status: 400 });
  }

  const season = await currentSeason();
  if (!season) return NextResponse.json({ error: "The current season could not be loaded." }, { status: 503 });

  const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
  const { data: recentMessage, error: rateError } = await supabaseAdmin
    .from("pool_chat_messages")
    .select("id")
    .eq("season_id", season.id)
    .eq("player_id", player.id)
    .gte("created_at", tenSecondsAgo)
    .limit(1)
    .maybeSingle();

  if (rateError) return NextResponse.json({ error: "The Rail could not be reached. Please try again." }, { status: 503 });
  if (recentMessage) return NextResponse.json({ error: "Give the table a moment before sending another note." }, { status: 429 });

  const { error } = await supabaseAdmin.from("pool_chat_messages").insert({
    season_id: season.id,
    player_id: player.id,
    body: message,
  });
  if (error) return NextResponse.json({ error: "Your note could not be sent." }, { status: 503 });

  const result = await loadMessages(season.id, player);
  if (result.error) return NextResponse.json({ error: "Your note was saved, but the Rail could not refresh." }, { status: 503 });
  return NextResponse.json({ messages: result.messages });
}

export async function DELETE(request: NextRequest) {
  const player = await authenticatedProfilePlayer(request);
  if (!player) return NextResponse.json({ error: "You must be signed in as an active player." }, { status: 401 });

  let body: { messageId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "That message could not be identified." }, { status: 400 });
  }
  if (typeof body.messageId !== "string") return NextResponse.json({ error: "That message could not be identified." }, { status: 400 });

  const season = await currentSeason();
  if (!season) return NextResponse.json({ error: "The current season could not be loaded." }, { status: 503 });

  const { data: message, error: messageError } = await supabaseAdmin
    .from("pool_chat_messages")
    .select("id, player_id, deleted_at")
    .eq("id", body.messageId)
    .eq("season_id", season.id)
    .maybeSingle();
  if (messageError || !message) return NextResponse.json({ error: "That message is no longer available." }, { status: 404 });
  if (message.deleted_at) return NextResponse.json({ error: "That message has already been removed." }, { status: 409 });
  if (message.player_id !== player.id && !player.is_commissioner) return NextResponse.json({ error: "You can only remove your own messages." }, { status: 403 });

  const { error } = await supabaseAdmin
    .from("pool_chat_messages")
    .update({ deleted_at: new Date().toISOString(), deleted_by_player_id: player.id })
    .eq("id", message.id);
  if (error) return NextResponse.json({ error: "That message could not be removed." }, { status: 503 });

  const result = await loadMessages(season.id, player);
  if (result.error) return NextResponse.json({ error: "The message was removed, but chat could not refresh." }, { status: 503 });
  return NextResponse.json({ messages: result.messages });
}
