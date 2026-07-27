import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { syncFinalScores } from "@/lib/sync-final-scores";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function requireCommissioner(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");

  if (!supabaseUrl || !publishableKey || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: { user } } = await authClient.auth.getUser();

  if (!user) return false;

  const { data: player } = await supabaseAdmin
    .from("players")
    .select("is_commissioner, active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return Boolean(player?.active && player.is_commissioner);
}

export async function POST(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  try {
    const result = await syncFinalScores();
    return NextResponse.json({
      message:
        result.weekRollover.action === "completed"
          ? "Weekly handoff completed."
          : result.weekRollover.action === "activated"
            ? `${result.weekRollover.currentWeek} is now active.`
            : result.providerChecked
              ? "Final score check completed."
              : "No games are ready for a final score check yet.",
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The final score check failed." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) {
    return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });
  }

  const { data: latestRun, error } = await supabaseAdmin
    .from("sync_runs")
    .select("status, started_at, completed_at, details, error_message")
    .eq("job_type", "scores")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "The latest score check could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ latestRun });
}
