# Play sheet: prototype
**Status:** in progress  ·  **Who:** maddox, brody  ·  **Plan:** [planning/character-data.md](../planning/character-data.md), [roadmap/playtest-mvp.md](../roadmap/playtest-mvp.md)  ·  **Outcome:** not decided yet

## What we're testing
1. **The state system.** Do the events in [character-data.md](../planning/character-data.md) cover what happens at the table? Do they follow the glossary's Action Pool rules the way Brody means them?
2. **What a player needs at a glance.** Which numbers belong at the top, and what can be tucked away?
3. **Phone or laptop.** Is it quick enough to use mid-combat on a phone?
4. **Sharing characters with the old Creator.** The additive format: the Creator's fields stay where they are, with `state`, `log`, `logBase` and `overrides` next to them.

## What we built
- **Where:** Testing → Play sheet (admins only), or `/testing/sheet` on the new site. `?sample=1` opens a sample character that's never saved.
- **Code:** `web/src/app/routes/PlaySheet.tsx`, `web/src/app/store/character.ts`.
  - The rules are in `web/src/lib/character/` (`apply.ts`, `derive.ts`, `migrate.ts`) and `web/src/lib/content/` (stage A of the content schema). Both have tests (`npm test`).
- **Characters:** the ones the Character Creator saved in this browser (`localStorage crawl-characters`), and your account's once Supabase is on.
  - The sheet adds play state to the same object, so the Creator and the sheet share it.
  - An open Creator tab reloads when the sheet saves, so it doesn't overwrite play state.
- **On the sheet:**
  - HP with damage, heal and temp HP;
  - the Action Pool as slots (AP / MP / EP) with Exploration/Combat, Start turn (rolls the Action Die, asks what to keep on overflow), spend and gain, and rest;
  - conditions from the glossary;
  - abilities, saves and skills (tap to roll);
  - weapons (damage rolls), actions with AP costs, spells (MP in combat, AP in Exploration);
  - gear, money and XP;
  - Adjust (Max HP and Max Pool overrides);
  - a log with Undo; notes.
- **Not worked out yet:** most numbers come from the old Creator's saved `snap`. Attack bonuses aren't calculated. The full maths comes with the React Creator.

## Checked so far (2026-11-04, Maddox's machine, headless Edge)
An automated run against a saved Fighter: 34 of 34 checks passed, with no page errors. It covered:
- damage, temp HP and healing;
- combat turns: AP replaced each turn, not added up;
- EP surviving the end of combat;
- undo;
- a reload keeping everything;
- the death warning;
- refused spending;
- money;
- the old Creator still loading the played character, with its ability scores untouched;
- the sample never being saved.

## Questions for Brody (from building it)
- **EP and a full pool.** The glossary says EP "can't be lost to overflow", but not what happens when new EP doesn't fit.
  We push out AP first, then MP. Is that right?
- **Temporary HP.** We keep the higher amount (as in the SRD) instead of adding them up. Right for Crawl?
- **Classes without a chart.** Cleric, Druid, Paladin, Sorcerer and Warlock have no Max Pool / Action Die chart yet, and Ranger's rows are blank.
  Those characters need a Max Pool set by hand under Adjust.
- **Exploration.** The sheet shows the steady 3 AP and doesn't use it up. Spending MP in Exploration is allowed if you have it. Right?

## What we learned
-

## Recommendation
Not yet: try it in a real session first.
