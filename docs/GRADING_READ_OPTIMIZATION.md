# Grading dashboard selected-period read

Prepared October 5, 2026 from `main` at `f0a529a`. This is a narrow request-count
change, not a measured latency or Vercel CPU improvement.

## Before and after

The selected-period branch of
[`/api/admin/grading-dashboard`](../src/app/api/admin/grading-dashboard/route.ts)
previously read `games` twice: a full selected-period row query and a second
ID-only query used to form the `game_lines` filter. The line query itself was
also issued once. The two `games` queries named the same scoring period.

| Selected-period query | Before | After |
| --- | ---: | ---: |
| Full `games` rows | 1 | 1 |
| ID-only `games` rows | 1 | 0 |
| `game_lines` by those IDs | 1 | 1 |

[`readGradingGamesAndLines`](../src/lib/grading-dashboard-reads.js) normalizes
the full game query to one promise. The dashboard consumes that same result and
the line query depends on its IDs. Unrelated dashboard reads remain in the
parallel batch. Empty or failed game reads still pass an empty ID list to the
line query; the route's existing error check still rejects a failed game read.

The before/after counts above follow from the route's query shape and an
executable one-read test with a controlled client. They are **not** a database
trace. No production traffic, personal data, or provider credits were used.
Full-route DB request counts, rows, response bytes, cold/warm cache latency,
and Vercel active CPU remain unmeasured. Capture those in `isolated-test` before
claiming a wider cost reduction or setting a numeric budget.

## Verification and recovery

- The helper test confirms one game read and one line read, ordered game IDs,
  and unchanged empty/error input handling. The route wiring test guards
  against restoring the duplicate query.
- Run the normal application gate and isolated Commissioner flow before merge.
  The dashboard remains read-only; no migration or provider call changes.
- If the deployed view regresses, revert this application change through the
  reviewed release path. No data repair is required.
