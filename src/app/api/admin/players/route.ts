import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function verifyCommissioner(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !publishableKey) {
    return {
      error: "The server is missing required configuration.",
      status: 500,
    };
  }

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: "You must be signed in.",
      status: 401,
    };
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return {
      error: "Your sign-in session could not be verified.",
      status: 401,
    };
  }

  const { data: commissioner } = await supabaseAdmin
    .from("players")
    .select("id, first_name, is_commissioner, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    !commissioner ||
    !commissioner.active ||
    !commissioner.is_commissioner
  ) {
    return {
      error: "Commissioner access is required.",
      status: 403,
    };
  }

  return { commissioner };
}

export async function GET(request: NextRequest) {
  const verification = await verifyCommissioner(request);

  if ("error" in verification) {
    return NextResponse.json(
      { error: verification.error },
      { status: verification.status },
    );
  }

  const { data: players, error } = await supabaseAdmin
    .from("players")
    .select(
      "id, first_name, login_pin, active, is_commissioner, created_at",
    )
    .order("first_name");

  if (error) {
    return NextResponse.json(
      { error: "The player list could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    players: (players ?? []).map((player) => ({
      id: player.id,
      firstName: player.first_name,
      loginPin: player.login_pin,
      active: player.active,
      isCommissioner: player.is_commissioner,
      createdAt: player.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const verification = await verifyCommissioner(request);

  if ("error" in verification) {
    return NextResponse.json(
      { error: verification.error },
      { status: verification.status },
    );
  }

  let body: {
    firstName?: string;
    pin?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "The player information was not valid." },
      { status: 400 },
    );
  }

  const firstName = body.firstName?.trim() ?? "";
  const pin = body.pin?.trim() ?? "";

  if (
    firstName.length < 1 ||
    firstName.length > 40 ||
    !/^[A-Za-z][A-Za-z'. -]*$/.test(firstName)
  ) {
    return NextResponse.json(
      { error: "Enter the name as it should appear in the pool." },
      { status: 400 },
    );
  }

  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "The PIN must contain exactly four numbers." },
      { status: 400 },
    );
  }

  const { data: existingPlayer } = await supabaseAdmin
    .from("players")
    .select("id")
    .ilike("first_name", firstName)
    .maybeSingle();

  if (existingPlayer) {
    return NextResponse.json(
      { error: `${firstName} is already in the player list.` },
      { status: 409 },
    );
  }

  const email = `pin-${pin}@pickemjb.app`;
  const password = `pickem-${pin}`;

  const {
    data: createdAccount,
    error: accountError,
  } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (accountError || !createdAccount.user) {
    return NextResponse.json(
      {
        error:
          "That PIN is already being used. Choose a different four-digit PIN.",
      },
      { status: 409 },
    );
  }

  const authUserId = createdAccount.user.id;

  const { data: newPlayer, error: playerError } =
    await supabaseAdmin
      .from("players")
      .insert({
        first_name: firstName,
        login_pin: pin,
        auth_user_id: authUserId,
        is_commissioner: false,
        active: true,
      })
      .select(
        "id, first_name, login_pin, active, is_commissioner",
      )
      .single();

  if (playerError || !newPlayer) {
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    return NextResponse.json(
      { error: "The player could not be created." },
      { status: 500 },
    );
  }

  const { error: auditError } = await supabaseAdmin
    .from("audit_logs")
    .insert({
      actor_player_id: verification.commissioner.id,
      action: "player_created",
      entity_type: "player",
      entity_id: newPlayer.id,
      details: {
        first_name: firstName,
      },
    });

  if (auditError) {
    await supabaseAdmin
      .from("players")
      .delete()
      .eq("id", newPlayer.id);

    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    return NextResponse.json(
      {
        error:
          "The player could not be created because the action was not recorded.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      message: `${firstName} was added successfully.`,
      player: {
        id: newPlayer.id,
        firstName: newPlayer.first_name,
        loginPin: newPlayer.login_pin,
        active: newPlayer.active,
        isCommissioner: newPlayer.is_commissioner,
      },
    },
    { status: 201 },
  );
}