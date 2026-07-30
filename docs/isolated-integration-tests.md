# Isolated integration and browser tests

These tests are deliberately unable to run against the live pool. They require a **second, separate Supabase project** and the exact confirmation value `isolated`.

Never place the production project URL (`qtuycmgjiizrahfchsxe`) in any `PICKEM_TEST_*` setting. The test harness rejects it before it makes a request.

## One-time setup

1. Create a separate free Supabase project named something unmistakable, such as `Joe Barr Pick'em Test`.
2. Apply the database schema to that project. The current SQL history predates the migration workflow, so this must be done only after the reproducible baseline work is completed.
3. In GitHub repository secrets, add:
   - `PICKEM_TEST_SUPABASE_URL`
   - `PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY`
   - `PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY`
4. Add the repository variable `PICKEM_TEST_DATABASE_CONFIRMATION` with the exact value `isolated`.
5. Install the Playwright Chromium browser once in the CI workflow or locally with `npx playwright install chromium`.

## Commands

- `npm run test` runs the fast logic suite.
- `npm run test:integration` exercises the real database procedures when the isolated settings exist; otherwise it reports one intentional skip.
- `PICKEM_E2E_ENABLED=true npm run test:e2e` launches the application against the isolated project and runs browser checks. It refuses a production URL.

The integration test creates records with an `integration-` identifier and removes them after every run. No local `.env.local` value is read by the test harness.
