import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

// The app's CSS is split into feature files under src/styles/, imported in order by
// src/app/globals.css. Tests that need the stylesheet's text read it through here, so a
// file move or split never breaks them. The pieces are joined in import order, which is
// also the cascade order.
const globals = new URL("../../src/app/globals.css", import.meta.url);

function importedFiles(globalsText) {
  return [...globalsText.matchAll(/@import "\.\.\/styles\/([^"]+)";/g)].map((match) => new URL(`../../src/styles/${match[1]}`, import.meta.url));
}

export async function readStylesheet() {
  const main = await readFile(globals, "utf8");
  const parts = await Promise.all(importedFiles(main).map((file) => readFile(file, "utf8")));
  return [main, ...parts].join("\n");
}

export function readStylesheetSync() {
  const main = readFileSync(globals, "utf8");
  return [main, ...importedFiles(main).map((file) => readFileSync(file, "utf8"))].join("\n");
}
