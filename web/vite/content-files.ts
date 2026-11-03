/* Vite plugin: the game content (crawl-*.json) and admin.json stay at the repo root, where Admin saves commit them.
   In dev this serves them next to the pages; in a build it copies them into dist/. */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

const isContent = (name: string) => /^crawl-[a-z-]+\.json$/.test(name) || name === "admin.json";

export function contentFiles(repoRoot: string): Plugin {
  const files = () => readdirSync(repoRoot).filter(isContent);
  return {
    name: "crawl-content-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = decodeURIComponent((req.url || "").split("?")[0].replace(/^\/+/, ""));
        if (!isContent(name) || !files().includes(name)) return next();
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.end(readFileSync(join(repoRoot, name)));
      });
    },
    generateBundle() {
      for (const name of files()) this.emitFile({ type: "asset", fileName: name, source: readFileSync(join(repoRoot, name)) });
    },
  };
}
