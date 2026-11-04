# Move the new site to React, now
**Status:** draft (proposed 2026-11-04, replaces the "React later" plan)  ·  **Owner:** maddox  ·  **Roadmap:** [playtest-mvp.md](../roadmap/playtest-mvp.md)
**Decision:** "Move the new site to React now" in [DECISIONS.md](../DECISIONS.md) (proposed; Brody to OK).

## Goal
Build the playtest MVP's screens in React from the start, instead of porting the page scripts to plain TypeScript first and to React later.
Meanwhile, the old site keeps running unchanged at `brodywoe-svg.github.io/crawl-1st-edition/` for session 1.

## Scope
- **In:**
  - React and a router added to the Vite build;
  - an app shell: layout, nav, theme, sign-in;
  - the MVP's screens: characters list, play sheet, dice, Creator, campaign;
  - framework-free game logic in `web/src/lib/` ([character-data.md](character-data.md)).
- **Out (for now):**
  - the compendium pages (Spells, Glossary, Items, Classes…) and their Admin editing. They keep running their legacy scripts on the new site,
    and Brody keeps editing content wherever he does today, until they're ported after the MVP;
  - Tree mode and the tabletop (proofs of concept);
  - the Windows app (it follows the new site at cutover);
  - any change to the old site.

## How it works

### The old site stays frozen
- GitHub Pages serves the generated root `*.html` from `main`. Those change only when someone runs `tools/build.py`, so **we don't run it** (except to fix a real problem).
- It still loads fresh `crawl-*.json`, so Brody's content edits show up there, and its Admin editing works.
  Content shape changes still have to work on it.
- **Characters from session 1:** the old site keeps them in that browser only. To bring one across, use **Save to file** on the old Creator and open the file in the new one.
  `migrate()` converts it ([character-data.md](character-data.md)).
  The two sites are on different addresses, so their browser storage never mixes.

### The stack
| Piece | Choice | Why |
| --- | --- | --- |
| UI | **React 19** + `@vitejs/plugin-react` | Live UI driven by state; the largest ecosystem; React Three Fiber for 3D later |
| Routing | **React Router**, one single-page app | Sign-in, the open character and live subscriptions survive moving between screens. The future tabletop mode needs this |
| App state | **Zustand** (small store) for the session and the open character | The character store is just `apply()` from `lib/character`: an event in, the next state out |
| Server data | Supabase calls wrapped in `lib/` and small hooks | Add TanStack Query only if caching and refetching get painful |
| Styles | The existing CSS (`web/src/styles/`), same class names | No visual redesign now; the look stays Crawl's |
| Tests | **Vitest** for `lib/` (character, dice, derive) | The rules engine is pure functions that are easy to test, and getting them wrong breaks a game night. This is the repo's first test setup |

**Layout:**
```
web/
  index.html            the React app's single HTML page
  spells.html …         legacy pages, still separate entries until ported
  src/
    lib/                game logic and data, no DOM or React (unchanged rule)
      character/        types, derive, apply, migrate
      dice.ts
    app/                the React app
      main.tsx          entry: router, providers
      routes/           one file per screen
      components/       shared UI: nav, stat blocks, dice tray…
      store/            Zustand stores
    ui/, legacy/        the current DOM code, used by legacy pages until they're ported, then deleted
```

**Routes (MVP):**
- `/`: home
- `/characters`: my characters
- `/characters/:id`: the play sheet
- `/create`, `/create/:id`: the Creator
- `/campaign/:id`: the party (DM view)
- `/account`: password reset

The legacy pages stay at `spells.html` etc. and are linked from the React nav.

**Hosting:**
- Vercel needs a rewrite that sends unknown paths to `index.html` (`vercel.json`), so `/characters/abc` loads the app.
- Electron can't use plain paths from `file://`. Either serve the build over a custom `app://` protocol, or use hash URLs in the app. That's decided with the Windows app work.

### Port order, aimed at session 2
1. **Shell:**
   - React, the router, Vitest;
   - the nav, theme and sign-in as components, rewritten from `ui/nav.ts`, `ui/theme.ts` and `ui/admin.ts` (sign-in only);
   - the home page.
2. **Logic:** `lib/character` and `lib/dice` ([character-data.md](character-data.md)), with tests.
3. **Prototypes (testing):** the play sheet / stat display, and dice rolling, as routes behind the Testing menu. Each gets a doc in `dev/testing/`.
4. **Characters list and the Creator** in React, writing the new character shape.
   - The biggest step: `src/creator.js` is about 1,300 lines. Its maths moves into `lib/character/derive.ts` first, so the React version is mostly forms.
   - **Fallback:** if it isn't ready by session 2, keep the legacy Creator on the new site and convert what it saves with `migrate()`.
5. **Campaign:** join by code, and the DM's live party view (cut-down phase 3, [supabase-database.md](supabase-database.md)).
6. **After the MVP:** the compendium pages and their Admin editing, one at a time, then delete `web/vite/legacy-pages.ts`, `ui/` and `legacy/`.

## Steps
- [ ] Brody OKs the decision (React now, old site frozen).
- [ ] Shell: React, the router, Zustand, Vitest, the SPA rewrite in `vercel.json`, nav/theme/sign-in components, home.
- [ ] `lib/character` and `lib/dice`, with tests.
- [ ] Play sheet and dice prototypes, with testing docs.
- [ ] Characters list and Creator in React (or the fallback).
- [ ] Campaign and the DM view.
- [ ] Update ARCHITECTURE.md §11 and CLAUDE.md's code style section as each piece lands.

## Open questions
- **Electron:** an `app://` protocol, or hash URLs? Decide with the Windows app.
- **Preact instead of React?** It's smaller (about 4 KB), with mostly the same API. Not worth the compatibility risk now; revisit if phone load times are a problem.
- **A component library** (Radix and the like) for menus, dialogs and the like? Proposed: no, until we need accessible widgets we'd otherwise hand-build.
