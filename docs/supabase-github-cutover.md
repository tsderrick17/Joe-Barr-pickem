# Supabase migration and production deployment

The production database was established through the numbered SQL files in
`/supabase`. Those files are historical evidence and must **not** be replayed
by the Supabase CLI.

## Cutover rule

From the cutover onward, every database change gets a timestamped migration in
`supabase/migrations/`. The old root-level SQL files remain unchanged as the
record of the original build.

## Historical cutover setup

The baseline steps below describe how the already established production
migration history was created. Do not replay them against the live database.

1. Add these GitHub repository secrets:
   - `SUPABASE_ACCESS_TOKEN` — a personal access token from Supabase.
   - `SUPABASE_PROJECT_ID` — `qtuycmgjiizrahfchsxe`.
   - `SUPABASE_DB_PASSWORD` — the production database password.
2. Run the **Supabase migrations** GitHub workflow manually with **Apply
   migrations** left off. It links to production and shows the exact migration
   plan without changing the database.
3. Review that plan. It should contain only the baseline marker.
4. Re-run the workflow with **Apply migrations** checked. The baseline marker
   records the cutover; it makes no schema or data change.

## Current deployment path

A pull request with a new timestamped migration must pass isolated database
checks before merge. When that migration reaches `main`, the **Supabase
migrations** workflow links the explicitly checked production project, previews
pending migrations, and then applies them through its `production` environment.
An application-only push does not trigger the migration workflow. A manual
workflow dispatch with **Apply migrations** off is a read-only production plan;
the checked option authorizes an application only after preview succeeds.
Never deploy application code that requires a new database contract before the
migration workflow is green and Launch Preflight passes.

## Safety rules

- Never run `supabase db reset --linked` against production. It is destructive.
- Do not put database passwords, service-role keys, or access tokens in source,
  documentation, logs, or public variables. Production server credentials are
  stored only in the appropriate protected GitHub/Vercel configuration, never
  in a `NEXT_PUBLIC_*` variable.
- Do not use the Supabase SQL Editor for routine schema changes after cutover.
  Commit a migration instead.
- Never edit or reorder an applied migration to make a failing deployment look
  green. Add a new corrective migration and test it against `isolated-test`.
