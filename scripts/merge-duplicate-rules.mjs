// Merges rules that define the same selector more than once (same media context) into the
// later one, but only where doing so cannot change which declaration wins:
//   * a declaration the later rule already sets is simply dropped from the earlier rule
//     (the later one always won);
//   * any other declaration moves into the later rule, ahead of its own, only if no rule
//     in between (anywhere, any selector) touches the same property family.
// Everything else is left where it is. Run until it reports nothing to do, then check the
// screenshots: they must not change.
//
//   node scripts/merge-duplicate-rules.mjs [--dry]
import { readFileSync, writeFileSync } from "node:fs";
import postcss from "postcss";
import { stylesheetFiles } from "./css-report.mjs";

const dry = process.argv.includes("--dry");

function family(prop) {
  let name = prop.replace(/^-(webkit|moz|ms)-/, "");
  if (name.startsWith("--")) return name;
  if (/^(top|right|bottom|left|inset)(-|$)/.test(name)) return "inset";
  if (/^(gap|row-gap|column-gap|grid-gap)$/.test(name)) return "gap";
  return name.split("-")[0];
}

const files = stylesheetFiles().map((path) => ({ path, root: postcss.parse(readFileSync(path, "utf8"), { from: path }) }));
const rules = [];
for (const file of files) {
  file.root.walkRules((rule) => {
    for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) {
      if (parent.type === "atrule" && !/^(media|supports)$/i.test(parent.name)) return; // keyframes, font-face, property...
    }
    const context = [];
    for (let parent = rule.parent; parent && parent.type !== "root"; parent = parent.parent) context.unshift(`@${parent.name} ${parent.params}`);
    if (rule.selector.trim() === ":root") return; // design tokens stay in 00-tokens.css
    rules.push({ rule, context: context.join(" | "), selector: rule.selector.replace(/\s+/g, " ").trim(), file, index: rules.length });
  });
}

const declsOf = (rule) => rule.nodes.filter((node) => node.type === "decl");
let moved = 0;
let dropped = 0;

const groups = new Map();
for (const entry of rules) {
  const key = `${entry.context}::${entry.selector}`;
  groups.set(key, [...(groups.get(key) ?? []), entry]);
}

for (const members of groups.values()) {
  for (let i = 0; i + 1 < members.length; i += 1) {
    const earlier = members[i];
    const later = members[i + 1];
    const laterDecls = declsOf(later.rule);
    const between = rules.slice(earlier.index + 1, later.index);
    const touched = new Set();
    for (const other of between) for (const decl of declsOf(other.rule)) touched.add(family(decl.prop));
    const toMove = [];
    for (const decl of declsOf(earlier.rule)) {
      const overriding = laterDecls.find((candidate) => candidate.prop === decl.prop);
      if (overriding && (overriding.important || !decl.important)) { decl.remove(); dropped += 1; continue; }
      if (!touched.has(family(decl.prop))) toMove.push(decl);
    }
    for (const decl of toMove.reverse()) {
      // keep the earlier rule's declarations ahead of the later rule's own
      const clone = decl.clone();
      clone.raws.before = laterDecls[0]?.raws.before ?? "\n  ";
      later.rule.prepend(clone);
      decl.remove();
      moved += 1;
    }
  }
}

// Remove rules left with no declarations (and no nested content).
let emptied = 0;
for (const { rule } of rules) {
  if (rule.parent && rule.nodes.length === 0) { rule.remove(); emptied += 1; }
}
// Remove media blocks left empty.
for (const file of files) file.root.walkAtRules("media", (atrule) => { if (atrule.nodes && atrule.nodes.every((node) => node.type === "comment") ) { if (atrule.nodes.length === 0) atrule.remove(); } });

console.log(`${dry ? "[dry run] " : ""}moved ${moved} declarations, dropped ${dropped} overridden ones, removed ${emptied} empty rules`);
if (!dry) for (const file of files) writeFileSync(file.path, file.root.toString());
