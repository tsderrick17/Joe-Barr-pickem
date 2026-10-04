import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the sliding wrapper never uses a Tailwind utility class name", async () => {
  const source = await readFile(new URL("../src/components/collapse.tsx", import.meta.url), "utf8");
  // Tailwind's `collapse` utility is `visibility: collapse`, which hides the whole table.
  assert.doesNotMatch(source, /className="[^"]*\b(collapse|invisible|hidden)\b/);
  // The slide is a height animation only; content is visible without it.
  assert.doesNotMatch(source, /opacity: 0;|data-open|grid-template-rows/);
});

test("the Standings spacing reset never strips the ticket's own padding", async () => {
  const styles = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.standings-stack > section:not\(\.my-ticket\):not\(\.standings-loading-ticket\) \{ padding-block: 0; \}/);
});
