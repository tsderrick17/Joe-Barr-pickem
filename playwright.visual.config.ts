import { defineConfig } from "@playwright/test";

/**
 * Slate screenshot baseline. Renders the real /board page with fixed sample
 * data (no database, no real accounts) and compares every state, at phone,
 * tablet, and desktop widths, against committed screenshots.
 *
 *   npm run test:visual            compare against the baseline
 *   npm run test:visual -- -u      record a new baseline (intended changes only)
 *
 * Screenshots are platform-specific (fonts render differently per OS), so the
 * committed baseline is for the machine that records it.
 */
export default defineConfig({
  testDir: "./test/visual",
  timeout: 60_000,
  // CI serves a production build, which is far faster and steadier than compiling
  // pages on demand in development. Locally two workers (a dev server compiling on
  // demand times out with more); on CI four, the cores a standard runner has on a
  // public repository, with images unoptimized so nothing piles up.
  workers: process.env.CI ? 4 : 2,
  // Every test is independent (its own page and mocked answers), so tests are spread one by one across workers and CI shards, not a file at a time:
  // the commissioner file alone holds a quarter of the suite.
  fullyParallel: true,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled", caret: "hide" } },
  use: { baseURL: "http://127.0.0.1:3130" },
  webServer: {
    command: process.env.CI
      ? "npm run build && npm run start -- --hostname 127.0.0.1 --port 3130"
      : "npm run dev -- --hostname 127.0.0.1 --port 3130",
    url: "http://127.0.0.1:3130/login",
    reuseExistingServer: true,
    timeout: 420_000,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-visual",
      NEXT_IMAGE_UNOPTIMIZED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "visual-baseline",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "visual-baseline",
      SUPABASE_SERVICE_ROLE_KEY: "visual-baseline",
      NEXT_PUBLIC_SENTRY_DSN: "",
    },
  },
});
