// A tiny static server for the render harness: serves this folder (scene pages, modules, node_modules, output).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };

export function startServer(port = 5599) {
  const server = http.createServer(async (request, response) => {
    try {
      const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^([\\/])+/, "");
      const data = await readFile(join(root, path || "scene.html"));
      response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
      response.end(data);
    } catch {
      response.writeHead(404); response.end("not found");
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] && process.argv[1].endsWith("serve.mjs")) { await startServer(); console.log("serving on 5599"); }
