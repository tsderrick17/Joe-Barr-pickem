import { createClient } from "@supabase/supabase-js";

const productionMarkers = [
  "qtuycmgjiizrahfchsxe",
  "pickemjb.vercel.app",
  "pickem-tsderrick.vercel.app",
];

export function isolatedTestConfig() {
  const url = process.env.PICKEM_TEST_SUPABASE_URL;
  const serviceRoleKey = process.env.PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.PICKEM_TEST_SUPABASE_PUBLISHABLE_KEY;
  const confirmation = process.env.PICKEM_TEST_DATABASE_CONFIRMATION;

  if (!url || !serviceRoleKey || !publishableKey || confirmation !== "isolated") {
    return null;
  }

  if (productionMarkers.some((marker) => url.includes(marker))) {
    throw new Error("Refusing to run integration tests against production.");
  }

  return { url, serviceRoleKey, publishableKey };
}

export function createIsolatedClients(config) {
  return {
    admin: createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    publicClient: createClient(config.url, config.publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export function testToken() {
  return `integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
