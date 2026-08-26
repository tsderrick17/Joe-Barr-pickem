# PickemJB — Joe Barr Memorial Pick'em

PickemJB runs the private **Lead Pipe Locks** NFL pool: season-long against-the-spread Pick'em plus regular-season Survivor. The production site is [pickemjb.vercel.app](https://pickemjb.vercel.app/).

The system is designed to fail closed. A missing line, unresolved score, schedule conflict, expired session, or unavailable provider should stop only the unsafe action—never expose private picks, guess a result, or rewrite history.

## Start with the page for your job

| You need to… | Start here |
| --- | --- |
| Run a normal NFL week | [Game-day checklist](docs/GAME_DAY_RUNBOOK.md) |
| Diagnose an alert or stuck process | [SOP index](docs/SOP_INDEX.md) |
| Recover a score, schedule, email, or release | [Commissioner recovery runbook](docs/commissioner-runbook.md) |
| Understand a pool rule or lifecycle guarantee | [Project reference](docs/PROJECT_REFERENCE.md) |
| Change database behavior | [Supabase migration workflow](docs/supabase-github-cutover.md) |
| Test safely away from production | [Isolated testing](docs/isolated-integration-tests.md) |
| Check backups, quotas, watchdogs, or automation | [Operations](docs/OPERATIONS.md) |
| Diagnose an external monitor | [Uptime monitoring](docs/uptime-monitoring.md) |
| Understand why a durable rule exists | [Decision log](docs/DECISION_LOG.md) |

Coding agents must begin with [AGENTS.md](AGENTS.md).

## System at a glance

| System | Responsibility |
| --- | --- |
| Vercel / Next.js | Player pages, Commissioner tools, API routes, and health endpoints |
| Supabase / Postgres | Identity, durable pool data, integrity rules, audit history, and scheduled jobs |
| NFL and odds providers | Canonical schedule, preliminary spreads, official-line inputs, and verified finals |
| Brevo | Player notifications, recaps, and Commissioner alerts |
| GitHub Actions | Quality gates, migrations, isolated rehearsals, and encrypted backups |
| Sentry / UptimeRobot | Application errors and independent availability/automation monitoring |

Production is the live pool. Disposable fixtures, migration rehearsals, browser tests, and season drills belong only in the separately confirmed `isolated-test` environment.

## Safe change path

1. Preserve unrelated working-tree changes.
2. Read the governing rule, test, and latest migration before editing.
3. Add a regression test for behavior changes.
4. Run the local gate:

   ```text
   npm run test:all
   npm run lint
   npm run build
   ```

5. For database work, rehearse the timestamped migration against `isolated-test` and use the guarded GitHub workflow. Never replay the historical numbered SQL files.
6. Merge only after application, deployment, and relevant database checks pass; smoke-test production afterward.

## Documentation contract

Each page has one job:

- `PROJECT_REFERENCE.md` says **what must remain true**.
- `DECISION_LOG.md` says **why durable choices were made**.
- `SOP_INDEX.md` says **where to go when something happens**.
- Runbooks say **what a human should do next**.
- `OPERATIONS.md` explains **how automated infrastructure is operated**.

When behavior, timing, recovery, or a pool rule changes, update the governing documentation in the same pull request. Never place PINs, tokens, database passwords, service-role keys, player data, or private provider responses in documentation or examples.
