# Playtest MVP: players track their characters on the site
**Status:** active  ·  **Owner:** maddox, brody

## Goal
Session 1 of the first campaign is played on paper, to playtest the core system.
By **session 2** (a couple of weeks after session 1; date to confirm), players should be able to use the website to make their character and track it during play,
in one campaign, with the DM able to see the party.

This is the first step toward a fully digital Crawl ([digital-tabletop.md](digital-tabletop.md)).
It's built so the step after it doesn't mean starting over, but it doesn't try to be that step.

## What "done" looks like
- Each player has an account and their character saved to it (Supabase phase 2, already built).
- During a session, a player can track on their phone or laptop:
  - HP, the Action Pool (AP / MP / EP), conditions, inventory and money;
  - Action Die and other dice rolls, with a history.
- One campaign: players join with a code, and the DM sees the party's characters, live.
- Brody can change rules between sessions and everyone's sheet follows.
- Session 2 runs on it without anyone falling back to paper.

## Order of work
1. **Character data and the state system** (planning): the shape everything else builds on.
2. **Prototypes** (testing): the stat display / play sheet, and dice rolling. They answer what players need to see at a glance, and how rolling should feel.
3. **Build the agreed version**, and a cut-down campaign (join by code, the DM's party view).
4. **Switch on the backend:** [planning/backend-setup-checklist.md](../planning/backend-setup-checklist.md) (needed by step 3 at the latest).

## Not in the MVP
- The map, tokens and a full tabletop mode ([digital-tabletop.md](digital-tabletop.md)).
- Levelling up, unless playtesting shows it's needed by session 2.
- DM change proposals: [supabase-database.md](../planning/supabase-database.md) phase 3, deferred.
- Homebrew and community content.
- Rules enforcement beyond the Action Pool, HP and conditions.

## Features
- [planning/character-data.md](../planning/character-data.md): character data and the state system (planning)
- Stat display / play sheet prototype: not started (testing)
- Dice rolling prototype: not started (testing). Builds on [testing/3d-dice.md](../testing/3d-dice.md) and `tabletop/dice.js`
- Campaigns, cut down: from [planning/supabase-database.md](../planning/supabase-database.md) phase 3 (planning)
- [planning/backend-setup-checklist.md](../planning/backend-setup-checklist.md): switching on Supabase (planning)
