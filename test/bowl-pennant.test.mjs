import assert from "node:assert/strict";
import test from "node:test";
import { BOWL_GOLD, BOWL_NAVY, bowlPennantColors, bowlSeasonLabel, normalizeHexColor, readableInk } from "../src/lib/bowl-pennant.js";

test("ESPN colors (six digits, no #) become lower-case hex, and anything else is rejected", () => {
  assert.equal(normalizeHexColor("154733"), "#154733");
  assert.equal(normalizeHexColor("#BB0000"), "#bb0000");
  for (const bad of [null, undefined, "", "fff", "12345g", "#12345", 123456]) assert.equal(normalizeHexColor(bad), null);
});

test("a pennant uses the school's colors, and the pool's navy and gold when it has none", () => {
  assert.deepEqual(bowlPennantColors({ primary_color: "#154733", secondary_color: "#fee123" }), { primary: "#154733", secondary: "#fee123", ink: "#ffffff" });
  assert.deepEqual(bowlPennantColors({}), { primary: BOWL_NAVY, secondary: BOWL_GOLD, ink: "#ffffff" });
  assert.equal(bowlPennantColors({ primary_color: "zzz" }).primary, BOWL_NAVY);
});

test("pennant lettering is white on dark colors and near-black on light ones", () => {
  assert.equal(readableInk("#154733"), "#ffffff");
  assert.equal(readableInk("#fee123"), "#1d1d1f");
  assert.equal(readableInk("#ffffff"), "#1d1d1f");
  assert.equal(readableInk("#bb0000"), "#ffffff");
});

test("the season label rolls over every year on its own", () => {
  assert.equal(bowlSeasonLabel(2026), "2026-27");
  assert.equal(bowlSeasonLabel(2027), "2027-28");
  assert.equal(bowlSeasonLabel(2099), "2099-00");
});
