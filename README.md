# PickemJB — Joe Barr Memorial Pick'em

PickemJB is a production NFL pool application for season-long against-the-spread Pick'em and regular-season Survivor, with a separate NCAA Bowl Pool. It is built for a small private league where accurate scoring, pick privacy, and reliable unattended operation matter more than adding features quickly. The live site is [pickemjb.vercel.app](https://pickemjb.vercel.app/); player and commissioner access is private.

This repository is both the application and its operating record: source code, database migrations, tests, deployment workflows, and incident runbooks live together. The project favors a fail-closed rule: an uncertain line, final score, schedule change, or eligibility decision pauses the affected transition instead of guessing or rewriting history.

## What the application does

- Lets players submit and revise individual picks until each game's kickoff, while keeping other players' picks private until that kickoff.
- Locks official spreads, imports verified finals, grades ATS and Survivor picks, and advances weeks through guarded, auditable database operations.
- Handles playoff eligibility from an immutable Eastern-day-start snapshot, including voiding future picks when a player is mathematically out.
- Preserves completed seasons and championships while creating each new season with a blank schedule and picks.
- Gives the commissioner a read-first operations desk for schedule, grading, reminders, provider usage, incidents, and exceptional recovery.
- Runs a voluntary Bowl Pool with its own schedule, picks, scoring, standings, and history.

## Engineering approach

| Boundary | Responsibility |
| --- | --- |
| Next.js on Vercel | Player and commissioner interfaces, authenticated API routes, email artwork, and public opaque health checks |
| Supabase/Postgres | Durable pool records, row-level security, integrity constraints, atomic scoring and rollover, leases, audit events, and scheduled dispatch gates |
| nflverse, The Odds API, ESPN | NFL schedule; NFL spreads/finals; Bowl schedule, preliminary lines, and finals respectively |
| Brevo | Opt-in player email and actionable commissioner alerts |
| GitHub Actions | Quality checks, guarded migrations, isolated rehearsals, encrypted backups, and deployment smoke checks |

The important design choice is to put competitive invariants in the database as well as the application. Gameweek pins, official lines, grade changes, and season transitions are not trusted to a browser or a single serverless invocation. Scheduled jobs and commissioner recovery controls share authentication, execution leases, quota protection, and the same atomic functions. Provider omissions are incomplete input, never an instruction to delete a game.

The system also manages free-tier limits deliberately: due-work gates prevent idle line-lock, reminder, and Bowl dispatches from invoking Vercel; score polling uses durable per-game retry times; health probes cache healthy answers; email images are rendered once and served from storage. These are engineering policies, not a claim that external free-tier limits or providers can never change.

For a technical review, useful starting points are [schedule validation](src/lib/full-schedule-provider.js) and its [adaptive-season integration test](test/integration/adaptive-season-length.test.mjs), the [score worker](src/lib/sync-final-scores.ts) and [automation watchdog](src/lib/automation-watchdog.ts), and the [playoff-eligibility tests](test/playoff-eligibility.test.mjs). The [full-season chaos certification](test/integration/full-season-chaos-certification.test.mjs) exercises those boundaries together against isolated data.

## Verification and release

The fast suite exercises scoring, privacy, scheduling, provider accounting, and failure paths. Privileged tests run only against a separately confirmed `isolated-test` Supabase project. The full-season drill rehearses 18 regular weeks and four playoff rounds in a disposable 285-game fixture; it is a certification scenario, not a hardcoded limit on future NFL seasons. Pull requests run application checks, a Vercel preview, and relevant isolated database/browser checks. Production migrations are previewed before application, and a successful Vercel production deployment triggers a public-contract smoke gate.

For a local code check with Node.js 24 and npm:

```text
npm ci
npm run test:all
npm run lint
npm run build
```

Integration and browser tests need the isolated credentials described in [isolated testing](docs/isolated-integration-tests.md). Do not point them at production. A local application run additionally needs Supabase publishable and server credentials plus the provider/email settings for the features being exercised; keep those values in ignored local configuration, never in a commit. A successful build alone does not prove production database migrations or external services are ready.

The normal test suite already validates local Markdown links and key operating-contract statements, so documentation drift is part of the pull-request quality gate.

## Documentation map

| Question | Start here |
| --- | --- |
| What rules and safety guarantees must remain true? | [Project reference](docs/PROJECT_REFERENCE.md) |
| Why was a durable tradeoff made? | [Decision log](docs/DECISION_LOG.md) |
| What should a commissioner do during a normal week? | [Game-day runbook](docs/GAME_DAY_RUNBOOK.md) |
| Where should an alert or unusual condition be routed? | [SOP index](docs/SOP_INDEX.md) |
| How is a guarded recovery or release performed? | [Commissioner runbook](docs/commissioner-runbook.md) |
| How do automation, quotas, backups, and rehearsals operate? | [Operations](docs/OPERATIONS.md) |
| How are database changes and isolated tests handled? | [Migration workflow](docs/supabase-github-cutover.md) · [Isolated testing](docs/isolated-integration-tests.md) |
| How are external alarms and errors triaged? | [Uptime monitoring](docs/uptime-monitoring.md) · [Sentry guide](docs/sentry-runbook.md) |
| What visual and maintenance conventions apply? | [Visual system](docs/visual-design-system.md) · [Maintenance checklist](docs/MAINTENANCE_CHECKLIST.md) |

Coding agents should begin with [AGENTS.md](AGENTS.md). The current migrations and executable tests take precedence over prose when they disagree. Update the affected reference and runbook with any behavior change, and preserve historical decisions by marking superseded guidance rather than silently erasing it. Never commit PINs, tokens, player data, private provider responses, or production fixtures.
