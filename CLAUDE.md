# Crawl 1st Edition

Brody Woelke's tabletop RPG (built on the SRD 5.1, with its own Action Pool / Action Die combat system).
This repo is all of its software: a static website on GitHub Pages (compendium, Character Creator,
in-browser Admin editing), an offline Windows app (Electron), and a virtual tabletop.
Brody and Maddox build it together, each with Claude Code, through pull requests.

**Where it's heading:** a fully digital Crawl, with the rules automated rather than just displayed, and
Three.js visualizations eventually. The backend and website will be rebuilt along the way.
Weigh every change against that direction.

- How it works today: @dev/ARCHITECTURE.md
- Shape of the game data: [dev/DATA-MODEL.md](dev/DATA-MODEL.md) (read before touching any `crawl-*.json` code)
- What we're working on: [dev/TASKS.md](dev/TASKS.md)
- Decisions made and why: [dev/DECISIONS.md](dev/DECISIONS.md)

## How features get built
Every feature goes through the same lifecycle. Each stage has a folder in `dev/` with a README and a template:

1. **Roadmap** (`dev/roadmap/`): a high-level goal. What it is, why it matters, and what "done" looks like. No implementation detail.
2. **Planning** (`dev/planning/`): one specific feature from a roadmap goal. Its scope, its approach, the files it touches, its open questions. Link the steps from `dev/TASKS.md`.
3. **Testing** (`dev/testing/`): build it as a prototype and write down what we learned. Prototypes live on a branch,
   in `dev/testing/<feature>/`, or behind an opt-in switch on the site (as Tree mode does). They never replace
   existing behavior until they've been agreed.
4. **Outcome**: decided together and logged in `dev/DECISIONS.md`. One of three:
   - **Ship**: build it properly into the site, and update `ARCHITECTURE.md` / `DATA-MODEL.md`.
   - **Iterate**: start a new planning doc for the next round, linking the old one.
   - **Remove**: take the prototype out, and note why.
5. **Archive** (`dev/archive/`): once the prototyping phase ends, `git mv` the feature's planning and testing docs here.
   Archive a roadmap doc once all of its features are resolved. Docs in the archive are history. The present is described by the top-level `dev/*.md` files.

**Guide the user through this. Don't skip it quietly.**
- **A new feature with no roadmap or plan:** say so, and offer to draft the missing doc first. Ask the questions it needs answered.
- **"Let's try X":** that's testing. Help define the question being tested before writing code.
- **A finished prototype:** prompt for the ship / iterate / remove call, and the archiving that follows.
- **Small fixes don't need any of this.** Bugs, typos and tweaks to shipped behavior just need a branch and a PR.

## Thinking and collaborating
- **Think before building.** Ask what problem a request solves and who it's for. Name the trade-offs and any simpler alternative.
  Say plainly when something conflicts with the planned rebuild, or with an earlier decision. Prefer small, reversible steps.
- **Two developers share this repo, plus their agents.** Before starting:
  - check `dev/TASKS.md` and `dev/planning/` for work someone already owns,
  - claim a task by putting your name on its line,
  - if your work overlaps someone else's, raise it rather than working around it.
- **Write it down, not just in chat.** Decisions go in `DECISIONS.md` and plans in `dev/planning/`. Open questions go in the doc they belong to.
  The other developer, and the next session, only see what's in the repo.
- **One idea per PR.** The description says why, links its planning or testing doc, and lists anything left undone.
- **Respect the other person's calls.** Brody owns the game's design and content.
  Changes to an agreed decision are proposed as a new `DECISIONS.md` entry and agreed by both, never made silently.
- **Leave things better documented than you found them.** If something in the docs is wrong or missing, fix it in the same PR.

## Commands
- `python tools/build.py`: regenerates every page in the repo root and `app/`, and the installer zip. Run it after changing `src/` or `tools/sitekit.py`.
- There are no dependencies to install (Python 3 standard library only), no tests and no linter.
- To preview locally, serve the repo root, e.g. `python -m http.server`, and open `/index.html` or `/tabletop/`. Pages fetch their JSON, so `file://` won't fully work.

## Rules
- **Never hand-edit generated files.** These are the root `*.html`, `app/*.html` and `downloads/*.zip`. Edit `src/` or `tools/`, then rebuild.
- **`crawl-*.json` is game content.** Brody edits it through the site's Admin UI, which commits straight to `main`. In code PRs:
  - don't change these files,
  - don't change their shape without agreeing it first (log it in DECISIONS.md).
- **Never modify `admin.json`.** Never write tokens or passwords anywhere.
- **Game content (rules, spells, classes, lore) is © Brody Woelke.** Don't invent or rewrite it unless asked.
- **Work on a branch and open a PR.** Pull `main` first, because Admin saves land there constantly.
- **Keep the docs true.** If your change alters how something in `dev/ARCHITECTURE.md` works, update it in the same PR. Tick or add items in `dev/TASKS.md` as you go.

## Code style
- **Site JS** (`src/*.js`): plain browser JS, no modules. `build.py` concatenates the scripts into one global scope per page, so top-level names must not collide.
- **Tabletop** (`tabletop/`): native ES modules, served as is.
- **Style:** match the existing compact style, with short helpers (`$`, `esc`, `arr`, `str`) and sparse plain-English comments.
- **Python:** stdlib only, with a docstring at the top of each file.
