import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("loading shells reserve the current compact card widths", () => {
  const standings = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  const slate = fs.readFileSync(path.join(root, "src/app/board/page.tsx"), "utf8");
  assert.match(standings, /standings-loading-ticket[^>]*max-w-\[30rem\]/);
  assert.match(standings, /<section className="mx-auto w-full max-w-\[30rem\]">/);
  assert.match(slate, /slate-loading-receipt h-\[6\.75rem\][^>]*sm:h-\[5\.8rem\]/);
});
