# Interactive character sheet
**Status:** draft, for Brody to review  ·  **Owner:** brody (design), builder to be decided  ·  **Roadmap:** none yet. This is the first step toward a fully digital Crawl.

## Goal
A live character sheet that players use **at the table**, not just a printout.
It tracks what changes during play, rolls dice from the sheet, and saves as you go.

It's for:
- **players**, on a phone or laptop during a session;
- **Brody**, as the base that rules automation, the tabletop and the Table App build on later.

One sheet everywhere: the same sheet should later appear in the tabletop and in the in-person Table App, so we build it once.

## Scope
**In (the base, version 1):**
- **A new page, `sheet.html`, on the new site.** It opens from the Character Creator (a **Play** button on a finished character) and from **My characters**.
- **It reads a character the Creator made**, from this browser, or from your account once Supabase phase 2 is live.
- **Two kinds of information, kept apart:**
  - **The build:** what the Creator decided (race, class, scores, proficiencies, features, spells). Shown on the sheet, but changed in the Creator.
  - **Play state:** what changes during a session. The sheet edits this.
- **Play state the sheet tracks:**
  - hit points: current, temporary and max,
  - the Action Pool: current AP against your Max Pool (from the class chart at your level), and the Action Die for your level,
  - MP and EP (see Open questions),
  - conditions (from the Glossary),
  - inventory: quantities, equipped or not, coins,
  - notes.
- **Rolls from the sheet:** ability checks, saving throws, skills, weapon attacks and damage, and the Action Die. Results appear in a small roll log on the sheet.
- **Works offline and saves automatically** to the same character, so it syncs through the account like the Creator does.
- **Phone and laptop** layouts.

**Out (each is a later plan):**
- **Automating features.** For example, Prowess adding AP when you roll the Action Die. Version 1 just gives you the buttons and numbers.
- **Levelling up** (stays in the Creator for now).
- **Combat turns and phases**, initiative, enemies.
- **DMs seeing or changing players' sheets.** That's Supabase phase 3 (campaigns).
- **The tabletop and the Table App** using the sheet.
- **3D dice** (there's a separate prototype).
- **Checking rules on the server.**

## How it works
**Code (new site only).** The old github.io site doesn't change; the printable sheet in the Creator stays as it is.
- `web/src/lib/sheet/`: the numbers, with no page code. Ability modifiers, proficiency, Max Pool and Action Die by level, attack bonuses.
  Where these already exist in `src/creator.js`, they're moved here rather than written twice, so the Creator and the sheet always agree.
- `web/src/pages/sheet.ts` and `web/sheet.html`: the page.
- Dice: the tabletop's `dice.js` parser, moved into `lib/` (the Vite refactor already plans this).

**Data.** No change to `crawl-*.json`.
- A character gets one new part, `play`, next to what the Creator saves. Proposed shape, matching the tabletop's existing `live` so the tabletop can use it later:
  `play: { hp, tmp, ap, mp, ep, conds: [], inv: {}, coins: {}, notes, rolls: [] }`
- It's saved in the same place as the character (this browser, and the `characters` table in Supabase), so no new database table is needed.
- This is a change to the character's shape, so it gets a `DATA-MODEL.md` update in the same PR.

**Plain TypeScript or React (needs a decision).**
The [React plan](react-migration.md) says the first live, rules-heavy screen should be React's trial, after the Vite refactor cuts over. This sheet is exactly that kind of screen. Options:
1. **Build it in plain TypeScript now**, and move it to React later. It's quickest to start, but means rewriting the page later.
2. **Build it as the React trial now.** It's a brand-new page, so it doesn't clash with porting the old pages. This needs Maddox to agree, since it moves his React plan earlier.
3. **Wait** until the refactor has cut over.

Suggestion: **option 2**. The numbers live in `lib/` either way, so only the page itself depends on this choice. Whatever we pick goes in `DECISIONS.md`.

## Steps
- [ ] Brody reviews this plan and answers the open questions below.
- [ ] Brody and Maddox decide plain TypeScript or React for the page (logged in `DECISIONS.md`), and who builds it.
- [ ] `lib/sheet/`: the derived numbers, shared with the Creator.
- [ ] The page, read-only: shows a Creator character on phone and laptop.
- [ ] Play state: HP, the Action Pool, MP, EP, conditions, inventory, notes, saved automatically.
- [ ] Rolls and the roll log.
- [ ] Testing doc in `dev/testing/`; Brody and Maddox try it on a preview link with real characters; ship / iterate / remove.

## Open questions
These are Brody's calls, because they're game rules. The sheet won't guess.
1. **The Action Pool:** when does AP reset or refill? At the start of each turn, at the start of combat, or after a rest? Can it go above Max Pool outside the features that say "can't exceed your Max Pool"?
2. **MP:** does it share the Action Pool's Max Pool, or have its own maximum? How does it refill?
3. **EP (Exhaustion Points):** what's the maximum, what happens at each amount, and how do you lose them?
4. **Rolling:** should the sheet roll dice for you, or only track numbers while players roll real dice? Or both, with a switch?
5. **Editing:** can players fix things like a score or a proficiency on the sheet, or only in the Creator?
6. **Rests:** do we want **Short rest** and **Long rest** buttons? If so, what does each one restore?
7. **Phone or laptop first?** Which one matters most at your table?
