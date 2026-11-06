/* Vite config for the new site. The pages live in web/. index.html is the React app (web/src/app/, see
   dev/planning/react-migration.md); the other HTML files are pages not yet moved into it, at the same URLs as the old site.
   The build goes to dist/, which is what Vercel serves. See dev/planning/typescript-vite-refactor.md. */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { contentFiles } from "./web/vite/content-files.ts";
import { legacyPages } from "./web/vite/legacy-pages.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const web = fileURLToPath(new URL("./web/", import.meta.url));
const PAGES = ["index", "wiki", "spells", "glossary", "conditions", "items", "crafting", "races", "classes", "backgrounds", "feats", "creator", "account",
  "testing/dice"]; // prototypes (dev/testing/), linked from the admin-only Testing menu (TESTING in web/src/ui/nav.ts)

export default defineConfig({
  root: web,
  // Absolute URLs: the React app has nested routes (/characters/abc), where relative asset URLs would break.
  // The Windows app will serve the build over its own app:// protocol, so "/" works there too.
  base: "/",
  envDir: root, // .env.local sits at the repo root (see .env.example)
  plugins: [react(), contentFiles(root), legacyPages(root + "src")],
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      // one entry per page (and each is listed in PORTED in web/src/config.ts)
      input: Object.fromEntries(PAGES.map(p => [p, web + p + ".html"])),
    },
  },
});
