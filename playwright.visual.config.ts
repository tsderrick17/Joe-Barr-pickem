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
  workers: 2,
  reporter: [["list"]],
  expect: { toHaveScreenshot: { maxDiffPixels: 0, animations: "disabled", caret: "hide" } },
  use: { baseURL: "http://127.0.0.1:3130" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3130",
    url: "http://127.0.0.1:3130/login",
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next-visual",
      NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "visual-baseline",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "visual-baseline",
      SUPABASE_SERVICE_ROLE_KEY: "visual-baseline",
      NEXT_PUBLIC_SENTRY_DSN: "",
    },
  },
});
