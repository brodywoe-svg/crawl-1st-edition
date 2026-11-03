# Architecture: how Crawl's software works today

_Written 2026-11-02 from a full read of the code. Update this file whenever you change how something here works._

## 1. What runs where

There is **no server we own**. Everything runs in the user's browser or on their PC, and three free
services stand in for a backend:

| Piece | Runs on | Hosted by | Notes |
| --- | --- | --- | --- |
| Website (compendium, creator, admin) | Browser | **GitHub Pages**: "legacy" mode serving the `main` branch root as is (`.nojekyll`, no workflow) | `https://brodywoe-svg.github.io/crawl-1st-edition/` |
| Content "database" | n/a | **The git repo itself**: `crawl-*.json` at the root | Read over HTTP from Pages; written through the GitHub REST API |
| Admin auth | Browser (Web Crypto) | `admin.json` in the repo | Encrypted GitHub tokens; see §4 |
| Tabletop | Browser | GitHub Pages (`/tabletop/`) + **Firebase Realtime Database** (Google) | Firebase is optional; falls back to single-browser mode |
| Windows app | Windows PC | Electron 33.2.1, downloaded from GitHub by the installer | Offline snapshot of the site |

External code loaded at runtime:
- Google Fonts (Montserrat), on the site only.
- Firebase JS SDK 10.12.2 from `gstatic.com`, in the tabletop only.
- `html2canvas`, vendored in `app/` and used for card image export.

## 2. The big picture

```
 authoring                          build (manual: python tools/build.py)           serving
 ─────────                          ─────────────────────────────────────           ───────
 src/page.html  ─┐                                                                  
 src/*.js       ─┼──► build.py + sitekit.py ──► root *.html ──(git push)──► GitHub Pages ──► browser
 crawl-*.json   ─┘     (JSON embedded as a     app/*.html ──► downloads/…zip ──► Windows app
                        snapshot in each page)

 run time, website:   page boots from its embedded snapshot, then fetch("crawl-*.json", no-cache) for fresh data
 run time, admin:     browser ──PUT /repos/brodywoe-svg/crawl-1st-edition/contents/<file>──► commit on main
                      ──► Pages redeploys (~1 min) ──► everyone's next fetch sees it
 run time, tabletop:  fetch crawl-*.json from the site ──► IndexedDB cache;  game state ──► Firebase or local
```

Key consequences:
- **Content edits don't need a rebuild for the website** (pages fetch fresh JSON). Several things *are*
  frozen at build time and go stale until someone runs `build.py`:
  - the nav dropdowns (race/class/background/feat/glossary-section lists),
  - the embedded snapshots,
  - the Windows app and installer.

  Example: on 2026-11-02 `creator.html`'s embedded skill tree was behind `crawl-tree.json`.
- **Admin edits are commits to `main`.** Of the last 200 commits, 164 are Brody's (most of them Admin saves)
  and 36 were authored by Claude.

## 3. The website

### Pages and their code
Each page is one self-contained HTML file (400–900 KB, mostly embedded JSON).

| Page | Script(s) from `src/` | Edits (as admin) |
| --- | --- | --- |
| `index.html` (home) | `home.js` | none |
| `spells.html` | inline in `page.html` | `crawl-spells.json` |
| `glossary.html`, `conditions.html` | `glossary.js` | `crawl-glossary.json` |
| `items.html`, `crafting.html` | `catalog.js` | `crawl-items.json` |
| `races.html` | `races.js` | `crawl-races.json` |
| `classes.html`, `backgrounds.html`, `feats.html` | `crawldata.js` + `classes.js` | `crawl-classes.json` / `-backgrounds` / `-feats` |
| `creator.html` | `crawldata.js` + `creator.js` + `treeicons.js` + `skilltree.js` | `crawl-creator.json`, `crawl-tree.json` |

All pages except home also get `editkit.js` (the text-color sidebar), plus two blocks cut out of `page.html`:
- **`GLCORE`**: glossary tooltips and rich-text rendering.
- **`ADMIN`**: sign-in and saving to GitHub.

Code size (lines):
- `creator.js` 1,282
- `page.html` 1,191
- `catalog.js` 668
- `classes.js` 399
- `skilltree.js` 347
- `glossary.js` 330
- `races.js` 191
- `crawldata.js` 152
- `tools/sitekit.py` 1,579, most of it CSS and HTML shells in Python strings
- `tools/build.py` 294

### Three runtime modes
The same page code checks where it's running:
- **`STATIC`** (`window.CRAWL_STATIC`, set by `build.py`): GitHub Pages. Fetches fresh JSON and offers Admin.
- **`APP`** (`window.crawlApp`, from `app/preload.js`): Electron. Uses the embedded data. Only spells can be
  edited, and they're saved to disk.
- **Neither**: a leftover claude.ai-artifact mode. The Spells page began as a claude.ai artifact and can
  still republish itself through `window.claude.use("artifact")`. That's why `page.html` embeds a copy of itself (`/*@TPL@*/`).

### Text markup
Content text uses a small custom markup, rendered by `GLCORE` (and copied in `tabletop/app.js`):
- blank line = new paragraph
- `[color=#hex]…[/color]` for colored text
- `[link=page.html#id]…[/link]` for links
- `[table]` rows `|` cells `[/table]` for charts

Glossary entry names, and their "tooltip words", are found automatically in all text and turned into hover tooltips.

### What lives in the browser
- **`localStorage`:**
  - `crawl-mode` (dark mode), `crawl-tree-mode`, view/filter prefs
  - `crawl-characters`: **every character the creator makes**, in this browser only
- **`sessionStorage`:** `crawl-admin-key` and `crawl-admin-name`, the unlocked GitHub token for this tab.

## 4. Admin editing (the write path)
Code: the `/*@ADMIN@*/` block in `src/page.html`.
1. **`admin.json`** (public) is `{v:2, users:[{name, box}]}`. Each `box` is a fine-grained GitHub token, encrypted with
   AES-256-GCM. The key is derived from that admin's password with PBKDF2-SHA256 at 600,000 iterations. Brody and Maddox each have one.
2. **Signing in** tries the password against the boxes. A match puts the token in memory and `sessionStorage`.
3. **Saving** (`putFile()`):
   1. GETs the file's `sha`.
   2. PUTs the new JSON (one-space indent) with the message `… (by <name>)`.
   3. Handles errors: HTTP 409 means someone saved first, and the user is told to reload.
4. **Edit log.** `recordEdits()` diffs old against new per record and appends `{n, f, c, how, by, at}` to `crawl-edits.json`
   (newest 3000), as a second commit, "Record who edited what".

The security rests entirely on password strength, because the encrypted tokens are public.
There's no locking: two admins editing the same file at once get a conflict on the second save.

## 5. Character Creator (`src/creator.js`)
- **Ten steps:** Race, Class, Background, Abilities, Skills, Proficiencies, Spells, Equipment, Appearance, Name.
  It reads every content file.
- **It interprets free-text proficiency strings.** For example, "Either X or Y" becomes a choice. The wording in the data therefore matters.
- **Rules that can be configured:**
  - class spellcasting formulas: they can use ability modifiers, `level`, `floor`/`ceil`/`max`/`min`,
  - creator rules from `crawl-creator.json`.
- **Output** is a three-page printable sheet (`window.print`). Characters save to `localStorage crawl-characters`,
  and to and from `.crawl.json` files (`{crawlCharacter: …}`).
- **Tree mode** (`skilltree.js`, an experiment) redraws the Class step as a skill tree in the style of Path of Exile:
  - it's drawn with HTML and SVG, with pan, zoom and rotate,
  - it's built from the data every time,
  - `crawl-tree.json` stores only the admin's overrides (positions, icons, links).

## 6. Tabletop (`tabletop/`)
A virtual tabletop in the style of Roll20. Native ES modules, **not** processed by `build.py`.

**Modules**
- `app.js` (1,011 lines) is the whole UI:
  - lobby, map pages, tokens, drawing, fog of war,
  - measuring, turn order, chat with dice,
  - journal and handouts, compendium,
  - character sheets.
- `net.js` is the sync layer.
- `content.js` handles Crawl data download and caching.
- `dice.js` parses dice expressions: `4d6kh3`, `d%`, exploding dice, arithmetic.

**Sync** (`net.js`): one small API (`on`/`get`/`set`/`update`/`push`/`remove`/`presence`) over a tree at `games/<id>/`.
- `FirebaseNet`:
  - Firebase RTDB with anonymous auth,
  - config comes from `tabletop/config.json` (not present), settings pasted into the game, or the invite link.
- `LocalNet`:
  - IndexedDB, plus `BroadcastChannel` between tabs,
  - this browser only.

**Game data:**
- `meta`, `players`, `pages`
- `maps/<pid>`: the image as a data URL
- `tokens`, `draw`, `fog`, `chars`, `handouts`, `turn`, `chat`

The full shape is in the header comment of `app.js`.

**Characters** come from the creator: same-origin `localStorage crawl-characters` or a `.crawl.json` file.
They're stored as a frozen `snap` plus `live` state.

**How much of the Crawl rules it knows:**
- The sheet shows ability, skill and save roll buttons, weapon attack and damage rolls, and Weapon Actions with their AP cost.
- It has an Action Die roll button and one "Action pool" number.
- **None of the Crawl rules are automated.** AP/MP/EP accounting, overflow, exhaustion and combat phases are all left to the players.

**Access:** "private testing". Only an admin can create games, and players join through invite links.

**Security:** the Firebase rules let any signed-in (anonymous) user read and write any game. GM-only actions are enforced only in the client.

## 7. Windows app (`app/`, `installer/`)
- **`main.js`** opens one sandboxed window on `app/index.html`. External links open in the browser.
- **`preload.js`** exposes `crawlApp.{load, save, saveFile, openJson}`.
- **Data:** only spells are editable. They're saved to `%APPDATA%\Crawl Spell Compendium\spells.json`. That's the app's old name, kept so saved data carries over.
- **`install.ps1`:**
  1. downloads Electron 33.2.1 and checks its SHA-256,
  2. installs to `%LOCALAPPDATA%\Programs\Crawl 1st Edition`,
  3. brands the exe with the bundled `rcedit-x64.exe`,
  4. makes the shortcuts.
- **No auto-update.** Users re-download the zip.

## 8. Build pipeline (`tools/build.py`)
Run it from the repo root. It writes 11 root pages, the same 11 under `app/`, and the installer zip.

**Placeholders in `src/page.html`:**
- `/*@DATA@*/`: spells
- `/*@GLOSSARY@*/null`: the glossary
- `/*@TPL@*/`: the template itself
- `<!--@NAV@-->` and `/*@NAVCSS@*/`: the nav bar
- `/*@GLCORE@*/…/*@GLCORE-END@*/` and `/*@ADMIN@*/…/*@ADMIN-END@*/`: shared code, cut out for the other pages

**For every page except Spells**, `glossary_page()`:
1. scrapes the `<style>`, logo, buttons and admin modal out of `page.html` with **regexes**,
2. adds a page "shell" from `sitekit.py`,
3. adds a prelude of embedded JSON constants (`GLOSSARY`, `CATALOG`, `CLASSES`…),
4. concatenates the page's scripts.

Renaming those elements in `page.html` can break the build without any error.

**For the app**, fonts are swapped to the bundled `app/fonts/`.

**On Windows**, Python writes CRLF line endings. With `core.autocrlf=true`, git shows the files as modified even when nothing changed.

## 9. Known issues found while documenting
- **Tabletop admin sign-in is broken.** `tabletop/app.js` `adminSignIn()` expects the old single-box `admin.json`
  format (`box.data`). The file is now `{v:2, users:[…]}`, so it fails with "Couldn't reach the Crawl website".
  Workaround: sign in as admin on the main site, then open `/tabletop/` **in the same tab**. `isAdmin()` also accepts
  the `crawl-admin-key` in `sessionStorage`.
- **The tabletop admin gate is client-side only.** It's `localStorage tt-admin = "1"`.
- **Build-time snapshots go stale** after Admin edits until someone rebuilds (see §2).
- **The repo is about 57 MB.** Large generated HTML and the zip are committed on every build.
- **A header comment is out of date.** The `chars.live` comment in `app.js` lists `ap, mp, ep`, but the code stores a single `pool`.

## 10. What matters for the planned rebuild
The goal is to make Crawl fully digital, with Three.js visualizations eventually. These are the facts about the current code that bear on that:
- **The site has no module system or bundler.** Its scripts are concatenated into one global scope. Three.js and most modern
  libraries expect ES modules or a bundler. The tabletop already uses native ES modules, so it's the easier base.
- **Content and code are already separated.** All content is in versioned JSON, with stable `id`s (except spells and
  glossary entries, which are keyed by name) and per-file `v` versions. This is the most reusable part of the current system.
- **Rules are data plus free text.** Class charts (Max Pool and Action Die per level), costs and formulas are structured,
  but most effects are prose. Automating the rules ("fully digital") means turning the prose into structured fields over time.
- **The rendering is all DOM and SVG, with no WebGL anywhere.** The only 2D `<canvas>` uses are the tabletop's fog of war
  and image shrinking (map uploads, creator portraits).
  The tabletop board (`#world` layers) and the Tree-mode skill tree are the natural places a 3D view would plug in.
- **The backend is GitHub plus Firebase.** Anything needing server logic (accounts, real permissions, rules enforcement,
  large asset storage) means adding a real backend. Firebase is already in use and could grow into that role.
- **Data is duplicated.** Every page embeds all its JSON, and `app/` duplicates every page. A rebuild that loads data at
  runtime would remove most of the generated output.

## 11. In progress: the new site in `web/` (Vite + TypeScript)
Plan: [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md). Sections 1–10 above still describe the **live** site (GitHub Pages).
This section covers the new one (Vercel). Every page and the tabletop now run on it. The Windows app and the cutover are still to do.
- **Build:**
  - `vite.config.ts` builds the pages in `web/*.html` into `dist/`: the old site's 11, with the same URLs, plus `wiki.html` and the `testing/` prototypes.
  - `base: './'` keeps every URL relative.
  - `web/vite/content-files.ts` serves `crawl-*.json`, `admin.json` and `tabletop/` from the repo root in dev, and copies them into `dist/` in a build.
    The tabletop is native ES modules, so it's served as is; the old site serves the same files.
- **Hosting:**
  - Vercel builds `main` and every PR (`vercel.json`).
  - It skips commits that only touch `crawl-edits.json`, `dev/` or Markdown.
- **Real TypeScript modules** (shared by every page):
  - `lib/markup.ts`: the text markup and glossary matching (was `GLCORE` in `src/page.html`); `ui/tips.ts`: the glossary tooltips.
  - `lib/github.ts`: admin keys, GitHub saving, the edit log; `ui/admin.ts`: the whole admin UI (was the `ADMIN` block).
  - `ui/nav.ts`: the nav, shortened to Home · Character Creator · **Wiki** · Tabletop · About ([planning/wiki-menu.md](planning/wiki-menu.md)).
    The Wiki menu lists the eight reference sections and links to `wiki.html`, a page of section cards with live counts (`ui/counts.ts`).
    The old per-section menus are gone; the old scripts' `window.crawlNav*` calls are now no-ops.
    Flyouts that wouldn't fit open to the left, so each menu stays under its item (the old nav slid the Glossary menu far to the left).
  - `ui/theme.ts`: dark mode and Tree mode; `lib/data.ts`: loading content files.
  - The home page (`web/src/pages/home.ts`) is fully TypeScript.
- **Page scripts still shared with the old site** (`src/*.js`, and the Spells script in `src/page.html`):
  - `web/vite/legacy-pages.ts` bundles each page's scripts into one module, `virtual:legacy/<page>`, the way `build.py` concatenated them.
    The two sites therefore run the **same** page code until cutover, and a fix to `src/` lands in both.
  - Each bundle starts by importing the shared modules under their old global names (`ADMIN`, `putFile`, `glMapOf`…), then
    `await boot(page)` (`web/src/legacy/boot.ts`) sets up the nav, theme and admin and loads the data the old build embedded (`GLOSSARY`, `CLASSES`, `FEAT_SRC`…).
  - A name a script declares itself is never imported, so its own version wins (the Spells script has its own `$` and `esc`).
  - The scripts now run as modules (strict mode). If one assigns to an undeclared variable, it throws on the new site but not on the old one.
  - The Spells page's claude.ai artifact mode is left out on the new site (it's still in `src/page.html` for the old one).
  - **To move a page off this:** rewrite its scripts as TypeScript modules under `web/src/pages/`, then remove it from `LEGACY_PAGES`.
- **Page markup** (`web/*.html`) was generated once from the `sitekit.py` shells and `src/page.html`. The admin modal is left out because `ui/admin.ts` adds it.
- **CSS** is copied as is from `src/page.html` and `tools/sitekit.py` into `web/src/styles/`. Keep the copies in sync until cutover.
- **Still on the old site only:** the Windows app (`app/`, the installer zip). The footer's download link still points to github.io.
