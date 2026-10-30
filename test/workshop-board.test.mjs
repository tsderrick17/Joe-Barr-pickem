import assert from "node:assert/strict";
import test from "node:test";
import { cellSize, clampZoom, glide, mergeSaved, patchProblems, patchSize, tileBox, visibleCopies, WORKSHOP_PATCH, ZOOM_MAX, ZOOM_MIN, zoomAt } from "../src/lib/workshop-board.js";

// The Workshop board: one patch of tiles repeated forever, seen through a camera. These check the arithmetic on its own.

test("a patch layout must fill every cell exactly once", () => {
  const tiles = [{ id: "a", col: 0, row: 0, cols: 2, rows: 1 }, { id: "b", col: 0, row: 1, cols: 1, rows: 1 }, { id: "c", col: 1, row: 1, cols: 1, rows: 1 }];
  assert.deepEqual(patchProblems(tiles, 2, 2), []);
  assert.deepEqual(patchProblems(tiles.slice(0, 2), 2, 2), ["cell 1,1 is empty"]);
  assert.deepEqual(patchProblems([...tiles, { id: "d", col: 1, row: 0, cols: 1, rows: 2 }], 2, 2), ["d overlaps a at 1,0", "d overlaps c at 1,1"]);
  assert.deepEqual(patchProblems([{ id: "e", col: 1, row: 0, cols: 2, rows: 2 }, ...tiles.slice(1, 2)], 2, 2).slice(0, 1), ["e runs outside the patch"]);
});

test("tiles sit on the grid with an even gap, and the patch repeats with the same gap", () => {
  assert.deepEqual(tileBox({ col: 2, row: 1, cols: 2, rows: 1 }, 100, 6), { left: 212, top: 106, width: 206, height: 100 });
  assert.deepEqual(patchSize(6, 4, 100, 6), { width: 636, height: 424 });
  assert.equal(cellSize(390), 150);
  assert.equal(cellSize(1280), 180);
});

test("the copies on screen cover the whole screen wherever the board has been dragged, with every other row shifted half a patch", () => {
  const patch = { width: 600, height: 400 };
  const viewport = { width: 390, height: 844 };
  for (const camera of [{ x: 0, y: 0, zoom: 1 }, { x: -12345, y: 6789, zoom: 1 }, { x: 250, y: -999, zoom: 0.5 }, { x: 3, y: 3, zoom: 2.5 }]) {
    const copies = visibleCopies(camera, viewport, patch);
    // every screen point (on a coarse grid) falls inside one copy
    for (let sx = 0; sx <= viewport.width; sx += 30) {
      for (let sy = 0; sy <= viewport.height; sy += 30) {
        const bx = (sx - camera.x) / camera.zoom, by = (sy - camera.y) / camera.zoom;
        assert.ok(copies.some((copy) => bx >= copy.left && bx < copy.left + patch.width && by >= copy.top && by < copy.top + patch.height), `screen ${sx},${sy} uncovered at ${JSON.stringify(camera)}`);
      }
    }
    assert.equal(new Set(copies.map((copy) => copy.key)).size, copies.length, "no copy twice");
  }
  const rows = visibleCopies({ x: 0, y: 0, zoom: 1 }, { width: 600, height: 800 }, patch);
  assert.equal(rows.find((copy) => copy.key === "0:0").left, 0);
  assert.equal(rows.find((copy) => copy.key === "0:1").left, 300);
  assert.equal(rows.find((copy) => copy.key === "-1:1").left, -300);
});

test("a margin brings in copies just off screen, so a short drag never shows a gap", () => {
  const patch = { width: 600, height: 400 };
  const plain = visibleCopies({ x: 0, y: 0, zoom: 1 }, { width: 600, height: 400 }, patch);
  const padded = visibleCopies({ x: 0, y: 0, zoom: 1 }, { width: 600, height: 400 }, patch, 180);
  assert.deepEqual(plain.map((copy) => copy.key), ["0:0"]);
  assert.ok(padded.length > plain.length);
});

test("zoom stays within its limits and keeps the point under the finger still", () => {
  assert.equal(clampZoom(10), ZOOM_MAX);
  assert.equal(clampZoom(0.01), ZOOM_MIN);
  const before = { x: 40, y: -20, zoom: 1 };
  const point = { x: 200, y: 300 };
  const after = zoomAt(before, 2, point);
  assert.equal(after.zoom, 2);
  assert.deepEqual([(point.x - after.x) / after.zoom, (point.y - after.y) / after.zoom], [(point.x - before.x) / before.zoom, (point.y - before.y) / before.zoom]);
  assert.equal(zoomAt({ x: 0, y: 0, zoom: ZOOM_MAX }, 2, point).zoom, ZOOM_MAX);
});

test("a fling slows down and stops", () => {
  assert.ok(glide(1, 16) < 1);
  assert.ok(glide(1, 2000) < 0.02);
});

test("saved settings are used only where they still fit, so an old or damaged save never breaks the board", () => {
  const defaults = { knobs: { pace: 140, "--tilt": 45 }, chip: { team: "KC", spinning: false }, words: "Chiefs" };
  const rules = { limits: { "knobs.pace": [40, 400] }, choices: { "chip.team": ["KC", "BUF"] } };
  assert.deepEqual(mergeSaved(defaults, { knobs: { pace: 200, "--tilt": 30 }, chip: { team: "BUF", spinning: true }, words: "Rams" }, rules), { knobs: { pace: 200, "--tilt": 30 }, chip: { team: "BUF", spinning: true }, words: "Rams" });
  assert.deepEqual(mergeSaved(defaults, { knobs: { pace: 9000, "--tilt": "steep" }, chip: { team: "XYZ", spinning: "yes" }, words: 4, extra: 1 }, rules), defaults);
  assert.deepEqual(mergeSaved(defaults, { knobs: { pace: Number.NaN } }, rules).knobs.pace, 140);
  assert.deepEqual(mergeSaved(defaults, null, rules), defaults);
  assert.deepEqual(mergeSaved(defaults, [1, 2], rules), defaults);
  assert.deepEqual(mergeSaved(defaults, { chip: "KC" }, rules).chip, defaults.chip);
});

test("the Workshop's own patch fills its grid with no gaps or overlaps, each piece once", () => {
  assert.deepEqual(patchProblems(WORKSHOP_PATCH.tiles, WORKSHOP_PATCH.cols, WORKSHOP_PATCH.rows), []);
  const ids = WORKSHOP_PATCH.tiles.map((tile) => tile.id);
  assert.equal(new Set(ids).size, ids.length);
});
