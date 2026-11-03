/* Vite plugin: files that live at the repo root and are served as they are.
   - The game content (crawl-*.json) and admin.json, which Admin saves commit to the repo root.
   - The tabletop (tabletop/), which is already native ES modules and needs no bundling. The old site serves the same files.
   In dev this serves them next to the pages; in a build it copies them into dist/. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import type { Plugin } from "vite";

const isContent = (name: string) => /^crawl-[a-z-]+\.json$/.test(name) || name === "admin.json";
const STATIC_DIRS = ["tabletop"];
const SKIP = new Set(["SETUP.md"]); // docs, not part of the site
const TYPES: Record<string, string> = {
  ".json": "application/json; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
};

/** Every file to serve, as published path -> file on disk. */
function listFiles(repoRoot: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const name of readdirSync(repoRoot)) if (isContent(name)) out.set(name, join(repoRoot, name));
  const walk = (dir: string, pub: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name), p = pub + "/" + name;
      if (statSync(path).isDirectory()) walk(path, p); else if (!SKIP.has(name)) out.set(p, path);
    }
  };
  for (const d of STATIC_DIRS) walk(join(repoRoot, d), d);
  return out;
}

export function contentFiles(repoRoot: string): Plugin {
  return {
    name: "crawl-content-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        let name = decodeURIComponent((req.url || "").split("?")[0].replace(/^\/+/, ""));
        if (STATIC_DIRS.includes(name.replace(/\/$/, ""))) name = name.replace(/\/?$/, "/index.html");
        const path = listFiles(repoRoot).get(name);
        if (!path) return next();
        res.setHeader("Content-Type", TYPES[extname(name)] || "application/octet-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(path));
      });
    },
    generateBundle() {
      for (const [fileName, path] of listFiles(repoRoot)) this.emitFile({ type: "asset", fileName, source: readFileSync(path) });
    },
  };
}
