// Measures the stylesheet: how many rules, how many selectors are defined more than once,
// how many `!important`, how many hard-coded hex colors outside the token file, and which
// media widths are in use. Reads src/app/globals.css plus every file under src/styles/.
//
//   node scripts/css-report.mjs            print a report
//   node scripts/css-report.mjs --json     print the numbers as JSON (used by the budget test)
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Every stylesheet in cascade order: globals.css first, then src/styles/ sorted by name. */
export function stylesheetFiles() {
  const files = [join(root, "src/app/globals.css")];
  const dir = join(root, "src/styles");
  if (existsSync(dir)) for (const name of readdirSync(dir).filter((file) => file.endsWith(".css")).sort()) files.push(join(dir, name));
  return files;
}

function mediaContext(node) {
  const parts = [];
  for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) if (parent.type === "atrule") parts.unshift(`@${parent.name} ${parent.params}`);
  return parts.join(" | ");
}

export function measure() {
  const perFile = {};
  const definitions = new Map();
  const widths = new Map();
  const totals = { rules: 0, duplicateSelectors: 0, important: 0, hexColors: 0, nightRules: 0 };

  for (const file of stylesheetFiles()) {
    const css = readFileSync(file, "utf8");
    const tokenFile = /00-tokens\.css$/.test(file);
    const entry = { rules: 0, important: 0, hexColors: 0, nightRules: 0 };
    postcss.parse(css, { from: file }).walk((node) => {
      if (node.type === "rule") {
        if (node.parent?.type === "atrule" && /keyframes$/i.test(node.parent.name)) return;
        entry.rules += 1;
        const context = mediaContext(node);
        for (const selector of node.selectors) {
          const normalized = selector.replace(/\s+/g, " ").trim();
          if (normalized.startsWith('html[data-theme="night"]')) entry.nightRules += 1;
          const key = `${context}::${normalized}`;
          definitions.set(key, (definitions.get(key) ?? 0) + 1);
        }
      } else if (node.type === "decl") {
        if (node.important) entry.important += 1;
        if (!tokenFile) entry.hexColors += (node.value.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
      } else if (node.type === "atrule" && node.name === "media") {
        for (const match of node.params.matchAll(/(min|max)-width:\s*([\d.]+)px/g)) widths.set(`${match[1]}-${match[2]}`, (widths.get(`${match[1]}-${match[2]}`) ?? 0) + 1);
      }
    });
    perFile[file.slice(root.length).replaceAll("\\", "/")] = entry;
    for (const key of ["rules", "important", "hexColors", "nightRules"]) totals[key] += entry[key];
  }
  totals.duplicateSelectors = [...definitions.values()].filter((count) => count > 1).length;
  return { totals, perFile, widths: Object.fromEntries([...widths].sort()), duplicates: [...definitions].filter(([, count]) => count > 1).map(([key, count]) => ({ key, count })) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const report = measure();
  if (process.argv.includes("--json")) console.log(JSON.stringify(report.totals));
  else {
    console.log("Totals:", report.totals);
    for (const [file, entry] of Object.entries(report.perFile)) console.log(`  ${file}: ${JSON.stringify(entry)}`);
    console.log("Media widths in use:", report.widths);
    console.log(`Selectors defined more than once (${report.duplicates.length}); first 25:`);
    for (const { key, count } of report.duplicates.slice(0, 25)) console.log(`  x${count} ${key.slice(0, 150)}`);
  }
}
