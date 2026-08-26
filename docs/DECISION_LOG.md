# Durable decision log

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

**Status:** Accepted

Keep the existing self-service email choices, expressed as Essentials, Regular,
and Full Card plans with optional detailed controls. Existing player choices are
preserved until that player changes them. Deliver no more than one routine pool
email per player per Eastern calendar day; deadline reminders and material
early-lock or schedule-change notices remain eligible because they can require
timely action. Record intentionally held routine messages as receipts so the
Commissioner can distinguish them from delivery failures.

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
Record a successful monthly completion artifact so later daily checks skip, but
allow a failed attempt to retry on another non-gameday and preserve manual
dispatch. This does not change production availability—the rehearsal has always
been isolated—but it keeps optional CI work and alerts away from peak game use.
