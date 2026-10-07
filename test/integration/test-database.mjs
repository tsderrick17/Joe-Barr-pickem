const productionMarkers = [
  "qtuycmgjiizrahfchsxe",
];

/**
 * Return the explicitly confirmed disposable database URL, or undefined when
 * isolated integration tests are not configured. A confirmed production URL
 * is a hard error so a typo cannot turn a lifecycle test into a live mutation.
 */
export function isolatedDatabaseUrl(env = process.env) {
  const url = env.PICKEM_TEST_DATABASE_URL;
  if (!url || env.PICKEM_TEST_DATABASE_CONFIRMATION !== "isolated") return undefined;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("PICKEM_TEST_DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("PICKEM_TEST_DATABASE_URL must use the PostgreSQL protocol.");
  }

  if (productionMarkers.some((marker) => url.toLowerCase().includes(marker))) {
    throw new Error("Refusing to run integration tests against the production database.");
  }

  return url;
}

export function isolatedDatabaseEnabled({ env = process.env, flagName, flagValue } = {}) {
  const url = isolatedDatabaseUrl(env);
  return Boolean(url) && (!flagName || env[flagName] === flagValue);
}
