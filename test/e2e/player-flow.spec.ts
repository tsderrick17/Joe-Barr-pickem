import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const enabled = process.env.PICKEM_E2E_ENABLED === "true";
const confirmation = process.env.PICKEM_TEST_DATABASE_CONFIRMATION;
const url = process.env.PICKEM_TEST_SUPABASE_URL;
const serviceRoleKey = process.env.PICKEM_TEST_SUPABASE_SERVICE_ROLE_KEY;

test.skip(!enabled, "Set PICKEM_E2E_ENABLED=true and point at the isolated test project.");

type Fixture = {
  admin: SupabaseClient;
  authUserId: string;
  playerId: string;
  seasonId: string;
  periodId: string;
  createdPeriod: boolean;
  previousStatuses: Array<{ id: string; status: "upcoming" | "active" | "complete" }>;
  gameIds: string[];
  firstGame: { awayId: string; homeId: string };
  secondGame: { awayId: string; homeId: string };
  pin: string;
};

function requireIsolatedConfig() {
  if (!url || !serviceRoleKey || confirmation !== "isolated" || url.includes("qtuycmgjiizrahfchsxe")) {
    throw new Error("Refusing to prepare browser fixtures without an explicitly confirmed isolated Supabase project.");
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function teamId(admin: SupabaseClient, abbreviation: string) {
  const { data, error } = await admin.from("teams").select("id").eq("abbreviation", abbreviation).single();
  if (error || !data) throw new Error(`The isolated test project is missing the ${abbreviation} team seed.`);
  return data.id as string;
}

async function prepareFixture(): Promise<Fixture> {
  const admin = requireIsolatedConfig();
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const pin = String(1000 + Math.floor(Math.random() * 8999));
  // The player-facing PIN screen deliberately derives this address; use the
  // same credential shape here so this is a true browser login, not a bypass.
  const email = `pin-${pin}@pickemjb.app`;
  const password = `pickem-${pin}`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError || !authData.user) throw new Error(authError?.message ?? "Could not create the isolated test player.");

  const { data: season, error: seasonError } = await admin.from("seasons").select("id").eq("year", 2026).single();
  if (seasonError || !season) throw new Error("The isolated test project must have the 2026 seed season before browser tests can run.");

  const { data: periods, error: periodsError } = await admin
    .from("scoring_periods")
    .select("id, status")
    .eq("season_id", season.id)
    .order("display_order");
  if (periodsError || !periods?.length) throw new Error("The isolated test project must have seeded scoring periods.");

  const firstPeriod = periods[0];
  const previousStatuses = periods.map((period) => ({ id: period.id as string, status: period.status as "upcoming" | "active" | "complete" }));
  const { error: deactivateError } = await admin.from("scoring_periods").update({ status: "upcoming" }).eq("season_id", season.id);
  if (deactivateError) throw new Error(deactivateError.message);
  const { error: activateError } = await admin.from("scoring_periods").update({ status: "active" }).eq("id", firstPeriod.id);
  if (activateError) throw new Error(activateError.message);

  const { data: player, error: playerError } = await admin
    .from("players")
    .insert({ first_name: `E2E ${suffix}`, login_pin: pin, auth_user_id: authData.user.id, active: true })
    .select("id")
    .single();
  if (playerError || !player) throw new Error(playerError?.message ?? "Could not create the isolated test player.");

  const [sea, ne, lar, sf] = await Promise.all(["SEA", "NE", "LAR", "SF"].map((abbreviation) => teamId(admin, abbreviation)));
  const kickoff = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const games = [
    { external_game_id: `e2e-${suffix}-one`, scoring_period_id: firstPeriod.id, away_team_id: sea, home_team_id: ne, kickoff_at: kickoff, line_lock_at: kickoff },
    { external_game_id: `e2e-${suffix}-two`, scoring_period_id: firstPeriod.id, away_team_id: lar, home_team_id: sf, kickoff_at: kickoff, line_lock_at: kickoff },
  ];
  const { data: insertedGames, error: gamesError } = await admin.from("games").insert(games).select("id, away_team_id, home_team_id");
  if (gamesError || !insertedGames || insertedGames.length !== 2) throw new Error(gamesError?.message ?? "Could not create isolated test games.");
  const { error: spreadsError } = await admin.from("spread_history").insert([
    { game_id: insertedGames[0].id, favorite_team_id: sea, spread: 2.5, source: "e2e-test" },
    { game_id: insertedGames[1].id, favorite_team_id: lar, spread: 3.5, source: "e2e-test" },
  ]);
  if (spreadsError) throw new Error(spreadsError.message);

  return {
    admin,
    authUserId: authData.user.id,
    playerId: player.id,
    seasonId: season.id,
    periodId: firstPeriod.id,
    createdPeriod: false,
    previousStatuses,
    gameIds: insertedGames.map((game) => game.id as string),
    firstGame: { awayId: insertedGames[0].away_team_id as string, homeId: insertedGames[0].home_team_id as string },
    secondGame: { awayId: insertedGames[1].away_team_id as string, homeId: insertedGames[1].home_team_id as string },
    pin,
  };
}

async function cleanupFixture(fixture: Fixture | undefined) {
  if (!fixture) return;

  // Delete dependent records explicitly. This keeps an interrupted browser run
  // from leaving test players behind in the isolated project.
  const { data: entries } = await fixture.admin
    .from("survivor_entries")
    .select("id")
    .eq("player_id", fixture.playerId);
  const entryIds = (entries ?? []).map((entry) => entry.id as string);
  if (entryIds.length > 0) {
    await fixture.admin.from("survivor_picks").delete().in("survivor_entry_id", entryIds);
  }
  await fixture.admin.from("survivor_entries").delete().eq("player_id", fixture.playerId);
  await fixture.admin.from("picks").delete().eq("player_id", fixture.playerId);
  await fixture.admin.from("games").delete().in("id", fixture.gameIds);
  await fixture.admin.from("players").delete().eq("id", fixture.playerId);
  await fixture.admin.auth.admin.deleteUser(fixture.authUserId);
  for (const period of fixture.previousStatuses) {
    await fixture.admin.from("scoring_periods").update({ status: period.status }).eq("id", period.id);
  }
}

let fixture: Fixture | undefined;

test.beforeAll(async () => {
  fixture = await prepareFixture();
});

test.afterAll(async () => {
  await cleanupFixture(fixture);
});

test("isolated player can sign in, save ATS picks, and revise a Survivor selection", async ({ page }) => {
  if (!fixture) throw new Error("The isolated player fixture was not prepared.");

  await page.goto("/login");
  await page.getByLabel("FOUR-DIGIT PIN").fill(fixture.pin);
  await page.getByRole("button", { name: "Enter Pick'em" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 12_000 });

  // Supabase persists the browser session asynchronously. Wait for that
  // durable receipt before asking the next page to make an authenticated API
  // request; this mirrors a real player pausing briefly after sign-in.
  await page.waitForFunction(() =>
    Object.keys(window.localStorage).some((key) => key.includes("auth-token")),
  );

  await page.getByRole("link", { name: "The Slate" }).click();
  await page.waitForTimeout(750);
  await expect(page).toHaveURL(/\/board$/, { timeout: 12_000 });
  await expect(page.getByRole("heading", { name: "The Slate" })).toBeVisible({ timeout: 12_000 });

  await page.getByRole("button", { name: "Seattle Seahawks", exact: true }).click();
  await page.getByRole("button", { name: "Los Angeles Rams", exact: true }).click();
  await page.getByRole("button", { name: "Choose Seattle Seahawks as your Survivor winner" }).click();
  const firstSave = page.waitForResponse((response) => response.url().endsWith("/api/picks") && response.request().method() === "POST");
  await page.getByRole("button", { name: "SUBMIT" }).click();
  expect((await firstSave).status()).toBe(200);
  const receipt = page.getByRole("region", { name: "Your weekly receipt" });
  await expect(receipt.locator(".slate-receipt-pickem > em")).toContainText("2/2");
  await expect(receipt.locator(".slate-receipt-pickem > em")).toContainText("SUBMITTED");
  await expect(receipt.locator(".slate-receipt-survivor-pick > strong")).toHaveAttribute("aria-label", "Seattle Seahawks");
  await expect(receipt.locator(".slate-receipt-survivor > em")).toContainText("SUBMITTED");

  await page.getByRole("button", { name: "Choose Los Angeles Rams as your Survivor winner" }).click();
  await expect(receipt.getByText(/CHANGED.*HIT SUBMIT/)).toBeVisible();
  const replacementSave = page.waitForResponse((response) => response.url().endsWith("/api/picks") && response.request().method() === "POST");
  await page.getByRole("button", { name: "SUBMIT" }).click();
  expect((await replacementSave).status()).toBe(200);
  await expect(receipt.locator(".slate-receipt-survivor-pick > strong")).toHaveAttribute("aria-label", "Los Angeles Rams");
  await expect(receipt.locator(".slate-receipt-survivor > em")).toContainText("SUBMITTED");

  const { data: savedAts, error: savedAtsError } = await fixture.admin
    .from("picks")
    .select("selected_team_id")
    .eq("player_id", fixture.playerId)
    .eq("scoring_period_id", fixture.periodId);
  expect(savedAtsError).toBeNull();
  expect(savedAts?.map((pick) => pick.selected_team_id).sort()).toEqual([fixture.firstGame.awayId, fixture.secondGame.awayId].sort());

  const { data: survivorEntry, error: survivorEntryError } = await fixture.admin
    .from("survivor_entries")
    .select("id")
    .eq("player_id", fixture.playerId)
    .eq("season_id", fixture.seasonId)
    .single();
  expect(survivorEntryError).toBeNull();

  const { data: savedSurvivor, error: savedSurvivorError } = await fixture.admin
    .from("survivor_picks")
    .select("id, game_id, selected_team_id, result, submitted_at")
    .eq("survivor_entry_id", survivorEntry?.id)
    .eq("scoring_period_id", fixture.periodId)
    .single();
  expect(savedSurvivorError).toBeNull();
  expect(savedSurvivor?.selected_team_id).toBe(fixture.secondGame.awayId);
});
