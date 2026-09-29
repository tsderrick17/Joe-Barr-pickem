# Durable decision log

## 2026-09-22 - Email artwork and preview share one renderer

**Status:** Accepted

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

This log records project rules that future changes must not casually reverse.
Entries describe the current accepted decision; a later change adds a new entry
that explicitly supersedes the old one.

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

## 2026-08-09 — REF-004 — Treat provider omission as incomplete input

**Status:** Accepted

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

## 2026-08-09 — REF-010 — Protect provider and compute allowance

**Status:** Accepted

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
### REF-017 — Harden advisor findings without opening data access (2026-08-18)

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
## 2026-09-07 — REF-028 — Keep the NCAA Bowl Pool separate, voluntary, and push-free

**Status:** Accepted

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
## 2026-09-08 — REF-029 — Make production worker failures actionable to the Commissioner

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
## REF-033 — Agile NCAA bowl schedule staging

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
## 2026-09-22 — Interactive provider charts and monthly credit accounting

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

The Pick'em Pad contains a default-minimized Season Snapshot, visible only to
commissioners until release. The graph uses historical period results, and its
commissioner-only endpoint loads only while expanded. The original settled-week
chart treatment was superseded by the alignment, active-card, and visual rules
below.

## 2026-09-28 - Season Snapshot week alignment and release timing

**Status:** Accepted, revised for commissioner preview and simplified chart

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
