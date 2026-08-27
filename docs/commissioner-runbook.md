# Commissioner recovery and release runbook

Use this page only after the [SOP index](SOP_INDEX.md) identifies an abnormal
condition. Scheduled automation is the normal operator. Recovery controls must
retain the same authentication, execution lease, provider allowance,
gameweek-pin, audit, and atomicity protections.

## Release gate

### Application-only change

1. Run `npm run test:all`, `npm run lint`, and `npm run build`.
2. Open a pull request and wait for application, Vercel, and relevant database
   checks.
3. The isolated browser check must pass for player/session work. It signs in
   and writes fixtures only in `isolated-test`.
4. Merge only green work and wait for **Production smoke gate** after Vercel
   reports the live deployment. Smoke-test the changed player or Commissioner
   path when the release is user-visible.

### Database change

1. Add a new timestamped migration under `supabase/migrations/`. Never edit or
   replay an applied migration or the historical numbered SQL files.
2. Apply and test it against the confirmed `isolated-test` database.
3. Run the production migration workflow in dry-run mode and review the exact
   plan.
4. Apply through the guarded workflow, then run **Commissioner → Launch
   preflight** before deploying application code that depends on it.

A successful application build never proves that a required production
function, trigger, schedule, Vault secret, or provider setting exists.

## Missing or late final score

1. Wait until the normal three-hour post-kickoff eligibility window.
2. Open **Commissioner → Final Score Check** and run it once.
3. Read the result and most recent check receipt.
4. If the provider has not finalized the game, let the measured retry/backoff
   continue. Do not repeatedly spend provider credits.
5. A missing official line leaves the affected pick pending and blocks unsafe
   week completion.

## Provider score disagrees with the saved final

1. Run **Final Score Reconciliation**. It is read-only.
2. Verify the official correction independently.
3. Use the audited score-correction control once. It must preserve void rows,
   regrade affected picks atomically, and record league impact.
4. Confirm standings, receipts, and week state before allowing handoff.

Never overwrite the original audit event or type an estimated score.

## Kickoff moved or schedule changed

- Let canonical schedule reconciliation apply an unlocked timing-only change.
- The game remains pinned to its original scoring period and NFL gameweek,
  even if it crosses a calendar-week boundary.
- A locked, settled, re-paired, omitted, or cross-period change is quarantined
  for review. Do not force it through or delete the saved game.
- Use preview/import only as a diagnosed recovery after the automatic path
  validates a complete schedule.

## Postponed, cancelled, or no-contest game

1. Verify the league status.
2. Record it through **Commissioner → Game Exceptions**.
3. Confirm pending ATS and Survivor selections become audited voids and remain
   replaceable only while a legal future game exists.
4. A disruption never advances Survivor and is not graded as a loss. If no
   legal replacement remains, it does not eliminate the entry.
5. Once the verified status is recorded and the picks are void, the disruption
   is settled and does not hold the automatic week handoff.

## Official line did not lock

1. Check **Automation Health** and its one watchdog incident.
2. Run **Check official spread locks** once.
3. Preserve any line that already locked. Never substitute a later market line
   after the deadline.
4. A preliminary line no more than 24 hours old may be used automatically.
   Older or unverified lines remain preliminary; let the affected pick remain
   pending until Commissioner review provides a trustworthy official line.

## Reminder, reveal, or recap is late

1. Open **Commissioner → Reminders** and inspect the scheduled item and receipt.
2. Distinguish `suppressed` from `failed`: an empty reveal window is intentional.
3. For a Tuesday recap, confirm the source week is fully trustworthy first.
4. Use the private Commissioner test only for configuration diagnosis. Do not
   recreate the automatic timetable with one-off messages.

Players control delivery choices under **Notifications**. Commissioner wording
changes apply to future messages; dynamic week/date context remains automatic.
During playoffs, Regular receives the daily final recap and Full Card also
receives each kickoff reveal. Several valid messages can therefore arrive on
one day; investigate only missing, failed, or duplicate receipts.

## Account controls or sign-in disappear

1. Refresh once and confirm the latest production deployment is ready.
2. A valid saved session should show the player name, **Notifications**, **Sign
   out**, and **Commissioner** for the commissioner.
3. An expired session should return to PIN sign-in. Sign in once and confirm the
   browser remembers the renewed session.
4. If pool data remains visible but controls vanish, inspect `/api/profile` and
   the shared session path. Do not add broad player-table policies as a UI fix.

## Backup recovery

Use a backup only for genuine disaster recovery, not an ordinary late score.
Pause writes, preserve the current audit evidence, and restore into an isolated
project first. Verify the restored application before considering any
production recovery. Detailed retention and backup behavior lives in
[OPERATIONS.md](OPERATIONS.md).
