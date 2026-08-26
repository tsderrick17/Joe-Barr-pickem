import { pathToFileURL } from "node:url";

export const PRODUCTION_SMOKE_PATHS = [
  "/",
  "/api/health",
  "/api/health/automation",
  "/api/health/workers",
  "/api/health/backup",
];

const baseUrl = (process.env.PICKEM_SMOKE_BASE_URL ?? "https://pickemjb.vercel.app").replace(/\/$/, "");
const maximumAttempts = Number(process.env.PICKEM_SMOKE_ATTEMPTS ?? 12);
const retryDelayMs = Number(process.env.PICKEM_SMOKE_RETRY_MS ?? 10_000);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function check(path) {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    return { path, status: response.status, healthy: response.status === 200 };
  } catch {
    return { path, status: null, healthy: false };
  }
}

export async function runProductionSmoke() {
  if (baseUrl !== "https://pickemjb.vercel.app") {
    throw new Error("The production smoke gate only accepts the canonical PickemJB URL.");
  }
  if (!Number.isInteger(maximumAttempts) || maximumAttempts < 1 || maximumAttempts > 30) {
    throw new Error("PICKEM_SMOKE_ATTEMPTS must be an integer from 1 through 30.");
  }

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const results = await Promise.all(PRODUCTION_SMOKE_PATHS.map(check));
    const failures = results.filter((result) => !result.healthy);
    if (failures.length === 0) {
      console.log(`Production smoke passed on attempt ${attempt}: ${PRODUCTION_SMOKE_PATHS.length} contracts returned HTTP 200.`);
      return;
    }

    const summary = failures
      .map((failure) => `${failure.path}=${failure.status ?? "unreachable"}`)
      .join(", ");
    console.error(`Production smoke attempt ${attempt}/${maximumAttempts} failed: ${summary}`);
    if (failures.length > 1) {
      console.error("Multiple health contracts failed together; investigate shared deployment or Supabase server authorization before changing individual schedules.");
    }
    if (attempt < maximumAttempts) await delay(retryDelayMs);
  }

  throw new Error("Production did not become healthy within the post-deployment retry window.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runProductionSmoke();
}
