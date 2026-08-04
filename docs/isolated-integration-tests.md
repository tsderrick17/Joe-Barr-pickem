# Isolated integration and browser tests

These tests are deliberately unable to run against the live pool. They require a **second, separate Supabase project** and the exact confirmation value `isolated`.

Never place the production project URL (`qtuycmgjiizrahfchsxe`) in any `PICKEM_TEST_*` setting. The test harness rejects it before it makes a request.

## One-time setup

1. Create a separate free Supabase project named something unmistakable, such as `Joe Barr Pick'em Test`.
2. Apply the same current schema and seed data as production, including the 2026 season, scoring periods, and NFL teams. The test project is allowed to receive disposable fixtures; production never is.
3. For a local rehearsal, create an ignored file named `.env.test.local` in the project folder with:

   ```text
   PICKEM_TEST_SUPABASE_URL=https://your-test-project.supabase.co
   PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY=your-test-secret-key
   PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY=your-test-publishable-key
   PICKEM_TEST_DATABASE_CONFIRMATION=isolated
   PICKEM_E2E_ENABLED=true
   ```

   This file is never committed and must point only to the separate test project. Do not put these values in Vercel.
4. In GitHub repository secrets, add:
   - `PICKEM_TEST_SUPABASE_URL`
   - `PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY`
   - `PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY`
5. Add the repository variable `PICKEM_TEST_DATABASE_CONFIRMATION` with the exact value `isolated`.
6. Install the Playwright Chromium browser once in the CI workflow or locally with `npx playwright install chromium`.

## Commands

- `npm run test` runs the fast logic suite.
- `npm run test:integration` exercises the real database procedures when the isolated settings exist; otherwise it reports one intentional skip.
- `npm run test:season-drill` runs every fast rule check and the isolated browser player flow when the isolated settings are present. Without those settings it reports that browser checks are intentionally waiting, rather than touching production.
- `npm run test:isolated` loads only `.env.test.local` and runs the complete season drill. This is the recommended local command.
- `PICKEM_E2E_ENABLED=true npm run test:e2e` launches the application against the isolated project and verifies an actual player can sign in, save two ATS picks, save a Survivor pick, change that Survivor pick, and leave only the final selections behind. It refuses a production URL.

The integration test creates records with an `integration-` identifier and removes them after every run. No local `.env.local` value is read by the test harness.
