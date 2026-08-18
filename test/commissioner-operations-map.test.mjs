import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/app/api/admin/operations-map/route.ts", import.meta.url), "utf8");
const component = await readFile(new URL("../src/components/commissioner-operations-map.tsx", import.meta.url), "utf8");

test("commissioner operations map keeps the five operational stages in order", () => {
  const stages = ["schedule", "selections", "lines", "scores", "results"];
  let cursor = -1;
  for (const stage of stages) {
    const position = route.indexOf(`\"${stage}\"`, cursor + 1);
    assert.ok(position > cursor, `${stage} should follow the previous operational stage`);
    cursor = position;
  }
});

test("commissioner operations map exposes the hold and the next safe transition", () => {
  assert.match(component, /WHAT HAPPENS NEXT/);
  assert.match(component, /first red stage explains the hold/);
  assert.match(component, /aria-current=\{current \? "step"/);
});
