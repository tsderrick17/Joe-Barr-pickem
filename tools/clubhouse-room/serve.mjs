// A tiny static server for the clubhouse room renderer. It serves this folder first, then the trophy renderer's folder, so the room
// can use the real trophy models (whose modules import "/lib.js" and friends) and that folder's three.js install.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const roots = [fileURLToPath(new URL(".", import.meta.url)), fileURLToPath(new URL("../trophy-render/", import.meta.url))];
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };

export function startServer(port = 5620) {
  const server = http.createServer(async (request, response) => {
    const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^([\\/])+/, "") || "scene.html";
    for (const root of roots) {
      try {
        const data = await readFile(join(root, path));
        response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
        response.end(data);
        return;
      } catch { /* try the next folder */ }
    }
    response.writeHead(404); response.end("not found");
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
