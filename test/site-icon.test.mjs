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
  assert.deepEqual(sizes, [16, 32, 64, 256]);
  const png = await readFile(new URL("../src/app/icon.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [256, 256]);
});

// The home-screen ("app thumbnail") icons are the same goalpost as the tab icon: a full square with no transparent corners (the phone applies its
// own rounded mask), at the sizes the manifest declares.
test("the home-screen icons are opaque squares at the sizes the manifest declares", async () => {
  const manifest = (await readFile(new URL("../src/app/manifest.ts", import.meta.url), "utf8"));
  for (const [file, size] of [["../public/icons/icon-192.png", 192], ["../public/icons/icon-512.png", 512], ["../public/icons/icon-maskable-512.png", 512], ["../src/app/apple-icon.png", 192]]) {
    const png = await readFile(new URL(file, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG", file);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [size, size], file);
    assert.equal(png[25], 2, `${file} is plain RGB, so no corner is transparent`);
    if (file.includes("/icons/")) assert.ok(manifest.includes(`/icons/${file.split("/icons/")[1]}`), `${file} is in the manifest`);
  }
});
