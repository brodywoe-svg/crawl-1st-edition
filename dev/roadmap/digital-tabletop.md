# A fully digital Crawl tabletop
**Status:** idea (ideation; nothing scheduled)  ·  **Owner:** maddox, brody

## Goal
The end goal for Crawl's software: a digital tabletop RPG where the rules are run by the app, not tracked by hand.
It should feel like Crawl: the Action Pool, Action Die and its other unique systems are the centre of the interface, not a reskinned 5e sheet.

It should scale from one campaign (now) to thousands, and eventually support community-made dungeons, loot and possibly spells.

This doc is a place for ideas. Each idea becomes a planning doc only when we're ready to build it.

## What "done" looks like (eventually)
- A **tabletop mode**, with interfaces for:
  - inventory,
  - levelling,
  - the map: seeing it and taking actions on it,
  - dice rolls.
- Combat run by the app: phases, turn order, Action Die rolls, AP / MP / EP spending and overflow, with the rules checked.
- Players and DMs on the web, the Windows app and phones. Ideally offline for solo use (Brody's opinion still needed).
- Community content: dungeons, loot and spells that players make and share, kept separate from the official rules.
- 3D visualizations where they help (Three.js).

## Proofs of concept so far
These are experiments to learn from. They are **not** foundations to build on until we've agreed a final design.
- **Tabletop** (`tabletop/`, Brody): maps, tokens, fog, chat with dice, character sheets. Firebase sync.
- **Tree mode** (`src/skilltree.js`, Brody): the Class step as a skill tree.
- **3D dice** ([testing/3d-dice.md](../testing/3d-dice.md), Maddox).

## Ideas and questions to work through
- **Who decides what happened in combat?**
  - Each player's device (simple; fine among friends).
  - Server checks on the actions that matter (database functions running the shared rules code).
  - A live game server (most work; needed only for real-time play with strangers).
- **Live sync at scale.**
  - Things that only matter while they're moving (token drags, cursors, pings) go over Supabase **Broadcast**, not saved.
  - Things that last (final positions, chat, handouts) are saved rows.
  - Settle this before building the tabletop on Supabase. It's [supabase-database.md](../planning/supabase-database.md) phase 4, which is on hold.
- **Structured rules.** Effects are prose today. Automating them means turning features, spells and items into data the engine can run.
  This is Brody's design work as much as code, and the biggest piece of the whole goal.
- **Community content.**
  - Content needs stable ids and an owner, so spells can't be keyed by name any more.
  - Each campaign would choose which content it uses.
  - Probably content in the database instead of git, which needs its own decision.
- **Offline:** what works without internet, and how changes merge back. The event-based character state ([planning/character-data.md](../planning/character-data.md)) is meant to make this possible.
- **Paying for it:** at thousands of campaigns, free plans won't do. Is Crawl ever sold? (TBD)

## Features
- [roadmap/playtest-mvp.md](playtest-mvp.md): the first step (active)
- Tabletop on Supabase: [planning/supabase-database.md](../planning/supabase-database.md) phase 4 (on hold)
