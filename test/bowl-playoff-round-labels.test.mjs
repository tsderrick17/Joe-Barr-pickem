import assert from "node:assert/strict";
import test from "node:test";
import { bowlColumnName } from "../src/lib/bowl-pool.js";

// The Bowl Card's column names (and the clubhouse Bowl sheet's, which uses the same rule).
test("Bowl playoff standings retain QF and SF labels when providers return bare bowl names", () => {
  for (const bowl of ["Fiesta", "Cotton Bowl", "Peach", "Rose Bowl"]) assert.equal(bowlColumnName({ bowl_name: bowl }), `${bowl} (QF)`);
  for (const bowl of ["Orange Bowl", "Sugar"]) assert.equal(bowlColumnName({ bowl_name: bowl }), `${bowl} (SF)`);
  assert.equal(bowlColumnName({ bowl_name: "Goodyear Cotton Bowl Classic", provider_game_id: "cfp-quarterfinal-1" }), "Goodyear Cotton Bowl Classic (QF)");
  assert.equal(bowlColumnName({ bowl_name: "CFP Semifinal at the Capital One Orange Bowl" }), "CFP Semifinal at the Capital One Orange Bowl (SF)");
  assert.equal(bowlColumnName({ bowl_name: "Boca Raton Bowl" }), "Boca Raton Bowl");
  assert.equal(bowlColumnName({ bowl_name: "Lockheed Martin Armed Forces Bowl" }), "Lockheed Martin Armed Forces Bowl");
  assert.equal(bowlColumnName({ bowl_name: "Bahamas Bowl (2026)" }), "Bahamas Bowl (2026)");
  assert.equal(bowlColumnName({ bowl_name: "Myrtle Beach Bowl Football Classic" }), "Myrtle Beach Bowl");
});
