# Dice rolling: prototype
**Status:** in progress  ·  **Who:** maddox, brody  ·  **Plan:** [roadmap/playtest-mvp.md](../roadmap/playtest-mvp.md)  ·  **Outcome:** not decided yet

## What we're testing
1. **Speed versus feel.** Is an instant 2D roll (every die shown, dropped dice crossed out) good enough at the table?
   Or do players want the 3D dice ([3d-dice.md](3d-dice.md))?
2. **What to roll from where.** Quick buttons, typed expressions, or tapping the thing on the sheet (an ability, a weapon, the Action Die)?
3. **History.** Should rolls be visible to the DM and the party (later, with campaigns)? Right now they go in the character's own log.

## What we built
- **Where:** Testing → Dice roller (admins only), or `/testing/roll` on the new site. The play sheet also rolls from abilities, skills, weapons, spells and Start turn.
- **Code:** `web/src/app/routes/Roller.tsx` and `web/src/app/play/rolls.ts`, on `web/src/lib/dice.ts`.
  `lib/dice.ts` is `tabletop/dice.js` in TypeScript, with tests. The tabletop keeps its own copy for now.
- **Rolls:**
  - `NdM`, `d%`, keep and drop (`kh`, `kl`, `dh`, `dl`), exploding (`!`), and `+ − × ÷`;
  - quick d4–d100, plus advantage, disadvantage, `4d6kh3` and exploding presets;
  - the open character's Action Die.
- **With a character open on the play sheet,** every roll also goes in that character's log. The open character is remembered for the browser tab.

## Checked so far (2026-11-04)
- Unit tests: totals stay in range, keep and drop, exploding dice, `d%`, arithmetic, and bad input is refused.
- End to end:
  - `4d6kh3` shows 4 dice with one dropped;
  - the Action Die button uses the character's die;
  - rolls reach the character's log;
  - a bad roll shows a message.

## What we learned
-

## Recommendation
Not yet.
