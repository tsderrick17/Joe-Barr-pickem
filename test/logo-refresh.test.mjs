import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(new URL("../.github/workflows/logo-refresh.yml", import.meta.url), "utf8");

test("the logo refresh runs on the Friday before Selection Sunday (bowls) and July 31 (NFL), and never puts logos live itself", () => {
  // Selection Sunday falls Dec 2-8, so its Friday falls Nov 30 - Dec 6; the job only acts on the Friday.
  assert.match(workflow, /- cron: "0 14 30 11 \*"/);
  assert.match(workflow, /- cron: "0 14 1-6 12 \*"/);
  assert.match(workflow, /- cron: "0 14 31 7 \*"/);
  assert.match(workflow, /date -u \+%u\)" = "5" \]; then kind=bowl/);
  assert.doesNotMatch(workflow, /git push origin main|gh pr merge/);
});

test("every saved bowl logo (except LA's poster and the playoff's two) has a Wikipedia article to refresh from", async () => {
  const { BOWL_ARTICLES } = await import("../scripts/bowl-logo-articles.mjs");
  for (const file of readdirSync(new URL("../assets/bowl-logos/", import.meta.url))) {
    const name = file.replace(/\.\w+$/, "");
    if (["la", "cfp", "championship"].includes(name)) continue;
    assert.ok(BOWL_ARTICLES[name], `${name} has an article`);
  }
});
