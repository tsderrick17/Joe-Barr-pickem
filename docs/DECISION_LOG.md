# Durable decision log

This log records project rules that future changes must not casually reverse.
Entries preserve the original reasoning; a later change marks an older detail
as superseded and records the current contract rather than rewriting history.

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
