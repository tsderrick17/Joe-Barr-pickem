import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the ticket shows preliminary lines and distinguishes official lines", async () => {
  const [home, ticket, styles, recapImage] = await Promise.all([
    readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/my-ticket.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/recap-image/route.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(home, /spread: pick\.spread \?\? null,/);
  assert.doesNotMatch(home, /spread: pick\.isLineLocked \? pick\.spread/);
  assert.match(ticket, /<strong>GAME LINES<\/strong>/);
  assert.doesNotMatch(ticket, /ROUND LINES/);
  assert.match(ticket, /\{pick\.spread \?\? "—"\}/);
  assert.match(ticket, /Current spreads appear here; teal lines are official\./);
  assert.match(styles, /--official-line-color: #008c82;/);
  assert.match(styles, /\.my-ticket-line \{[\s\S]*?font: 900 \.8rem\/1 "Courier New", monospace;[\s\S]*?text-align: right;/);
  assert.match(styles, /\.my-ticket-line\.is-locked \{\s*color: var\(--official-line-color\);/);
  assert.match(styles, /\.my-ticket-line\.is-locked \{[\s\S]*?font-size: \.9rem;/);
  assert.match(styles, /is-playoff-picks--4 \{[\s\S]*?grid-auto-flow: column;/);
  assert.match(styles, /is-playoff-picks--5,[\s\S]*?is-playoff-picks--6 \{[\s\S]*?grid-template-rows: repeat\(3/);
  assert.match(recapImage, /const TEAL = "#008c82";/);
});
