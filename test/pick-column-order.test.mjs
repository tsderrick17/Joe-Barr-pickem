import assert from "node:assert/strict";
import test from "node:test";
import { comparePickColumns } from "../src/lib/pick-column-order.js";

const pick = (gameId, kickoffAt) => ({ gameId, kickoffAt });

test("picks sit in kickoff order, whatever order they were submitted in", () => {
  const picks = [pick("c", "2026-10-04T20:20:00Z"), pick("a", "2026-10-04T13:00:00Z"), pick("b", "2026-10-04T16:25:00Z")];
  assert.deepEqual([...picks].sort(comparePickColumns).map((item) => item.gameId), ["a", "b", "c"]);
  assert.deepEqual([...picks].reverse().sort(comparePickColumns).map((item) => item.gameId), ["a", "b", "c"]);
});

test("simultaneous kickoffs are ordered by game id, never by a hidden selection", () => {
  const picks = [pick("g2", "2026-10-04T13:00:00Z"), pick("g1", "2026-10-04T13:00:00Z")];
  assert.deepEqual([...picks].sort(comparePickColumns).map((item) => item.gameId), ["g1", "g2"]);
});

test("a game with no kickoff time goes last", () => {
  const picks = [pick("x", undefined), pick("y", "2026-10-04T13:00:00Z")];
  assert.deepEqual([...picks].sort(comparePickColumns).map((item) => item.gameId), ["y", "x"]);
});

test("invalid kickoff times go last in deterministic game-id order", () => {
  const picks = [pick("no-time", null), pick("valid", "2026-10-04T13:00:00Z"), pick("bad-time", "not-a-date")];
  assert.deepEqual([...picks].sort(comparePickColumns).map((item) => item.gameId), ["valid", "bad-time", "no-time"]);
  assert.deepEqual([...picks].reverse().sort(comparePickColumns).map((item) => item.gameId), ["valid", "bad-time", "no-time"]);
});
