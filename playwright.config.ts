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
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  webServer: enabled ? {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: process.env.PICKEM_TEST_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY ?? "",
      SUPABASE_SECRET_KEY: process.env.PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  } : undefined,
});
