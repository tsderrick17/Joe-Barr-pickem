import assert from "node:assert/strict";
import test from "node:test";
import { notificationsBannerVisible, NOTIFICATIONS_BANNER_QUIET_DAYS } from "../src/lib/phone-push.js";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 30);
const facts = (overrides = {}) => ({ status: "off", standalone: true, signedIn: true, path: "/", dismissedAt: null, now, ...overrides });

test("the in-app banner offers notifications to a signed-in player in the Home Screen app who has not turned them on", () => {
  assert.equal(notificationsBannerVisible(facts()), true);
  assert.equal(notificationsBannerVisible(facts({ path: "/board" })), true);
});

test("never in a browser tab, before sign-in, or once notifications are on, blocked or impossible", () => {
  assert.equal(notificationsBannerVisible(facts({ standalone: false })), false);
  assert.equal(notificationsBannerVisible(facts({ signedIn: false })), false);
  for (const status of ["on", "blocked", "unsupported", "not-installed", "checking"]) assert.equal(notificationsBannerVisible(facts({ status })), false, status);
});

test("not on the sign-in page or the Notifications page", () => {
  assert.equal(notificationsBannerVisible(facts({ path: "/login" })), false);
  assert.equal(notificationsBannerVisible(facts({ path: "/profile" })), false);
});

test("Not now keeps it away for 14 days, and a clock moved far ahead does not hide it for good", () => {
  assert.equal(NOTIFICATIONS_BANNER_QUIET_DAYS, 14);
  assert.equal(notificationsBannerVisible(facts({ dismissedAt: now - 13 * DAY })), false);
  assert.equal(notificationsBannerVisible(facts({ dismissedAt: now - 14 * DAY })), true);
  assert.equal(notificationsBannerVisible(facts({ dismissedAt: now + 1000 })), false, "tapped a moment after the page loaded");
  assert.equal(notificationsBannerVisible(facts({ dismissedAt: now + 3 * DAY })), true);
});

test("the one-tap Install goes straight on to ask for notifications only when it went through and the phone has not been asked", async () => {
  const { askForNotificationsAfterInstall } = await import("../src/lib/phone-push.js");
  const after = (overrides = {}) => askForNotificationsAfterInstall({ outcome: "accepted", hasPush: true, permission: "default", signedIn: true, ...overrides });
  assert.equal(after(), true);
  assert.equal(after({ outcome: "dismissed" }), false, "the player said no to installing");
  assert.equal(after({ hasPush: false }), false);
  assert.equal(after({ permission: "granted" }), false, "already allowed: nothing to ask");
  assert.equal(after({ permission: "denied" }), false, "the phone said no before: never ask again");
  assert.equal(after({ signedIn: false }), false, "the phone could not be saved for anyone");
});
