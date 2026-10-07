# Commissioner recovery and release runbook

## Control-center overview

A malformed Pick'em or Bowl Pool save is rejected with a client error before
the save path reaches game lookups or writes. For a reported failed save,
refresh the player's saved card before retrying: a lost response does not prove
the original save failed. An omitted Survivor field leaves that pick unchanged;
an explicit clear is a separate request. Do not change a player's selection
directly in production to work around a rejected request.

If Standings reports an unsupported Survivor entry status, treat it as a
database/application contract mismatch. Check the current migration and entry
record in a safe read; do not relabel the state in the browser or edit a
player's history to make the page render.

The Season Snapshot is the reverse of the Pick'em Pad on Standings, opened by
its flip button. Commissioners can inspect it before Week 6; players receive
the same button and data from Week 6 onward. The regular-season chart starts
everyone at zero. It adds the active week for everyone together only when no
Pick'em pick is pending and each active player has a full card or every game
has kicked off. The playoff view carries forward regular-season totals. The
key follows current standings; select a player to hide or show a ribbon, or
use **Show all** to restore the full field. Touching shaded ribbons make tied
paths distinguishable without moving anyone off their actual win total. The
chart loads only while visible and follows the normal standings refresh.

If a player data route or any commissioner read or action fails, inspect its
API status before asking a player to sign
in again. A 401 means the request token is absent or
invalid; 403 means a verified pool identity is missing, inactive, or lacks
the needed role. A 503 with
`auth_unavailable` or `profile_unavailable` means a temporary dependency
failure, so retry the read after service recovers. A 500 with
`auth_not_configured` requires checking the deployment's Supabase variables.
Access failures stop before protected work. Do not automatically retry a
mutation after an ambiguous transport failure; inspect saved state first.
Do not change player records or issue a new PIN to work around an outage.

Start at **Commissioner → Overview**. The live operations map is the first
place to check schedule, selections, line locks, scoring, recap readiness, and
week/round handoff. Its at-a-glance cards show the current stage, watchdog
incidents, and provider allowance; select a stage for the exact hold and next
safe action. Use the specialist panels only after the map identifies a need.

Use this page only after the [SOP index](SOP_INDEX.md) identifies an abnormal
condition. Scheduled automation is the normal operator. Recovery controls must
retain the same authentication, execution lease, provider allowance,
gameweek-pin, audit, and atomicity protections.

## Release gate

### Application-only change

1. Finish the intended changes on one named release branch. Run
   `npm run test:all`, `npm run lint`, and `npm run build` before the final
   commit. Keep other work in a separate checkout.
2. Run `npm run release:fetch`, update the release branch from current `main`
   if needed, and run `npm run release:check`. The check confirms the GitHub
   account, a credential-free repository URL, a clean branch, and current
   `main`. `npm run release:push -- --dry-run` verifies the upload path without
   starting CI.
3. Run `npm run release:push` once, then open one pull request. Wait for
   application, Vercel, and relevant database checks. The isolated browser
   check must pass for player/session work; it uses only `isolated-test`.
4. Merge only green work and wait for **Production smoke gate** after Vercel
   reports the live deployment. Smoke-test the changed player or Commissioner
   path when the release is user-visible.

The release helper reads the existing GitHub CLI login and passes a temporary
authorization header to Git. It never saves a token in the repository URL or
Git config. On Windows it uses Git's OpenSSL backend for this operation, which
avoids the Schannel credential failure seen on this machine. If the check says
GitHub is unreachable in Codex, grant network access and retry before starting
another device login. If GitHub actually returns HTTP 401, run
`gh auth login --hostname github.com --git-protocol https --web`; the code can
be approved at `https://github.com/login/device` on a phone. Press Enter in
the waiting CLI after approval so it saves the result.

A newer push to the same pull request cancels its older application run. The
main-branch quality run still executes after merge: current branch protection
requires the isolated database check but does not require application quality
and permits administrator bypass. Do not remove that main-branch check until
the corresponding branch protections are strengthened.

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

1. Wait until the normal two-hour-fifty-minute post-kickoff eligibility window.
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
   An unverified line includes a provider market for the wrong matchup,
   incomplete or non-finite points, or malformed saved history.
5. If the check timed out, wait for its lease to expire and inspect the saved
   official line before another recovery attempt. An in-flight atomic lock
   could have committed despite the timeout response.

## Reminder, reveal, or recap is late

### Review email images before delivery

Open **Commissioner → Email → Email image studio**. Choose the email type,
review the generated PNGs at Phone or Desktop width, and use the download
links to inspect an image at full resolution. Change the subject or message,
select **Refresh preview**, then **Save email changes**. Saving is disabled
until the current draft has rendered.

**View email images** on a queued or sent card uses that message's saved
snapshot when available. If upcoming results are not ready, the preview is
explicitly marked as fictional sample data; it is not approval of results.
Previewing never sends an email or freezes delivery data. Standard wording
changes apply to future messages. Already sent messages keep their source
snapshot and rendered artwork; do not expect an editor change to restyle them.
Competitive corrections belong in Grading, not the image editor.

### Delivery diagnosis

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

## Grading control center

The Commissioner Desk's **Grading** panel is the operational view for live
settlement. It shows the active scoring period, game-by-game state, pending
Pick'em and Survivor grades, score-sync freshness, provider allowance, and a
prioritized attention queue. Use the queue as the starting point when a final
score is late, a grade remains pending, a kickoff has passed without a live or
final state, or a line is missing after lock.

The dashboard is read-only and refreshes every minute during live games, open
attention items, or a kickoff within 15 minutes; otherwise it refreshes every
five minutes while visible. An unavailable numeric measurement shows a dash
without hiding the rest of the Commissioner panel. It does
not replace the guarded recovery controls on Game day. For a game in
`Needs review`, verify the provider result and use Final Score Check or Final
Score Reconciliation according to the normal runbook. Do not type an estimated
score or repeatedly poll a failing provider.

Its selected-period game/line reads reuse one game result rather than making
an extra ID-only lookup. This is a request-count optimization, not a reason to
change the refresh cadence or an assurance of lower Vercel CPU. See the
[measurement note](GRADING_READ_OPTIMIZATION.md) before comparing costs.

The **Recent operational history** list is the durable audit trail for the
current view. It is useful for answering whether a final score was accepted,
whether grading ran, and when the underlying record changed; it is not a
replacement for the immutable player-facing receipt or the full audit log.

The **Participant impact** and **Notification readiness** cards are context,
not controls: they summarize graded outcomes, Survivor status, and queued or
completed messages. Use the Email center for delivery receipts and the guarded
game-day controls for any correction.

The **Release readiness** cards provide the next milestone without changing
the schedule: loaded games, official-line coverage, next kickoff, and next
line lock. A partial line count is expected before the slate is fully locked;
only a missing line after its deadline should enter the attention queue.

The **Provider efficiency** card is a decision aid, not a dynamic polling
switch. It compares score-check credits per settled game with settlement
latency by exact kickoff slate, and retains the 15-day game-weighted moving
average for credits per game. Missing or ambiguous attribution is shown as a
gap, not a zero.

Use the **Period** selector to inspect a completed or upcoming scoring period
without changing the player-facing default week. Historical views are
read-only and retain the same attention, audit, and readiness rules.

The **Worker activity** table is a quick liveness check for score and line-lock
invocations. A failed row should be investigated through Automation Health and
the watchdog before any manual retry; a missing row means there is no recent
worker receipt to trust.

The **Period comparison** card compares average settlement time with the prior
scoring period when enough settled games exist. It is a trend signal only; it
does not alter polling cadence or the safe settlement rules.

Use **Game inspector** for the evidence behind a status: score, finalization
time, Pick'em grades, and Survivor grades. **Copy snapshot** creates a small
text handoff for a support note or incident log; it does not expose picks or
change any pool record.

The **Incident posture** card shows both open and recently resolved watchdog
signals. Treat an open item as the current source of truth; resolved items are
there for context when reviewing whether a retry actually recovered the system.

### Score polling cadence

The fixed retry ladder below is the only score-polling policy. There is no polling simulator or suggested plan, and nothing here changes the cadence.

The live cadence: the first NFL score check is eligible 170 minutes after official kickoff for both regular-season and playoff games, the worker is invoked every 10 minutes, and unfinished games follow six 10-minute windows, three 20-minute windows, one 60-minute window, one 120-minute window, and one emergency 240-minute window. Recent score polls list eligible games, completed finals found, newly finalized games, and credits consumed. The ladder cards show the percentage of newly finalized games captured by each polling window; each game is counted once at the window that first records it as final.

Provider efficiency uses one point per exact kickoff slate in the selected period,
with credits per settled game on the left axis and settlement latency on the right.
Historical receipts have no slate IDs: non-overlapping polling windows are
estimated, while overlapping windows remain unplotted. A gap is not a zero.
Use hover, touch, or the Explore slider for exact values, and View chart data
for the accessible table.

Current-month credit usage starts on the first UTC day and ends today. Switch
between Month to date and Daily spend. Tracked request costs include charged
failures and clearly identify older estimated costs. The summary shows actual
tracked credits, a schedule-based month-end forecast, and average credits per
elapsed regular-season Sunday. The provider's used/remaining figures are one
separate quota snapshot, not a fabricated reconciliation of local run records.
All charts refresh with the dashboard and retain selections.
