import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compareBowlPoolStandings, bowlColumnName } from "../src/lib/bowl-pool.js";
import { bowlManualLineProblem, easternKickoffIso } from "../src/lib/bowl-commissioner-input.js";
import fs, { readdirSync } from "node:fs";
import path from "node:path";
import { bowlDailyRecapAt, bowlGamedays, unpickedBowlReminderAt } from "../src/lib/bowl-email-schedule.js";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BOWL_PENNANTS } from "../src/lib/bowl-logos.js";
import { bowlPoolPrelaunchHealthResult } from "../src/lib/bowl-pool-health-gate.js";
import { assessBowlPoolSettlement } from "../src/lib/bowl-pool-reconciliation.js";
import { parseBowlPoolScheduleCsv, normalizeBowlDisplayName } from "../src/lib/bowl-pool-schedule.js";
import { bowlRecapCopy } from "../src/lib/bowl-recap-copy.js";

// The bowl rules that each needed only a test or two, kept together. Each block is one rule's tests, named for the file it came from.

// bowl-champion-tiebreaker
{
  test("a missing tiebreaker guess loses the tiebreaker but never outranks more wins", () => {
    const rows = [
      { playerId: "al", playerName: "Al", wins: 5, losses: 0, tiebreakerTotal: null },
      { playerId: "bo", playerName: "Bo", wins: 5, losses: 0, tiebreakerTotal: 80 },
      { playerId: "cy", playerName: "Cy", wins: 5, losses: 0, tiebreakerTotal: 51 },
      { playerId: "di", playerName: "Di", wins: 6, losses: 0, tiebreakerTotal: null },
    ];
    assert.deepEqual([...rows].sort((a, b) => compareBowlPoolStandings(a, b, 50)).map((row) => row.playerName), ["Di", "Cy", "Bo", "Al"]);
  });

  test("the database champion includes entries without a guess and shares the title when no leader guessed", async () => {
    const sql = await readFile(new URL("../supabase/migrations/20260929050000_bowl_champion_missing_tiebreaker.sql", import.meta.url), "utf8");
    assert.match(sql, /alter column championship_total_guess drop not null/);
    assert.match(sql, /alter column final_total_difference drop not null/);
    assert.doesNotMatch(sql, /and entry\.championship_total_guess is not null/);
    assert.match(sql, /or \(select min\(difference\) from leaders\) is null/);
    assert.match(sql, /grant execute on function public\.refresh_bowl_pool_champion\(uuid, timestamptz\) to service_role;/);
    const route = await readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8");
    // The Bowl Card sorts with the tested shared order, not its own copy.
    assert.match(route, /\.sort\(\(a, b\) => compareBowlPoolStandings\(a, b, finalCombinedPoints\)\)/);
  });

  test("clearing a Bowl pick never writes a history row that points at the deleted pick", async () => {
    const sql = await readFile(new URL("../supabase/migrations/20260929060000_fix_bowl_pick_clear_audit.sql", import.meta.url), "utf8");
    assert.match(sql, /values\(null, old\.entry_id, actor, 'cleared', jsonb_build_object\('pick_id', old\.id/);
    assert.doesNotMatch(sql, /values\(old\.id, old\.entry_id/);
  });
}

// bowl-commissioner-input
{
  // What the Commissioner may type on the Bowl Pool tab: a hand-entered line, and the new date and time of a postponed game.
  const GAME = { away_team_id: "away", home_team_id: "home" };

  test("a hand-entered line has a favorite from the game, a half-point spread, and a sensible size; no favorite means a pick'em at 0", () => {
    assert.equal(bowlManualLineProblem({ favoriteTeamId: "home", spread: 3.5 }, GAME), null);
    assert.equal(bowlManualLineProblem({ favoriteTeamId: "away", spread: 0.5 }, GAME), null);
    assert.equal(bowlManualLineProblem({ favoriteTeamId: "away", spread: 30.5 }, GAME)?.includes("typing slip"), true, "35 for 3.5 is caught");
    assert.equal(bowlManualLineProblem({ favoriteTeamId: "away", spread: 30 }, GAME)?.includes("typing slip"), false, "the cap itself is allowed to reach the half-point rule");
    assert.equal(bowlManualLineProblem({ favoriteTeamId: null, spread: 0 }, GAME), null);
    assert.match(bowlManualLineProblem({ favoriteTeamId: null, spread: 3.5 }, GAME), /pick'em/);
    assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: 3 }, GAME), /half point/, "a whole number could tie");
    assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: 0 }, GAME), /Enter how many points/);
    assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: -3.5 }, GAME), /Enter how many points/);
    assert.match(bowlManualLineProblem({ favoriteTeamId: "somebody-else", spread: 3.5 }, GAME), /one of the two teams/);
    assert.match(bowlManualLineProblem({ favoriteTeamId: "home", spread: Number.NaN }, GAME), /as a number/);
  });

  test("the Reschedule date and time are Eastern, daylight saving included, and only real dates count", () => {
    assert.equal(easternKickoffIso("2026-12-30", "19:30"), "2026-12-31T00:30:00.000Z", "winter: Eastern is five hours behind UTC");
    assert.equal(easternKickoffIso("2026-12-15", "00:00"), "2026-12-15T05:00:00.000Z");
    assert.equal(easternKickoffIso("2026-06-30", "19:30"), "2026-06-30T23:30:00.000Z", "summer: four hours behind");
    for (const [date, time] of [["", "19:30"], ["2026-12-30", ""], [null, "19:30"], ["2026-12-30", undefined], ["12/30/2026", "19:30"], ["2026-12-30", "7:30 PM"], ["2026-02-31", "19:30"], ["2026-13-01", "19:30"], ["2026-12-30", "24:00"], ["2026-12-30", "19:60"]]) {
      assert.equal(easternKickoffIso(date, time), null, `${date} ${time}`);
    }
  });
}

// bowl-email-pipeline
{
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

  test("Bowl email delivery snapshots the recap and sends reminders only to active unpicked entries", () => {
    const source = read("src/lib/email-reminders.ts");
    assert.match(source, /ensureBowlDailyRecapSnapshot/);
    assert.match(source, /from\("bowl_pool_entries"\)/);
    assert.match(source, /\.eq\("status", "active"\)/);
    assert.match(source, /from\("bowl_pool_picks"\)/);
    assert.match(source, /email_notifications_enabled/);
    assert.match(source, /kind: "bowl"/);
    assert.match(source, /ensureBowlLineLockSnapshot/);
  });

  // The route itself runs in test/sync-bowl-scores-route.test.mjs; the scheduler in test/automatic-bowl-emails.test.mjs.
  test("Bowl score automation has its own fifteen-minute endpoint", () => {
    const nflRoute = read("src/app/api/cron/sync-scores/route.ts");
    const migration = read("supabase/migrations/20260928020000_reduce_automation_dispatch_work.sql");
    assert.doesNotMatch(nflRoute, /syncBowlPool/);
    assert.match(migration, /refresh-bowl-pool-every-fifteen-minutes/);
    assert.match(migration, /public\.dispatch_bowl_sync_if_due\(\)/);
    assert.match(migration, /min_interval := interval '15 minutes'/);
    assert.match(migration, /interval '1 hour'/);
    assert.match(migration, /min_interval := interval '24 hours'/);
    assert.match(migration, /'https:\/\/pickemjb\.vercel\.app\/api\/cron\/sync-bowl-scores'/);
  });

  test("Bowl score settlement works from ESPN without a paid NCAAF odds key", () => {
    const source = read("src/lib/sync-bowl-pool.ts");
    assert.match(source, /college-football\/scoreboard/);
    assert.match(source, /provider_game_id/);
    assert.match(source, /ESPN is the no-cost source of truth for bowl results/);
  });
}

// bowl-email-schedule
{
  test("Bowl recap is 5 AM Eastern the following day", () => assert.equal(bowlDailyRecapAt("2026-12-15"), "2026-12-16T10:00:00.000Z"));
  test("Bowl gamedays are unique", () => assert.deepEqual(bowlGamedays([{ kickoff_at: "2026-12-16T00:00:00Z" }, { kickoff_at: "2026-12-16T02:00:00Z" }]), ["2026-12-15"]));
  test("unpicked reminder is three hours before kickoff", () => assert.equal(unpickedBowlReminderAt("2026-12-15T17:30:00.000Z"), "2026-12-15T14:30:00.000Z"));
}

// bowl-logo-files
{
  // Every bowl logo is fitted by scripts/fit-bowl-logos.mjs: one canvas the shape of the pennant's logo box, clear round the logo (no
  // square of white or black behind it), so every logo flies the same size.
  const DIR = new URL("../public/bowl-logos/", import.meta.url);
  const files = readdirSync(DIR).filter((file) => file.endsWith(".webp"));

  test("every bowl logo is on the standard 288 x 138 clear canvas, and every pennant's logo file exists", async () => {
    for (const file of files) {
      const image = sharp(fileURLToPath(new URL(file, DIR)));
      const { width, height, hasAlpha } = await image.metadata();
      assert.deepEqual({ file, width, height, hasAlpha }, { file, width: 288, height: 138, hasAlpha: true });
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alphaAt = (x, y) => data[(y * info.width + x) * 4 + 3];
      for (const [x, y] of [[0, 0], [287, 0], [0, 137], [287, 137]]) assert.equal(alphaAt(x, y), 0, `${file} has a solid corner`);
    }
    for (const { logo } of BOWL_PENNANTS) assert.ok(files.includes(`${logo}.webp`), `${logo}.webp is missing`);
    // Each logo is made from its full-size original kept in assets/bowl-logos/, so a later re-fit never works from a shrunken copy.
    const originals = readdirSync(new URL("../assets/bowl-logos/", import.meta.url)).map((file) => file.replace(/\.\w+$/, ".webp"));
    for (const file of files) assert.ok(originals.includes(file), `${file} has no original in assets/bowl-logos/`);
  });
}

// bowl-placeholder-drafts
{
  const [route, page, migration] = await Promise.all([
    readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260913030000_persist_bowl_placeholder_drafts.sql", import.meta.url), "utf8"),
  ]);

  test("commissioner placeholder Bowl picks persist separately from gradeable team picks", () => {
    assert.match(migration, /add column if not exists preview_selections jsonb/);
    assert.match(route, /player\.is_commissioner && !game\.away_team_id && !game\.home_team_id/);
    assert.match(route, /update\(\{ preview_selections: previewSelections \}\)/);
    assert.match(route, /ownPreviewSelections:/);
    assert.match(page, /payload\.ownPreviewSelections/);
    assert.match(page, /teamId:.*side/s);
  });
}

// bowl-playoff-round-labels
{
  // The Bowl Card's column names (and the clubhouse Bowl sheet's, which uses the same rule).
  test("Bowl playoff standings retain QF and SF labels when providers return bare bowl names", () => {
    for (const bowl of ["Fiesta", "Cotton Bowl", "Peach", "Rose Bowl"]) assert.equal(bowlColumnName({ bowl_name: bowl }), `${bowl} (QF)`);
    for (const bowl of ["Orange Bowl", "Sugar"]) assert.equal(bowlColumnName({ bowl_name: bowl }), `${bowl} (SF)`);
    assert.equal(bowlColumnName({ bowl_name: "Goodyear Cotton Bowl Classic", provider_game_id: "cfp-quarterfinal-1" }), "Goodyear Cotton Bowl Classic (QF)");
    assert.equal(bowlColumnName({ bowl_name: "CFP Semifinal at the Capital One Orange Bowl" }), "CFP Semifinal at the Capital One Orange Bowl (SF)");
    // Frisco hosts two bowls: the Classic keeps its own name so the two never read the same.
    assert.equal(bowlColumnName({ bowl_name: "Frisco Football Classic" }), "Frisco Classic");
    assert.notEqual(bowlColumnName({ bowl_name: "Frisco Football Classic" }), bowlColumnName({ bowl_name: "Frisco" }));
    assert.equal(bowlColumnName({ bowl_name: "Boca Raton Bowl" }), "Boca Raton Bowl");
    assert.equal(bowlColumnName({ bowl_name: "Lockheed Martin Armed Forces Bowl" }), "Lockheed Martin Armed Forces Bowl");
    assert.equal(bowlColumnName({ bowl_name: "Bahamas Bowl (2026)" }), "Bahamas Bowl (2026)");
    assert.equal(bowlColumnName({ bowl_name: "Myrtle Beach Bowl Football Classic" }), "Myrtle Beach Bowl");
  });
}

// bowl-pool-health
{
  const season = {
    player_visible_at: "2026-12-07T08:00:00.000Z",
    first_kickoff_at: "2026-12-18T16:00:00.000Z",
  };

  test("the Bowl monitor tolerates setup only before player visibility", () => {
    assert.deepEqual(
      bowlPoolPrelaunchHealthResult(season, new Date("2026-12-07T07:59:59.999Z")),
      { configured: true, healthy: true, problems: [], integrity: null, settlement: null },
    );
    assert.equal(bowlPoolPrelaunchHealthResult(season, new Date(season.player_visible_at)), null);
  });

  test("Bowl integrity checks are required before first kickoff once players can see the pool", () => {
    assert.equal(bowlPoolPrelaunchHealthResult(season, new Date("2026-12-10T12:00:00.000Z")), null);
    assert.equal(bowlPoolPrelaunchHealthResult(season, new Date(season.first_kickoff_at)), null);
  });
}

// bowl-pool-reconciliation
{
  const base = { games: [{ id: "g1", status: "final" }], entries: [{ id: "e1", status: "active" }], lines: [{ game_id: "g1" }] };
  test("Bowl settlement accepts matching graded pick and receipt", () => {
    const result = assessBowlPoolSettlement({ ...base, picks: [{ entry_id: "e1", game_id: "g1", result: "win" }], results: [{ entry_id: "e1", game_id: "g1", result: "win" }] });
    assert.equal(result.healthy, true);
  });
  test("Bowl settlement catches missing and mismatched receipts", () => {
    const result = assessBowlPoolSettlement({ ...base, picks: [{ entry_id: "e1", game_id: "g1", result: "pending" }], results: [] });
    assert.equal(result.healthy, false);
    assert.match(result.problems.join(" "), /missing a result/);
    assert.match(result.problems.join(" "), /still pending/);
  });
}

// bowl-pool-schedule-import
{
  test("schedule importer preserves canonical names and allows blank teams", () => {
    const rows = parseBowlPoolScheduleCsv("order,bowl_name,kickoff_at,game_key,away_team,home_team,spread\n2, Pop-Tarts Bowl,2026-12-28T20:00:00-05:00,bowl-2,,,\n1, Rose Bowl,2026-12-26T17:00:00-05:00,bowl-1,,,");
    assert.deepEqual(rows.map((row) => row.order_index), [1, 2]);
    assert.equal(rows[0].bowl_name, "Rose Bowl");
    assert.equal(rows[0].away_team, null);
  });

  test("schedule importer rejects duplicate keys and malformed dates", () => {
    assert.throws(() => parseBowlPoolScheduleCsv("order,bowl_name,kickoff_at,game_key\n1,Rose Bowl,nope,x\n1,Peach Bowl,2026-12-30T00:00:00Z,x"), /invalid kickoff_at|Duplicate game_key/);
    assert.equal(normalizeBowlDisplayName("  Rose   Bowl "), "Rose Bowl");
  });
}

// bowl-private-scoreboard-markers
{
  const route = await readFile(new URL("../src/app/api/bowl-pool/route.ts", import.meta.url), "utf8");

  test("Bowl standings expose pre-kickoff markers only to the commissioner or picking player", () => {
    assert.match(route, /new Date\(game\.kickoff_at\) > now && \(player\.is_commissioner \|\| entry\?\.player_id === player\.id\)/);
  });
}

// bowl-recap-copy
{
  test("recap copy includes elimination and remaining count", () => assert.equal(bowlRecapCopy({ eliminated: ["Al"], remaining: 3 }), "Al was eliminated today. 3 entries remain."));
  test("recap copy announces co-champions", () => assert.match(bowlRecapCopy({ champions: ["Al", "Tyler"] }), /co-champions/));
}
