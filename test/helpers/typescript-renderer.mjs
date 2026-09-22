import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Run the production TSX renderer directly: these tests inspect actual PNGs,
// not a second implementation of the layout or source-code expressions.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes("/node_modules/")) return nextResolve(specifier, context);
    if (specifier === "next/og") return nextResolve("next/og.js", context);
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier.startsWith(".") || specifier.startsWith("@/")) {
      const base = specifier.startsWith("@/") ? new URL("../../src/" + specifier.slice(2), import.meta.url) : new URL(specifier, context.parentURL);
      if (existsSync(fileURLToPath(base)) && /\.(ts|tsx|js)$/.test(base.pathname)) return nextResolve(base.href, context);
      for (const extension of [".ts", ".tsx", ".js"]) {
        if (existsSync(fileURLToPath(base) + extension)) return nextResolve(base.href + extension, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url) && !url.includes("/node_modules/")) {
      return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText };
    }
    return nextLoad(url, context);
  },
});
