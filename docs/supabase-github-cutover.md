# Supabase GitHub cutover

The production database was established through the numbered SQL files in
`/supabase`. Those files are historical evidence and must **not** be replayed
by the Supabase CLI.

## Cutover rule

From the cutover onward, every database change gets a timestamped migration in
`supabase/migrations/`. The old root-level SQL files remain unchanged as the
record of the original build.

## One-time setup

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

After that, the workflow can be changed from manual to automatic deployment on
`main` once at least one normal post-cutover migration has been reviewed.

## Safety rules

- Never run `supabase db reset --linked` against production. It is destructive.
- Do not put database passwords, service-role keys, or access tokens in the
  repository, Vercel variables, or source files.
- Do not use the Supabase SQL Editor for routine schema changes after cutover.
  Commit a migration instead.
- Keep production migration deployment manual until the first post-cutover
  migration has been verified successfully.
