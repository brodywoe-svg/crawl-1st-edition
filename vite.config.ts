/* Vite config for the new site. The pages live in web/ (one HTML file per page, so URLs stay the same),
   and the build goes to dist/, which is what Vercel serves. See dev/planning/typescript-vite-refactor.md. */
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { contentFiles } from "./web/vite/content-files.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const web = fileURLToPath(new URL("./web/", import.meta.url));

export default defineConfig({
  root: web,
  base: "./", // relative URLs, so the same build works on Vercel and inside the Electron app
  plugins: [contentFiles(root)],
  build: {
    outDir: fileURLToPath(new URL("./dist", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      // one entry per page; add each page here as it's ported (and to PORTED in web/src/config.ts)
      input: { index: web + "index.html" },
    },
  },
});
