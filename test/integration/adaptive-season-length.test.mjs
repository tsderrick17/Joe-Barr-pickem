import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";
import { isolatedDatabaseEnabled } from "./test-database.mjs";

const enabled = isolatedDatabaseEnabled();
const skip = !enabled && "Set PICKEM_TEST_DATABASE_URL for the isolated database to run this test.";

async function withPreseason(run) {
  const client = new pg.Client({ connectionString: process.env.PICKEM_TEST_DATABASE_URL });
  await client.connect();
  await client.query("begin");
  try {
    const season = (await client.query("insert into public.seasons(year, state) values ($1, 'preseason') returning id", [6000 + Math.floor(Math.random() * 900)])).rows[0];
    const specs = [
      ...Array.from({ length: 18 }, (_, index) => [`Week ${index + 1}`, "regular", 2]),
      ["Wild Card", "playoff", 6], ["Divisional Round", "playoff", 4], ["Conference Championships", "playoff", 2], ["Super Bowl", "playoff", 1],
    ];
    for (const [index, [name, type, max]] of specs.entries()) {
      await client.query("insert into public.scoring_periods (season_id, display_name, period_type, max_picks, status, display_order) values ($1, $2, $3, $4, 'upcoming', $5)", [season.id, name, type, max, index + 1]);
    }
    await run(client, season);
  } finally {
    await client.query("rollback");
    await client.end();
  }
}

const periodsOf = async (client, seasonId) => (await client.query("select display_name, period_type, display_order, max_picks from public.scoring_periods where season_id = $1 order by display_order", [seasonId])).rows;

test("a longer season adds its missing week before the playoff rounds, once", { skip }, async () => {
  await withPreseason(async (client, season) => {
    const added = (await client.query("select public.ensure_regular_season_weeks($1, 19) as weeks", [season.id])).rows[0].weeks;
    assert.equal(added, 19);
    const periods = await periodsOf(client, season.id);
    assert.equal(periods.length, 23);
    assert.deepEqual(periods.slice(17, 20).map((period) => [period.display_name, period.period_type, period.display_order]), [
      ["Week 18", "regular", 18], ["Week 19", "regular", 19], ["Wild Card", "playoff", 20],
    ]);
    assert.equal(periods.find((period) => period.display_name === "Week 19").max_picks, 2, "the new week copies the regular-season pick count");
    assert.equal(periods.at(-1).display_name, "Super Bowl");
    assert.equal(periods.at(-1).display_order, 23);
    // Running it again changes nothing.
    await client.query("select public.ensure_regular_season_weeks($1, 19)", [season.id]);
    assert.equal((await periodsOf(client, season.id)).length, 23);
  });
});

test("weeks are never removed, and are only added in preseason", { skip }, async () => {
  await withPreseason(async (client, season) => {
    // Asking for fewer weeks than exist leaves the season alone.
    assert.equal((await client.query("select public.ensure_regular_season_weeks($1, 18) as weeks", [season.id])).rows[0].weeks, 18);
    // Each expected error rolls back to a savepoint so the test transaction stays usable.
    await client.query("savepoint too_short");
    await assert.rejects(client.query("select public.ensure_regular_season_weeks($1, 17)", [season.id]), /between 18 and 22 weeks/);
    await client.query("rollback to savepoint too_short");
    await client.query("savepoint before_state");
    await client.query("update public.seasons set state = 'regular_season' where id = $1", [season.id]);
    await assert.rejects(client.query("select public.ensure_regular_season_weeks($1, 19)", [season.id]), /only be added in preseason/);
    await client.query("rollback to savepoint before_state");
  });
});

test("the full-schedule import no longer hard-codes 18 weeks and 272 games", { skip }, async () => {
  await withPreseason(async (client, season) => {
    // An incomplete payload is refused with the season-shape message, not a fixed count.
    await assert.rejects(
      client.query("select * from public.import_full_schedule_atomically($1, '[]'::jsonb, '[]'::jsonb)", [season.id]),
      /every regular-season week \(at least 18\) and include at least 272 games/,
    );
  });
});
