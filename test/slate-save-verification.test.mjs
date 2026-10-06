import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const { confirmsSlateSubmission } = await import("../src/lib/slate-save-verification.ts");

const picks = [
  { gameId: "game-1", teamId: "team-a" },
  { gameId: "game-2", teamId: "team-b" },
];

function board(myPicks = picks, survivorPick = null) {
  return { myPicks, survivor: { pick: survivorPick } };
}

test("confirms the submitted ATS snapshot regardless of response ordering", () => {
  assert.deepEqual(confirmsSlateSubmission(board([...picks].reverse()), picks), { kind: "confirmed" });
});

test("requires exact picks and rejects duplicate or malformed server selections", () => {
  assert.deepEqual(confirmsSlateSubmission(board([picks[0]]), picks), { kind: "different", savedPicks: [picks[0]] });
  assert.deepEqual(confirmsSlateSubmission(board([picks[0], picks[0]]), picks), { kind: "unavailable" });
  assert.deepEqual(confirmsSlateSubmission(board([picks[0], null]), picks), { kind: "unavailable" });
});

test("checks Survivor only when it was part of the submission", () => {
  const survivorPick = { game_id: "game-3", selected_team_id: "team-c" };
  assert.deepEqual(confirmsSlateSubmission(board(picks, survivorPick), picks), { kind: "confirmed" });
  assert.deepEqual(confirmsSlateSubmission(board(picks, survivorPick), picks, { gameId: "game-3", teamId: "team-c" }), { kind: "confirmed" });
  assert.deepEqual(confirmsSlateSubmission(board(picks, survivorPick), picks, { gameId: "game-3", teamId: "team-d" }), {
    kind: "different",
    savedPicks: picks,
    savedSurvivorPick: { gameId: "game-3", teamId: "team-c" },
  });
  assert.deepEqual(confirmsSlateSubmission(board(picks, null), picks, null), { kind: "confirmed" });
});

test("ambiguous save outcomes use a bounded board read and never replay the mutation", async () => {
  const source = await readFile(new URL("../src/app/board/page.tsx", import.meta.url), "utf8");
  const submit = source.slice(source.indexOf("async function submitPicks"), source.indexOf("// Stable handlers"));

  assert.match(source, /const SAVE_VERIFY_TIMEOUT_MS = 8_000/);
  assert.match(source, /\/api\/board\?scoringPeriodId=\$\{encodeURIComponent\(scoringPeriodId\)\}/);
  assert.match(submit, /if \(response\.status >= 500\)[\s\S]*?verifySubmittedPicks/);
  assert.match(submit, /catch \(error\)[\s\S]*?verifySubmittedPicks/);
  assert.match(submit, /saveVerificationRequiredForPeriod === week\.id[\s\S]*?return;/);
  assert.equal(submit.match(/fetchWithSession\("\/api\/picks"/g)?.length, 1);
  const receipt = await readFile(new URL("../src/components/slate-receipt.tsx", import.meta.url), "utf8");
  assert.match(receipt, /disabled=\{receiptIsLoading \|\| isSubmitting \|\| saveVerificationRequired\}/);
});
