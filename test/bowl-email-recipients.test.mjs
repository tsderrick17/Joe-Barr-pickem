import test from "node:test";
import assert from "node:assert/strict";
import { bowlEmailRecipients } from "../src/lib/bowl-email-recipients.js";
test("recap requires active entry and email", () => assert.equal(bowlEmailRecipients([{ id: "p", entry_id: "e", notification_email: "p@example.com" }], [{ player_id: "p", status: "active" }], []).length, 1));
test("pick reminder excludes picked entry", () => assert.equal(bowlEmailRecipients([{ id: "p", entry_id: "e", notification_email: "p@example.com" }], [{ player_id: "p", status: "active" }], [{ entry_id: "e", game_id: "g" }], "g").length, 0));
