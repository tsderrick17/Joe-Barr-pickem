# Codebase improvement execution plan

Prepared: October 5, 2026. Review baseline: `34e12ac` on `main`.

Status: in execution on the October 5 review baseline. Completed locally so
far: mutation-boundary validation and the launch-year holder correction;
shared player-access handling across the principal player routes; browser
session lifecycle coverage; shared API contracts for Slate, profile, saves,
and grading; and TypeScript checking for core policy modules. The Slate state
work is active: selection drafts and saved snapshots now share a reducer,
week switching is locked during saves, initial bootstrap reads are bounded and
cancelled on unmount, and pending Pool Action preference changes survive stale
week responses. Ambiguous pick-save outcomes now trigger one safe read rather
than an automatic mutation retry. The Slate's bootstrap/week loading, request
cancellation, server clock, and kickoff visibility refresh now live in a
dedicated data hook; its kickoff refresh intentionally never hydrates player
drafts. Browser-width and isolated player-flow evidence for this extraction
remain outstanding. Phase 0 route-cost measurements, generated database types
and drift checks, further score-worker stage extraction/cancellation, and
measured query optimizations also remain open. The first worker slice now
isolates completed-event selection and provider-team score matching in a pure
module. Due-game cooldown eligibility and the regular/playoff polling-mode
decision now live in a second pure module. Provider HTTP/JSON intake is isolated
behind a tested transport boundary that preserves quota headers on failure;
the repeated-delay/provider-reserve conjunction is now an explicit tested
backoff policy. The polling cadence, quota thresholds, persistent retry
backoff, and atomic database grading path are unchanged.
Environment-dependent isolated database,
full-season/weekly rehearsal, and isolated-copy checks are not implied by a
passing local application suite. The current application suite passes (581
tests: 561 pass, 20 environment-gated skips, none failing); lint and both
TypeScript checks pass. The production compile succeeds, but Next's final route
collection cannot finish in this environment because server-side Supabase
configuration is absent. A repeat of the fictional response-shaping benchmark
matched the recorded payload sizes and remained below 0.17 ms median per call;
it does not substitute for the isolated database-backed route measurements.
This worktree has no isolated-test credentials, so no route request or external
Supabase connection was attempted. This document does not change pool rules,
authorize a production data correction, or supersede the project reference.
Recheck the current branch before starting each work package: development with
Claude and the stylesheet work may have advanced the baseline.

## Outcome

Make the application easier to understand, change, verify, and operate within
its free hosting allowances. Success means fewer repeated definitions and
authentication branches, explicit request and state transitions, executable
evidence for competitive rules, and measured performance improvements.

The existing response-shaping modules, atomic database functions, isolated
rehearsals, screenshot suite, due-work dispatch gates, and production health
checks provide the foundation. Extend those mechanisms where they already fit.

The governing references are [AGENTS.md](../AGENTS.md),
[PROJECT_REFERENCE.md](PROJECT_REFERENCE.md), [SOP_INDEX.md](SOP_INDEX.md),
[isolated testing](isolated-integration-tests.md),
[database deployment](supabase-github-cutover.md), and
[view states](VIEW_STATES.md).

## Execution rules

- Give each pull request one reviewable responsibility. Separate behavior fixes,
  mechanical type adoption, visual changes, and query optimization.
- Before extracting existing behavior, add meaningful missing coverage for that
  behavior. Keep privacy, security, migration, and configuration guards where
  they protect a real invariant.
- Preserve atomic database enforcement, leases, quota reserves, retry safety,
  gameweek pins, pick privacy, and historical records throughout the work.
- Make new database changes in timestamped migrations. Applied migrations and
  historical root SQL files remain unchanged.
- Keep changes compatible with the existing browser/API contract while moving
  callers. Any required database addition must support the old application
  until the new application has deployed successfully.
- Use the existing reviewed release path and required checks. Choose quiet
  release windows for authentication, saves, and workers; avoid changing these
  during a live kickoff, line lock, grading run, or recap delivery.
- Update operating references and the decision log when behavior changes.
  Refactoring-only PRs should state which outcomes remain equivalent.

## Coordination with Claude and stylesheet work

Use a short shared work log in each active PR: baseline commit, scope, owner,
files being edited, tests, and remaining dependencies. Compare current `main`
before branching and again before merge. Branches should stay short-lived.

The stylesheet pass owns style files, class conventions, and intended visual
changes. The state refactor owns page controllers and request lifecycles.
Those efforts can research independently, but overlapping edits to a page or
component should land sequentially. Agree on component interfaces first.

During state and worker extractions, retain markup and class names. Unexpected
screenshot differences require investigation; baseline regeneration belongs
only to a reviewed visual change. Do not make broad formatting or renaming
changes in a functional PR, because they obscure the relevant diff.

## Phase 0: Establish a baseline and early measurements

Effort: small. Risk: low. Dependency: none.

1. Confirm current `main`, the migration state in isolated-test, and the existing
   application, browser, visual, and database gates. Record actual results and
   explicitly identify environment-dependent skips.
2. Create a compact architecture map for player reads, pick saves, provider
   workers, and email preparation. Identify where each rule is decided and
   where the database independently enforces it.
3. Record initial measurements for `/api/home`, `/api/board`, and the grading
   dashboard using fictional isolated fixtures: database request count, rows
   returned, response bytes, and elapsed time. Include early season, late
   regular season, playoffs, and multiple historical seasons.
4. Record the existing behavior of auth errors, failed reads, stale responses,
   saves with uncertain outcomes, and worker timeouts before changing it.

The previous review did not measure live production CPU or query latency.
Distinguish isolated measurements from production observations and identify
cache state, fixture size, and sample count in reports. Use existing telemetry
for production trends; avoid adding a database write for every page request.
Measurements must exclude credentials, picks, names, and email addresses.

Done when: the baseline is reproducible and later PRs can show an explicit
before/after result. Do not make a timing threshold a hard CI gate until its
noise and usefulness are understood.

## Phase 1: Fix small boundary and historical correctness gaps

Effort: small to medium. Risk: low to medium. Dependency: Phase 0.

### Validate submissions before accessing fields

Start with `/api/picks`, then Bowl Pool and other mutation routes. Treat JSON
as unknown input and validate the object, every array element, IDs, allowed
values, optional fields, and size limits. A TypeScript cast is not validation.

Preserve the distinction between an omitted Survivor selection, an explicit
clear, and an unchanged selection. A sealed Survivor pick must still allow an
otherwise legal ATS save. Database functions remain the final authority for
kickoff, ownership, team membership, and atomic writes.

Use small shared validators where the same shape is actually reused. Select a
schema library only if it reduces complexity across enough routes to justify
the dependency. Preserve existing successful response fields and user wording.

Tests: malformed JSON; null body; null selection; missing or wrongly typed IDs;
duplicate games; excessive selections; invalid Survivor shape; legal empty
clear; and no mutation on rejected input.

### Remove the unbounded inaugural-champion fallback

The home route currently falls back to a player named John when the season has
no Survivor champion, without restricting that fallback to the launch year.
Verify the intended historical fact before choosing a correction. Either
represent confirmed history in the existing championship model or narrowly
scope a compatibility fallback to the launch condition. Do not fabricate a
championship or populate history from an assumed name match.

Tests: launch-year display, an uncrowned later season, a crowned season,
co-champions, and an absent/inactive historical holder.

Done when: invalid requests produce intentional client errors without uncaught
property-access failures, valid saves behave identically, and historical display
is based on an explicit season condition or verified record.

## Phase 2: Strengthen database and application contracts

Effort: medium. Risk: low to medium. Dependency: Phase 0; can follow Phase 1
without touching its behavior.

### Generate database types

Generate a committed database type file from the isolated database after the
current migrations have applied. Confirm that isolation-only schedule removal
does not alter application schema types. Connect the server and browser
Supabase clients to those definitions and adopt them in a small pilot first.

Migrate remaining reads and RPC calls in feature-sized PRs. Resolve each
reported mismatch against the migration/database contract rather than masking
it with broad casts, `any`, or suppressions. Check whether nullable joins and
numeric values genuinely need normalization at the query boundary.

Add a reproducible generation command and a schema-type drift check to the
privileged isolated workflow. Do not grant isolated credentials to Dependabot
or fork checks. The normal application build checks committed types without
needing database credentials.

### Share API contracts and check core JavaScript

Define serializable request/response types used by both routes and pages.
Start with Slate, Standings, pick saves, and grading. Keep database rows,
application decisions, and viewer-safe API responses distinct: sharing a raw
row type must not expose a hidden pick or private profile field.

There are 60 JavaScript source files in the review baseline. Gradually add
checked JSDoc or convert the core policy modules to TypeScript when touched.
Start with scoring, game status, visibility, and eligibility. Preserve Node
test execution and avoid a repository-wide extension rename.

Add an explicit type-check command suitable for local fast feedback. Enforce
server/browser import boundaries using the existing tooling, taking the real
test loader into account. Prevent runtime imports of privileged database and
worker modules into browser components; type-only imports remain distinct.

Done when: the main data flows use generated database types and shared API
contracts, unsupported status values cannot quietly disappear from a manually
defined union, and schema drift is detected by the isolated gate.

## Phase 3: Unify authentication, errors, and behavioral evidence

Effort: medium. Risk: medium for route migration, low for added coverage.
Dependency: request contracts and baseline tests. Add coverage before replacing
the implementation of each route.

### One server authentication result

Use a shared result that distinguishes a verified active player, missing or
invalid session, inactive player, insufficient role, missing configuration,
and temporary dependency failure. Centralize token verification and active
player lookup; keep commissioner authorization explicit at the protected route.

Use consistent status semantics: 401 for missing/invalid authentication, 403
for denied access, 503 for temporary service failure, and an intentional server
configuration error for missing configuration. Preserve client-compatible
`error` text; add stable machine-readable codes where useful.

Migrate a pilot read route first, then Home/Slate/Bowl, then mutation and
commissioner routes in small groups. Do not globally cache authorization or
retry mutations. A browser must not log out merely because a verified profile
could not be read during a service outage.

The browser session helper already shares reads, refreshes sessions, retries
safe reads, and invalidates shared data on identity changes. Add missing
execution coverage for those promises rather than introducing another cache.

Tests: malformed/expired bearer; inactive player; valid commissioner; ordinary
player on a commissioner route; auth service outage; profile database outage;
session refresh; sign-out/sign-in as another player; request deduplication;
cache invalidation; and no blind retry of an uncertain save.

### Strengthen tests where wording currently stands in for behavior

Classify source-inspection checks by purpose. Retain useful checks for secrets,
unsafe SQL, installed schedules, and import boundaries. Replace behavioral text
checks only after equivalent execution coverage exists. Tests should allow a
function to move or be renamed without losing protection.

Build a small dependency-injection seam for network/database operations where
necessary, without constructing a new general framework. Exercise real route
handlers and policy modules with deterministic clocks and controlled failures.
Retain real isolated database/browser flows for integration evidence.

Create shared fictional scenarios with independently specified expected results
and run them through both application scoring and the appropriate database
functions. Cover favorites/underdogs, half/whole/zero spreads, pushes, ties,
missing lines, voids, kickoff equality, and playoff day-start eligibility.
Pool-specific NFL and Bowl rules must retain their intended differences.

Done when: protected routes share failure semantics; transient failures do not
masquerade as lost permissions; key tests invoke production code; and selected
cross-layer rules are checked against the same expected scenarios.

## Phase 4: Simplify page state and requests

Effort: medium. Risk: medium. Dependency: Phases 2 and 3; coordinate with styles.

Start with the Slate page. Separate the loaded server state, editable draft,
saved selections, submission status, server clock, and visual feedback. Use a
focused reducer where several values must transition together and a data hook
for loading, cancellation, and kickoff refreshes. Keep purely derived values
derived instead of duplicating them in state.

Define transitions such as load start/success/failure, week change, draft edit,
save success/failure, and kickoff refresh. Latest-request checks and cancellation
must ensure a previous week cannot replace the selected week. Public-visibility
refreshes must not replace an unsaved draft. On an uncertain save, read the
saved state safely before assuming success or offering another submission.

Retain current layout, keyboard behavior, server-clock protection, visibility
timers, selection limits, Survivor rules, and saved-preference behavior.
Apply a smaller version of the same approach to Standings only where it removes
actual duplication; pages need not all use an identical abstraction.

Tests: out-of-order reads; rapid week switching; editing during refresh; kickoff
crossing; ATS change with sealed Survivor; display-preference save during a
stale read; failed save; and a save committed before its response is lost.
Run existing phone-width visual and isolated player-flow checks.

Done when: each request/state transition has a clear owner, stale reads cannot
overwrite a draft, and existing views match their intended screenshot baselines.
A smaller line count is supporting evidence, not the acceptance criterion.

## Phase 5: Clarify workers and make cancellation cooperative

Effort: medium to large. Risk: higher. Dependency: contracts and behavioral
coverage. Complete one worker at a time, beginning with scores.

### Extract decisions without changing timing

Use explicit stages: read context, determine due work, obtain/validate provider
input, build an intended change, commit through atomic database functions, and
record the outcome. Extract pure decisions and recap transformations first.

Inject a clock and provider transport at the narrow boundary needed for tests.
Keep provider omissions, quotas, retry ladders, fallback freshness, disrupted
picks, eligibility snapshots, rollover, and immutable email snapshots under
their existing rules. Share transport or run-recording helpers only when their
semantics are genuinely the same across workers.

Document the order of stages and which partial outcomes are safe to retry.
Use a consistent small outcome record for job, run identifier, duration, useful
work performed, and failure category, without adding personal data to telemetry.

### Strengthen the timeout boundary separately

The existing `Promise.race` timeout rejects the waiting caller but does not stop
the task itself; the lease is deliberately retained until expiry on timeout.
Preserve that safeguard while adding an execution context with a deadline and
abort signal. Pass cancellation to supported provider reads and check it before
starting additional work or commits.

Cancellation is not a guarantee that a database call or email delivery did not
commit. Retain atomic operations, delivery receipts, and idempotency protections
for uncertain outcomes. Any lease/fencing change requires separate database
design and isolated evidence; do not assume client cancellation solves it.

Tests: idle run; provider timeout; invalid/partial payload; quota protection;
duplicate run; commit followed by lost response; outcome-recording failure;
expired execution context; no later stages after cancellation; and recovery
without duplicate grades, line changes, rollovers, or messages.

Done when: worker order is readable, failure and retry boundaries are explicit,
and timeout/retry behavior is proven in isolated tests. Run the full-season
certification for changes that affect scoring or lifecycle orchestration.

## Phase 6: Optimize measured costs and establish budgets

Effort: small to medium per optimization. Risk: medium for database/caching
changes. Dependency: Phase 0 measurements; safe measurement can continue during
other phases.

Start with Standings and Slate. Examine repeated bootstrap reads, loading an
entire season of picks to compute totals, and fetching every preliminary spread
when only the newest value is needed. Use representative isolated query plans
to decide whether a query change, supporting index, or focused view/RPC helps.

Prefer reducing unnecessary rows and requests before introducing more caches.
Any aggregation must preserve exactly which wins, voids, and pending picks
count. Keep season-history reads scoped and paginated. New views/RPCs must have
explicit grants and preserve pick privacy.

For caches, classify data as shared public, viewer-specific, or private before
choosing a key and lifetime. Account for kickoff reveals, completed saves,
grading, season rollover, and account changes. Preserve the existing adaptive
refresh and provider gates; avoid creating extra recurring jobs or paid services.

Use deterministic CI budgets for request/row counts and response size where
they protect a meaningful cost. Report latency trends rather than failing on
small wall-clock variations. Compare production usage over equivalent windows
with similar game activity; distinguish request volume, active CPU, storage,
provider credits, and estimated costs.

Done when: each optimization has a before/after report, relevant privacy and
correctness tests pass, and a repeatable budget prevents the old excess from
returning. Keep performance work separate from scoring-rule changes.

## Suggested pull-request sequence

This is a scope guide, not a requirement to combine large changes. Split a row
when the diff stops being easy to review; approximately 12-16 focused PRs is a
reasonable initial planning range, not a delivery promise.

| Package | Scope | Depends on | Evidence to finish |
| --- | --- | --- | --- |
| A | Baseline, architecture map, isolated measurements | None | Reproducible report and known gaps |
| B | Pick-save validation, then other mutation boundaries | A | Invalid inputs rejected; valid save flow passes |
| C | Inaugural-holder correctness fix | A, verified history | Later season and championship cases pass |
| D | Generated database types and pilot client/query adoption | A | Generation and type checks pass |
| E | Shared API contracts and remaining type adoption | D | Feature-sized migrations; schema drift gate |
| F | Shared authentication result and pilot route | B, E | Execution tests for each failure category |
| G | Remaining auth routes and browser session coverage | F | Isolated sign-in/save flow; identity-change tests |
| H | Shared scoring scenarios and highest-value behavior tests | D | Application/database outcomes agree |
| I | Slate request/state extraction; limited Standings follow-up | E, G, H | Race tests, browser flow, unchanged visuals |
| J | Worker decision extraction, one worker per PR | E, H | Failure/retry tests; relevant lifecycle gate |
| K | Cooperative cancellation and execution-boundary tests | J | Timeout/uncertain-write recovery proven |
| L | Measured query optimizations and regression budgets | A, relevant types/tests | Before/after cost report and privacy checks |

Measurement and test preparation can proceed alongside the stylesheet pass.
Overlapping page changes, shared authentication migration, and production worker
changes should merge sequentially. Keep the isolated database concurrency group
so parallel branches cannot interfere with shared fixtures.

## Verification and release matrix

All implementation PRs retain required repository checks. Use focused local
checks while iterating, then run the normal application gate before handoff:
`npm run test:all`, `npm run lint`, and `npm run build`.

| Change | Additional evidence |
| --- | --- |
| Documentation-only planning | Existing documentation/link checks |
| Database/API types | Explicit type check; isolated schema/type drift check |
| Authentication or save parsing | Route failure tests; isolated PIN, ATS, Survivor, and ordinary-player access flow |
| Page state | Race tests; visual suite; phone-width browser check |
| SQL or query grants | New migration; isolated integration and permission checks; production preview |
| Scoring/lifecycle worker | Fault tests; full-season certification where lifecycle changes |
| Email preparation/delivery | Snapshot/artwork checks; isolated delivery retry/receipt cases |
| Performance | Repeated baseline comparison; output correctness and privacy tests |

Production release requires the existing PR, preview, application, and relevant
database checks. Deploy database additions in a backward-compatible step before
application code needs them, then verify Launch Preflight. After application
deployment, verify the production smoke gate and the affected flow through
safe reads; do not create production fixtures or trigger real delivery as a test.

For each release, record the commit, results, before/after behavior, any migration,
and recovery path. Use the previous known-good deployment or a reviewed revert
for application regressions. Applied database migrations remain in place; any
schema correction is a new tested migration. Preserve completed saves, finals,
and delivery receipts when recovering from a failed release.

## Completion scorecard

- Key database operations and API responses have dependable shared contracts.
- Authentication distinguishes lost access from temporary service failure.
- Invalid submissions cannot reach property access or mutations unchecked.
- Competitive rules have execution coverage across application and database.
- State transitions preserve drafts and reject stale responses.
- Worker stages, deadlines, and uncertain outcomes have an explicit contract.
- Cost improvements have measured evidence and practical regression budgets.
- Styling and functional refactors remain independently reviewable.
- Current reference/runbook entries describe the delivered behavior, and every
  milestone identifies remaining work instead of claiming blanket completion.

Begin with A and B. Review their evidence, then proceed through contracts and
authentication before changing page state or worker orchestration.
