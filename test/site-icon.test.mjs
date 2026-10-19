import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// The browser tab shows the site's own football, not the framework's default triangle: the .ico carries every size a tab or bookmark asks for,
// and the PNG is the large version for places that prefer it.
test("the favicon carries the tab sizes, and the large icon is a 256 px PNG", async () => {
  const ico = await readFile(new URL("../src/app/favicon.ico", import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0, "an icon file");
  assert.equal(ico.readUInt16LE(2), 1, "of type icon");
  const count = ico.readUInt16LE(4);
  const sizes = Array.from({ length: count }, (_, index) => ico[6 + index * 16] || 256).sort((a, b) => a - b);
  assert.deepEqual(sizes, [16, 32, 48, 256]);
  const png = await readFile(new URL("../src/app/icon.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [256, 256]);
});
