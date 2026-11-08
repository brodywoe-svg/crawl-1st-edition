# Tasks

The one shared to-do list for Crawl's software. Keep it short:
- one line per task,
- tick it in the PR that finishes it,
- delete done items once they've been released for a while (git history keeps them).

Format: `- [ ] Task (@owner)`. The owner is `@brody`, `@maddox`, or left off if no one has it yet.
If a task needs more than a line of explanation, write a doc in [planning/](planning/) and link it from the task.

## Now
Goal: the playtest MVP, ready for session 2: [roadmap/playtest-mvp.md](roadmap/playtest-mvp.md).
- [ ] Answer the open questions in the planning docs (rules-data authoring, coins, XP, monsters, an Actions section), and check the events table in [planning/character-data.md](planning/character-data.md) (@brody)
- [x] React shell: router, home, the SPA rewrite; nav, theme and sign-in reused from `ui/`: [planning/react-migration.md](planning/react-migration.md) (@maddox)
- [x] Character data and the state system: types, `apply`, `derive` (minimal), migration, dice: [planning/character-data.md](planning/character-data.md) (@maddox)
- [x] Content schema, stage A (types, adapters, `content:check`) for what the play sheet needs: [planning/content-schema.md](planning/content-schema.md) (@maddox)
- [ ] Try the play sheet and dice roller prototypes, then decide ship / iterate / remove: [testing/play-sheet.md](testing/play-sheet.md), [testing/dice-rolling.md](testing/dice-rolling.md) (@maddox, @brody)
- [ ] Answer the rules questions in [testing/play-sheet.md](testing/play-sheet.md): EP in a full pool, temp HP, classes without a chart, Exploration (@brody)
- [ ] **2026-11-08 with Brody:** accounts and APIs, following the session to-do at the top of [planning/backend-setup-checklist.md](planning/backend-setup-checklist.md) (@maddox, @brody)
- [x] Home page, characters first (each opens its sheet in the Creator); rules search and what's new still to do: [planning/home-page.md](planning/home-page.md) (@maddox)
- [ ] Go through the backend and API setup checklist together, and settle its open questions: [planning/backend-setup-checklist.md](planning/backend-setup-checklist.md) (@maddox, @brody)
- [ ] Review the decisions (TypeScript + Vite, Vercel, React now): start at [QUICKSTART.md](QUICKSTART.md). Supabase is agreed. (@brody)
- [ ] Supabase admin login: code is in (off until configured); next, create the project and set it up: [planning/supabase-admin-login.md](planning/supabase-admin-login.md) (@maddox)
- [ ] Supabase database plan, phases 2–4 (player, DM and admin roles): [planning/supabase-database.md](planning/supabase-database.md). Brody to OK it (@maddox, @brody)
- [ ] Supabase: accept the org invite, then make the `GITHUB_TOKEN` and add it to Supabase: [QUICKSTART.md](QUICKSTART.md) step 6 (@brody)
- [ ] TypeScript + Vite refactor: [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md). Every page and the tabletop now run on the new site; pages are now rewritten in React, MVP screens first ([planning/react-migration.md](planning/react-migration.md)), then the Windows app and cutover. **Don't run `tools/build.py`:** the old site stays frozen for session 1. (@maddox)

## Next
- [ ] Try the 3D dice prototype on a laptop and a phone, fill in [testing/3d-dice.md](testing/3d-dice.md), then decide ship / iterate / remove (@maddox, @brody)
- [ ] Wiki menu: built on the new site; Brody to OK the name and the defaults: [planning/wiki-menu.md](planning/wiki-menu.md) (@brody)
- [ ] Add the Vercel site address to Firebase's authorized domains, so online tabletop play works there (@brody)

## Later
- [ ] Supabase phase 2: player accounts and cloud-saved characters. Built (PR #8): push the migration and config, then test with two accounts: [planning/supabase-database.md](planning/supabase-database.md)
- [ ] Supabase phase 3, cut down for the MVP: campaigns, join by code, the DM's live party view (proposals deferred): [planning/supabase-database.md](planning/supabase-database.md)
- [ ] Supabase phase 4: the tabletop off Firebase. **On hold**: the tabletop is a proof of concept ([roadmap/digital-tabletop.md](roadmap/digital-tabletop.md))
- [ ] Move the UI to React after the Vite refactor: [planning/react-migration.md](planning/react-migration.md)

## Done
- [x] Connect the repo to Vercel (@brody)
- [x] Spells page claude.ai mode: dropped on the new site (@maddox, 2026-11-02)
- [x] Dev docs set up: `CLAUDE.md`, `dev/ARCHITECTURE.md`, `dev/DATA-MODEL.md`, this list, `dev/DECISIONS.md` (@maddox)
