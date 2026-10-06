# Application architecture and measurement map

Verified from `main` at `f0a529a` on October 5, 2026. This map is a guide to
ownership and request boundaries, not a replacement for
[PROJECT_REFERENCE.md](PROJECT_REFERENCE.md), current migrations, or tests.
Paths and conditional requests may change; recheck the code before making a
performance or security decision.

## The main flows

| Flow | Entry and orchestration | Decision / privacy boundary | Durable authority |
| --- | --- | --- | --- |
| Standings and Pick'em Pad | [`/api/home`](../src/app/api/home/route.ts) uses the request-scoped [`authenticateActivePlayer`](../src/lib/authenticate-active-player.ts) result (including the viewer's preferences in that same profile read), then reads the current season, periods, players, picks, games, lines, championships, and conditional Survivor data. | [`home-shape.ts`](../src/lib/home-shape.ts) counts wins and reveals the viewer's own picks, but another player's pick only after that game's kickoff. | Games, picks, lines, periods, and championships in current database migrations. |
| The Slate | [`/api/board`](../src/app/api/board/route.ts) authenticates through request-scoped [`authenticateActivePlayer`](../src/lib/authenticate-active-player.ts), then resolves the requested/default week and reads games, the viewer's saved picks, players, lines, and conditional Survivor state. | [`slate-shape.ts`](../src/lib/slate-shape.ts) exposes named public pickers only for started games. [`slate-view.ts`](../src/lib/slate-view.ts) owns page-side selection decisions. | Period/game pins and saved selections in the database. |
| Pick save | [`/api/picks`](../src/app/api/picks/route.ts) validates the shared [`PickSaveRequest`](../src/lib/api-contracts.ts), then uses request-scoped [`authenticateActivePlayer`](../src/lib/authenticate-active-player.ts) before checking week, eligibility, existing picks, and selected games. | [`slate-submission.js`](../src/lib/slate-submission.js) builds the same request contract and prepares ATS replacements; the route distinguishes omitted Survivor input from a requested Survivor change and preserves access failure codes. | Atomic `replace_unlocked_picks` or `save_slate_selections` RPCs, plus database kickoff and integrity guards. |
| Survivor | [`/api/survivor`](../src/app/api/survivor/route.ts) uses request-scoped [`authenticateActivePlayer`](../src/lib/authenticate-active-player.ts) for both reads and saves and records player activity only after access succeeds. | The selected period and entry status are loaded after authorization; auth errors keep stable status codes and distinguish service outages from sign-in failures. | Survivor entries and picks, with `replace_unlocked_survivor_pick` enforcing kickoff and team-reuse rules. |
| Bowl Pool | [`/api/bowl-pool`](../src/app/api/bowl-pool/route.ts) uses the request-scoped [`authenticateActivePlayer`](../src/lib/authenticate-active-player.ts) result for reads and saves. | [`bowl-pool-access.js`](../src/lib/bowl-pool-access.js) preserves stable 401/403/500/503 error semantics and does not turn temporary outages into sign-outs. | Atomic `save_bowl_pool_submission` RPC, kickoff guards, and Bowl Pool entry/pick records. |
| Grading dashboard | [`/api/admin/grading-dashboard`](../src/app/api/admin/grading-dashboard/route.ts) checks the Commissioner, then reads season/period, game and pick status, worker records, reminders, incidents, and provider history. | [`require-commissioner.ts`](../src/lib/require-commissioner.ts) gates access; route-local functions summarize game state and latency. | Final/grade/line records and audited worker runs. |
| Final-score worker | [`/api/cron/sync-scores`](../src/app/api/cron/sync-scores/route.ts) checks the automation secret and takes an execution lease before [`sync-final-scores.ts`](../src/lib/sync-final-scores.ts). | Due-game/backoff/quota checks decide whether the provider is called. Verified finals are normalized and applied through guarded database operations; absence from a provider response is not deletion. | Atomic grading, disruption, eligibility, period-transition, audit, and run-record functions. |
| Official lines | [`/api/cron/lock-lines`](../src/app/api/cron/lock-lines/route.ts) uses the same secret/lease boundary before [`lock-due-lines.ts`](../src/lib/lock-due-lines.ts). | Due-game selection, provider validation, and freshness of fallback lines. | Atomic official-line lock and audit operations; a locked line is not replaced retroactively. |
| Scheduled email | [`/api/cron/maintain-reminders`](../src/app/api/cron/maintain-reminders/route.ts) reconciles future messages; [`/api/cron/send-reminders`](../src/app/api/cron/send-reminders/route.ts) claims and delivers due messages. Both are leased. | [`reminder-readiness.ts`](../src/lib/reminder-readiness.ts) can defer/suppress; [`email-reminders.ts`](../src/lib/email-reminders.ts) selects recipients and preserves delivery receipts. | `push_reminders` and delivery records. The table/RPC names are historical; the transport is email. |

Player authentication uses a bearer session checked against Supabase Auth and
an active `players` row. Home, Profile, Season Snapshot, Slate, Pick'em save,
Survivor, Pool Chat, and Bowl Pool routes share the request-scoped server
access resolver. PIN sign-in remains a separate credential exchange. Browser
reads and refreshes share the session path in [`auth-session.ts`](../src/lib/auth-session.ts),
with no durable browser authorization cache. Commissioner routes use the shared gate. Automation uses a separate secret,
lease, and heartbeat path; a player's browser token does not authorize workers.

## Read-path cost inventory

These are code-level observations, **not measured DB request counts or route
latencies**. A conditional branch, pagination, cache hit, or helper query can
change the actual count. Use fictional data in `isolated-test` to measure the
complete route before changing a query.

| Route | Currently visible request shape | Measurement priority |
| --- | --- | --- |
| Home | Starts with viewer/season/player reads, then periods. `readAllPages` loads non-void picks for all season periods in 1,000-row pages; game/team/line detail is conditional on selected picks. Survivor data adds more paged reads when shown. | High: early/late season and playoff row counts, page count, response bytes, and time. Any aggregation must preserve win, void, and reveal semantics. |
| Slate | Bootstrapping adds season/period and sometimes active-game reads. The chosen week loads games, own picks, period, players, teams, line history, and conditional Survivor reads; public picks are limited to started games. | High: distinguish initial bootstrap from week switch and a post-kickoff refresh. Record conditional Survivor and playoff paths separately. |
| Grading dashboard | Loads health/watchdog/reminders plus season and period, then a broad parallel batch. The selected period's `games` rows are read once in full and again for IDs before the `game_lines` read. Provider runs and the season ladder paginate; the ladder has a short in-process cache. | High: instrument the duplicate game lookup and provider-history page count before optimizing. Compare request count, rows, bytes, and elapsed time, including a cold cache. |

Local response-shaping benchmarks time in-process transformation and fragment
serialization. They do **not** measure database traffic, complete route
payloads, Vercel active CPU, or production usage. Do not combine those figures
with this inventory as if they were the same metric.

For the next isolated measurement, use the same fictional 11-player fixture
across early regular season, late regular season, and playoffs, and include
multiple historical seasons. Record per-route cache state, DB request count,
rows returned, response bytes, elapsed-time distribution, and query errors.
No live player names, picks, tokens, or email addresses belong in the report.
Measure before and after each query change; only a measured improvement with
privacy and rule tests should become a regression budget.

## Verification and change seams

- `npm run test:all` exercises application rules and checks migration-version
  uniqueness. Database integration tests without the isolated credentials and
  manually enabled full-season/weekly rehearsals are expected to skip locally;
  a green local run is not equivalent to a passed isolated lifecycle workflow.
- `npm run lint` and `npm run build` cover the application and TypeScript build.
  `npm run typecheck` additionally checks fifteen JavaScript policy
  modules listed in `tsconfig.policy.json` with JSDoc types. This is a focused
  boundary, not a claim that every JavaScript module is checked; expand it as
  modules gain accurate input contracts. CI runs this check before tests.
  The isolated browser/database, visual, and production-smoke checks are
  separate release gates described in the [Commissioner runbook](commissioner-runbook.md).
- For privacy edits, test the shaping module and the authenticated route; a
  browser screenshot cannot prove that hidden selections were not returned.
- For saves, preserve the atomic RPC boundary and test both rejection before
  mutation and uncertain responses after a possible commit. Never auto-retry
  an uncertain mutation as if it were a read.
- For workers, retain the automation secret, lease, quota/cooldown checks,
  audited run record, and database idempotency. A request timeout alone does
  not cancel a provider call or prove that a database/email write did not land.
