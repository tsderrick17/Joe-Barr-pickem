import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { lockDueLines } from "@/lib/lock-due-lines";
import { AutomationAlreadyRunningError, runWithAutomationLease } from "@/lib/automation-execution-lease";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireCommissioner(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !publishableKey || !authorization?.startsWith("Bearer ")) {
    return false;
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
  } = await authClient.auth.getUser();

  if (!user) return false;

  const { data: commissioner } = await supabaseAdmin
    .from("players")
    .select("id, is_commissioner, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return Boolean(
    commissioner?.active && commissioner.is_commissioner,
  );
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json(
      { error: "The server is missing required configuration." },
      { status: 500 },
    );
  }

  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  if (!(await requireCommissioner(request))) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  try {
    const result = await runWithAutomationLease("line_locks", lockDueLines);

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
    if (error instanceof AutomationAlreadyRunningError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
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

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json(
      { error: "Commissioner access is required." },
      { status: 403 },
    );
  }

  const { data: latestRun, error } = await supabaseAdmin
    .from("sync_runs")
    .select("status, started_at, completed_at, details, error_message")
    .eq("job_type", "line_locks")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "The latest official line lock could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json({ latestRun });
}
