import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";
import { TEAM_LOGO_SCALE, teamLogoScale } from "../src/lib/team-logo-scale.js";

test("every team logo has a scale, and every scale is within sane limits", async () => {
  const logos = (await readdir(new URL("../public/team-logos/", import.meta.url))).filter((name) => name.endsWith(".png")).map((name) => name.replace(/\.png$/, ""));
  assert.deepEqual(Object.keys(TEAM_LOGO_SCALE).sort(), logos.sort());
  for (const [team, scale] of Object.entries(TEAM_LOGO_SCALE)) assert.ok(scale >= 0.72 && scale <= 1.2, `${team} scale ${scale}`);
});

test("the edge-to-edge Colts horseshoe is scaled down, wide marks up, and unknown teams are left alone", () => {
  assert.ok(teamLogoScale("IND") < 0.9);
  assert.ok(teamLogoScale("SEA") > 1.1);
  assert.equal(teamLogoScale("ind"), teamLogoScale("IND"));
  assert.equal(teamLogoScale(" ind "), teamLogoScale("IND"));
  assert.equal(teamLogoScale("XYZ"), 1);
});
