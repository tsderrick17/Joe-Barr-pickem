# Worker stages, deadlines and retries

How the automation workers are organized, where a run may stop, and what is safe to repeat. This covers the score,
official line-lock, reminder and Bowl workers.

## One run

`runWithAutomationLease(job, task)` records a heartbeat, claims the database lease, and runs the task with a
**deadline** (a little shorter than the lease). If the deadline passes, the waiting caller is released with a timeout
error and the run's context is cancelled. The database lease is deliberately kept until it expires, so a second run
cannot start on top of a slow first one. Cancellation is **cooperative**: a worker calls `checkpoint(stage)`
(`src/lib/execution-context.ts`) before it starts each stage or a commit and passes `providerSignal()` to outside
requests. It never interrupts a database call or an email already in flight, so those stay protected by the atomic
database functions, delivery receipts and idempotency rules. A worker called outside a lease (a test, a script)
never cancels.

A stopped run is safe to repeat: every stage is idempotent and the next run finds the same due work. A run stopped by
its own deadline is **not** treated as a provider failure, so it does not push games onto a longer retry delay.

## Score worker (`syncFinalScores`)

Decisions are pure functions in `src/lib/score-work-plan.ts` (which games are due, which may be asked about now, the
cadence, whether the paid allowance says to hold). The worker reads context, asks them, then acts.

| # | Stage | Checkpoint before | Safe to retry |
| --- | --- | --- | --- |
| 1 | Annual season handoff check | yes | yes (idempotent RPC) |
| 2 | Void disrupted picks | yes | yes |
| 3 | Settle declared no-contest picks | yes | yes |
| 4 | Eliminate Survivor players with no pick | yes | yes |
| 5 | Recover pending final pick grades | yes | yes |
| 6 | Advance scoring periods | yes | yes (atomic RPC) |
| 7 | Playoff eligibility snapshot | yes | yes (immutable once taken) |
| 8 | Read games awaiting scores; plan (pure) | yes | yes (reads) |
| 9 | Quota hold decision (pure) | no | yes |
| 10 | Provider request | yes | yes; the signal aborts on cancellation |
| 11 | **Commit** final scores (`finalize_games_atomically`) | **yes, the last one** | yes (atomic, idempotent) |
| 12 | Bookkeeping after the commit: clear backoff, defer unfinished games, roll the week, record the run | no | must finish; each step is idempotent |

After the commit nothing checks for cancellation, because the remaining steps have to complete.

## Line-lock worker (`lockDueLines`)

| Stage | Checkpoint before | Safe to retry |
| --- | --- | --- |
| Void disrupted picks | yes | yes |
| Read games due a line | yes | yes |
| Provider request (a cancelled request counts as "provider unavailable"; the commit checkpoint below then stops the run) | yes | yes |
| **Commit** official lines (`lock_official_lines_atomically`: line, history and audit together) | **yes** | yes (all-or-nothing) |

## Measured and tested

`test/worker-cancellation.test.mjs` proves the boundary: a run past its deadline starts no further stage, its own
rejection is handled, two runs keep separate contexts, and both workers stop before touching the database or the
provider. `test/score-work-plan.test.mjs` covers the decisions. Changes to the score worker's orchestration also
need the full-season certification (`isolated-integration.yml` with `full_season_drill`).

## Reminder worker (`sendDueReminders`)

The database claims the due reminders first (`claim_due_push_reminders` marks them `sending`). What each outcome
becomes is decided by pure functions in `src/lib/reminder-outcome.ts`: not ready (suppressed for good only for a
terminal reason, otherwise waits), delivered (sent, failed, retry in 15 minutes, or suppressed), error (retry only if
delivery never started or the email could not be prepared), and release (handed back with no delay).

| Stage | Checkpoint before | Safe to retry |
| --- | --- | --- |
| Claim due reminders | no | yes (the claim is the lease on each reminder) |
| For each claimed reminder: checkpoint | **yes, once, before anything for that reminder** | yes |
| Readiness check | no (inside the reminder) | yes (read) |
| Email delivery (per-address receipts) | **never**: a reminder is not interrupted once it starts | receipts stop a repeated attempt from emailing anyone twice |
| Record the outcome | no | yes |

When the run is stopped at that checkpoint, this reminder and every later claimed one have not started delivery, so
they are handed straight back to the queue (status `scheduled`, no delay) instead of waiting for the stale-claim timer
(20 minutes). If a hand-back write fails, the stale-claim recovery still returns it.

## Bowl worker (`syncBowlPool`)

Pure rules are in `src/lib/bowl-line-policy.ts` (half-point hooks, the favorite from ESPN's sign, the lock stamp, and
when a line is due to lock). Stages, each with a checkpoint before it and each idempotent: annual schedule import,
schedule and lines from the odds feed, scores, kickoff transitions, missing-pick losses, withdrawn-draft purge, grade
final picks (grades and result receipts in one database call), champion refresh, season status. All three provider
requests carry the cancellable signal.
