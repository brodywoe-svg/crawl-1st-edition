# TypeScript + Vite refactor
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** none yet. This is the groundwork for the backend rebuild, fully digital rules and Three.js.

## Goal
Move the website and the tabletop off `build.py` and onto one TypeScript + Vite project. Players and Brody shouldn't notice any change:
- the same pages,
- the same URLs,
- the same Admin editing.

What changes is underneath. We get a module system, a typed codebase that Three.js, Supabase and a shared rules engine can be built on,
and one build that also feeds the Windows app.
See the [decision in DECISIONS.md](../DECISIONS.md).

## Scope
- **In:**
  - the Vite + TypeScript project setup,
  - porting `src/*.js` and `tabletop/` to TypeScript modules,
  - loading the JSON at run time instead of embedding it in each page,
  - a GitHub Actions deploy to Pages,
  - pointing the Electron app at the Vite build,
  - removing `build.py` and the generated files once we cut over.
- **Out:** each of these gets its own plan later.
  - the Supabase migration,
  - Capacitor/mobile,
  - Three.js,
  - automating the rules,
  - any change to the shape of `crawl-*.json`,
  - a visual redesign,
  - choosing a UI framework.

## How it works
**Port, don't rewrite.** Each page keeps its current behavior and markup. Files are converted to TypeScript modules one at a time.
TypeScript starts in a lenient mode (`allowJs`, loose `strict`), so half-converted code still builds. We tighten it once everything is ported.

**Layout:** a single Vite project at the repo root:
- `web/`: the pages, one HTML entry per current page, so the URLs stay `spells.html`, `creator.html`, and so on,
- `web/src/shared/`: the code every page uses,
- `web/src/pages/`: per-page code,
- `web/src/tabletop/`: the tabletop,
- later, `web/src/rules/`: the rules engine.

**Shared code is pulled out first.** Several pieces are used by many pages:
- `GLCORE` (the markup renderer and glossary tooltips), which today is regex-cut from `page.html`. The tabletop also has its own copy of the renderer.
- `ADMIN` (sign-in and `putFile`).
- The `$` / `esc` / `arr` / `str` helpers.
- The data loading.

Each of these becomes one module that every page imports. That also gets rid of the fragile regex scraping in `build.py`, and the duplicate renderer in the tabletop.

**Data is loaded at run time, with nothing embedded.** Pages `fetch` `crawl-*.json`, as they already do in `STATIC` mode.
- The deploy copies the JSON files from the repo root into the build output.
- The JSON stays at the repo root, so the Admin UI keeps committing to the same paths.
- The nav dropdowns get built at run time too, so they can't go stale anymore.

**Deploy:**
- GitHub Pages switches from serving `main` as is to a GitHub Actions workflow: `npm ci && npm run build`, then publish `dist/`.
- Every Admin save to `main` triggers a rebuild, which takes about 1–2 minutes. Today a save shows up after about 1 minute.

**The changeover is opt-in until it's done.**
- While we port, the workflow publishes the new build under `/next/` next to the current site.
- Brody can try `/next/creator.html` while the real site stays untouched.
- We cut over only once every page matches the current site.

**Windows app:**
- Electron loads the Vite build (`base: './'`).
- The app's spell editing keeps using the `crawlApp` preload API.

**What it touches:** almost all of [ARCHITECTURE.md](../ARCHITECTURE.md) §2, §3 and §8, and the Commands and Code style sections of `CLAUDE.md`.
All of these get rewritten at cutover. [DATA-MODEL.md](../DATA-MODEL.md) doesn't change.

## Steps
- [ ] Brody agrees the two decisions in DECISIONS.md: TypeScript + Vite, and Supabase.
- [ ] Set up the scaffold:
  - Vite + TypeScript, `package.json`, `tsconfig`,
  - an Actions workflow that publishes the current site plus `/next/`,
  - a README on how to run it.
- [ ] Pull out the shared modules: helpers, data loading, the markup renderer and glossary tooltips, Admin sign-in and saving, the nav.
- [ ] Port the pages in rough order of size, simplest first, to shake out the shared modules: glossary and conditions → races → items and crafting → classes, backgrounds and feats → spells → creator and the skill tree.
- [ ] Move the tabletop in. It's already ES modules, so this is mostly renaming files and adding types. Use the shared renderer, and fix the admin sign-in that broke with `admin.json` v2.
- [ ] Point the Electron app and installer at the Vite build.
- [ ] Cut over:
  1. `/next/` becomes the site,
  2. delete `build.py`, `sitekit.py`, the root and `app/` HTML, and the committed zip,
  3. update `ARCHITECTURE.md` and `CLAUDE.md`.

## Open questions
- **A UI framework or not?** Porting in plain TypeScript keeps the risk low. The creator, and anything with 3D later, might benefit from React or Svelte.
  Suggestion: port in plain TypeScript first, and decide on a framework as its own entry before building new UI.
- **The claude.ai artifact mode.** This is the Spells page republishing itself through `window.claude`. Do we still need it?
  If not, we drop it and the `/*@TPL@*/` self-copy that exists only for it.
- **Releasing the Windows app.** Keep the installer zip (built by CI and attached to a GitHub Release instead of committed),
  or move to an auto-updating Electron app, or switch to Tauri?
- **Node for Brody.** Brody's Admin edits don't need Node. But will Brody also want to run the site locally? If so, setup docs need to cover installing Node.
- **The `/next/` URLs.** Are there links or bookmarks to specific pages we must keep working at cutover? The plan keeps every current filename.
