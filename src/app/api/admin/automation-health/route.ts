import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Run = { job_type: "line_locks" | "scores"; status: "started" | "success" | "failed"; started_at: string; completed_at: string | null; error_message: string | null };

async function requireCommissioner(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !key || !authorization?.startsWith("Bearer ")) return false;
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const { data: player } = await supabaseAdmin.from("players").select("active, is_commissioner").eq("auth_user_id", user.id).maybeSingle();
  return Boolean(player?.active && player.is_commissioner);
}

function latestByJob(runs: Run[], job: Run["job_type"]) {
  return runs.find((run) => run.job_type === job) ?? null;
}

export async function GET(request: NextRequest) {
  if (!(await requireCommissioner(request))) return NextResponse.json({ error: "Commissioner access is required." }, { status: 403 });

  const now = new Date();
  const scoreDueAt = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const [runsResult, dueGamesResult, scoreGamesResult] = await Promise.all([
    supabaseAdmin.from("sync_runs").select("job_type, status, started_at, completed_at, error_message").in("job_type", ["line_locks", "scores"]).order("started_at", { ascending: false }).limit(20),
    supabaseAdmin.from("games").select("id, kickoff_at").eq("status", "scheduled").lte("line_lock_at", now.toISOString()).gt("kickoff_at", now.toISOString()),
    supabaseAdmin.from("games").select("id").in("status", ["scheduled", "live"]).lte("kickoff_at", scoreDueAt),
  ]);
  if (runsResult.error || dueGamesResult.error || scoreGamesResult.error) return NextResponse.json({ error: "Automation health could not be prepared." }, { status: 500 });

  const dueIds = (dueGamesResult.data ?? []).map((game) => game.id);
  const { data: lines, error: linesError } = dueIds.length ? await supabaseAdmin.from("game_lines").select("game_id").in("game_id", dueIds) : { data: [], error: null };
  if (linesError) return NextResponse.json({ error: "Automation health could not verify official lines." }, { status: 500 });

  const runs = (runsResult.data ?? []) as Run[];
  const latestLocks = latestByJob(runs, "line_locks");
  const latestScores = latestByJob(runs, "scores");
  const lockedIds = new Set((lines ?? []).map((line) => line.game_id));
  const missingOfficialLines = dueIds.filter((id) => !lockedIds.has(id)).length;
  const scoreCandidates = (scoreGamesResult.data ?? []).length;
  const problems: string[] = [];
  if (latestLocks?.status === "failed") problems.push("The most recent official-line lock failed.");
  if (latestScores?.status === "failed") problems.push("The most recent final-score sync failed.");
  if (missingOfficialLines) problems.push(`${missingOfficialLines} game${missingOfficialLines === 1 ? " is" : "s are"} past line lock without an official line.`);
  if (scoreCandidates && (!latestScores || latestScores.status !== "success" || now.getTime() - new Date(latestScores.completed_at ?? latestScores.started_at).getTime() > 30 * 60 * 1000)) problems.push("Final-score sync is stale while games are awaiting review.");

  return NextResponse.json({ checkedAt: now.toISOString(), status: problems.length ? "attention" : "healthy", problems, latestLocks, latestScores, missingOfficialLines, scoreCandidates });
}
