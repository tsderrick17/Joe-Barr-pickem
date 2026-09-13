import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Slate and Bowl receipts show printer feedback below the stable Submit button", async () => {
  const [board, bowl, css] = await Promise.all([
    readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/bowl-pool/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(board, /receipt-printing-status \$\{isSubmitting \? "is-printing"/);
  assert.match(bowl, /receipt-printing-status \$\{isSubmitting \? "is-printing"/);
  assert.match(board, /isSubmitting \? "PRINTING" : ""/);
  assert.match(bowl, /isSubmitting \? "PRINTING" : ""/);
  assert.match(css, /\.receipt-printing-status \{[\s\S]*min-height: \.62rem/);
  assert.match(css, /\.receipt-printing-status \{[\s\S]*white-space: nowrap/);
  assert.match(css, /@keyframes receipt-printer-feed/);
  assert.match(css, /prefers-reduced-motion[\s\S]*receipt-printing-marks i/);
});
