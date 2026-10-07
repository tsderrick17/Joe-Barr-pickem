import { measureRoute } from "./route-cost-harness.mjs";
import { buildPool, SCENARIOS } from "./pool-fixture.mjs";
import { seasonYearAt } from "../../src/lib/season.ts";

const viewer = { id: "p1", active: true, is_commissioner: false, show_survivor_standings: true, show_bowl_card: true, show_pool_chat: true, hide_pickem_eliminated_rows: false, hide_survivor_eliminated_rows: false };
const ROUTES = [["home", ""], ["board", "?bootstrap=1"]];

/** Every route in every scenario: what one read costs. */
export async function measureAllRoutes() {
  const results = {};
  for (const scenario of Object.keys(SCENARIOS)) {
    for (const [route, query] of ROUTES) {
      const { tables } = buildPool({ seasonYear: seasonYearAt(new Date()), scenario });
      const { body, ...summary } = await measureRoute({ route, query, tables, player: viewer, rpc: { snapshot_playoff_day_eligibility: () => [{ snapshot_day: "2027-01-17" }] } });
      void body;
      results[`${route}/${scenario}`] = summary;
    }
  }
  return results;
}
