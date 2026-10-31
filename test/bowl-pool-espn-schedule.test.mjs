import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  bowlNameWords, chronologicalOrder, espnHeadline, espnTeamIsTbd, espnTimeIsConfirmed, headlineIsCfp, headlineIsChampionship, headlineIsPoolGame, newBowlName, noonEastern, orderIsChronological, planBowlSchedule,
} from "../src/lib/bowl-pool-espn-schedule.js";
import { easternDateTimeToUtc } from "../src/lib/schedule-time.js";

// ESPN's real postseason list as it stood on 2026-10-31 (48 games, nearly all "TBD at TBD"), and the 42 rows the Bowl Pool was seeded with in September.
// Last year's finished list (real teams, the FCS playoff, sponsor names that have since changed) is the other fixture.
const read = async (name) => JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const feed2026 = (await read("espn-bowl-schedule-2026-10-31.json")).events;
const feed2025 = (await read("espn-bowl-schedule-2025-final.json")).events;
const seeded = await read("bowl-pool-seeded-2026.json");

// Our row -> the ESPN headline it must be paired with on December 1.
const EXPECTED = {
  "Salute to Veterans": "IS4S Salute to Veterans Bowl", "Frisco Football Classic": "Frisco Football Classic", "Boca Raton": "Boca Raton Bowl", Gasparilla: "Union Home Mortgage Gasparilla Bowl",
  "Myrtle Beach": "Myrtle Beach Bowl", "Idaho Potato": "Famous Idaho Potato Bowl", "Puerto Rico": "Puerto Rico Bowl", Cure: "StaffDNA Cure Bowl", Independence: "Radiance Technologies Independence Bowl",
  "New Orleans": "New Orleans Bowl", "Armed Forces": "Lockheed Martin Armed Forces Bowl", Frisco: "Frisco Bowl", "New Mexico": "Isleta New Mexico Bowl", "Hawaiʻi": "Sheraton Hawaiʻi Bowl",
  Pinstripe: "Bad Boy Mowers Pinstripe Bowl", Fenway: "Wasabi Fenway Bowl", "Duke's Mayo": "Duke's Mayo Bowl", "68 Ventures": "68 Ventures Bowl", Cactus: "Cactus Bowl", Military: "Freedom Mortgage Military Bowl",
  Birmingham: "JLab Birmingham Bowl", "Pop-Tarts": "Pop-Tarts Bowl", Alamo: "Valero Alamo Bowl", Gator: "TaxSlayer Gator Bowl", "Music City": "Liberty Mutual Music City Bowl", ReliaQuest: "ReliaQuest Bowl",
  "Las Vegas": "Las Vegas Bowl", Texas: "Kinder's Texas Bowl", Citrus: "Citrus Bowl", "First Responder": "SERVPRO First Responder Bowl", Liberty: "AutoZone Liberty Bowl",
  Fiesta: "College Football Playoff Quarterfinal at the Vrbo Fiesta Bowl", Cotton: "College Football Playoff Quarterfinal at the Goodyear Cotton Bowl Classic",
  Peach: "College Football Playoff Quarterfinal at the Chick-fil-A Peach Bowl", Rose: "College Football Playoff Quarterfinal at the Rose Bowl Presented by Prudential",
  Orange: "College Football Playoff Semifinal at the Capital One Orange Bowl", Sugar: "College Football Playoff Semifinal at the Allstate Sugar Bowl",
  "National Championship": "College Football Playoff National Championship Presented by AT&T",
};

test("all 42 seeded rows are paired with their own ESPN game, one to one, and the five games we lack are the only additions", () => {
  const plan = planBowlSchedule(feed2026, seeded);
  assert.equal(plan.updates.length, 42);
  assert.equal(new Set(plan.updates.map(({ event }) => event.id)).size, 42, "no ESPN game is used twice");
  for (const { game, event } of plan.updates) {
    if (game.bowl_name.startsWith("CFP First Round")) {
      assert.equal(espnHeadline(event), "College Football Playoff First Round Game");
      assert.ok(Math.abs(Date.parse(event.date) - Date.parse(game.kickoff_at)) <= 60 * 60_000, `${game.bowl_name} takes the first-round game at its own time`);
    } else assert.equal(espnHeadline(event), EXPECTED[game.bowl_name], game.bowl_name);
  }
  assert.deepEqual(plan.inserts.map(({ headline }) => headline).sort(), ["Holiday Bowl", "San Diego County Credit Union Poinsettia Bowl", "Snoop Dogg Arizona Bowl", "Tony the Tiger Sun Bowl", "TransPerfect San Juan Bowl"]);
  assert.deepEqual(plan.unmatched, []);
});

test("the Celebration Bowl, the owner's choice, and the FCS playoff are left out", () => {
  assert.deepEqual(planBowlSchedule(feed2026, seeded).ignored.map(({ headline }) => headline), ["Cricket Celebration Bowl"]);
  const lastYear = planBowlSchedule(feed2025, []);
  assert.equal(lastYear.ignored.length, 7, "last year: the Celebration Bowl and six FCS playoff games stay out");
  assert.equal(lastYear.inserts.length, feed2025.length - 7);
  assert.ok(lastYear.ignored.every(({ headline }) => /celebration|FCS/i.test(headline)));
  assert.ok(lastYear.inserts.every(({ headline }) => headlineIsPoolGame(headline)));
});

test("bowls ESPN moved or renamed never swap teams: Poinsettia is not Frisco, Sun is not Las Vegas, Arizona is not Liberty", () => {
  const plan = planBowlSchedule(feed2026, seeded);
  const paired = Object.fromEntries(plan.updates.map(({ game, event }) => [game.bowl_name, espnHeadline(event)]));
  assert.equal(paired.Frisco, "Frisco Bowl");
  assert.equal(paired["Las Vegas"], "Las Vegas Bowl");
  assert.equal(paired.Texas, "Kinder's Texas Bowl");
  assert.equal(paired.Liberty, "AutoZone Liberty Bowl", "not the Music City game, whose name begins with Liberty");
  assert.equal(paired["Music City"], "Liberty Mutual Music City Bowl");
  // Pairing by nearest kickoff alone (what the sync once did) puts these on the wrong rows.
  const nearest = (headline) => {
    const event = feed2026.find((candidate) => espnHeadline(candidate) === headline);
    return seeded.map((game) => ({ game, distance: Math.abs(Date.parse(game.kickoff_at) - Date.parse(event.date)) })).sort((a, b) => a.distance - b.distance)[0].game.bowl_name;
  };
  assert.notEqual(nearest("San Diego County Credit Union Poinsettia Bowl"), "Poinsettia");
  assert.notEqual(nearest("Tony the Tiger Sun Bowl"), "Sun");
});

test("running the pull again changes nothing: after the five new games are added every row pairs and nothing is added", () => {
  const first = planBowlSchedule(feed2026, seeded);
  const added = first.inserts.map(({ event, headline }, index) => ({ id: `new-${index}`, provider_game_id: `espn:${event.id}`, bowl_name: newBowlName(headline), kickoff_at: new Date(event.date).toISOString(), order_index: 100 + index }));
  const linked = [...seeded.map((game) => ({ ...game, provider_game_id: `espn:${first.updates.find((update) => update.game.id === game.id).event.id}` })), ...added];
  const second = planBowlSchedule(feed2026, linked);
  assert.equal(second.inserts.length, 0);
  assert.equal(second.updates.length, 47);
  assert.deepEqual(second.unmatched, []);
});

test("a game already linked to its ESPN game stays linked when it moves days or ESPN rewords it", () => {
  const event = feed2026.find((candidate) => espnHeadline(candidate) === "Cactus Bowl");
  const reworded = { ...event, competitions: [{ ...event.competitions[0], notes: [{ headline: "Cactus Bowl presented by Somebody Else" }] }] };
  const row = { id: "g", provider_game_id: `espn:${event.id}`, bowl_name: "Cactus", kickoff_at: "2026-12-30T17:00:00.000Z", order_index: 1 };
  const plan = planBowlSchedule([reworded], [row]);
  assert.equal(plan.updates[0].event.id, event.id);
  const renamed = planBowlSchedule([{ ...event, competitions: [{ ...event.competitions[0], notes: [{ headline: "Brand New Name" }] }] }], [row]);
  assert.equal(renamed.updates.length, 1, "the link alone keeps it ours");
  assert.equal(renamed.inserts.length, 0);
});

test("which ESPN games belong in the pool", () => {
  for (const headline of ["Famous Idaho Potato Bowl", "Frisco Football Classic", "College Football Playoff First Round Game", "College Football Playoff National Championship Presented by AT&T", "Duke's Mayo Bowl"]) assert.equal(headlineIsPoolGame(headline), true, headline);
  for (const headline of ["Cricket Celebration Bowl", "FCS Championship", "FCS Championship - Quarterfinals", "", "Army-Navy Game"]) assert.equal(headlineIsPoolGame(headline), false, headline);
  assert.equal(headlineIsCfp("College Football Playoff Semifinal at the Capital One Orange Bowl"), true);
  assert.equal(headlineIsCfp("Famous Idaho Potato Bowl"), false);
  assert.equal(headlineIsChampionship("College Football Playoff National Championship Presented by AT&T"), true);
  assert.equal(headlineIsChampionship("College Football Playoff Semifinal at the Allstate Sugar Bowl"), false);
});

test("a bowl's name reduces to the words that identify it", () => {
  assert.deepEqual(bowlNameWords("Cotton"), ["cotton"]);
  assert.deepEqual(bowlNameWords("College Football Playoff Quarterfinal at the Goodyear Cotton Bowl Classic"), ["goodyear", "cotton"]);
  assert.deepEqual(bowlNameWords("Rose Bowl Presented by Prudential"), ["rose"]);
  assert.deepEqual(bowlNameWords("Hawaiʻi"), bowlNameWords("Sheraton Hawaiʻi Bowl").slice(1));
  assert.deepEqual(bowlNameWords("Duke's Mayo"), ["dukes", "mayo"]);
  assert.deepEqual(bowlNameWords("CFP First Round 3"), bowlNameWords("College Football Playoff First Round Game"));
  assert.deepEqual(bowlNameWords("Frisco Football Classic"), ["frisco", "football", "classic"], "a Classic that is part of the name is kept");
  assert.deepEqual(bowlNameWords("Orange Bowl (CFP Semifinal)"), ["orange"]);
});

test("a time ESPN has not announced is not a kickoff, and a TBD team is no team", () => {
  const tba = feed2026.find((event) => espnHeadline(event).includes("Rose Bowl"));
  const set = feed2026.find((event) => espnHeadline(event) === "Cactus Bowl");
  assert.equal(espnTimeIsConfirmed(tba), false);
  assert.equal(espnTimeIsConfirmed(set), true);
  assert.equal(espnTimeIsConfirmed({ date: "not a date", competitions: [{}] }), false);
  const [away, home] = set.competitions[0].competitors.map((competitor) => competitor.team);
  assert.equal(espnTeamIsTbd(away), true);
  assert.equal(espnTeamIsTbd(home), true);
  const real = feed2025.find((event) => espnHeadline(event) === "Pop-Tarts Bowl").competitions[0].competitors.map((competitor) => competitor.team);
  assert.deepEqual(real.map(espnTeamIsTbd), [false, false]);
  assert.equal(espnTeamIsTbd({ id: "1", displayName: "TBD" }), true);
  assert.equal(espnTeamIsTbd(undefined), true);
});

test("a new game is named in the seeded style and a TBA game waits at noon Eastern on its day", () => {
  assert.equal(newBowlName("TransPerfect San Juan Bowl"), "TransPerfect San Juan");
  assert.equal(newBowlName("Holiday Bowl"), "Holiday");
  assert.equal(newBowlName("College Football Playoff National Championship Presented by AT&T"), "National Championship");
  assert.equal(newBowlName("College Football Playoff Quarterfinal at the Goodyear Cotton Bowl Classic"), "Goodyear Cotton");
  assert.equal(noonEastern("2026-12-16", easternDateTimeToUtc).toISOString(), "2026-12-16T17:00:00.000Z");
  assert.equal(noonEastern("2026-07-04", easternDateTimeToUtc).toISOString(), "2026-07-04T16:00:00.000Z", "daylight time");
});

test("new games take their place by kickoff, but a curated order is left alone", () => {
  const rows = [{ id: "a", kickoff_at: "2026-12-15T22:00:00Z", order_index: 1 }, { id: "b", kickoff_at: "2026-12-18T22:00:00Z", order_index: 2 }, { id: "n", kickoff_at: "2026-12-16T22:00:00Z", order_index: 3 }];
  assert.equal(orderIsChronological(rows.slice(0, 2)), true);
  assert.equal(orderIsChronological(rows), false, "with the new game last it is not by kickoff yet, but the old order was");
  assert.deepEqual(chronologicalOrder(rows), [{ id: "n", order_index: 2 }, { id: "b", order_index: 3 }]);
  assert.equal(orderIsChronological([{ kickoff_at: "2026-12-20T00:00:00Z", order_index: 1 }, { kickoff_at: "2026-12-15T00:00:00Z", order_index: 2 }]), false, "a curated order");
  const tied = [{ id: "x", kickoff_at: "2027-01-01T17:00:00Z", order_index: 1 }, { id: "y", kickoff_at: "2027-01-01T17:00:00Z", order_index: 2 }];
  assert.deepEqual(chronologicalOrder(tied), [], "games at the same time keep the order they have");
});
