# TypeScript + Vite refactor
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** none yet. This is the groundwork for the backend rebuild, fully digital rules and Three.js.

## Goal
Move the website, the tabletop and the Windows app off `build.py` and onto one TypeScript + Vite project.
Players and Brody shouldn't notice any change:
- the same pages,
- the same URLs,
- the same Admin editing.

What changes is underneath. We get a module system, and a typed codebase that Three.js, Supabase and a shared rules engine can be built on.
One build also feeds an auto-updating Windows app.
See the TypeScript + Vite and "plain TypeScript now, React later" entries in [DECISIONS.md](../DECISIONS.md).

## Scope
- **In:**
  - the Vite + TypeScript project setup,
  - porting `src/*.js` and `tabletop/` to TypeScript modules,
  - loading the JSON at run time instead of embedding it in each page,
  - deploying to Vercel,
  - an auto-updating Electron app,
  - removing `build.py` and the generated files once we cut over.
- **Out:** each of these gets its own plan later.
  - React. See [react-migration.md](react-migration.md).
  - the Supabase migration,
  - Capacitor/mobile,
  - Three.js,
  - automating the rules,
  - any change to the shape of `crawl-*.json`,
  - a visual redesign.

## How it works
**Port, don't rewrite.** Each page keeps its current behavior, markup and CSS. Files are converted to TypeScript modules one at a time.
TypeScript starts in a lenient mode (`allowJs`, loose `strict`) so half-converted code still builds. We tighten it once everything is ported.

**Layout:** a single Vite project at the repo root:
- `web/`: one HTML entry per current page, so the URLs stay `spells.html`, `creator.html`, and so on.
- `web/src/lib/`: game logic with **no UI code**:
  - data loading and the content types,
  - the markup renderer,
  - Admin sign-in and `putFile`,
  - dice,
  - later, `rules/`.
- `web/src/ui/`: shared UI:
  - the nav,
  - glossary tooltips,
  - the Admin modal,
  - the text-color sidebar from `editkit`.
- `web/src/pages/`: per-page code.
- `web/src/tabletop/`: the tabletop.

Keeping `lib/` free of UI code is what makes the later move to React cheap, and lets the rules engine run on a server too.
When we port a page, its logic (filters, sorting, the creator's proficiency parsing, the spellcasting formulas) goes in `lib/` wherever it untangles easily.

**Shared code is pulled out first.** Several pieces are used by many pages:
- `GLCORE` (the markup renderer and glossary tooltips), which today is regex-cut from `page.html`. The tabletop also has its own copy of the renderer.
- `ADMIN` (sign-in and `putFile`).
- The `$` / `esc` / `arr` / `str` helpers.
- The data loading.

Each becomes one module that every page imports. That also gets rid of the fragile regex scraping in `build.py`, and the duplicate renderer in the tabletop.

**Data is loaded at run time, with nothing embedded.** Pages `fetch` `crawl-*.json`, as they already do in `STATIC` mode.
- The deploy copies the JSON files from the repo root into the build output.
- The JSON stays at the repo root, so the Admin UI keeps committing to the same paths.
- The nav dropdowns get built at run time too, so they can't go stale anymore.

**Deploy (Vercel):**
- Vercel runs `npm run build` and hosts `dist/`.
- **Production:** `main` deploys to the project's production URL.
- **Previews:** every PR gets its own preview link, posted as a PR comment.
- **Paths:** `base: './'` keeps every URL relative, so the same build works at Vercel's root and inside Electron.
- **Admin saves:** every save to `main` triggers a rebuild, which takes about 1 minute.
  - `vercel.json` has an `ignoreCommand` that skips commits touching only `crawl-edits.json`, `dev/` or `*.md`.
    The edit-log commit that follows each save therefore doesn't cost a second deploy.
  - If we start hitting the daily deploy limit, the fallback is to proxy `crawl-*.json` live from GitHub and skip content-only builds entirely.

**The changeover is opt-in until it's done.**
- While we port, the old site stays live on GitHub Pages, untouched.
- The Vercel production URL is the in-progress new site. Brody can try it at any time, and try each PR's preview before it merges.
- The nav links pages that aren't ported yet to the old github.io site, so the new site is always usable.
- **We cut over only once every page matches the current site.** At that point we:
  - (optionally) point a custom domain at Vercel,
  - replace the GitHub Pages files with small redirect pages that keep the `?query` and `#hash`,
  - add the Vercel domain to Firebase's authorized domains, until the tabletop moves to Supabase,
  - update the hard-coded github.io URLs in `tools/sitekit.py` (the nav's Tabletop link), `tabletop/content.js` (`SITE`) and `tabletop/SETUP.md`.

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
- [x] Agree TypeScript + Vite, "plain TypeScript now, React later", and Vercel (maddox). Brody confirms in the PR.
- [ ] Set up the scaffold:
  - Vite + TypeScript, with `npm run typecheck` (no linter yet, to keep it minimal),
  - `vercel.json`,
  - the home page ported, along with the shared nav, theme, data loading and Admin sign-in,
  - finish [SETUP.md](../SETUP.md) with the real commands.
- [ ] Brody connects the repo to Vercel ([QUICKSTART.md](../QUICKSTART.md), step 3).
- [ ] Pull out the rest of the shared code: helpers, the markup renderer and glossary tooltips, Admin saving (`putFile`, `recordEdits`).
- [ ] Port the pages in rough order of size, simplest first, to shake out the shared modules: glossary and conditions → races → items and crafting → classes, backgrounds and feats → spells → creator and the skill tree.
- [ ] Move the tabletop in:
  - it's already ES modules, so this is mostly renaming files and adding types,
  - `net.js` and `dice.js` go in `lib/`,
  - use the shared renderer,
  - fix the admin sign-in that broke with `admin.json` v2.
- [ ] Windows app:
  - set up `electron-builder` and `electron-updater`,
  - add a release workflow on version tags,
  - check that saved spells carry over from the old app.
- [ ] Cut over:
  1. Vercel becomes the main site, and the GitHub Pages files become redirects (see Deploy above),
  2. delete `build.py`, `sitekit.py`, the root and `app/` HTML, `installer/` and the committed zip,
  3. update `ARCHITECTURE.md` and `CLAUDE.md`.

## Open questions
- **The claude.ai mode on the Spells page (question for Brody).** The Spells page started life as an artifact made in the claude.ai chat app.
  It still has code that, when the page is opened inside claude.ai, can save edited spells back to that artifact.
  On the website and in the Windows app this code does nothing. If Brody no longer edits spells through claude.ai, we drop it.
  That also drops the copy of itself that the page carries around for it (`/*@TPL@*/`).
- **Links and bookmarks.** Are there links or bookmarks to specific pages we must keep working at cutover?
  The plan keeps every current filename, and the old site redirects to the new one.
- **A custom domain?** For example `crawlrpg.com` (about $10–15 a year). Without one, the site lives at a `*.vercel.app` address.
