import test from "node:test";
import assert from "node:assert/strict";
import { bowlRecapCopy } from "../src/lib/bowl-recap-copy.js";
test("recap copy includes elimination and remaining count", () => assert.equal(bowlRecapCopy({ eliminated: ["Al"], remaining: 3 }), "Al was eliminated today. 3 entries remain."));
test("recap copy announces co-champions", () => assert.match(bowlRecapCopy({ champions: ["Al", "Tyler"] }), /co-champions/));
