# Decisions

A log of technical choices and why we made them, so nobody (person or agent) undoes one by accident.
Add an entry when you pick between real alternatives, for example:
- a library or framework,
- hosting or a backend,
- a data-format change,
- a build tool.

Bug fixes and routine changes don't need one. Newest first. Never delete an entry. If a decision is reversed,
add a new entry and mark the old one **Replaced by**.

Template:
```
## YYYY-MM-DD: Decision in one line
**Status:** proposed | agreed | replaced by <date/title>  ·  **Who:** brody, maddox
**Why:** the problem and the options we weighed.
**Decision:** what we chose.
**Trade-offs:** what gets harder, and what to revisit later.
```

---

## 2026-11-02: The UI is built with React
**Status:** agreed by maddox; Brody to confirm in the PR · **Who:** maddox
**Why:**
- Today's pages build their HTML as strings and redraw by hand, and that gets harder as the creator and the rules UI grow.
- We weighed three options:
  - **plain TypeScript:** the smallest port, but leaves the hand-redrawing as it is,
  - **Svelte:** lighter, but a smaller ecosystem,
  - **React:** the largest ecosystem and the most familiar to Claude Code and to anyone who joins later. It also has
    **React Three Fiber**, the standard way to use Three.js inside React, which matters for the planned 3D views.

**Decision:**
- Use React with TypeScript, set up by Vite.
- Game logic stays framework-free: data loading, the markup renderer, Admin saving and, later, the rules engine are plain TypeScript modules.
  React only draws the UI, so the rules engine can also run on a server later.

**Trade-offs:**
- Porting a page means rewriting its UI as components, not only renaming files, so the refactor takes longer.
- It adds about 45 KB of library to each page.

## 2026-11-02: The client is rebuilt as TypeScript + Vite, one build for web, PC and mobile
**Status:** agreed by maddox; Brody to confirm in the PR · **Who:** maddox
**Why:**
- The site has no module system. `build.py` concatenates plain scripts into one global scope.
- Three.js and most modern libraries expect ES modules and a bundler.
- We want web, PC and (later) mobile from one codebase.
- We want the rules engine to be shared code that runs both on the client and on the server.

Options we weighed:
- **Keep `build.py` and add modules by hand.** No new tooling, but it fights every library we'd want to use.
- **TypeScript + Vite.** This is the standard setup for Three.js. It gives fast dev reloads and catches type errors in rules code.
- **A heavier framework (Next.js etc.).** It's built for server-rendered sites, which we don't need.

**Decision:**
- Use TypeScript and Vite.
- **Web:** the Vite build, hosted on GitHub Pages.
- **PC:** Electron loads the same build. It's packaged with `electron-builder` and updates itself
  from GitHub Releases with `electron-updater`, which replaces the hand-made PowerShell installer.
- **Mobile, later:** Capacitor wraps the same build.

The migration is planned in [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md).
**Trade-offs:**
- We'll need Node.js and npm, which ends the "Python stdlib only, no dependencies" rule.
- The site will need a build step in CI (GitHub Actions) instead of committed HTML.
- The UI framework is chosen in the React entry above.
- The Windows app won't be code-signed at first, so Windows SmartScreen will warn on the first install, as it does today.

## 2026-11-02: Supabase over Firebase as the backend
**Status:** proposed, waiting on Brody · **Who:** maddox
**Why:** A fully digital Crawl needs things that GitHub and Firebase, as we use them now, can't do well:
- player accounts,
- characters saved to the cloud,
- real permissions (today any anonymous user can read and write any tabletop game),
- rules enforced on the server,
- proper storage for map images (today they're data URLs inside the database).

Note that Three.js runs entirely in the browser, so it didn't factor into this choice.

Options we weighed:
- **Firebase** (expand what the tabletop already uses):
  - **For:** there's nothing to migrate.
  - **Against:** its document-tree model is awkward for relational rules data (classes → features → costs, characters → items).
  - **Against:** bandwidth pricing gets expensive with maps and assets.
  - **Against:** we'd be locked into Google.
- **Supabase** (hosted Postgres with auth, realtime sync, storage and serverless functions):
  - **For:** relational data fits the content.
  - **For:** row-level security enforces permissions like "only the GM can edit fog" on the server.
  - **For:** it has real file storage.
  - **For:** its Edge Functions run TypeScript, so they can share the rules code.
  - **For:** it's open source, self-hostable plain Postgres, so there's no lock-in.
  - **For:** the free tier covers us while we're testing.
- **A custom Node server, e.g. Colyseus:**
  - **For:** full control over live, server-run combat.
  - **Against:** we'd be running servers ourselves, which is too much for now.
  - We can add one alongside Supabase later if live combat needs it.
- **Convex:**
  - **For:** TypeScript-native and pleasant to use.
  - **Against:** it's smaller and proprietary.

**Decision:**
- Use Supabase for accounts, characters, tabletop sync and asset storage.
- The tabletop moves over by adding a `SupabaseNet` behind the existing `net.js` API. The rest of `app.js` shouldn't need to change.
- Game content stays in `crawl-*.json` for now (see the entry below). Moving it into Postgres would be its own decision.

**Trade-offs:**
- It's a new service with its own keys and dashboard to manage.
- Existing Firebase tabletop games won't carry over unless we write an export.
- Postgres schema changes need migrations, which is more discipline than JSON.

## 2026-11-02: Dev docs live in the repo as a few Markdown files
**Status:** proposed · **Who:** maddox
**Why:** Two people plus Claude Code agents need shared context that survives between sessions. Agents read
the repo, not chat history. We considered GitHub Projects and a heavier per-feature file system, but both felt like too much for now.
**Decision:**
- Use `CLAUDE.md` (loaded by Claude Code automatically), `dev/ARCHITECTURE.md`, `dev/DATA-MODEL.md`, `dev/TASKS.md`
  and this file. No tooling.
- Features follow a lifecycle with a folder per stage: `dev/roadmap/` → `dev/planning/` → `dev/testing/` → an outcome
  (ship, iterate or remove) logged here → `dev/archive/`.
**Trade-offs:** `TASKS.md` can get merge conflicts if both of us edit it at once. Revisit if it grows past one screen.

## 2026-11-02: `crawl-*.json` stays the source of truth for game content
**Status:** proposed · **Who:** maddox
**Why:** Brody edits content through the website's Admin UI, which commits these files straight to `main`. Moving
content elsewhere (e.g. Markdown) would break that workflow.
**Decision:** Keep the JSON files and their current formats. The dev docs are for development only. Any change to a file's
shape gets an entry here first, because the site, the creator, the tabletop and the build all read these files.
**Trade-offs:** Admin commits bypass PRs, so code PRs should leave the JSON alone to avoid conflicts. The planned
rebuild may revisit where content lives. When it does, it gets a new entry here.
