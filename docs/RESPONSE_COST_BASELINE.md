# Player-response cost baseline

Prepared: October 5, 2026. Source baseline: `34e12ac` on `main`.

This is a deliberately limited, reproducible **response-shaping** baseline.
It uses fictional players, games, picks, and lines; it makes no network or
database request and does not touch the live pool. It is not a production
Vercel CPU measurement or a complete API-route benchmark.

Run `npm run measure:shaping` locally, or add `-- --json` for machine-readable
output. The script exercises the production `shapePadRows` and
`shapeSlateGames` functions. Each scenario has 10 warmups and nine samples of
100 calls; `medianMs` is the median per-call time. `shapedBytes` is the UTF-8
JSON size of the shaped fragment, **not** the full HTTP response. The test
checks scenario and output shape but intentionally has no wall-clock limit.
It also enforces a deterministic JSON-fragment budget of 125% of each byte
baseline below. A larger intentional response requires updating this budget
with a reason; timing remains a reported trend, not a CI threshold.

| Scenario | Inputs | Standings fragment | Slate fragment |
| --- | --- | ---: | ---: |
| Early regular | 11 players, 16 games, 66 season picks, no started games | 4,162 B | 8,372 B |
| Late regular | 11 players, 16 games, 374 season picks, 8 started games | 4,406 B | 8,688 B |
| Playoff round | 11 players, 6 games, 462 season picks, 3 started games | 10,781 B | 3,563 B |

The October 5, 2026 repeat on Windows/Node 22.23.1 measured median per-call
times of 0.053/0.018 ms (Standings/Slate) early, 0.056/0.028 ms late, and
0.167/0.018 ms in the playoff scenario. Fragment sizes matched the table
exactly. These are local shaping costs, not promises about another machine.
The playoff Standings fragment grows because every player has six current-round
picks. Input/output row counts and byte sizes are the reproducible comparison;
time should be compared across repeated runs on the same machine.

On October 6, the Pad shaper was changed from rescanning both pick lists for
each player to indexing season wins and current-week picks in one pass. A
same-session before/after sample on Windows/Node 22.23.1 measured Standings
shaping at 0.062 to 0.045 ms early, 0.060 to 0.035 ms late, and 0.161 to
0.127 ms in the playoff fixture (one prior-baseline run; three post-change
runs, with the listed post-change median). Shaped byte counts and row counts
were identical. This is an observed response-shaping improvement only; it does
not establish faster API routes or lower Vercel usage. Timings remain
non-gating.

## What is still required for a route-cost baseline

The code path is broader than its shaper. `/api/home` reads the current season,
scoring periods, roster, games, picks, lines, Survivor records, and championship
history before shaping. `/api/board` additionally has conditional bootstrap,
started-game disclosure, playoff eligibility, and Survivor branches.
`/api/admin/grading-dashboard` reads several operational sources and is not
represented by this script. Counting `.from()` calls in source would not be a
true request count: branches, pagination, retries, and RPCs vary by state.

No isolated route measurement was attempted during the October 5 repeat: this
worktree has neither `.env.test.local` nor the `PICKEM_TEST_*` environment
settings. No Supabase connection was made. The next measurement must run
against the confirmed `isolated-test` project
with disposable, non-personal fixtures. For each of early season, late regular
season, playoffs, and multiple historical seasons, capture five warm and five
cold route reads of `/api/home`, `/api/board`, and the grading dashboard:

- database request/RPC count and rows returned, including paginated reads;
- full HTTP response bytes and elapsed time;
- fixture size, cache state, Node/runtime version, and sample distribution.

Use the existing guarded isolated environment and its player/commissioner
identities. Do not collect credentials, player names, picks, or emails in the
report. Do not add a durable page-request log or production fixture. No query
optimization should claim a before/after win from the shaping numbers alone.
