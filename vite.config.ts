/* Vite config for the new site. The pages live in web/ (one HTML file per page, so URLs stay the same),
   and the build goes to dist/, which is what Vercel serves. See dev/planning/typescript-vite-refactor.md. */
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { contentFiles } from "./web/vite/content-files.ts";
import { legacyPages } from "./web/vite/legacy-pages.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const web = fileURLToPath(new URL("./web/", import.meta.url));
const PAGES = ["index", "wiki", "spells", "glossary", "conditions", "items", "crafting", "races", "classes", "backgrounds", "feats", "creator",
  "testing/dice"]; // prototypes (dev/testing/), linked from the admin-only Testing menu (TESTING in web/src/ui/nav.ts)

export default defineConfig({
  root: web,
  base: "./", // relative URLs, so the same build works on Vercel and inside the Electron app
  envDir: root, // .env.local sits at the repo root (see .env.example)
  plugins: [contentFiles(root), legacyPages(root + "src")],
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      // one entry per page (and each is listed in PORTED in web/src/config.ts)
      input: Object.fromEntries(PAGES.map(p => [p, web + p + ".html"])),
    },
  },
});
