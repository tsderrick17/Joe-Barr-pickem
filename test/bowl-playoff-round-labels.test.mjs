import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("Bowl playoff standings retain QF and SF labels when providers return bare bowl names", () => {
  assert.match(page, /qfBowl = \/\^\(fiesta\|cotton\|peach\|rose\)/);
  assert.match(page, /sfBowl = \/\^\(orange\|sugar\)/);
  assert.match(page, /\$\{cleanName\} \(QF\)/);
  assert.match(page, /\$\{cleanName\} \(SF\)/);
});
