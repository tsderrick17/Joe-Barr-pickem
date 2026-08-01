import { defineConfig } from "@playwright/test";

const enabled = process.env.PICKEM_E2E_ENABLED === "true";
const url = process.env.PICKEM_TEST_SUPABASE_URL;

if (enabled && (!url || process.env.PICKEM_TEST_DATABASE_CONFIRMATION !== "isolated" || url.includes("qtuycmgjiizrahfchsxe"))) {
  throw new Error("Browser tests require an explicitly confirmed isolated Supabase project.");
}

export default defineConfig({
  testDir: "./test/e2e",
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // The E2E app must never share an existing developer server: that server
  // could be carrying production configuration from .env.local. A separate
  // port and no-reuse policy make the isolated database boundary real.
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  webServer: enabled ? {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101/login",
    reuseExistingServer: false,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: process.env.PICKEM_TEST_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SECRET_KEY: process.env.PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  } : undefined,
});
