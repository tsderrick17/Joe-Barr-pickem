import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { lockDueLines } from "@/lib/lock-due-lines";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
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
    return NextResponse.json(
      { error: "Your sign-in session could not be verified." },
      { status: 401 },
    );
  }

  const { data: commissioner } = await supabaseAdmin
    .from("players")
    .select("id, is_commissioner, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (
    !commissioner ||
    !commissioner.active ||
    !commissioner.is_commissioner
  ) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  try {
    const result = await lockDueLines();

    const message =
      result.dueGames === 0
        ? "No games are due for official spread locking."
        : result.missingGames.length > 0
          ? `${result.lockedGames} official lines were locked. ${result.missingGames.length} games need attention.`
          : `${result.lockedGames} official lines were locked successfully.`;

    return NextResponse.json({
      message,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The official line check failed.";

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
