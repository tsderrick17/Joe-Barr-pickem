import assert from "node:assert/strict";
import test from "node:test";
import { dateFormat } from "../src/lib/date-format.js";

// Date formatters are built once per format and reused; what they print must be exactly what a freshly built one prints.
test("one formatter per distinct format, reused on later calls", () => {
  const options = { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" };
  assert.equal(dateFormat("en-US", options), dateFormat("en-US", { ...options }));
  assert.notEqual(dateFormat("en-US", options), dateFormat("en-CA", options));
  assert.notEqual(dateFormat("en-US", options), dateFormat("en-US", { ...options, timeZone: "UTC" }));
});

test("a reused formatter prints the same as a new one, across midnight and the daylight-saving changes", () => {
  const options = { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" };
  for (const at of ["2026-03-08T06:59:00Z", "2026-03-08T07:01:00Z", "2026-11-01T05:59:00Z", "2026-11-01T06:01:00Z", "2027-01-01T04:59:59Z"]) {
    assert.equal(dateFormat("en-US", options).format(new Date(at)), new Intl.DateTimeFormat("en-US", options).format(new Date(at)), at);
  }
});
