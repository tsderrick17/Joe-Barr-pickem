import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { readStylesheet } from "./helpers/stylesheet.mjs";

test("the Commissioner map exposes release context and shared visual tokens", async () => {
  const api = await readFile(new URL("../src/app/api/admin/operations-map/route.ts", import.meta.url), "utf8");
  const component = await readFile(new URL("../src/components/commissioner-operations-map.tsx", import.meta.url), "utf8");
  const css = await readStylesheet();
  const guide = await readFile(new URL("../docs/visual-design-system.md", import.meta.url), "utf8");

  assert.match(api, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(api, /release,/);
  assert.match(component, /DEPLOYED RELEASE/);
  assert.match(css, /--pool-display-font/);
  assert.match(guide, /Layout contracts/);
});
