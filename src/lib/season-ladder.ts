import type { SupabaseClient } from "@supabase/supabase-js";

export type SeasonLadder = { counts: Map<number, number>; runs: number; since: string | null };

/**
 * Every fresh final the score worker recorded on a retry rung, from `since`
 * (optionally up to `until`). Reads only score runs that recorded a rung, and
 * only the rung counts, in pages, so the whole season is covered however many
 * runs there are. A run counts toward coverage only if it actually found a final.
 */
export async function loadSeasonLadder(client: SupabaseClient, since: string, until?: string): Promise<SeasonLadder> {
  const counts = new Map<number, number>();
  let runs = 0;
  let first: string | null = null;
  for (let offset = 0; ; offset += 1000) {
    let query = client.from("sync_runs")
      .select("started_at, ladder:details->ladderRungs")
      .eq("job_type", "scores").not("details->ladderRungs", "is", null)
      .gte("started_at", since);
    if (until) query = query.lt("started_at", until);
    const { data, error } = await query
      .order("started_at", { ascending: true }).order("id", { ascending: true })
      .range(offset, offset + 999);
    if (error) throw error;
    for (const run of data ?? []) {
      const rungs = run.ladder;
      if (!rungs || typeof rungs !== "object" || Array.isArray(rungs)) continue;
      let foundFinals = false;
      for (const [rung, count] of Object.entries(rungs as Record<string, unknown>)) {
        const rungNumber = Number(rung);
        const rungCount = Number(count);
        if (Number.isInteger(rungNumber) && rungNumber > 0 && Number.isFinite(rungCount) && rungCount > 0) {
          counts.set(rungNumber, (counts.get(rungNumber) ?? 0) + rungCount);
          foundFinals = true;
        }
      }
      if (foundFinals) { runs += 1; first ??= run.started_at; }
    }
    if ((data ?? []).length < 1000) break;
  }
  return { counts, runs, since: first };
}
