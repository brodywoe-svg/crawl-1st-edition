# TypeScript + Vite + React refactor
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** none yet. This is the groundwork for the backend rebuild, fully digital rules and Three.js.

## Goal
Move the website, the tabletop and the Windows app off `build.py` and onto one TypeScript + Vite + React project.
Players and Brody shouldn't notice any change:
- the same pages,
- the same URLs,
- the same Admin editing.

What changes is underneath. We get a module system, a typed component-based codebase that Three.js (through React Three Fiber),
Supabase and a shared rules engine can be built on, and one build that also feeds an auto-updating Windows app.
See the TypeScript + Vite and React entries in [DECISIONS.md](../DECISIONS.md).

## Scope
- **In:**
  - the Vite + React + TypeScript project setup,
  - porting every page and the tabletop to React components,
  - loading the JSON at run time instead of embedding it in each page,
  - a GitHub Actions deploy to Pages,
  - an auto-updating Electron app,
  - removing `build.py` and the generated files once we cut over.
- **Out:** each of these gets its own plan later.
  - the Supabase migration,
  - Capacitor/mobile,
  - Three.js,
  - automating the rules,
  - any change to the shape of `crawl-*.json`,
  - a visual redesign.

## How it works
**Same behavior, new structure.** Each page keeps its current behavior, look and CSS. Its UI is rewritten as React components.
- Today's code builds HTML strings and redraws by hand. In React that becomes components plus state.
- The logic inside the current files carries over mostly as is: filters, sorting, the creator's proficiency parsing, the spellcasting formulas.
- TypeScript starts lenient (`allowJs`, loose `strict`) so the port can move fast. We tighten it once everything is ported.

**Layout:** a single Vite project at the repo root:
- `web/`: one HTML entry per current page, so the URLs stay `spells.html`, `creator.html`, and so on,
- `web/src/lib/`: plain TypeScript with no React:
  - data loading and the content types,
  - the markup renderer,
  - Admin sign-in and `putFile`,
  - dice,
  - later, `rules/`.
- `web/src/components/`: shared React pieces:
  - the nav,
  - glossary tooltips,
  - the rich-text component,
  - the Admin modal,
  - the text-color sidebar from `editkit`.
- `web/src/pages/`: one folder per page,
- `web/src/tabletop/`: the tabletop.

Keeping `lib/` free of React means the same code can later run in a Supabase Edge Function or a game server.

**Shared code is pulled out first.** Several pieces are used by many pages:
- `GLCORE` (the markup renderer and glossary tooltips), which today is regex-cut from `page.html`. The tabletop also has its own copy of the renderer.
- `ADMIN` (sign-in and `putFile`).
- The helpers.
- The data loading.

Each becomes one module or component that every page imports. That also gets rid of the fragile regex scraping in `build.py`, and the duplicate renderer in the tabletop.

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

**Windows app: auto-updating Electron**
- Electron loads the Vite build (`base: './'`).
- `electron-builder` makes a normal Windows installer (NSIS). This replaces `installer/`, `install.ps1` and the bundled `rcedit`.
- `electron-updater` checks GitHub Releases when the app starts, downloads new versions in the background and installs them on the next restart.
- A GitHub Actions workflow builds the installer and publishes a Release whenever we tag a version, e.g. `v1.4.0`.
- It keeps the existing `%APPDATA%\Crawl Spell Compendium\` data folder, so saved spells carry over.
- The app isn't code-signed, so SmartScreen warns on the first install. Updates after that install quietly.
- Users on the old zip install the new app once by hand. From then on it updates itself.

**What it touches:** almost all of [ARCHITECTURE.md](../ARCHITECTURE.md) §2, §3, §7 and §8, and the Commands and Code style sections of `CLAUDE.md`.
All of these get rewritten at cutover. [DATA-MODEL.md](../DATA-MODEL.md) doesn't change.

## Steps
- [x] Agree TypeScript + Vite, and React (maddox). Brody confirms in the PR.
- [ ] Set up the scaffold:
  - Vite + React + TypeScript, ESLint,
  - an Actions workflow that publishes the current site plus `/next/`,
  - finish [SETUP.md](../SETUP.md) with the real commands.
- [ ] Pull out the shared code:
  - `lib/`: data loading, the content types, the markup renderer, Admin sign-in and saving,
  - `components/`: the nav, rich text and glossary tooltips, the Admin modal.
- [ ] Port the pages in rough order of size, simplest first, to shake out the shared pieces: glossary and conditions → races → items and crafting → classes, backgrounds and feats → spells → creator and the skill tree.
- [ ] Move the tabletop in:
  - port its UI to React,
  - keep `net.js` and `dice.js` as plain TypeScript in `lib/`,
  - use the shared renderer,
  - fix the admin sign-in that broke with `admin.json` v2.
- [ ] Windows app:
  - set up `electron-builder` and `electron-updater`,
  - add a release workflow on version tags,
  - check that saved spells carry over from the old app.
- [ ] Cut over:
  1. `/next/` becomes the site,
  2. delete `build.py`, `sitekit.py`, the root and `app/` HTML, `installer/` and the committed zip,
  3. update `ARCHITECTURE.md` and `CLAUDE.md`.

## Open questions
- **The claude.ai mode on the Spells page (question for Brody).** The Spells page started life as an artifact made in the claude.ai chat app.
  It still has code that, when the page is opened inside claude.ai, can save edited spells back to that artifact.
  On the website and in the Windows app this code does nothing. If Brody no longer edits spells through claude.ai, we drop it.
  That also drops the copy of itself that the page carries around for it (`/*@TPL@*/`).
- **The `/next/` URLs.** Are there links or bookmarks to specific pages we must keep working at cutover? The plan keeps every current filename.
- **Single-page app or not?** One HTML file per page keeps today's URLs simple. A single React app with a router would switch pages faster and share state.
  Suggestion: keep separate pages for the port, and revisit once the rules UI exists.
