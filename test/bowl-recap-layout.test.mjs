import test from "node:test";
import assert from "node:assert/strict";
import { bowlRecapLayout } from "../src/lib/bowl-recap-layout.js";
test("four games stay one column", () => assert.equal(bowlRecapLayout(4).columns, 1));
test("eight games split into two columns", () => assert.deepEqual(bowlRecapLayout(8), { columns: 2, gamesPerColumn: 4, width: 1200, height: 1100 }));
