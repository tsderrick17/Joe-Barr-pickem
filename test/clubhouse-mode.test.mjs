import test from "node:test";
import assert from "node:assert/strict";
import { paneForHref, paneFromHash } from "../src/lib/clubhouse-mode.js";

const origin = "https://pickemjb.vercel.app";

test("a link to a real page opens that page in place; any other link leaves the clubhouse", () => {
  assert.equal(paneForHref("/", origin), "standings");
  assert.equal(paneForHref("/board", origin), "slate");
  assert.equal(paneForHref("/board#slate-matchups", origin), "slate");
  assert.equal(paneForHref(`${origin}/trophy-room`, origin), "trophies");
  assert.equal(paneForHref("/bowl-pool", origin), "bowl");
  assert.equal(paneForHref("/clubhouse/rules", origin), "rules");
  assert.equal(paneForHref("/profile", origin), "notifications");   // Notifications opens as the cloud's pop-up
  assert.equal(paneForHref("/admin/stats", origin), null);
  assert.equal(paneForHref("https://example.com/board", origin), null);
  assert.equal(paneForHref("http://[bad", origin), null);
});

test("an address's hash names the pane to reopen; nothing else does", () => {
  assert.equal(paneFromHash("#slate"), "slate");
  assert.equal(paneFromHash("#rules"), "rules");
  assert.equal(paneFromHash("#survivor"), "survivor");
  assert.equal(paneFromHash("#nonsense"), null);
  assert.equal(paneFromHash(""), null);
  assert.equal(paneFromHash(undefined), null);
});

test("a link that only jumps within the page is never another page", () => {
  assert.equal(paneForHref("#rule-1", "https://pickemjb.vercel.app"), null);
});
