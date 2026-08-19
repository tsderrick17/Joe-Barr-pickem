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

The major recap becomes eligible Tuesday at 8:00 AM Eastern after accurate
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
