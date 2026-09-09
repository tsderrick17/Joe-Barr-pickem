import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");

test("Bowl standings game columns share fixed row tracks and centered baselines", () => {
  assert.match(
    css,
    /\.bowl-standings-game-cell\s*\{[^}]*display:\s*grid !important;[^}]*grid-template-rows:\s*3rem 1\.6rem 1\.6rem 1\.6rem;/s,
  );
  assert.match(
    css,
    /\.bowl-standings-game-cell > \.bowl-standings-bowl-name,[\s\S]*?\.bowl-standings-game-cell > \.bowl-standings-line\s*\{[^}]*align-items:\s*center;[^}]*height:\s*100%;[^}]*justify-content:\s*center;/s,
  );
});
