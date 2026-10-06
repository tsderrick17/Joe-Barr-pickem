# Durable decision log

This log records project rules that future changes must not casually reverse.
Entries preserve the original reasoning; a later change marks an older detail
as superseded and records the current contract rather than rewriting history.

## 2026-10-05 - AUTH-001 - Distinguish invalid sessions from dependency failure

**Status:** Accepted for the Season Snapshot read-route pilot only

An unavailable authentication service or failed player lookup must not be
reported as an invalid session. Use a request-scoped result with explicit
401/403/503 outcomes and a stable code; keep missing server configuration an
intentional 500. Start with a read route so the contract can be exercised
without changing save retry behavior. Migrate other routes only with their own
failure tests and isolated player-flow evidence. Do not cache authorization.

## 2026-10-05 — STATE-001 — Bound and cancel the Slate bootstrap read

**Status:** Accepted for the Slate's initial page load

The initial Slate bootstrap uses the authenticated browser session and can
remain on the loading shell if its board request stalls. Bound that read to 15
seconds, cancel it when the page unmounts, and ignore late errors after
navigation. This preserves the existing authentication and retry policy while
making the page lifecycle explicit; week-change requests retain their separate
latest-request guard.

## 2026-10-05 — STATE-002 — Keep an optimistic Slate preference over stale reads

**Status:** Accepted for the Slate's Pool Action display choice

Changing weeks can return a profile snapshot captured before an optimistic
Pool Action preference save. Keep the pending choice in a local override so
the stale response cannot flip the view back. Restore the previous value if
the save fails, and allow only one preference save at a time to avoid
out-of-order writes.

## 2026-10-05 — STATE-003 — Verify uncertain Slate saves with a safe read

**Status:** Accepted for Pick'em and Survivor saves from The Slate

Never replay a pick mutation because its response was lost or failed: the
database may already have committed the save. For transport failures and
server errors, make one bounded authenticated read of the player's saved
Slate. Mark the captured request snapshot saved only if the returned picks
match exactly; otherwise update the saved baseline from that read while
preserving any newer draft. If transport failure may leave the write in flight,
hold another submission until that week has been reloaded. If the read itself
is unavailable, use the same hold. Omitted Survivor remains outside the check.

## 2026-10-05 — PERF-001 — Reuse grading game rows for the line query

**Status:** Accepted for the selected-period grading dashboard read

The dashboard already loads the selected period's game IDs with its full game
rows. Reuse that result to select locked lines instead of issuing an ID-only
`games` request. Normalize the read to one promise so other dashboard queries
can remain concurrent, and keep the same failure handling. The observed
request-count reduction is one per loaded period; no latency or Vercel CPU
claim is made without isolated and production measurements.

## 2026-08-09 — REF-001 — Layer project guidance

**Status:** Accepted

Keep short mandatory instructions in the repository root `AGENTS.md`. Keep the
detailed product/system contract in `docs/PROJECT_REFERENCE.md`, route human
procedures through `docs/SOP_INDEX.md`, and preserve reasons here. This keeps
the always-loaded instruction set focused while making deeper context durable.

## 2026-08-09 — REF-002 — Preserve history; start new seasons blank

**Status:** Accepted

Annual rollover copies the scoring-period template only. Historical games,
picks, scores, player results, Survivor records, championships, and audit logs
remain attached to their original season and are never copied into the new one.

## 2026-08-09 — REF-003 — Pin every game to its original pool week

**Status:** Accepted

An NFL schedule change may move an unlocked game's time, including across a
calendar boundary, but cannot change its original scoring period or gameweek.
Database constraints backstop application reconciliation. Ambiguous, locked,
settled, re-paired, or cross-period changes go to review.

## 2026-08-09 - REF-004 - Treat provider omission as incomplete input

**Status:** Accepted for omission safety; the fixed 272-game import requirement
was superseded by the 2026-10-02 season-length decision below.

A partial schedule feed cannot delete saved games. The initial full-season
import requires exactly 272 validated regular-season games; in-season refreshes
report missing events and continue applying unrelated safe corrections.

## 2026-08-09 — REF-005 — Use immutable Eastern day-start playoff eligibility

**Status:** Accepted

Playoff eligibility is calculated once at the start of each Eastern game day.
A player who could tie the leader at that moment may compete in every eligible
game that day. Later same-day results do not retroactively remove eligibility.
When a future day finds the player mathematically out, affected pending picks
are voided rather than graded as losses.

## 2026-08-09 — REF-006 — Separate recap timing from default-week handoff

**Status:** Accepted

The major recap becomes eligible Tuesday at 6:30 AM Eastern after accurate
settlement. The default week normally changes Wednesday at 3:00 AM Eastern and
at least 24 hours after the prior week settled. The next week can be selected
manually on the next Eastern day, and all completed weeks remain accessible.

## 2026-08-09 — REF-007 — Keep schedule and scoring automation fail-closed

**Status:** Accepted

Imports validate before writes; scoring consumes verified finals; period
completion requires every applicable record to settle. Missing lines, pending
grades, disruption reviews, malformed schedules, and unsafe moves block only
the affected transition instead of guessing or rewriting history.

## 2026-08-09 — REF-008 — Make manual controls guarded recovery paths

**Status:** Accepted

Commissioner controls call the same underlying functions as scheduled jobs and
retain authentication, execution leases, quota reserve, gameweek pins, audit,
and atomicity. An emergency button may bypass a cooldown clock but not an
integrity rule.

## 2026-08-09 — REF-009 — Alert only on actionable incidents

**Status:** Accepted

The watchdog opens a deduplicated incident for missing locked lines, stale due
scoring, stuck scheduled messages, an overdue incomplete season schedule, or a
missing production automation prerequisite. Intentional cooldowns and isolated
recipient failures do not produce commissioner incidents.

## 2026-08-09 - REF-010 - Protect provider and compute allowance

**Status:** Accepted for quota protection; the earlier exponential score
cooldown was superseded by the fixed retry ladder and ten-minute worker schedule.

Score checks use per-game exponential cooldown through six hours. Schedule
refresh failures use a shared circuit breaker, scheduled/manual paths share
leases, and low allowance preserves credits for line integrity. Repeat clicks
must not create overlapping or unbounded provider work.

## 2026-08-09 — REF-011 — Use timestamped migrations after cutover

**Status:** Accepted

The root-level numbered SQL files are immutable historical evidence. Every new
database change is a timestamped file under `supabase/migrations/`, rehearsed
against isolated-test, and deployed through the guarded migration workflow.

## 2026-08-09 — REF-012 — Rehearse full seasons outside production

**Status:** Accepted

Lifecycle certification runs only against the confirmed isolated project. It
covers the full 285-game season, dynamic scheduling, disruptions, line and
score failures, privacy, playoff eligibility, Survivor, archives, championship
recording, and a blank annual rollover. Production never receives fixtures.

## 2026-08-17 — REF-013 — Player-controlled email plans with a routine inbox limit

**Status:** Superseded in part by REF-026

Keep the existing self-service email choices, expressed as Essentials, Regular,
and Full Card plans with optional detailed controls. Existing player choices are
preserved until that player changes them. Deliver no more than one routine pool
email per player per Eastern calendar day; deadline reminders and material
early-lock or schedule-change notices remain eligible because they can require
timely action. Record intentionally held routine messages as receipts so the
Commissioner can distinguish them from delivery failures.

The plan presets and self-service choices remain accepted. REF-026 supersedes
only the cross-category one-message-per-day limit.

## 2026-08-18 — REF-015 — Reproduce and independently monitor critical automation

**Status:** Accepted

Keep line locking, score refresh, and pre-lock spread refresh in one idempotent
timestamped migration. Launch preflight validates exact schedules, endpoints,
authorization, external providers, sender readiness, and Commissioner alert
delivery without consuming odds credits or sending email. A separate public,
opaque heartbeat lets an external monitor prove the internal watchdog itself
is still completing.

## 2026-08-18 — REF-016 — Make notification timing explicit and suppress empty reveals

**Status:** Accepted

Replace the single selection-reminder preference with three preserved player
choices: Sunday early, Sunday afternoon, and the combined Sunday/Monday
primetime set. Add the 6:00 PM Sunday occurrence, but send every reminder only
when a legal selection can still be made. Public reveal occurrences with no
represented selections end as explicit suppressions rather than deliveries,
failures, or indefinite retries. Automatic subjects always identify the
relevant week or playoff date, and weekly recap wording drops Survivor after
that pool is no longer relevant. Remove ad-hoc Commissioner scheduling so the
automatic timetable and player self-service choices remain the only delivery
controls.

## 2026-08-19 — REF-018 — Bound operational storage without deleting pool history

**Status:** Accepted

Keep every competitive and player-facing historical record, including picks,
official lines, final results, audit entries, championships, and email
receipts. Weekly storage cleanup may delete only routine `sync_runs` and
resolved automation or schedule-review records after 180 days. Store unchanged
preliminary spread snapshots no more than once per Eastern day while preserving
all changed snapshots. A service-role-only per-table size report makes the
remaining database use visible to the Commissioner without opening metadata to
players.

### REF-017 - Harden advisor findings without opening data access (2026-08-18)

**Decision:** Pin the `search_path` of every public-schema function that does
not already declare one, and make the legacy `rls_auto_enable()` helper
service-role-only if it exists.

**Why:** The security advisor correctly identified mutable lookup paths and a
publicly executable `SECURITY DEFINER` helper. This remediation is idempotent,
preserves explicit `cron`/`vault` paths, and never adds a client-facing table
policy merely to dismiss RLS informational findings.

## 2026-08-20 — REF-019 — Certify annual turnover before cleanup

**Status:** Accepted

On and after the August 1 Eastern season boundary, create the new blank season
first, then clean only after the previous season is complete, every game and
selection is settled, schedule reviews are resolved, and required champions
are recorded. Preserve official games, lines, picks, scores, championships,
delivery receipts, and the final save snapshot for every player/period/mode.
The only selection history eligible for deletion is an earlier pre-kickoff save
that was superseded by a later save. Also collapse preliminary line history to
the final snapshot per old-season game, expire transient worker/security state,
run the existing 180-day operational retention, and create next-season
Survivor entries. Record one permanent retry-safe receipt with the exact kept
and removed counts. A failed certification blocks cleanup, not scoring or
schedule preparation, and opens one actionable Commissioner alert.

## 2026-08-20 — REF-020 — Monitor execution and verified backups externally

**Status:** Accepted

Keep the existing public-site and watchdog monitors, then add two independent
proofs: a fixed-size critical-worker heartbeat for line locks, scores, and
reminders, and a free HTTP endpoint that verifies the latest encrypted-backup
workflow completed successfully. The backup workflow uploads an artifact only
after export, encryption, and decrypt/restore verification. Public health stays
deliberately opaque, while the Commissioner and GitHub views retain actionable
detail. Monitoring records update in place and therefore do not create a new
source of database growth or require UptimeRobot's paid push-heartbeat tier.

## 2026-08-20 — REF-021 — Rehearse a live week weekly and detect drift daily

**Status:** Accepted

Use the existing Wednesday isolated workflow to rehearse a realistic ATS and
Survivor save/revision, slate finalization, grading, history check, and atomic
week handoff inside an always-rolled-back transaction. Separately, reuse the
existing leased five-minute watchdog to run Launch Preflight's external
configuration checks once per Eastern day, retry failed checks no more than
hourly, and surface one deduplicated incident. The daily check must not send a
pool message, spend an Odds API credit, create another cron schedule, or run
against test fixtures in production.

## 2026-08-25 — REF-022 — Verify real sessions and deployed configuration

**Status:** Accepted

Run the existing browser player flow on every pull request against only the
confirmed isolated project, including saved-session account controls and a
temporary authenticated-profile failure. After Vercel marks a production
deployment successful, independently retry the canonical page and all four
opaque health contracts. Report multiple simultaneous contract failures as a
likely shared deployment or server-authorization incident before touching
individual schedules. Launch Preflight must name the selected Supabase server
credential variable without exposing its value and treat the compatibility
fallback as configuration drift. Drop only the exact confirmed
`runtime.sendMessage` browser-extension error from client Sentry events; broad
error classes and player identity remain excluded.

## 2026-08-25 — REF-023 — Preserve the Data API schema boundary

**Status:** Accepted

Keep `USAGE` on the exposed `public` schema for `anon`, `authenticated`, and
`service_role`. Preserve full table and sequence access for the trusted,
server-only `service_role`, while continuing to control client access with
explicit object-level grants and row-level security. Audit these prerequisites
in the isolated database on every pull request so an advisor cleanup or manual
grant change cannot silently disable player sessions or server automation
again.

## 2026-08-26 — REF-024 — Keep isolated credentials away from Dependabot

**Status:** Accepted

Dependabot pull-request events intentionally cannot read the `isolated-test`
environment secrets. Give those pull requests an explicit successful no-secret
result instead of failing the environment confirmation with blank values.
Application quality continues to validate dependency updates, while
human-authored pull requests, scheduled rehearsals, and manual certifications
retain the complete isolated database and browser gate. Do not duplicate the
database URL or service-role credential into Dependabot secrets merely to make
the privileged test execute. Classify the change by the pull request author,
not `github.actor`, because an owner can refresh a bot branch without changing
who authored it. Serialize only the privileged database-lifecycle jobs through
one repository-wide concurrency group because every such branch targets the same
disposable database; parallel rehearsals can otherwise collide while seeding
fixtures. Keep no-secret Dependabot safety jobs outside that queue so concurrent
bot updates cannot supersede and cancel one another while waiting.

## 2026-08-26 — REF-025 — Schedule upgrade rehearsal on a non-gameday

**Status:** Accepted

Evaluate the monthly isolated upgrade rehearsal during the first ten Eastern
calendar days and run it on the first available date with no NFL game. Use the
canonical no-credit schedule feed across preseason, regular season, and
playoffs; fail closed when an active football month lacks schedule coverage.
Record a successful monthly completion artifact so later daily checks skip. A
scheduled attempt gets exactly one selected non-gameday each month; preserve
manual dispatch as the deliberate retry path after a failure. This does not change production availability—the rehearsal has always
been isolated—but it keeps optional CI work and alerts away from peak game use.

## 2026-08-26 — REF-026 — Treat playoff reveals and daily recaps as separate promises

**Status:** Accepted

Remove the global one-routine-email-per-Eastern-day limit because distinct live
events—especially sequential playoff kickoffs followed by a final recap—are
separate messages the player explicitly selected. Keep one immutable snapshot
per scheduled occurrence and one unique reminder/player delivery receipt so
retries cannot duplicate that occurrence. Regular includes the daily playoff
recap; Full Card additionally includes every playoff kickoff reveal.

At kickoff, reveal only that exact game group and combine games only when their
kickoff timestamps match. The receipt lists every player eligible for those
matchups, marks a missing required selection as a no-pick loss, and never includes
an earlier or later game. Subjects name the round, matchup, and Eastern date.
Daily recaps send only after final grading, explicitly list new eliminations,
and crown the Pick'em champion or co-champions on the final day. Empty public
windows remain terminal suppressions rather than retries.

## 2026-08-26 — REF-027 — Harden lifecycle edges without changing pool play

**Status:** Accepted

Enforce the current/next-week pick window inside the database as well as the
application, including replacement and clear operations, and reject selections
for any game no longer scheduled. Freeze playoff eligibility only on a real
playoff game day after every earlier game day has reconciled. Bound reminder
claims to three items, extend their worker lease, and reclaim a crashed claim
only when no delivery receipt exists.

Use a preliminary line as an automatic provider fallback only when it is no
more than 24 hours old; older or invalid history remains preliminary and opens
Commissioner review. For pick'em (`PK`), keep the home team in the pool's
favorite-side position. Slow repeated PIN guesses by source fingerprint after
five and ten failures without ever locking an individual player's valid PIN.
Treat verified postponed, cancelled, and no-contest selections as audited
voids—not losses—and allow those settled disruptions to stop holding rollover.

## 2026-09-07 - REF-028 - Keep the NCAA Bowl Pool separate, voluntary, and push-free

**Status:** Accepted for competition rules; the named schedule/result provider
was superseded by the ESPN-backed implementation described below.

Create a separate annual Bowl Pool rather than bending the NFL season model.
Players opt in beginning December 7 at 3:00 AM Eastern and may withdraw before
the first kickoff; a withdrawn pre-event draft is retained through that choice
window and removed at the first kickoff. Every FBS bowl and CFP game is an
individually lockable ATS selection, public only at that game's kickoff.

Keep genuine PK games as PK. Convert every non-zero whole-number source spread
to the next half point before it is locked, removing ATS pushes without hiding
the original provider value. Rank by wins, then the closest absolute combined
points prediction for the CFP national championship; remaining ties crown
co-champions. Use CollegeFootballData as the no-cost schedule/result source
and the existing Odds API integration for current NCAAF lines.

## 2026-09-08 - REF-029 - Make production worker failures actionable to the Commissioner

**Status:** Accepted

The public worker-health endpoint remains an intentionally opaque availability
contract, but it and the Commissioner Automation Status view must use one shared
evaluation of due line locks, scores, reminders, and worker heartbeats. A failed
production smoke gate therefore corresponds to a visible Commissioner action
item with the affected responsibility, while public probes reveal no job names
or timestamps.

## 2026-09-08 — REF-030 — Recover proven overdue critical work through the watchdog

**Status:** Accepted

When the shared critical-worker assessment proves that a line lock, score
check, or reminder is both due and unhealthy, the existing leased watchdog may
run that worker's standard recovery path once. This avoids a second privileged
implementation and retains every worker's lease, provider allowance, backoff,
idempotency, and delivery protections. The watchdog re-evaluates health after
the attempt and preserves an incident when recovery fails or remains in
progress; it never treats an attempted repair as a successful one.

## 2026-09-08 — REF-031 — Keep legacy recap duplicates from blocking the reminder worker

**Status:** Accepted

Weekly recap scheduling needs only one existing recap record to prove that the
period is already queued. It therefore reads at most one matching record and
leaves any legacy duplicates untouched. This avoids a harmless historical
duplicate turning into a worker-wide failure while preserving all delivery and
audit records.

## 2026-09-08 — REF-032 — Insert only missing automatic email occurrences

**Status:** Accepted

Automatic email scheduling first reconciles the existing scheduled occurrences,
then inserts only keys that are absent. The table's partial unique key remains
the final duplicate guard, but is not used as a PostgREST upsert conflict
target. This retains immutable delivery records and prevents schedule setup
from blocking the reminder worker.

## REF-033 - Agile NCAA bowl schedule staging

- **Decision:** Stage bowl games with a stable commissioner-supplied key and
  canonical sponsor-free display name; allow team and spread fields to remain
  blank until confirmed. Keep the pre-launch standings preview commissioner-only.
- **Reason:** Bowl participants and lines change annually, while the known bowl
  order and kickoff schedule can be prepared safely without exposing unfinished
  data or changing NFL records. Idempotent keyed imports avoid duplicate games.
- **Supersedes:** Manual, one-off bowl rows and a fixed five-row preview.

## REF-034 — Weekly subscribers receive playoff round recaps

**Status:** Accepted

Keep the existing post-grading playoff recap snapshot and its elimination and
champion detection, but deliver it to players who selected weekly recaps as
well as players using the older dedicated playoff-recap choice. Subject lines
identify both the completed playoff round and the represented game date.

**Reason:** A weekly recap subscriber should not silently miss the round summary
just because the playoff-specific toggle predates the plan system. Preserving
the legacy toggle avoids changing custom player choices while making the weekly
plan promise consistent through the playoffs.

## 2026-09-11 — REF-035 — Separate watchdog liveness from diagnostics

**Status:** Accepted

Treat the public automation heartbeat as proof that an authenticated, leased
watchdog invocation reached Postgres and durably recorded its run receipt. Write
that pulse before the watchdog performs heavier diagnostics, provider checks,
alert delivery, Bowl readiness, or housekeeping. Failures in those later steps
remain persisted as failed watchdog runs and Commissioner incidents, while a
failure to acquire the lease or store the initial receipt remains a real
liveness outage.

**Reason:** A transient diagnostic dependency should not make the independent
monitor report the scheduler as dead. This preserves prompt detection of real
cron, authorization, lease, or database failures without recurring false
heartbeat alarms.

## 2026-09-12 — REF-036 — Bound heartbeat noise without masking scheduler failure

**Status:** Accepted

The public watchdog heartbeat allows a durable receipt to be up to 35 minutes
old while the watchdog remains scheduled every five minutes. This absorbs
bounded pg_cron and serverless delivery jitter that can otherwise turn several
short-lived missed invocations into repetitive external downtime messages.

**Reason:** The liveness route still fails closed when no receipt arrives for
seven monitor intervals, preserving detection of a genuinely stopped cron,
authorization, lease, or database path while making a transient dispatch delay
non-actionable rather than noisy.

## 2026-09-12 — REF-037 — Decouple unchanged Survivor state from Pick'em saves

**Status:** Accepted

A Slate submission includes Survivor data only when the player changed the
Survivor selection. An ATS-only update therefore uses the ATS-only atomic save
path and leaves an existing Survivor pick untouched.

**Reason:** Once a Survivor game begins, its selection must stay sealed. That
constraint applies only to Survivor changes; it must not prevent a player from
adding or revising a still-open Pick'em selection later in the same week.

## 2026-09-22 - Email artwork and preview share one renderer

**Status:** Accepted for shared rendering; the image-spacing editor choice was
later removed. The density field remains an internal compatibility detail, not
a commissioner control.

Replace guessed-height recap canvases and separate roster sections with an
intrinsically sized card, trimmed from its transparent working canvas.
Standings, recap wins and selections appear together by player identity.
Keep all rows at readable width instead of shrinking large rosters into two
columns. Survivor omits future empty weeks and shows up to six completed weeks.
The Commissioner Email image studio uses the delivery PNG renderer and HTML,
supports private phone/desktop inspection and downloads, and saves spacing
alongside standard wording. Preview calls are read-only; unavailable results
are explicitly fictional samples. Saved delivery snapshots remain immutable.
Image spacing is included in outgoing URLs so later preference edits do not
restyle sent messages. Pixel-based renderer checks cover short and long cards.

## 2026-09-22 - Interactive provider charts and monthly credit accounting

Grading charts now share the dashboard refresh and period selection. Use a
daily/cumulative UTC calendar-month credit chart and paginate receipts to avoid
the 1,000-row truncation. Explicit zero-cost responses remain zero; missing cost
headers use the documented endpoint estimate rather than JavaScript null-to-zero
coercion. Quota snapshots and recorded costs are different measures.
Legacy slate attribution is bounded by finalization and marked estimated;
overlapping windows are withheld rather than assigned to the latest kickoff.
Shared responsive charts provide crosshairs, touch and keyboard exploration,
separate efficiency axes, and a data table. Ladder widths retain actual gap
proportions, with fresh-final counts controlling bar height.

## 2026-09-28 - Commissioner-only Season Snapshot prototype

**Status:** Superseded by the Pick'em Pad flip, Week 6 release gate, and
all-player week plotting decisions below.

The Pick'em Pad contains a default-minimized Season Snapshot, visible only to
commissioners until release. The graph uses historical period results, and its
commissioner-only endpoint loads only while expanded. The original settled-week
chart treatment was superseded by the alignment, active-card, and visual rules
below.

## 2026-09-28 - Season Snapshot week alignment and release timing

**Status:** Accepted for aligned axes and styling; the per-player active-week
plotting rule was superseded by the all-player rule below.

Keep the snapshot available to commissioners for review, including before Week
6; players do not see it until it is explicitly released. Plot a zero-win
regular-season baseline and align every player on the same week x coordinate.
Once all of one player's weekly picks are graded, plot their cumulative result
without waiting for the rest of the period. Use vivid stable player colors and
no point markers or bottom data table. Fit the plotted weeks across the full
available graph width so the current week always lands at the far edge. When
results overlap exactly, use narrow layered line colors in live standings
order instead of offsetting players horizontally. Show a separate playoff plot
that continues cumulative season totals, with a dynamic vertical range around
those totals. Refresh it from the existing standings cadence, without an
independent polling loop.

## 2026-09-28 - Touching Season Snapshot ribbons

Replace overlapping strokes with slim touching ribbons. On a shared trajectory,
the higher current standing occupies the upper band. Center each bundle on its
actual score and keep common week endpoints continuous as players split or join.
Inset light and dark edges provide a restrained bevel without outside shadows,
dash patterns, gaps, or markers. This supersedes the nested stroke treatment;
the regular-season baseline still starts at zero and all week columns align.

## 2026-09-28 - One credential path and fewer superseded release runs

**Status:** Accepted

Use a clean release branch and verify the existing GitHub CLI login after
network access is available. The release helper rejects credentials embedded in
the remote URL, uses a temporary Git authorization header, and selects OpenSSL
for Git on Windows. A newer commit to the same pull request cancels its older
application-quality run. The isolated database gate and production smoke gate
remain unchanged.

**Reason:** Restricted network access had made a valid login look expired, and
the Windows Git TLS/credential path caused release hangs and unsafe workarounds.
One final push avoids repeated preview and CI runs. We retain main-branch
application quality after merge because branch protection currently requires
only the database lifecycle check and does not enforce those rules for admins.

## 2026-09-29 - Grades and official lines are saved in one database call

**Status:** Accepted

NFL pending-grade recovery, Bowl Pool grading, and official line locking each
run as a single database function (`recover_pending_ats_grades`,
`grade_bowl_pool_final_picks`, `lock_official_lines_atomically`). Bowl grades
and their result receipts are written together, and the Bowl function also
repairs any graded pick whose receipt an earlier two-step write left missing.
An official line, its preliminary-history snapshot, and its audit entry are
saved together, and only lines actually inserted are audited. The Bowl sync now
uses the shared Eastern August 1 season year instead of a UTC calculation.
Grading rules are unchanged: a cover wins, an ATS push is a loss, a Bowl PK is
straight up, and a tie is a loss.

**Reason:** Separate application writes could leave a graded pick without its
receipt (never retried, because only pending picks were reloaded), a locked line
without its audit record, or a week half-graded after an interruption. One
transaction leaves either the old state or the complete new state, so retries
are safe. This supersedes the per-pick and per-step writes previously issued
from `sync-bowl-pool.ts`, `sync-final-scores.ts`, and `lock-due-lines.ts`.

## 2026-09-29 - Bookkeeping writes are checked

**Status:** Accepted

A watchdog alert is sent only after its attempt time is saved, and incident
open, refresh, and close writes are counted in the run details (bookkeepingFailures)
and skipped for that incident, so one bad row cannot stop the others from being
opened or sent.
Run outcomes go through one helper that retries once and reports in the server
log. The ESPN Bowl sync never replaces a locked official line, and its line,
reminder-cancellation, and season-status writes are checked.

**Reason:** An unrecorded alert attempt would repeat the Commissioner email on
every five-minute run, and an unrecorded run outcome leaves a run stuck at
started. These make failures visible rather than silent.

## 2026-09-29 - Period activation is atomic; Bowl refresh keeps curated names

**Status:** Accepted

Opening a scoring period when none is active now uses
`activate_scoring_period_atomically`, under the same per-season lock as the
weekly handoff. It refuses to skip an unfinished earlier period, to open a
second active period, or to open one with no imported schedule, and it reports
the reason instead of failing the score worker. The earliest due period opens
first. The weekly handoff also checks pending Survivor picks in the application
and reports "blocked" with a reason, matching the ATS check, instead of failing
every score run on the database exception. The ESPN Bowl refresh may link a game
(`provider_game_id`), correct its kickoff, teams, and venue, and add new games,
but never renames or reorders an existing game. The unused polling-plan
simulator and its "suggested plan" were removed; the fixed retry ladder is the
only score-polling policy.

**Reason:** The old activation was a plain update that could skip a period or
open an empty one. A pending Survivor pick made the handoff throw generically on
every run. Overwriting bowl names and order every 15 minutes could undo curated
values, and the simulator recommended plans that could never be applied. This
supersedes the latest-due-period activation and the provider-owned bowl names.

## 2026-09-29 - The Slate receipt is a die-cut ticket

**Status:** Accepted

The receipt is drawn as a real die-cut ticket: a stub (Submit), the Pick'em
section, and Survivor when it applies. Round notches are cut at the top and
bottom of each perforation and the two ends are serrated. Each section paints
its own paper on a masked layer behind its content, so the notches are true
cutouts (the page shows through as it scrolls under the sticky receipt) and
nothing inside is clipped. When Survivor is not shown, the Pick'em section
takes over the serrated right end. The shadow follows the ticket's outline.
The Pick'em section still grows to fit playoff rounds (three chips per row for
five or six picks).

**Reason:** A rectangular bar with painted-on punches could not show the page
behind it, and a fixed shape would not survive Survivor appearing or
disappearing. Per-section masks keep the notches on the perforations whatever
the section widths. This supersedes the single-background receipt strip.

## 2026-09-29 - Season Snapshot: recency stacking, hide/show, fixed colors

**Status:** Accepted

Lines that share a path stack by who held the greater total most recently
(latest week back to the first difference), replacing current-standings order.
Players can be hidden and shown from the key; the axis and stacking recompute
for whoever remains, and hovering highlights one player. Each person keeps one
of eleven validated hues (assigned alphabetically) regardless of visibility.
All explanatory text was removed; only the title remains.

**Reason:** With eleven players the old order made overlapping lines hard to
read and the leader always drew on top even after being passed. Recency shows
who is actually ahead right now, hiding lets a viewer follow only the players
they care about, and stable colors keep a person recognizable when the chart
changes. This supersedes the higher-current-standing-above rule and the
single-player focus mode.

## 2026-09-29 - Database hiccups are reported as hiccups

**Status:** Accepted

When the pick-save or Slate route cannot read the player or week, the player now
sees "Pick'em is having trouble reaching its records right now. Please try
again in a minute." (HTTP 503) instead of being told their profile is inactive
or the week does not exist. The Bowl sync stops with a clear error when a
database read fails, rather than finishing as an empty, healthy run. A failure
to clear old PIN attempts after a correct sign-in is logged; sign-in still
succeeds. react-dom now matches react (19.3.0).

**Reason:** A wrong message about a player's own account erodes trust, and a
silent empty run hides a real outage from the watchdog.

## 2026-09-29 - One Sentry version; Eastern season year in the Bowl dispatcher

**Status:** Accepted

The browser Sentry setup uses the SDK's own replay integration instead of a
separately versioned `@sentry/replay` package, so one SDK version loads. The
unused `js-yaml` direct dependency was removed (ESLint keeps its own copy). The
Bowl sync dispatcher now takes its season year from Eastern time, matching the
application's August 1 rule. The Commissioner access check retries a transient
database error and logs a persistent one; it still denies access on failure.

**Reason:** Mismatched Sentry packages loaded two SDK cores and needed a type
cast to fit; an unused dependency is maintenance with no benefit; and the
dispatcher could create next season's Bowl row about four hours early.

## 2026-09-29 - A skipped Bowl tiebreaker only loses the tiebreaker

**Status:** Accepted

The Bowl Pool champion calculation ignored every entry without a championship
total guess, so a player with the most wins who skipped the optional guess
could not be crowned, and a season with no guesses crowned no one. Entries
without a guess now count; they lose the tiebreaker to any guess, and leaders
who all skipped it are co-champions. The standings sort follows the same rule.
A new isolated test certifies a full Bowl season end to end.

**Reason:** Wins are the competition; the guess is only a tiebreaker. This
supersedes the guess-required champion query.

## 2026-09-29 - Clearing a Bowl pick is audited without a dangling reference

**Status:** Accepted

The Bowl pick audit trigger runs after a delete and recorded the deleted pick's
id as a foreign key, so every delete failed: a player could not remove a
selection, and purging withdrawn drafts at the first kickoff failed and stopped
the Bowl sync. A cleared pick is now recorded with no pick reference and the old
id, game, and team in its details. Found by the new isolated Bowl season test.

## 2026-09-29 - Leaner commissioner desk

**Status:** Accepted

The desk drops repeated navigation (Quick Routes duplicated the header links and
tabs), every per-tab intro block, the tab description line, and an empty Season
section. Season readiness checks moved to the Season tab; the handbook is its own
collapsed section under System. On phones the active tab scrolls into view. No
tool was removed. The account nav retries a failed profile read so the
Commissioner link cannot stay missing after one transient error.

**Reason:** The desk had the right tools but spent a screen of prose before
reaching them.

## 2026-09-29 - The Season Snapshot is the back of the Pick'em Pad

**Status:** Accepted

Instead of a collapsed section under the pad, the Season Snapshot is the pad's
back face. A round button at the top right turns the card over with a 3D flip
(instant under reduced motion). Both faces share the front's size, the chart
fills the back's height with Wins and Week axis labels, the player key sits
below it, and Show all is always visible and greyed out when everyone is shown.
Still commissioner-only until released.

**Reason:** The chart belongs to the pad it summarizes, and a fixed card size
keeps the page from jumping. This supersedes the default-minimized section.

## 2026-09-29 - Season Snapshot opens to players at Week 6; weeks plot together

**Status:** Accepted

Players get the flip button and the snapshot data from Week 6 (or any playoff
round) until the August 1 rollover; commissioners always have it. The data route
moved from /api/admin to /api/season-snapshot and checks the release rule
before reading any picks. The active week is plotted for everyone at the same
time, once every game has kicked off and no Pick'em pick is pending.

**Reason:** A mid-season reveal keeps early weeks from spoiling the race, and
plotting everyone together avoids a line that jumps ahead of players whose
games have not finished. This supersedes per-player plotting of the active week.

## 2026-09-29 - Permanent snapshot colors and a slab-style flip

**Status:** Accepted

The eleven-hue palette was shuffled three times with a secure random source and
frozen. Colors follow join order (players.created_at, including inactive
players) instead of alphabetical order. The flip button is two chasing arrows
that spin once per turn; the pad turns as a thin slab with paper edges, faces
swap visibility at the edge-on midpoint with symmetric easing, and the phone key
is a compact four-column grid.

**Reason:** Random-then-frozen colors are fair and never shift when someone
joins, leaves, or is hidden. The midpoint swap removes the brief mirrored front
face, and the compact key gives the chart more room on phones. Supersedes
alphabetical color assignment.

## 2026-09-29 - Cut idle Vercel CPU from polling and reminder ticks

**Status:** Accepted

The home page background poll slows from one to three minutes, and returning
to the tab (focus or visibility) refreshes at once, at most every 30 seconds.
The exact kickoff reveal timer is unchanged. The Grading tab polls only while
visible. Reminder delivery is gated in Supabase so idle five-minute ticks never
call Vercel. Score sync and the watchdog keep their cadences.

**Reason:** The project was near the Vercel Fluid active-CPU limit. Grades only
change on the ten-minute score sync, so one-minute home polling did mostly
redundant work, and nearly every reminder tick found nothing to send.

## 2026-09-29 - Flat, wide Season Snapshot flip

**Status:** Accepted

The slab depth is removed; the pad turns flat. The back widens to the full
Standings rail, matching the Survivor Table, and uses a cool gray surface
instead of the pad's parchment. The flip arrows use thinner strokes and small
open chevron heads. Supersedes the slab-style flip.

**Reason:** The commissioner preferred a flat, elegant turn, and the wider back
gives the chart room to read.

## 2026-09-29 - Season Snapshot views, eased lanes, and remembered choices

**Status:** Accepted

The back of the pad returns to the pad's parchment. Lane changes between a
shared week point and a bundle now ease over the outer 30% of each week
instead of a sharp jog. An All / 6 Wk toggle (regular season only) shows the
whole season or an exact, week-notched six-week window that opens on the
latest six weeks. During the playoffs the playoff chart replaces the
regular-season chart and hides players out of the race by default.
The range choice and hidden players are remembered per device in browser
storage; if storage is unavailable the defaults apply.

**Reason:** The commissioner preferred the parchment, saw distracting kinks,
wanted a tighter, more readable recent view, and wanted the chart to open the
way it was last left. Device storage avoids a schema change for a view
preference. Supersedes the cool gray back.

## 2026-09-29 - Straight weekly bands in the Season Snapshot

**Status:** Accepted

Each week of a line is one straight band from the player's slot at the start
of the week to their slot at the end; the eased lane changes are removed. The
All / 6 Wk toggle halves are equal width.

**Reason:** Easing lane changes inside a week added visible S-bends on phones.
Straight bands bend only at week boundaries, like an ordinary line chart, and
keep stacking order so shared paths never cross. Supersedes the eased lanes.

## 2026-10-01 - Bowl Pool gold theme and standard heading rule

**Status:** Accepted

The Bowl Pool's teal/green treatment (Bowl Card header band, game cells, rules
panel, selections page, and commissioner Bowl panels) is replaced by a subtle
gold palette, in light and night themes. The Bowl Card's heading line, including
when minimized, now uses the same ledger rule as the other standings headings.
Green remains reserved for "ready" status and red for problems.

**Reason:** The commissioner found the green heavy and the minimized heading
line inconsistent. Supersedes the teal-and-gold Bowl identity.

## 2026-10-01 - Brown accents for Bowl spreads and countdown

**Status:** Accepted

The Bowl Card's spreads and the Games Remaining countdown tiles use brown
accents; countdown digits stay white. Night theme spreads use a light tan.

**Reason:** The commissioner wants to lean into brown accents alongside the gold
Bowl palette. Extends the gold theme.

## 2026-10-01 - Patch Next.js for a critical advisory

**Status:** Accepted

Next.js is pinned to 16.3.8 (was 16.3.3). The Application quality audit gate
(npm audit, critical level) began failing on a new Next.js remote-code-execution
advisory in next/og ImageResponse, affecting versions 16.2.0 through 16.3.5.

**Reason:** Keep the critical-audit gate meaningful and the app patched. The pin
stays exact, as before.

## 2026-10-01 - Cut Vercel CPU from uptime probes and the watchdog

**Status:** Accepted

Healthy answers from the automation, worker, settlement, Bowl Pool, and backup
probes are cached at Vercel's CDN (10, 10, 15, 15, and 60 minutes), each well
inside the probe's own grace window. Failures are never cached, and /api/health
always runs live. The operations watchdog moves from every five to every ten
minutes; its 35-minute heartbeat window still leaves slack.

**Reason:** The project neared the Vercel Hobby 4-hour monthly active-CPU limit.
Eight five-minute uptime monitors were about 2,300 function calls a day, far
more than the scheduled jobs, and the earlier polling cuts did not touch them.

## 2026-10-01 - Phone slate rows without Survivor chips

**Status:** Accepted

On phones, rows without Survivor chips no longer apply the desktop centering
nudge to the spread (the kickoff time already has its own lane there), and the
early-lock note wraps inside the spread column.

**Reason:** The nudge pushed spreads into the favorite's name and the lock note
into the underdog's name for players whose Survivor chips are hidden.

## 2026-10-01 - Smaller email images

**Status:** Accepted

Email artwork is saved as a 256-color palette PNG instead of full-color RGBA,
cutting each image by about two thirds (for example 74 KB to 23 KB) with no
visible change. Both the stored email images and the fallback image route use the
same renderer.

**Reason:** Email images were slow to load on phones. The artwork is flat color
and text, so a palette loses nothing visible, and fewer bytes load faster in every
email client without changing the format clients already accept.

## 2026-10-01 - Faster Season Snapshot

**Status:** Accepted

The snapshot route's database reads moved to a loader that shares the finished
chart in memory (held until the active week's last kickoff, rechecked every two
minutes while grades land, and held an hour once the week settles, instead of a
fixed timer), merges the two player reads into one, and pages
picks past PostgREST's 1,000-row cap. The release gate still runs before any
pick is read, and a cached chart is never given to a player before Week 6. The
browser keeps the last chart on the device and shows it immediately while the
fresh one loads.

**Reason:** The back of the pad waited on five or six sequential network calls on
every open. Everyone sees the same chart and grades change on the ten-minute
score sync, so a short shared cache and a saved copy remove most of the wait
without a schema change. Paging also prevents silently truncated picks late in
the season.

The browser loads the chart only while the back is showing and only when the
standings changed since it last loaded, so there is no polling and flipping back
and forth costs nothing. The chart only changes once a week, when the last pick
settles, so a fixed 30-second refresh was needless work.

## 2026-10-01 - Plot the week when its last pick settles

**Status:** Accepted

The Season Snapshot plots the active week as soon as its last Pick'em pick has
settled, not after the week's final kickoff. A week is settled when no pick is
pending and every active player either holds all their picks for the week or every
game has kicked off. The server holds the chart accordingly: until pending picks
could first be graded (about three hours after their kickoffs), then rechecks every
two minutes, and holds it an hour once the week has settled. Supersedes the rule
that required every game of the week to have kicked off.

**Reason:** Nobody has to pick the Monday night game, so the week is usually
settled earlier, and the chart should appear then. A player with an open pick slot
keeps the week open until the last kickoff, so the chart never plots a week that
could still change.

## 2026-10-02 - Ticket corner notches and a two-line early-lock note

**Status:** Accepted

The receipt ticket now has a round bite in all four outer corners (the two left
corners of the stub and the two right corners of the last section) in addition to
the notches at both ends of every perforation, with the serrated edge between the
corners. The early-lock note on the Slate is two short lines under the centered
spread: the day, then the time (for example LOCKS 10/3, then 6 PM ET), in a
slightly smaller size so it fits the spread column on phones.

**Reason:** The commissioner wanted the ticket to read as die-cut at every corner
and perforation, and the lock note wrapped awkwardly (an orphaned "PM ET") and
crowded the team names.

## 2026-10-02 - Season length read from the schedule feed

**Status:** Accepted

The schedule import no longer assumes 18 weeks and 272 games. It reads the
season's length from the nflverse feed, requires every week to have games and all
32 teams to play the same number of games, and, in preseason, adds any missing
regular-season week before the playoff rounds (ensure_regular_season_weeks). Weeks
are never removed; a shorter feed stops for review. Live reconciliation compares
against the season's own canonical game set instead of 272.

**Reason:** The NFL has discussed an 18-game season. The commissioner chose for the
pool to adapt on its own rather than stop and wait for a code change.

## 2026-10-02 - Unattended operation for years

**Status:** Accepted

A sweep for running a decade without anyone touching it. Fixed now: a weekly
workflow re-enables every scheduled GitHub workflow so GitHub's 60-day idle rule
for public repositories never stops the weekly backup; the backup health check
falls back to an anonymous read of the public run list when its token is missing
or expired; and the Bowl Pool title and commissioner schedule default no longer
hardcode 2026. OPERATIONS.md now lists what resets each year, what is kept and
removed, and what still needs a person.

**Reason:** Without a commit for 60 days GitHub would have disabled the backup
workflow, and an expired token would have reported a false backup outage. The
remaining items (Survivor with no single winner, a longer NFL season, provider
plans, and Node runtime support) need a rule or an account decision and alert the
commissioner when they occur.



## 2026-10-02 - Survivor co-champions

**Status:** Accepted

Survivor now always ends with a champion. The last entry standing wins alone;
everyone eliminated in the same final week shares the title; several entries that
survive the whole regular season share the title. A champion is decided only once
the deciding week has settled (the survivor's own pick has won, or the week is
complete), so a player who outlasts the others on Sunday but loses on Monday
shares the title instead of winning alone. The one-Survivor-champion-per-year
database limit is removed; each co-champion gets a trophy and is named together.

**Reason:** Before this, a same-week finish or several survivors left the season
with no Survivor champion, which blocked the annual turnover and kept the next
season's Survivor from opening. The commissioner chose co-champions. Supersedes the
one-champion Survivor rule and crowning the instant one entry remained.

## 2026-10-02 - Grading page uses every recorded data point

**Status:** Accepted

The polling histogram read only the newest 1,000 score, line-lock, and bowl runs,
which at one line-lock run a minute covered well under a day. It now reads every
score run that recorded a retry rung since the start of the season, in pages, and
the page states the date the record starts. "Last score sync" now reads score runs
only (it could be a line-lock or bowl run before), Worker activity reads the latest
run of each worker, and the efficiency totals are season to date instead of a
rolling 30 days. A database test pins the paged read.

**Reason:** The commissioner expected the histogram to cover the whole season. Rungs
were first recorded on Sep 21, so earlier checks cannot be added without guessing.

## 2026-10-02 - Remove dead code and styles

**Status:** Accepted

Removed about 330 lines of CSS for classes no page uses (an old selection footer,
the earlier receipt layout, newspaper-clipping styles, and retired commissioner
panels), the JavaScript schedule reconciler that the live database reconciliation
replaced, and four exports nothing called. The documented rule that a game omitted
by the provider is reported and never deleted is now anchored to the live
reconciliation function instead of the unused file.

**Reason:** Less code to read and maintain, with no behavior change.

## 2026-10-02 - One Eastern-time module; tests cover the real rules

**Status:** Accepted

About 16 copies of the Eastern date and clock helpers across week rollover, line
locks, reminders, recaps, and Bowl emails now read one module (eastern-time.js).
A test compares it with verbatim copies of the old helpers over two years of
timestamps, every daylight-saving switch, and every midnight; they match exactly.
Two one-off display formats were left as they are.

JavaScript copies of rules that only tests used were removed: Bowl grading and
spread rounding (the database grades, and the Bowl lifecycle database test covers
it), two reminder-readiness rules, an outdated Survivor availability rule, a pickable
status check, an older heartbeat check, and a calendar-month credit summary. Where
the real rule lived inline, it moved into the tested library instead: the Bowl Card
sorts with the shared standings order (unchanged for players: wins, tiebreaker once
the final is in, then fewer losses), the Slate's Survivor "already used" check, and
the live heartbeat check.

**Reason:** Fewer places for time math to drift, and tests that check the code
players actually use.

## 2026-10-02 - Adapt commissioner grading refresh to workload

**Status:** Accepted

The grading dashboard refreshes every minute while games are live, attention
items are open, or a scheduled kickoff is within 15 minutes. It refreshes every
five minutes during quiet periods, pauses while hidden, and refreshes on return.
Periodic refreshes are skipped while another dashboard request is in flight.

**Reason:** Production route measurements showed the grading dashboard was the
largest observed source of server work. Adaptive polling preserves timely game-day
updates while reducing requests during quiet periods.

## 2026-10-02 - Bound repeated reads and incidental writes

**Status:** Accepted

Season-wide picks reads in standings, recap, and snapshot paths paginate beyond
PostgREST's 1,000-row response cap. The Home standings endpoint is read-only with
respect to Survivor enrollment and no-pick elimination; those changes remain on
the existing scoring and selection paths. Chat and settings polling use a narrow
player projection and do not write activity. Activity timestamps are best-effort,
rate-limited per player per warm function to once per 15 minutes, and concurrent
instances are coalesced by a database-side timestamp condition.

**Reason:** Keep historic data complete as the season grows while avoiding
repeated full-season maintenance and activity writes on read-heavy pages.

## 2026-10-02 - Compare provider cost and settlement at the same slate grain

**Status:** Accepted

The Commissioner grading dashboard pairs score-polling credits per settled
game with average kickoff-to-accepted-final minutes for each completed
game-time slate. The left and right axes name their units. A 15-Eastern-day
rolling credits-per-game average is weighted by the number of games, and
excludes incomplete slates and slates with ambiguous or missing polling
attribution. Separate game- and period-level latency charts are omitted from
this card; productive-check rate is removed from this chart, not from
underlying records.

**Reason:** Cost and settlement can be compared on the same timeline without
mixing game, period, and slate observations or treating a one-game slate as
equal to a full Sunday slate.

## 2026-10-02 - Keep Commissioner panels usable when a measurement is absent

**Status:** Accepted

Admin charts and capacity panels format provider and operational counts through
one missing-value-safe formatter. A temporarily absent number displays a dash;
other live metrics and controls remain available.

**Reason:** A production `/admin` error showed that formatting an undefined
measurement could crash a Commissioner panel. The alert did not include a
stack trace, so the exact field was not identified.

## 2026-10-02 - Reconcile the documented operating contract

**Status:** Documentation clarification; no runtime rule changed in this entry.

Keep historical decisions as a record of why a design existed, but identify
superseded details explicitly. The current implementation uses a feed-validated
NFL season length, a ten-minute NFL score-worker schedule with a fixed per-game
retry ladder, ESPN as the default Bowl schedule/result source, an optional
NCAAF Odds API fallback, and pre-rendered email artwork without a commissioner
spacing switch. The 18-week, 285-game isolated drill is a regression fixture,
not a production season-length constant. A scheduled monthly upgrade rehearsal
attempts only the selected non-gameday once; a failure requires a deliberate
manual retry. These statements reflect the current migration, test, and code
contracts and supersede conflicting wording in earlier entries.

**Reason:** A portfolio-quality operating record must distinguish current
behavior from earlier design decisions without silently editing history or
claiming that a documentation correction changed production.

## 2026-10-03 - Slower chat and home polling after a 100% Fluid CPU warning

**Status:** Accepted

Pool chat refreshes every three minutes (was one) while the tab is visible and
still refreshes on return. The home page background poll is five minutes (was
three). Return-to-tab refreshes and the exact kickoff reveal timer are unchanged.

**Reason:** Vercel reported 100% of the included Fluid Active CPU. Chat mounts on
every player-facing page, so its one-minute poll was the largest steady source.

## 2026-10-03 - Further Vercel CPU cuts: quiet grading poll and longer health caching

**Status:** Accepted

The commissioner Grading page polls every 15 minutes (was five) when no game is
near or live; the one-minute live/attention cadence is unchanged. Healthy
automation probes are CDN-cached 20 minutes, settlement and Bowl Pool one hour,
and backup six hours; worker probes stay at ten minutes to respect their
12-minute line-lock window.

**Reason:** Observability showed the Grading dashboard as the largest single
route and the health probes together about a third of background CPU, with the
30-day Fluid Active CPU total at the 4-hour allowance.

## 2026-10-03 - Symmetric Slate ticket; Survivor section torn off after elimination

**Status:** Accepted

The Slate ticket keeps its overall width and is symmetric: the left stub and
the Survivor section are the same width, with Pick'em between them. The
Survivor section is part of a week's ticket while the player is in the pool
and through the week they are knocked out. After that, and in the playoffs, it
is torn off: the stub and Pick'em that remain (same sizes) sit centered in the
same width, and the empty space stays until the next season, when Survivor
returns. After a champion is crowned the section stays for that week and then
leaves for everyone. On phones the six picks of a Wild Card round stack as two
columns of three on the narrower torn ticket. The board API reports this as
`survivor.showOnReceipt`.

**Reason:** An out player's ticket kept a dead Survivor column, and the
single-column version stretched wider than the picks needed.

## 2026-10-03 - The Standings ticket tears off Survivor too

**Status:** Accepted

The full ticket on Standings follows the same rule as the Slate receipt: its
Survivor section stays while a player is in and through their elimination week,
then is gone from the week after; it is also gone once the pool has a champion
and in the playoffs. Without it the ticket is a single column with the notes
beneath the picks. (Unlike the Slate receipt, the Standings ticket does not
keep the crowning week.)

**Reason:** An out player kept seeing "ENTRY CLOSED · OUT" on their ticket for
the rest of the season.

## 2026-10-03 - Trim Vercel Functions Storage

**Status:** Accepted

Functions Storage counts the function bundles of every deployment, and each
pushed branch was adding a preview deployment (about 90 deployments a day, 10.4
GB over 30 days). Vercel now skips preview builds except for `main` and
branches named `preview/...` (`scripts/vercel-ignore-build.mjs`); name a branch
`preview/<name>` when a phone preview is wanted. Separately, the two dashboard
routes no longer bundle the reminder worker and the image renderer (sharp, about
14 MB each) because the watchdog status read moved to `src/lib/watchdog-status.ts`.
The routes that really render email images keep it.

**Reason:** Functions Storage was at the edge of the Hobby allowance and the
project will not move to Pro.

## 2026-10-03 - Standings screenshot baseline and stylesheet cleanup

**Status:** Accepted

The Standings page (ticket, Pick'em Pad, Survivor Table, Bowl Card, and the
commissioner's flip to the Season Snapshot) has the same exact-match screenshot
baseline as the Slate (`npm run test:visual`, 44 images across phone, tablet and
desktop, with night mode on the busiest states). Against it, 49 style
declarations that provably changed nothing were removed, the ticket, Pick'em Pad
and Survivor Table rules were each gathered into one section, the flip rules were
rewritten as one block, and repeated rules were merged. Appearance is unchanged;
the Bowl Card's styles were deliberately left alone while its design is reworked.

**Reason:** The Slate cleanup showed the approach is safe when every state is
screenshot-tested, and the ticket and pad had their styles scattered across many
parts of a 4,000-line file.

## 2026-10-03 - Batch of Slate, ticket, and ledger refinements

**Status:** Accepted

The round cut-outs on the receipt are outlined with a hairline ring like the
straight edges. The Survivor chip on the receipt is larger (3.7 rem on desktop)
and centered in its section. On phones, pregame Slate rows without Survivor chips
set the favorite's name against the line from the left so the two names sit
symmetrically about it. The Pick'em Pad no longer shows an OUT mark under an
eliminated player's score (the ELIMINATED stamp over the picks remains). On a
phone, playoff rounds with more than two picks keep two columns on the Standings ticket, with each pick stacked (team, then kickoff and spread) so nothing overlaps, and the playoff ledger wraps each player's picks onto two lines
(2 x 2 for four picks, 3 x 2 for five or six) instead of scrolling sideways; the
round name sits under the ledger title.

**Reason:** The Wild Card ticket's two-column picks overlapped the spreads on a
phone, and a six-pick ledger needed horizontal scrolling to be read.

### Larger tap target for Slate picks

Each open team button on the Slate now has an invisible margin (about 0.7rem above and below, 0.35rem at the sides) that counts as a tap on that team, so a pick no longer needs an exact click. The margin sits behind other controls, so Survivor chips and links keep their own taps, and nothing changes visually.

### Slate spread alignment and ticket outlines

Pregame phone rows now mirror the kickoff lane with an empty right column, so the spread sits at the true center of the row, in line with the spread on finished rows. On finished rows the spread rides the team-name line instead of floating at the middle of the taller row. The ticket's notch rings are one pixel like the straight edges, and the perforation starts just below each ring over a strip of paper that hides the hairline where two sections meet.

### A real 3D poker chip, and a test chip on the Operations desk

The Survivor chip is now built as a true cylinder at a real chip's proportions (thickness about 8.5% of the diameter, like a 39 mm by 3.3 mm casino chip): two identical faces half a thickness either side of center, and 32 flat edge segments around the rim. Each quarter has one 16-degree segment carrying the face's colored insert over the edge, and the edge darkens as it faces away from the light, so it reads as round when the chip flips or spins. Head on it looks the same as before. A Raiders test chip sits to the right of Email center on the Operations desk heading: click to flip it, drag to turn it by hand. The "View chart data" tables on the grading dashboard are now plain ledgers instead of picking up the dashboard's pill-shaped row styling.

### A pick keeps its column

The Pick'em Pad and the ticket now place each player's picks by earliest kickoff, with the game id breaking a tie (src/lib/pick-column-order.js). Before, the Pad used submission order, so editing a pick, or two players entering the same picks in a different order, moved a pick between columns. The order uses only public facts about the game, so it does not change when a pick is revealed or settled. The ticket's instruction lines now wrap inside the Survivor column instead of running to the ticket edge.

### Final-lines mail is due when the day's last line locks

The game-day "final lines" and "Sunday final lines" emails were scheduled for the day's first line lock, then held by the sender until every game that day had its official line. On a Sunday with an international game, the first lock is Saturday at 6 PM Eastern, so both emails sat held overnight: the Watchdog reported them as two overdue messages, and the reminder worker was woken every five minutes all night for nothing. They are now scheduled for the day's last line lock, the first moment they can be ready, so they send at the same time as before without looking stuck. The email-schedule reconciler (every 15 minutes) moves any already-scheduled copies to the new time. The stuck-message alert now names the waiting messages.

### The Bowl Pool gets its own look

Navy and old gold on cream, with varsity lettering (Graduate) and an old-style italic (Cormorant Garamond). Both pages open with a crest heading: gold rules, three stars, BOWL POOL (BOWL CARD on Standings) and the season, which is computed from the season year (2026-27, then 2027-28, and so on). On Standings the matrix keeps its scoreboard layout; the dates, bowl names, and lines now read like a scoreboard header, and the player rows share the heading's serif and gold. Joining the pool is a "Claim your seat" ticket that replaces the old opt-in checkbox: until a player claims it, only the ticket shows on the picks page and on Standings; claiming it brings the whole card in. "Opt out" sits above the picks card until the first kickoff. Picking a team raises a felt pennant in that school's own colors. Every pennant is the same size and lettered with the school's name. The schedule import now saves ESPN's primary and alternate team colors and short school name with each team (migration 20261004010000; teams already saved pick them up on the next import, and a team with no colors gets a navy pennant). Team names replace abbreviations on the picks page and the Standings matrix because many schools share look-alike abbreviations. The pick instructions are a short list. The champion plaque is saved for the League History page.

The Claim your seat ticket states, "You may opt out at any time prior to first kickoff." Standings keeps abbreviations in the Bowl Card matrix so more games fit; school names are used on the picks page, where they matter most.

On the picks page the Bowl receipt is the Slate receipt for a player without Survivor: the same two-section ticket at the same width (79% of the Slate content column on desktop, 75% on a phone). Upcoming Slate games center each team name in its half of the row, so the two names sit the same distance from the line.

Bowl names on the picks page wrap only between words, never hyphenated mid-word, and locations wrap instead of being cut off on a phone. The screenshot sample now includes long names (Salute to Veterans, Frisco Football Classic) to keep this covered.

The Bowl Pool fonts (Graduate and Cormorant Garamond, both SIL OFL) are bundled from the @fontsource packages instead of fetched from Google Fonts, so a build or test run never needs to reach Google. A failed fetch had broken one end-to-end run, and could just as easily have failed a deploy. The rendered fonts are identical.

The test chip on the Operations desk is about twice its old size, turns more readily under a drag (1.9 degrees per pixel, up from 1.2), and a click runs the Survivor toss from whatever orientation it is in: three turns, landing flat and face up.

### Bowl Card scores as flip tiles

Each player's Bowl Pool win total is a two-digit flip tile in the style of the games-remaining counter: navy with gold digits for the signed-in player, cream with navy digits for everyone else. The first time the Bowl Card scrolls into view on a visit, each tile spins on its own (its own pace, each digit turning independently, slowing as it comes in) for about a second, then the tiles land down the line, one about a tenth of a second after the one above it (skipped for anyone who has reduced motion turned on). The score and name cells now share the row's paper color and its top and bottom hairlines, with a thin gold edge where the games begin, so the whole row reads as one.

Survivor chips show each team mark 18% larger than the Pick'em Pad does (still from the same even-size table), so the logo fills the chip face as it did before the sizes were evened out.

The split-flap tiles now run on the browser's animation engine instead of re-rendering the page on every flip, which made them slow and choppy on a phone. Each flip lets the top flap fall (accelerating and darkening as it turns away) and the next card's lower half land with a slight bounce; the last flip before stopping is a little slower, like the mechanism catching. The board paints at a steady 60 frames a second.

The split-flap was still dropping frames on phones. Measured with the processor slowed sixfold (to stand in for a phone), 78 of 175 frames ran late during the spin. Now the flaps fold flat (a vertical squash rather than a 3D turn, which reads the same at this size), every digit keeps a steady rhythm, the moving flaps no longer switch on and off or animate shading, each digit is sealed so a flip never relays out the table, and digits flip about eight times a second. Under the same test 20 of 203 frames run late, and the spin finishes sooner.

### Stylesheet trimmed of overridden declarations

A scan found 88 declarations (in 58 rules) that a later rule with the identical selector sets again, so they could never take effect: mostly leftovers from earlier Bowl Card and receipt restyles that later rules replaced. They are removed, along with the rules for three classes no component uses. All 102 screenshots are pixel-identical. Rules were not moved between sections: gathering the Bowl rules into one block changed 6 to 22 screenshots, because several Bowl rules deliberately follow generic rules they override.

### Standings spacing, sliding tables, and quicker score tiles

Every section on Standings (header, ticket, Pick'em Pad, Survivor Table, Bowl Card) is now separated by one gap, 1.5 rem on a phone and 2 rem on larger screens, the same above the ticket and below the last section (`.standings-stack`). Before, sections carried their own padding, so the gaps were 20, 40, and 56 px. The ticket's spread column is as wide as its widest spread, so spreads end at the dotted rule above them (a fixed 2.25 rem column let a spread overhang it). The space between the season label and the Bowl Card matrix is smaller. The Survivor Table and Bowl Card slide open and shut (`collapse.tsx`, 340 ms, none for reduced motion): content is mounted collapsed and grows, and removed after it shrinks, so a hidden table still costs nothing. The Bowl score tiles wait 350 ms (was a full second) before landing, 45 ms apart.

## Sliding tables: a height animation only (fix for #386)

The first sliding version wrapped the Survivor Table and Bowl Card in a class named `collapse`, which is also a Tailwind utility (`visibility: collapse`); my own stylesheet rule had been masking it, and the grid wrapper let wide tables stretch the page to 904 px on a phone, so both tables looked blank. The wrapper is now `.slide-section` with no styles of its own: content is always laid out and visible, and opening or closing runs a Web Animations height-and-fade on top (340 ms, none for reduced motion). If an animation never runs, the content is still in its correct state. `test/collapse-class-contract.test.mjs` keeps utility class names out of the wrapper. The Standings baseline now records the correct page width.

## Standings spacing reset skips the ticket (fix for #386)

`.standings-stack > section { padding-block: 0 }` also matched the ticket (a `<section class="my-ticket">`) and beat its own padding, so the footer touched the bottom edge. The reset now excludes `.my-ticket` and the loading ticket; the gap between sections is unchanged because it comes from margins.

## Sliding tables roll like window blinds

Opening a table used to skip the slide: the content was measured after it had already painted at full height, so it popped open. The slide now runs in a layout effect from zero height before the first paint, with no fade, on an ease-in-out curve over 420 ms (`collapse.tsx`). Survivor's − OUT / + OUT button rolls the eliminated rows shut and open the same way (`useBlindRows`): hidden rows stay on the page until they have rolled away. Reduced motion skips both.

## Worker activity on phones, test coin, chip edge shading, wider playoff ledger

- Worker activity: its own rules lost to the dashboard's generic table rules (one-line cells and a pill on every second column), so on a phone the dates overlapped and the status became a circle. Its selector now outranks them, and on a phone each run is a card: worker and status on one line, then "Started" and "Finished" lines.
- The Operations test coin flips three turns end over end and lands exactly where it started, instead of snapping to the nearest flat position.
- Chip edge: each rim segment was one flat shade, which showed faint steps between segments up close. Each segment now shades from its neighbor's tone to the next, so the edge reads as one round band. Thickness was left as is: it already matches a real chip (about 8.5% of the diameter).
- Playoff ledger: from tablet width up, every pick of the round sits on one line per player. Each column is only as wide as its longest entry (abbreviations and spreads vary) plus one even gap (1.25 rem on a desktop, narrowing on a tablet so six still fit), and the pad hugs the ledger, centered, instead of stretching across the page.

## Survivor picks in the pick reveal emails

The Sunday and featured-window reveal images now show the Survivor picks made on that window's started games, as a short "Survivor · Straight-up" section under the Pick'em table in the same image: name and team chip, three to a line, green for W and red for L once graded. It is part of the same image rather than a second one, so the email makes no extra image request, and the snapshot adds one small read (that week's Survivor picks on just those games, then the names and teams). Only games that have kicked off are read, so a pick on a later game stays private. Receipts saved before this change have no Survivor field and render exactly as before. Playoff reveals are unchanged, since Survivor ends with the regular season.

## Bowl Card: one line style for the whole table

Adjacent cells each drew their own border, so day breaks were doubled (2 px gold plus 2 px on the next cell, or gold against a navy edge at the tiebreaker), the header's lines were heavier than the rows', and the row rules were a different color. Every line in the Bowl Card table is now one single 1 px old-gold rule: day breaks are a left edge only, the frozen name column carries the edge where the games begin, the tiebreaker has one left rule, and each row has one bottom rule. The older overlapping border rules were removed rather than overridden. Spreads drop the minus sign, since the favorite is always listed on top.

## Live Slate rows take their final layout at kickoff

At kickoff a row used to keep the upcoming layout (centered names, a divider after a wider LIVE badge) and then jump to the final layout when the game ended. A live row now uses the final layout from kickoff: team names and picker lists sit where they will stay, the date column keeps its width, and the LIVE badge is sized to fit inside it.
On a finished or live row the spread's middle is level with the middle of the team names at every width, with or without Survivor chips (it sat about 10 to 14 px high beside the chips).

## Truer split-flap and coin-toss motion; Bowl Card "Special"; no dotted zeros

- Split-flap tiles: the flat squash did not read as a mechanism. Each flip is now two hinged halves turning in real perspective: the top half swings down toward you (accelerating), the next card's lower half follows, hits its stop with a small rebound, and the shading moves with them (the falling flap darkens, it shadows the half it is about to cover, the uncovered half brightens out of that shadow). Only transforms and opacity animate, on the browser's animation engine, so it stays light. Digits still step in order and stop only on their target, the last few flips slowing as the drum catches; a tile now takes a little longer to settle.
- Graduate draws its zero with a dot in the middle, so tiles and the games-remaining counter show its capital O, the same shape without the dot.
- Coin toss: the old toss slowed its spin to a stop like a spinning top. The chip now spins at a steady rate while it rises toward you and falls (height and swell follow a real arc), with a slight wobble, then lands flat and rocks to rest; the ground shadow widens and fades with height. 900 ms (was 680). The Operations test coin uses exactly the same curve, which a test keeps identical.
- The Bowl Card's season line reads "2026-27 Special".
- "Games" and "remaining" stack on two lines above the centered games-remaining counter.

## Bowl Pool picks page: tighter top, boxed team targets

The receipt now sits right under the menu (the page had a large blank band above it), and Opt out is a small link at the foot of the board instead of its own line between the receipt and the board. Each team is a large boxed button (at least 3.1 rem tall, with margin on every side) so a tap can never land on the wrong team; the chosen team's pennant fills its box, and names wrap only between words. On a phone the line has its own lane between the two boxes, wide enough for a spread like -10.5.
Pennants keep their normal size inside the boxes rather than stretching to the box width. The instructions read: "Pick every game." / "A game with no pick counts as a loss." / "Selections lock and are revealed to others at kickoff." / "Tiebreaker is total points in Championship game." (Submit is no longer mentioned; the receipt carries it.)
Opt out returns to the top of the board, as a small link right under the instructions, and the first instruction reads "Pick every bowl, including playoffs, against the spread. Participation is optional."

## Screenshot safety net

Before restructuring the stylesheet and data code, every view and state got an exact-match screenshot (and every email image a pixel baseline) so a change that looks different fails a test instead of reaching a player. New coverage: Bowl Card (graded, champion, claim, closed, minimized), Bowl picks (games started, complete, unsaved, entry closed), the Commissioner desk (six panels in healthy, attention and quiet states, Players, Reminders), Login, Notifications, Week Archive, the rehearsal preview, and 24 email image variants. CI now runs the suite on Linux in the pinned Playwright container (`visual` job); Linux baselines are recorded by the manual `Record Linux visual baselines` workflow and committed. `docs/VIEW_STATES.md` lists every state, its scenario and how to refresh baselines.
In CI the screenshot suite serves a production build (`next build` then `next start`) instead of the dev server: the first attempt, on the dev server, compiled each page on demand and ran 23 minutes with timeouts. A production build renders pixel-identically to the dev server (all 274 Windows baselines match), so one set of specs works both ways and the suite runs in about four minutes. The Bowl Card settle step now scrolls the card into view on purpose instead of relying on a quick scroll passing it.
Every screenshot spec now forces lazy images to load (and waits for them) before capturing; on Linux the old quick scroll did not always bring chip logos into range, so the wait timed out.
## Final scores line up in a column

On finished rows the score and its W/L mark followed the team name, so a longer name pushed its score further right and the scores never lined up (and a wide W nudged the digits left of a row with an L). They now sit in fixed slots at the end of each team's lane (score right-aligned, then a fixed-width mark), so every score on a side shares one edge on phones and desktop alike.
The receipt's warning tab ("You already have 2 selections…") is drawn like the sections above it: its paper is a masked layer with the same corner cutouts and hairline ring, and the dashed rule stays the divider. A screenshot test raises the warning on the Slate to cover it.
The warning tab no longer draws its own dashed top edge: that doubled the receipt's bottom rule and ran past the notches. The paper layer's single rule is the only edge where it meets the Pick'em section.
## Bowl picks page: stacked legend, A/P times, pinned receipt

The legend over the schedule stacks "Date / Time" and "Bowl / Location" on two lines like the rows below (no slashes). Kickoff times use A or P instead of AM or PM ("7:30P"), so the narrow date column stays on one line and no longer crowds the bowl names. The receipt scrolled away because it was sticky inside a wrapper exactly its own height, and a sticky element only travels within its parent; the wrapper itself now sticks, below the site menu, and a test scrolls to the bottom to prove it stays visible.
The Fav, Line and Dog labels are vertically centered in the legend bar next to the two-line labels.
## Coin toss lands cleanly; games remaining is a split-flap tile

- The toss used to land, then rise about a pixel and rock before resting (extra settle stops after the arc, and an end height one pixel off the chip's resting height, which differs between the picked and unpicked states). It is now one continuous arc that ends exactly at rest, lifts measured from the chip's own resting height (`--chip-rest`), so nothing moves after it stops. The Operations test coin uses the same curve, and a test keeps them identical and checks that after the peak the chip only comes down.
- The Bowl Card's games-remaining number is the same split-flap tile as the player totals (drawn larger), so it spins and lands the same way, first. Player rows now land 90 ms apart instead of 45 (starting 90 ms after the counter). The old dotted-zero counter and its CSS are gone.
- The empty corner above Tiebreaker on the date row is the page color, like the corner above Games remaining.

## Smooth sections, varied coin tosses, no stutter after the pad turns

- **One width contract.** The Survivor Table and Bowl Card (collapsed) are exactly the Pick'em Pad's width (`--pad-width`, 30 rem) and centered on it; expanded they grow to the page rail (the Bowl Card further, on a wide screen). The width glides over the same 420 ms and curve as the blind that rolls the table, so the heading stretches and shrinks outward from the center while the table rolls, instead of snapping. Measured: during a collapse both sit centered on the pad's midpoint every frame and end at the pad's exact edges. On a phone, where the rail is narrower than the pad, nothing changes.
- **Coin tosses vary.** Each Survivor chip toss picks its own spin-axis lean (5 to 13 degrees, either way) and speed (0.78 to 1.06 seconds), chosen once when the toss starts; the lean is zero at both ends so the chip still lands upright. The Operations test coin keeps one fixed flip so it can be compared.
- **Pad turn.** The Pick'em Pad now keeps its own graphics layer permanently. When it only had one during the turn, the browser dropped it at the end and redrew the text slightly differently, which showed as a small stutter in the W/L marks after everything had stopped; now the text looks the same before, during and after the turn. The pad's text is drawn marginally differently as a result (screenshots re-recorded).
The screenshot server serves images unoptimized (`NEXT_IMAGE_UNOPTIMIZED=1`, set only by `playwright.visual.config.ts`): the on-demand image resizer built each team logo on first request and sometimes stalled pages on Linux CI for a minute each, so the first CI runs hung until the job limit. Production is unaffected.

## Stylesheet split into feature files

`globals.css` is now just the Tailwind import, the feature imports and the theme block; the rules live in `src/styles/` (tokens, base, slate, receipt, survivor chip, Pick'em pad, Slate rows, ticket, Bowl card, chat, Survivor table, ledger, commissioner, Bowl Pool), imported in a fixed order that is also the cascade order. The split moved no rule: the pieces joined back identical to the old file, and all 278 screenshots passed without re-recording. `scripts/css-report.mjs` counts rules, selectors defined twice, `!important`, hard-coded hex colors and night-mode rules; `test/stylesheet-budget.test.mjs` fails if any of them goes above `test/stylesheet-budget.json` (lower the numbers when a change reduces them, never raise them). `scripts/merge-duplicate-rules.mjs` merges a repeated selector into its later rule only where nothing in between touches the same property family (first run: 60 declarations moved, 2 dropped, 12 empty rules removed). Tests read the stylesheet through `test/helpers/stylesheet.mjs`, so file moves never break them.

## Response shaping pulled out of the routes

The Slate and Home routes and the reveal-email builders mixed database reads with the rules for what a viewer may see. The shaping is now in three modules with no database access (`slate-shape.ts`, `home-shape.ts`, `reveal-rows.ts`), moved without logic changes, and each has tests on fictional rows: pickers named only after kickoff (including the exact kickoff second), a player's own pick visible to them while others' stay hidden with no team, spread or result leaking, picks kept in kickoff-column order, official lines over preliminary ones, and reveal images including only revealed games from this period. One existing quirk is pinned rather than changed: a line row whose spread is null reads as a pick'em in the reveal label (it cannot occur, since official lines always carry a spread). Not done in this step, on purpose: splitting the Slate page's state into hooks, whose rows depend on being redrawn only when their own game changes; that is worth doing only with the performance check beside it.

## Slate page rules pulled out of the page

The Slate page's decisions now live in `src/lib/slate-view.ts` with no React in them: what a click on a team does (add, swap, remove, refuse at the limit, sealed once the game has kicked off, to the second), the Survivor used-team rule (a used team is refused except the one chosen or the saved one during an unsaved replacement), whether a receipt removal is allowed, the Eastern-day grouping, the Pool Action filter (upcoming games, plus started ones with public picks), the receipt's list of selections (game order, signed lines, home/away casing, removability, saved flag) and the unsaved-changes check. The page keeps its state and effects and applies these results with the same updates as before, so its rows still redraw only when their own game changes. Measured under a 6x CPU slowdown over 16 pick clicks on a phone-width Slate: script time 0.13 to 0.14 s before, 0.14 to 0.15 s after (within run-to-run noise). The page's loading and saving effects were deliberately left in place.
## Screenshot specs wait for decoded images

One Linux screenshot (Standings, regular-in, tablet width) failed once on main after a merge, in a 528-pixel band of the Survivor logos, and passed on the very same code in the pull request run and on every rerun. A loaded image counts as complete before it is necessarily decoded, so a capture could catch a logo mid-draw. Every spec now also waits for each image to decode before it captures.
Dependabot now skips ESLint major versions: ESLint 10 breaks the React lint plugin bundled in `eslint-config-next` (`getFilename is not a function`), which fails the lint step on every run, so its pull request is closed rather than left failing. Revisit when Next's lint config supports ESLint 10.

## Survivor logos masked in the Standings screenshots

The Standings screenshot failed again on Linux CI in a different case (night, phone), and on two more pull requests: the same band of about 550 pixels in the Survivor logo row, every time, in a few percent of runs. Zoomed in, the logos are the same but drawn with a very slightly different downscale (they are large originals scaled to about 28 px). Waiting for images to decode did not remove it. The Standings pictures now mask the Survivor logos: each logo's box (so its position and size) is still compared, only the artwork inside it is not. The masked screenshots were re-recorded for both platforms.

## Sentry 11

The Sentry 10 to 11 upgrade needed two changes. `withSentryConfig` moved to `@sentry/nextjs/config`, so `next.config.ts` imports it from there (the old import failed the build with "withSentryConfig is not a function"). And `sendDefaultPii` was removed: its replacement is the `dataCollection` group of options, whose defaults collect cookies, request headers, user details and local variables. The old line no longer type-checks, and simply deleting it would have quietly started sending that data, so all three setups (browser, server, edge) now use one shared `PRIVATE_DATA_COLLECTION` that turns every category off, with a test that fails if any setup stops using it.

## Survivor table opens and closes without a hitch

The Survivor toggle waited for the server before changing anything, so the roll started a network round trip late, and the page redrew three times around it: a "saving" flag on, the choice applied (the roll starts here), and the flag off, which landed in the middle of the animation. The Bowl Card went through the same steps but its own content does less work per redraw. All display choices (Survivor table, Bowl Card, hide eliminated rows) now go through one helper: the choice is remembered and shown at once, the save runs in the background, a failed save puts the old choice back with an error message, and a second tap during a save is ignored by a ref, not a state flag, so nothing redraws mid-roll. Each Survivor row is also its own memoized component, so a redraw of the table does not rebuild every logo. Measured under a 4x CPU slowdown, script time per toggle dropped from about 0.113 s to about 0.067 s, and the two extra redraws are gone. A test pins the order (remember, show, then save) and the revert.
Found by measuring the position of the Bowl Card under the Survivor table frame by frame: when the Survivor table finished rolling shut, everything below it dropped 11 px at the very last frame. The gap under the heading was the heading's own bottom margin. While the (zero-height) rolling wrapper was still in place that margin stayed in the section's height; when the wrapper was removed at the end it collapsed through, and the section shrank by the gap in one step. The gap now lives inside the rolling wrapper as the content's top margin (the wrapper contains it), so it travels with the table: the same layout when open and closed as before, and the last step of a close is now under 1 px.

## The Bowl Card no longer pops in, and "− OUT" ends without a jump

The Standings page showed itself as soon as its own data arrived, and the Bowl Card filled in a moment later, so it appeared out of nowhere. The page now keeps the loading shell up (with the real page laid out but hidden beneath it) until the Bowl Card reports its first load finished, whether it worked or not, or 2.5 seconds have passed.

The "− OUT" roll jumped 3 px at its last frame. Measured frame by frame: browsers draw a border under one pixel as a whole pixel, so each hidden row kept its 1 px bottom border until it left the page, and the last visible row also loses its border when it becomes the last row. The roll now takes the borders back with a negative bottom margin, which animates smoothly, and releases the held animations in the same render that removes the rows. The last step went from 3 px to 0.

## 2026-10-05 — Validate save payloads at the boundary and limit launch-holder fallback

Pick'em and Bowl Pool save requests are parsed as unknown input before slate
lookups or writes. Invalid array entries, IDs, duplicate games, oversized
selection sets, and invalid Bowl total guesses receive a deliberate client
error. The Pick'em parser preserves the distinction between no Survivor field
and an explicit clear; database functions still enforce the competitive rules
and atomicity. The known inaugural Survivor holder display fallback applies
only to the uncrowned 2026 launch season. A later season without a recorded
champion displays no holder instead of silently reusing a name match. This
fallback changes display only, never a championship record.

## Sections now open to their exact height

When the Survivor table finished opening on desktop, the Bowl Card below moved down about 0.4 px and came back. The blind measured its target with `scrollHeight`, which rounds to a whole pixel, so it stopped up to half a pixel off and corrected itself when it let go. It now measures the content's height to a fraction of a pixel, and an opening blind also follows the content if its height changes while opening (the table wraps differently as it glides wider). Measured at 1280 px: the last steps are now 1305.11, 1305.75, 1305.78, 1305.78 with no overshoot.

## 2026-10-05 — Share viewer-safe Slate and Standings response contracts

The two player pages and their routes now compile against the same response
types. Database rows remain distinct from viewer-safe JSON, so this does not
weaken kickoff privacy. The application explicitly recognizes the three
Survivor entry states allowed by the current database CHECK constraint and
fails visibly if a future schema adds a state without a display rule. A local
`typecheck` command supplies fast contract feedback; the production build
continues to enforce TypeScript in CI.

## 2026-10-05 — Mark the privileged Supabase client server-only

The application Supabase client uses a service-role credential and must never
be reachable from a Client Component. Mark its single privileged entry module
with Next.js `server-only`, which makes the framework fail the build if a
client import is added directly or through another module. Keep browser reads
on the publishable-key client and viewer-safe API routes instead.

## 2026-10-05 — Stop score-worker stages after the lease timeout

The shared lease timeout previously rejected its caller while the score task
could continue running. The score worker now receives an abort signal from its
lease. Scheduled, Commissioner, and watchdog score paths all pass it through;
the provider request accepts the signal and the worker checks it between
database stages. A timeout still retains the lease until expiry because a
database operation already in flight may have committed. Atomic finalization
and pending-grade recovery remain the source of truth for the next run. Other
workers retain their existing zero-argument callbacks until their own stage
boundaries and retry behavior are covered.
