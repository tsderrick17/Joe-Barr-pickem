import "./helpers/typescript-renderer.mjs";
import assert from "node:assert/strict";
import test from "node:test";

const { readAllPages } = await import("../src/lib/read-all-pages.ts");

// PostgREST answers at most 1,000 rows a request, so a long list has to be read in pages or it is silently cut short.
const table = (count) => Array.from({ length: count }, (_, id) => ({ id }));
const pagedSource = (rows) => { const reads = []; return { reads, read: async (from, to) => { reads.push([from, to]); return { data: rows.slice(from, to + 1), error: null }; } }; };

test("a list longer than one page is read in full, page by page", async () => {
  const source = pagedSource(table(2_350));
  const { data, error } = await readAllPages(source.read);
  assert.equal(error, null);
  assert.equal(data.length, 2_350);
  assert.deepEqual(source.reads, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("a list that ends exactly on a page boundary asks for the page after it and stops on the empty one", async () => {
  const source = pagedSource(table(1_000));
  const { data } = await readAllPages(source.read);
  assert.equal(data.length, 1_000);
  assert.deepEqual(source.reads, [[0, 999], [1000, 1999]]);
});

test("an error on any page is reported and no partial list is returned", async () => {
  let calls = 0;
  const result = await readAllPages(async () => (++calls === 2 ? { data: null, error: { code: "57014" } } : { data: table(1_000), error: null }));
  assert.equal(result.data, null);
  assert.deepEqual(result.error, { code: "57014" });
});
