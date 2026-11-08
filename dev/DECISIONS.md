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

## 2026-11-07: Playtest home page is about your characters; Tree mode moves to the Testing menu; short account passwords
**Status:** agreed by Maddox; **Brody to agree** (Tree mode is his prototype) · **Who:** maddox
**Why:** For the playtest, players come to the site to run their character, so the home page should get them there in one tap, on a phone.
Tree mode's switch sat in every page's nav bar, crowded it on phones, and could be left on by accident, but it's a proof of concept.
And while a handful of friends make accounts, password rules only get in the way.
**Decision:**
- **Home** lists your characters (HP, Action Pool, Play and Edit). **Play** opens the play sheet, which is still a prototype at `/testing/sheet`: this is the first prototype shown to players. Rules search and "what's new" wait ([planning/home-page.md](planning/home-page.md)).
- **Tree mode** has no switch in the nav or the Admin menu any more. The admin-only Testing menu opens the Creator with `?tree=1`, which turns it on for that page only; it isn't remembered. Nothing in Tree mode itself changed.
- **Account passwords** (Supabase) need 6 characters, the lowest Supabase allows, with no other rules. The old `admin.json` password stays at 12, because it guards a GitHub key that anyone can download.
**Trade-offs:** Admin accounts can now have weak passwords and they can save to GitHub, so admins should still choose long ones. Raise the minimum before the site opens beyond the playtest group. To bring Tree mode back for everyone, add a switch again (`ui/theme.ts`).

## 2026-11-04: Game content gets a typed schema; structured rules data sits beside the prose
**Status:** agreed (Brody approved PR #11, 2026-11-04) · **Who:** maddox, brody
**Why:** A virtual tabletop needs content a program can use: ids, numbers that are numbers, costs, rolls and effects.
Today most mechanics are prose or loose strings, and spells and glossary entries have no ids.
And every Admin editor drops fields it doesn't know, so new fields can't simply be added to `crawl-*.json` yet.
Plan: [planning/content-schema.md](planning/content-schema.md).
Options we weighed:
- **Add fields to the records now:** Admin saves would erase them, on both sites.
- **Rewrite the prose as structured data:** it loses Brody's wording, and it's his content.
- **Move content into the database:** a much bigger change, already ruled out for now ("`crawl-*.json` stays the source of truth").
**Decision:**
1. One schema for all content, as TypeScript + Zod in `web/src/lib/content/`:
   - stable ids;
   - references by id;
   - shared building blocks: `Cost`, `Roll`, `Damage`, `Effect`, `Modifier`, `Grant`, `Choice`;
   - actions and conditions as their own kinds.
2. **Prose stays the rule.** Structured fields are optional, added a slice at a time, and signed off by Brody.
3. Three stages:
   - **A. Adapters:** convert today's files on load, with no file changes;
   - **B. A side file:** structured data in `crawl-rules.json`, keyed by id, which the old editors never touch;
   - **C. Merged:** the data moves into the records once the editors are rebuilt in React and the old site is retired.
**Trade-offs:**
- Until stage C, a record's data lives in two files, and renaming a spell or glossary entry orphans its id until it's re-attached (validation flags it).
- The adapters parse loose text, so they'll misread some records. Those stay as hand-tracked `text` effects, with a warning.
- Writing structured data for 438 spells is a lot of content work. It's done in slices, starting with conditions and weapon actions.

## 2026-11-04: Move the new site to React now; the old site stays frozen at its URL until cutover
**Status:** agreed (Brody approved PR #11, 2026-11-04) · **Who:** maddox, brody
**Replaces:** "Port to plain TypeScript now, and move the UI to React later" (2026-11-02).
**Why:**
- The playtest MVP is mostly new, live UI: a play sheet where one event updates many numbers, dice rolls, and a DM view that updates live.
  That's what React is for.
- Porting the page scripts to plain TypeScript first, then to React, would rewrite the same UI twice.
- Players use the **old site** (`brodywoe-svg.github.io/crawl-1st-edition/`) for session 1, so it must keep working exactly as it does.
  Plan: [planning/react-migration.md](planning/react-migration.md).
- Weighed against:
  - **keeping the plan:** plain TS now, React later. Less to learn now, but double work, and the MVP UI would be built in the style we're leaving.
  - **React only for new screens**, with the old pages still running the shared `src/*.js`. Less work now, but the Creator has to write the new character format, so it gets rewritten anyway.
**Decision:**
1. **The old site is frozen.** GitHub Pages keeps serving the generated root `*.html`. We don't run `tools/build.py`, except to fix a real problem there.
   - Its content still updates: pages fetch fresh `crawl-*.json`, and Admin editing there keeps working. Content shape changes must therefore still work on it (as now).
   - `src/*.js` stops being shared code: a change there no longer has to work on both sites, because the old site only changes when rebuilt.
2. **The new site is React** (React 19, TypeScript, Vite), as a single-page app with a router.
   - The MVP's screens (play sheet, dice, characters list, Creator, campaign) are built in React first.
   - The other pages keep running their legacy scripts on the new site until they're ported.
   - Game logic stays framework-free in `web/src/lib/`, as before.
3. **Ports may change behavior** where the MVP needs it. "Port faithfully" applied while both sites shared code.
   Game content and rules are still Brody's: UI changes are fine, changes to rules text or content are not.
**Trade-offs:**
- More up front before session 2. The Creator (about 1,300 lines) is the biggest port. Fallback if it isn't ready: keep the legacy Creator, and convert its characters with `migrate()`.
- Tree mode isn't ported (it's a proof of concept). It stays on the old site.
- Bug fixes made on the new site don't reach the old one. That's fine while it's only for session 1 and a fallback.
- One more library to learn, and a router: URLs become `/spells` instead of `spells.html` (the old filenames redirect at cutover).

## 2026-11-04: Focus on a playtest MVP; the tabletop and Tree mode are proofs of concept; characters are build + state + events
**Status:** agreed (Brody approved PR #11, 2026-11-04) · **Who:** maddox, brody
**Why:** Session 1 of the first campaign is on paper. We want the site ready for session 2, a couple of weeks later, for one campaign.
The previous plan went straight from accounts (phase 2) to campaigns with DM proposals (phase 3) and the tabletop on Supabase (phase 4).
That's more than the playtest needs, and builds on the tabletop before we've agreed what a final tabletop looks like.
Plans: [roadmap/playtest-mvp.md](roadmap/playtest-mvp.md), [planning/character-data.md](planning/character-data.md).
**Decision:**
1. **The next goal is the playtest MVP:** players make and track their characters on the site in one campaign, and the DM sees the party.
   Order: character data and state, then prototypes (stat display, dice rolling), then the build.
2. **The tabletop (`tabletop/`) and Tree mode are proofs of concept.** We learn from them but don't build on them until a final design is agreed.
   Phase 4 (the tabletop on Supabase) is on hold. Phase 3 is cut down for the MVP (no DM proposals yet).
   The long-term vision is kept as ideas in [roadmap/digital-tabletop.md](roadmap/digital-tabletop.md).
3. **A character has three layers:**
   - **build:** the player's choices;
   - **state:** what changes in play;
   - **derived:** numbers worked out from the rules, never saved.

   State changes only through **events** handled by one pure function, which is the start of the rules engine.
   - Weighed against: keeping the Creator's single object and its saved `snap` (simplest, but saved numbers go stale whenever Brody changes a rule).
   - Weighed against: editing state fields directly (simpler now, but no undo, no history, and a rewrite when the tabletop or a server needs to check actions).
**Trade-offs:**
- Characters saved today need a migration (`v: 1` → `v: 2`). The old site's Creator has to cope with it until cutover.
- More code up front: porting the Creator's maths into `web/src/lib/` (which the TypeScript refactor needs anyway).
- The tabletop proof of concept falls further behind, and stays on Firebase meanwhile.

## 2026-11-02: A staging Supabase project; the tabletop's design; anonymous players
**Status:** proposed by maddox. Brody to OK the player-facing parts (4: roles, DM proposals, party privacy) · **Who:** maddox
**Why:** Planning the database as a whole ([planning/supabase-database.md](planning/supabase-database.md)) needed these choices.
**Decision:**
1. **A staging project.** A second free project, `crawl-dev`, takes every migration first, and Vercel preview links use it.
   Production (`crawl`) only gets changes that were tested there.
   - Weighed against: a single project, which is simpler, but then every test touches real accounts.
2. **The tabletop's tables.** One generic `campaign_items` table (campaign, kind, page, item, JSON data), on top of the campaign tables
   (decision 4), streamed with Supabase Realtime.
   - Weighed against: a table per kind (tokens, fog, chat…), which is cleaner SQL but means rewriting `app.js`.
   - The generic table matches today's Firebase tree, so a `SupabaseNet` can sit behind the existing `net.js` API.
   - RLS on `kind` and `data` still hides GM-only things from players on the server.
3. **Anonymous sign-in for tabletop players** who join from an invite link, as Firebase does today. They can upgrade to a real account later.
   - Weighed against: requiring accounts to play, which adds friction for one-off players.
4. **Roles.** Accounts are `player` or `admin`. **Dungeon master is a role per campaign**, and anyone can start a campaign and be its DM.
   DMs see the characters in their campaign, and only **propose** changes to them; the player accepts or rejects each proposal.
   - Weighed against: an account-wide DM role granted by admins (less open, and it slows new groups down),
     and DMs editing characters directly (simpler, but a player's sheet could change without them).
   - Campaign creation is capped per account (10), and needs a real, confirmed account, to limit spam.
   - Players see each other's characters only as a party summary (name, race, class, level, portrait). The full sheet is visible
     only if its owner shares it with that campaign.
5. **Free services, no domain, for now.** Account emails use Supabase's built-in sender, which only reaches our own team (about 2 an hour).
   So email confirmation is **off**: anyone can make an account and use it straight away. Password resets by email work for the team; anyone else is reset by an admin.
   - Weighed against: a dedicated Gmail account over SMTP (about 500 a day, free, but one more account to look after), or buying a domain for a real email service.
   - Before sign-up opens beyond our group: add a CAPTCHA, and a real sender (Gmail or a service) with confirmation on. Both are settings, not code.
**Trade-offs:**
- Two projects to keep in step: migrations must be pushed to both.
- `campaign_items` puts most of the data in JSON, so rules about it are written against `data->…` fields. That's harder to read than columns.
- Anonymous users count toward the monthly user limit, and can spam a game whose invite link leaks. The GM can remove them, and the invite code can be rotated.

## 2026-11-02: Admins sign in with Supabase accounts; a server function saves to GitHub
**Status:** proposed by maddox; Brody OK'd Supabase (below) · **Who:** maddox
**Why:** Admin access today is a GitHub key per admin, encrypted with that admin's password and published in `admin.json`.
Anyone can download it and try passwords offline, and the unlocked key lives in the browser. Plan: [planning/supabase-admin-login.md](planning/supabase-admin-login.md).
Options we weighed:
- **Email + password** (chosen): plain for Brody, with no GitHub sign-in needed. One GitHub key, kept as a server secret.
- **Sign in with GitHub:** saves would commit as each person's own GitHub account, with no stored key. But GitHub's permission
  covers all of that person's public repos, and every admin would need write access to the repo.
- **Magic link by email:** no password, but it needs an email provider set up, and a link to click every time you sign in.
**Decision:**
- On the new site, admins sign in to Supabase with an email and password. Sign-up was off at first (opened for player accounts on 2026-11-03, see the entry above); admins are made admins in the dashboard,
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
**Status:** **Replaced by** "Move the new site to React now" (2026-11-04) · **Who:** maddox
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
**Status:** agreed (Brody OK'd it, talking with Maddox, 2026-11-02) · **Who:** maddox, brody
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
