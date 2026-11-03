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

## 2026-11-02: A staging Supabase project; the tabletop's design; anonymous players
**Status:** proposed, waiting on Brody · **Who:** maddox
**Why:** Planning the database as a whole ([planning/supabase-database.md](planning/supabase-database.md)) needed three choices.
**Decision:**
1. **A staging project.** A second free project, `crawl-dev`, takes every migration first, and Vercel preview links use it.
   Production (`crawl`) only gets changes that were tested there.
   - Weighed against: a single project, which is simpler, but then every test touches real accounts.
2. **The tabletop's tables.** One generic `game_items` table (game, kind, page, item, JSON data), plus `games` and `game_members`,
   streamed with Supabase Realtime.
   - Weighed against: a table per kind (tokens, fog, chat…), which is cleaner SQL but means rewriting `app.js`.
   - The generic table matches today's Firebase tree, so a `SupabaseNet` can sit behind the existing `net.js` API.
   - RLS on `kind` and `data` still hides GM-only things from players on the server.
3. **Anonymous sign-in for tabletop players** who join from an invite link, as Firebase does today. They can upgrade to a real account later.
   - Weighed against: requiring accounts to play, which adds friction for one-off players.
**Trade-offs:**
- Two projects to keep in step: migrations must be pushed to both.
- `game_items` puts most of the data in JSON, so rules about it are written against `data->…` fields. That's harder to read than columns.
- Anonymous users count toward the monthly user limit, and can spam a game whose invite link leaks. The GM can remove them, and the invite code can be rotated.

## 2026-11-02: Admins sign in with Supabase accounts; a server function saves to GitHub
**Status:** proposed, waiting on Brody (depends on the Supabase entry below) · **Who:** maddox
**Why:** Admin access today is a GitHub key per admin, encrypted with that admin's password and published in `admin.json`.
Anyone can download it and try passwords offline, and the unlocked key lives in the browser. Plan: [planning/supabase-admin-login.md](planning/supabase-admin-login.md).
Options we weighed:
- **Email + password** (chosen): plain for Brody, with no GitHub sign-in needed. One GitHub key, kept as a server secret.
- **Sign in with GitHub:** saves would commit as each person's own GitHub account, with no stored key. But GitHub's permission
  covers all of that person's public repos, and every admin would need write access to the repo.
- **Magic link by email:** no password, but it needs an email provider set up, and a link to click every time you sign in.
**Decision:**
- On the new site, admins sign in to Supabase with an email and password. Sign-up is off; admins are invited from the dashboard,
  and the admin role is set there.
- Saves still commit `crawl-*.json` to GitHub, through a Supabase Edge Function that checks the caller is an admin.
- The same `profiles` table will hold player accounts later.
- The old site keeps the `admin.json` password until cutover. `admin.json` is retired after that.
**Trade-offs:**
- Commits are made by the GitHub account that owns the function's key. "(by name)" in the commit message says who really edited, as it does today.
- A Supabase outage blocks admin saves on the new site (the old site still works until cutover).
- Free Supabase projects pause after a week with no activity. Opening the dashboard wakes them.

## 2026-11-02: Host the site on Vercel, replacing GitHub Pages at cutover
**Status:** agreed by maddox; Brody to confirm in the PR · **Who:** maddox
**Why:** The new Vite site needs a build step, and GitHub Pages can only do that through a GitHub Actions workflow we'd have to maintain.
We weighed two options:
- **GitHub Pages + Actions.**
  - **For:** free, and it's what we use today.
  - **Against:** no PR previews without extra work, and no server code.
- **Vercel.**
  - **For:** it builds Vite automatically.
  - **For:** every PR gets its own **preview link** to try before merging.
  - **For:** it can run small server functions if we ever need them.
  - **For:** custom domains are easy.

**Decision:**
- Vercel builds `npm run build` and hosts `dist/`. `main` is production, and every PR gets a preview.
- The old GitHub Pages site stays live until the new one matches it. Then we cut over.
- Admin saves still commit to `main`, and each one triggers a rebuild of about 1 minute.
  `vercel.json` skips the rebuild for commits that only touch `crawl-edits.json`, `dev/` or Markdown, so each save costs one build, not two.

**Trade-offs:**
- **Hobby plan limits.** The free Hobby plan is for **non-commercial use only**. If Crawl is ever sold, we need Pro (about $20/month).
  It also limits deploys per day (100 at the time of writing; check it when we set up). That's fine unless there's a very heavy Admin editing day.
- **Brody's account.** Hobby allows one person per account, so the project lives on Brody's Vercel account, since Brody owns the repo.
  Maddox sees previews through the links Vercel posts on each PR.
- **The site address changes** from `brodywoe-svg.github.io/crawl-1st-edition/`.
  At cutover the old pages become redirects. We could also add a custom domain.

## 2026-11-02: Port to plain TypeScript now, and move the UI to React later
**Status:** agreed by maddox; Brody to confirm in the PR · **Who:** maddox
**Why:**
- Today's pages build HTML as strings and redraw by hand. That's fine for the compendium, but it gets harder as the creator,
  the rules automation and the tabletop grow.
- We weighed three options:
  - **plain TypeScript:** the smallest, lowest-risk port, because the current code converts mostly in place,
  - **React now:** better for complex, live UI, but every page's UI would have to be rewritten during the port, which makes it slower and riskier,
  - **Svelte:** lighter, but a smaller ecosystem.

  Three.js works with or without React. React Three Fiber, a wrapper for using Three.js inside React, is optional.

**Decision:**
- The Vite refactor ports the site in **plain TypeScript**, with no UI framework.
- **React is the planned UI framework for later.** It gets adopted page by page, after the port, starting with new rules-automation UI.
  See [planning/react-migration.md](planning/react-migration.md).
- To keep that move cheap, game logic stays framework-free in plain TypeScript modules (`lib/`):
  data loading, the markup renderer, Admin saving and, later, the rules engine.

**Trade-offs:**
- For a while there will be two UI styles: string-rendered pages and React pages.
- Some UI ported now will be rewritten later. That's accepted, because the port has to land first and the rules UI is mostly new screens anyway.

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
- **Web:** the Vite build, hosted on Vercel (see the entry above).
- **PC:** Electron loads the same build. It's packaged with `electron-builder` and updates itself
  from GitHub Releases with `electron-updater`, which replaces the hand-made PowerShell installer.
- **Mobile, later:** Capacitor wraps the same build.

The migration is planned in [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md).
**Trade-offs:**
- We'll need Node.js and npm, which ends the "Python stdlib only, no dependencies" rule.
- The site will need a build step (run by Vercel) instead of committed HTML.
- The UI framework is covered in the entry above: plain TypeScript now, React later.
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
