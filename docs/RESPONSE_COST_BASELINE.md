# Player-response cost baseline

> **Update, October 7, 2026.** The route-level measurement this document called for now exists: see
> "Route-read baseline and budgets" below. The shaping baseline further down is kept as it was.

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

| Scenario | Inputs | Standings fragment | Slate fragment |
| --- | --- | ---: | ---: |
| Early regular | 11 players, 16 games, 66 season picks, no started games | 4,162 B | 8,372 B |
| Late regular | 11 players, 16 games, 374 season picks, 8 started games | 4,406 B | 8,688 B |
| Playoff round | 11 players, 6 games, 462 season picks, 3 started games | 10,781 B | 3,563 B |

One Windows/Node 22 run measured median per-call times of 0.056/0.018 ms
(Standings/Slate) early, 0.059/0.027 ms late, and 0.165/0.018 ms in the playoff
scenario. These are local shaping costs, not promises about another machine.
The playoff Standings fragment grows because every player has six current-round
picks. Input/output row counts and byte sizes are the reproducible comparison;
time should be compared across repeated runs on the same machine.

## What is still required for a route-cost baseline

The code path is broader than its shaper. `/api/home` reads the current season,
scoring periods, roster, games, picks, lines, Survivor records, and championship
history before shaping. `/api/board` additionally has conditional bootstrap,
started-game disclosure, playoff eligibility, and Survivor branches.
`/api/admin/grading-dashboard` reads several operational sources and is not
represented by this script. Counting `.from()` calls in source would not be a
true request count: branches, pagination, retries, and RPCs vary by state.

The next measurement must run against the confirmed `isolated-test` project
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

## Route-read baseline and budgets

`npm run measure:routes` runs the **real** `/api/home` and `/api/board?bootstrap=1` handlers against fictional,
season-sized fixtures (11 players, 16 games a week, two picks a player a week, 18 regular weeks and four playoff
rounds) and an in-memory stand-in for the database. It counts each read's database requests, rows, bytes read from
the database, and response bytes. It needs no credentials, touches no real data, and is deterministic, so it runs in
`npm test`. Wall-clock time is **not** measured (a fake database has no network); latency is reported below from
read-only samples of public endpoints and is never a gate.

| Read | Requests | Rows | Database bytes | Response bytes |
| --- | ---: | ---: | ---: | ---: |
| `/api/home`, week 3 | 13 | 214 | 19,286 | 7,741 |
| `/api/home`, week 16 | 13 | 461 | 27,834 | 7,752 |
| `/api/home`, divisional round | 16 | 554 | 36,305 | 14,360 |
| `/api/home`, week 16, three prior seasons on file | 13 | 461 | 27,834 | 7,752 |
| `/api/board` (bootstrap), week 3 | 15 | 178 | 19,294 | 12,366 |
| `/api/board` (bootstrap), week 16 | 15 | 178 | 19,387 | 12,384 |
| `/api/board` (bootstrap), divisional round | 15 | 157 | 15,693 | 7,339 |
| `/api/board` (bootstrap), week 16, three prior seasons on file | 15 | 178 | 19,387 | 12,384 |

What the numbers say:

- **The Standings read used to load the whole season's picks** (352 rows and about 64 KB at week 16, most of its
  database traffic, for an 8 KB response). It now reads this week's picks in full and only the winning picks' player
  ids for the season totals: at week 16 the database bytes fell from 77,570 to 27,834 (about 64% less), the divisional
  round from 95,726 to 36,305, with one more request and an identical response. The remaining weight is mostly the
  current week's picks and the Survivor and history reads.
- **History is already scoped.** Three prior seasons on file add nothing to either read.
- **Request counts are modest and flat** (12 to 15 a read) and do not grow through the season.
- A player's read makes no write beyond the existing activity timestamp.

`test/route-cost-budgets.json` holds a ceiling for each read (these numbers plus 15%). `test/route-cost.test.mjs`
fails a pull request that exceeds one, and also guards that history stays scoped. To raise a ceiling on purpose, edit
the file in the same pull request and say why in the decision log. An optimization should tighten them (the Standings
read's change did).

### Production observation (October 7, 2026, read-only)

Five sequential requests each to two public endpoints from one machine: `/api/health` answered in 0.26 to 0.46 s
(median 0.41 s, 54 bytes) and `/login` in 0.07 to 0.19 s (median 0.09 s, 12,882 bytes). These include the network
from one location and say nothing about the signed-in routes, which need a player session. No production fixture,
write or real delivery was used. Vercel usage (invocations, CPU, egress) is not read here; compare it over equivalent
game-activity windows from the Vercel dashboard when judging an optimization.

### Not measured yet

Worker costs (score sync, line lock, reminders, Bowl sync) and the Commissioner grading dashboard are not in this
baseline: the workers talk to outside providers, and the dashboard needs a larger fake-database surface. Add them
the same way when one of them is the next thing to optimize.
