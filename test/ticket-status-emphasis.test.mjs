import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the ticket uses upright result stamps and aligned open states", async () => {
  const [ticket, styles] = await Promise.all([
    readFile(new URL("../src/components/my-ticket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.equal((ticket.match(/className="my-ticket-result"/g) ?? []).length, 2);
  assert.equal((ticket.match(/tilted=\{false\}/g) ?? []).length, 2);
  assert.match(ticket, /<span className="my-ticket-selection">\s*<strong className="my-ticket-open">OPEN<\/strong>\s*<\/span>\s*<span className="my-ticket-line">—<\/span>/);
  assert.match(ticket, /<div className="my-ticket-survivor-pick is-open">\s*<strong className="my-ticket-open">OPEN<\/strong>/);
  assert.doesNotMatch(ticket, /ONE PICK DUE/);

  assert.match(ticket, /variant="ticket"/);
  const stamp = await readFile(new URL("../src/components/ats-result-stamp.tsx", import.meta.url), "utf8");
  assert.match(stamp, /<circle className="ats-result-stamp__ring" cx="17" cy="17" r="14\.25" \/>/);
  assert.match(stamp, /className=\{`ats-result-stamp__letter is-\$\{mark\.toLowerCase\(\)\}`\}/);
  assert.match(stamp, /dominantBaseline="central"/);
  assert.doesNotMatch(stamp, /ats-result-stamp__wear/);
  assert.match(styles, /\.ats-result-stamp__ring \{[\s\S]*?stroke-width: 1\.3;/);
  assert.match(styles, /\.ats-result-stamp__letter \{[\s\S]*?font-family: Georgia/);
  assert.doesNotMatch(styles, /\.ats-result-stamp__letter \{[^}]*(?:opacity|stroke):/);
  assert.doesNotMatch(styles, /\.ats-result-stamp--ticket::(?:before|after)/);
  assert.match(styles, /\.my-ticket-open \{[\s\S]*?font: 900 \.84rem\/1 "Courier New", monospace;/);
  assert.match(styles, /Keep the completion receipt and status stamp from visually merging/);
  assert.match(styles, /\.my-ticket-footer \{\s*column-gap: \.65rem;\s*grid-template-columns: minmax\(0, 1fr\) minmax\(4\.75rem, auto\) 3\.2rem;/);
  assert.match(styles, /\.my-ticket-footer > div \{ min-width: 4\.75rem; \}/);
});
