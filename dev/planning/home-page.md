# Home page: a landing page for the playtest
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** [playtest-mvp.md](../roadmap/playtest-mvp.md)

## Goal
The home page is the first thing a playtester sees, so it should get them to **their character** and the **rules** fast, and show **what changed** since last session.
Today it's mostly a copy of the Wiki page: a grid of section cards. The section cards stay on the Wiki page.

## Decided (Maddox, 2026-11-07)
- **For playtest players.** No pitch or marketing text for now; this is a landing page for playtesting. (A newcomers' page can come later, with Brody's words.)
- **Three sections:** your characters, wiki search, what's new.
- **Look:** the site's black and white style and logo, but bolder. A smaller logo, fewer and larger blocks, and clear buttons. It must work well on a phone.

## The page, top to bottom
```
┌──────────────────────────────────────────────┐
│ [logo, small]   Crawl 1st Edition · Playtest │
├──────────────────────────────────────────────┤
│ YOUR CHARACTERS                [+ New]       │
│ ┌──────────────┐ ┌──────────────┐            │
│ │ Brakka       │ │ Sample …     │            │
│ │ Dwarf Fighter│ │              │            │
│ │ HP ███░ 9/14 │ │              │            │
│ │ ●●○○○ 2 EP   │ │              │            │
│ │ [Play] [Edit]│ │              │            │
│ └──────────────┘ └──────────────┘            │
│ Saved in this browser · Sign in to sync      │
├──────────────────────────────────────────────┤
│ SEARCH THE RULES                             │
│ [ Fireball, Prone, Longsword…            ]   │
│  Prone · Condition                           │
│  Fireball · Spell, level 3                   │
├──────────────────────────────────────────────┤
│ AT THE TABLE   Combat · Conditions · Actions │
├──────────────────────────────────────────────┤
│ WHAT'S NEW                                   │
│  Today      Brody updated Wizard (Classes)   │
│  3 days ago 2 glossary entries added         │
│  …                                [All →]    │
├──────────────────────────────────────────────┤
│ Wiki · Character Creator · Windows app       │
└──────────────────────────────────────────────┘
```

### 1. Your characters
- **A card for each character** in this browser (and in your account when signed in, through the existing sync). Each card shows:
  - name, race, class and level;
  - an **HP bar**, and the **Action Pool** dots if the character has been played (from `state`, via `lib/character`);
  - **Play** (the play sheet) and **Edit** (the Character Creator).
- **Unfinished characters** are shown as "In progress: continue in the Creator".
- **New character** goes to the Creator.
- **With no characters,** one big **Make your first character** button, and "Sign in to bring your characters from another device" (when accounts are on).
- **The status line** says where characters are saved, the same label as the Creator: "Saved in this browser" or "Saved to your account".

### 2. Search the rules
- One box that searches names across spells, items, classes, races, backgrounds, feats and glossary entries (conditions, actions, properties, rules).
- **Results as you type:** name, kind, and a detail (spell level, item category). It's keyboard friendly and fine on a phone.
- **A result opens its page at that entry:**
  - Classes, Races, Items: `#id` (already supported);
  - Spells and Glossary: check what each page supports, else open the page with its own search filled in.
- **Code:** `lib/search.ts` builds the index from the content files and `lib/content` (pure, tested); the UI is a React component.
- **Below it, "At the table":** links to the glossary's Combat rules, Conditions and Actions groups, which are looked up most during play.

### 3. What's new
- The newest changes to the rules, from the Admin edit log (`crawl-edits.json`, which each save already writes).
- Grouped by day: "Brody updated Wizard (Classes)", "2 glossary entries added".
- **Left out:** skill-tree layout and Creator settings (`crawl-tree.json`, `crawl-creator.json`). They're 78 of the 125 entries today, and players don't need them.
- Each change links to its page. The newest 8, then "All changes →", which opens the existing edit history.
- **Code:** `lib/edits.ts` summarises the log (pure, tested).

### 4. Footer links
Wiki (all sections), Character Creator, and the Windows app download, as today.

## Scope
- **In:** the new home route (`web/src/app/routes/Home.tsx`), `lib/search.ts`, `lib/edits.ts` with tests, and styles in `web/src/styles/`.
- **Out:**
  - the old site's home page (frozen);
  - the Wiki page (unchanged);
  - campaigns ("your table", next session): later, with phase 3;
  - a newcomers' landing page.

## Open questions
- **The play sheet is still a prototype** at `/testing/sheet`. Should the home page's **Play** button link to it during the playtest? That would be our first time showing a prototype to players.
  - Suggestion: yes, labelled "Play (testing)". Move it to a proper address, such as `/characters/<id>`, when the prototype is agreed (ship).
- **Brody:** does "what changed" belong on the home page? Is it OK to show his name on each change, as the edit log records it?

## Steps
- [ ] Agree this plan (Maddox), and the open questions with Brody.
- [ ] `lib/edits.ts` and `lib/search.ts`, with tests.
- [ ] The home route and styles, then check it at phone width (390px), in both themes, signed in and out, and with and without characters.
- [ ] Update ARCHITECTURE.md §11.
