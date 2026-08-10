import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("the Survivor receipt pick is constrained by its grid track", () => {
  assert.match(
    css,
    /\.slate-receipt-survivor-pick\s*\{[^}]*height:\s*100%;[^}]*\}/s,
  );
  assert.match(
    css,
    /\.slate-receipt-survivor-pick \.survivor-poker-chip-wrap-summary\s*\{[^}]*calc\(100% - \(var\(--receipt-chip-buffer\) \* 2\)\)/s,
  );
  assert.match(
    css,
    /@media \(max-width: 639px\)[\s\S]*\.slate-receipt-survivor-pick \.survivor-poker-chip-wrap-summary\s*\{[^}]*height:[^}]*width:\s*auto;/s,
  );
});
