# Character data and the state system
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** [playtest-mvp.md](../roadmap/playtest-mvp.md)
**Needs:** Brody's eye on the events table in "Events: the state system" (its rules come from his glossary text, and playtesting will change them).

## Goal
One shape for a character that the Creator, a play sheet, a DM's party view and, one day, a full digital tabletop can all share.
It has to work for the MVP (players tracking one campaign's characters in session 2) without a rewrite when we get to thousands of campaigns and automated rules.

## Scope
- **In:**
  - the character's shape, in three layers;
  - the play state and the events that change it;
  - where the code lives;
  - how it's saved and synced;
  - moving today's saved characters across.
- **Out:**
  - the play sheet's look: that's the stat display prototype (see Steps);
  - campaigns: [supabase-database.md](supabase-database.md) phase 3;
  - levelling: later, but the shape has room for it;
  - homebrew and community content;
  - rules automation beyond the Action Pool, HP and conditions.

## What exists today
- **The Creator's character** (`blankChar()` in `src/creator.js`, `v: 1`) mixes four things in one object:
  - **choices:** `race`, `sub`, `cls`, `subcls`, `bg`, `base`/`dice`/`asi` (abilities), `prof`, `choice`, `fopt`, `rank`, `spells`, `langs`, `inv`, `details`;
  - **overrides:** `sheet`, free text keyed by field (`hpmax`, `pool`, `ad`, `ac:Natural`…), typed onto the printable sheet;
  - **a computed copy:** `snap`, worked out on every save for the tabletop, which has no rules engine;
  - **Creator UI state:** `step`, `seen`, `done`.
- **No play state.** Current HP, Action Pool contents and conditions exist only in the tabletop proof of concept (`chars.live`), per game.
- **Level is fixed at 1** (`const LEVEL = 1`).
- **References:** races, classes, backgrounds and items are referenced by `id`; **spells by name** (DATA-MODEL.md).

## How it works

### Three layers
| Layer | What | Changes when | Saved? |
| --- | --- | --- | --- |
| **Build** | The player's choices: race, class, background, abilities, proficiencies, ranks, spells known, feature options, details, level | Creating, levelling up, retraining | Yes |
| **State** | What happens in play: HP, the Action Pool, conditions, inventory, money, XP, notes | Every few seconds during a session | Yes |
| **Derived** | Every number worked out from build + state + content: max HP, AC, Max Pool, Action Die, saves, skills, attacks, spell DCs | Never by hand | **No.** Calculated every time |

**Why derived numbers aren't saved.** Brody will change rules between playtests. If a class's Max Pool changes, every sheet should follow the change, not keep the old number.
The `snap` the Creator saves today goes stale exactly like that.

**Overrides stay, on purpose.** Rules are still mostly prose, so players will need to say "my AC is actually 15".
- An override is a separate, named layer on top of derived numbers: `overrides: {"ac": 15}`.
- The sheet shows overridden numbers marked as such.
- An override is easy to clear once the rules handle the case.
- Today's `sheet` text fields become this.

**Inventory** starts in the build (the class loadout the Creator picks), but after creation it's state, because it changes in play. The Creator seeds `state.inv` from the build.

```ts
type Character = {
  v: 2;
  id: string;                      // "pc_…", as today
  name: string;
  build: Build;                    // today's choice fields, plus level
  state: PlayState;
  overrides: Record<string, number | string>;
  log: Event[];                    // recent events, newest last, capped (see below)
  made: number; edited: number;
  creator?: { step: number; seen: object; done: boolean };   // Creator UI only
};

type PlayState = {
  mode: "explore" | "combat";
  hp: number; tempHp: number;
  pool: { ap: number; mp: number; ep: number };   // what's in the Action Pool now
  conds: string[];                 // glossary condition names (ids later)
  inv: { iid?: string; n?: string; qty: number; slot?: string }[];
  money: number;                   // in the smallest coin, as the Creator counts it
  xp: number;
  conc?: string;                   // the spell being concentrated on
  notes: string;
};
```

### Events: the state system
State is never edited field by field. Every change is an **event**, applied by one pure function:

```ts
apply(state, event, derived) → { state, warnings }
```

| Event | Effect (from the glossary as written today) |
| --- | --- |
| `combatStart` | Pool empties except EP; `mode = combat` |
| `turnStart {roll, bonus}` | Gain AP from the Action Die roll, plus bonuses (Prowess, Channeling…). AP left from last turn is lost first |
| `gain {ap, mp, ep}` | Add points; if over Max Pool, the player chooses what to keep (**overflow**). EP is never lost to overflow |
| `spend {ap \| mp, n}` | Remove points. AP can't pay for spells in combat; MP can't pay for actions |
| `combatEnd` | Pool empties except EP; `mode = explore` |
| `rest {hours}` | Remove 1 EP per 2 hours |
| `damage {n}`, `heal {n}`, `tempHp {n}` | Temp HP absorbs damage first |
| `cond {add \| remove}` | Conditions on or off |
| `item {add \| remove \| qty \| slot}`, `money {delta}`, `xp {delta}` | Inventory and wealth |
| `roll {expr, result, label}` | Records a dice roll (it changes nothing else) |
| `set {path, value, why}` | Escape hatch: a manual correction, logged |

- In Exploration, the sheet shows a steady 3 AP that returns after each action. The engine doesn't track it.
- **The death rule** (pool full of EP) and overflow come back as **warnings** and choices for the player to confirm. The engine never decides silently.

**Why events instead of editing fields:**
1. **Undo.** "I clicked damage twice" is one tap to undo, at the table.
2. **History.** The DM and the player can see what happened ("took 7, spent 3 AP on Rage"). That's the playtest data Brody needs to balance the system.
3. **One place for the rules.** `apply` *is* the rules engine, starting small: Action Pool, HP, conditions. Automating more of Crawl means adding events, not rewriting the sheet.
4. **It scales without a rewrite.**
   - The future tabletop sends the same events over the network.
   - A server can run the same `apply` to check them.
   - Two people editing at once can be merged event by event instead of overwriting each other.

**The log is capped:** the newest 500 events stay with the character. Nothing reads past that, so it's history, not the source of truth.
A full history, if we want one, becomes its own table later.

### Where the code lives
All of it is pure TypeScript in `web/src/lib/`, with no DOM, so it can later run in an Edge Function or under React:

| File | What |
| --- | --- |
| `lib/character/types.ts` | `Character`, `Build`, `PlayState`, `Event` |
| `lib/character/derive.ts` | `derive(build, state, content) → Derived`. Ports the Creator's maths (`profState`, `skillTotal`, `hpOf`, `chartRow`, `weaponLine`…) out of `src/creator.js` |
| `lib/character/apply.ts` | `apply()` and the events |
| `lib/character/migrate.ts` | `v: 1` (the Creator's object) → `v: 2` |
| `lib/dice.ts` | The dice parser, moved from `tabletop/dice.js` so the sheet and the tabletop share it |

Porting the maths into `derive.ts` comes first. The Creator is then rebuilt in React on top of it ([react-migration.md](react-migration.md)), and writes the new shape directly.

### Saving and syncing
- **Today's sync stays.** The working copy is in `localStorage`, synced to the `characters` table by `lib/characters.ts`, and the newer `edited` wins.
  This is enough for the MVP because **only the player writes their character**; the DM only reads.
- **The `characters` table:** keep `data jsonb`, now holding the `v: 2` character. Add a small `summary jsonb`
  (name, race, class, level, HP, portrait), written on save, for the party view. Then phase 3's `campaign_party()` reads it without opening the full sheet.
- **The DM's party view, live:** Supabase Realtime on the `characters` rows of the campaign. That's tens of rows, so it's fine at this scale.
- **Later, when the DM or the tabletop also writes play state:** sync by sending events instead of whole characters. The shape already allows it; nothing here has to change.
- **Offline:** the sheet works from `localStorage` and syncs when it's back online. The site needs to be cached for a full offline start; that's a separate, small step.

### Moving existing characters
`migrate()` runs on load, **on the new site only**. The old site is frozen for session 1 and keeps its own `v: 1` characters ([react-migration.md](react-migration.md)):
- choices → `build`;
- `sheet` → `overrides` where the key is a number we derive, the rest kept in `build.sheetNotes`;
- a fresh `state`: full HP, empty pool, `inv` from the build;
- `snap` dropped;
- `creator` UI fields kept.

- The two sites are on different addresses, so their browser storage never mixes. A session 1 character comes across through **Save to file** on the old site and **Open** on the new one.
- Characters already synced to an account (the new site, phase 2) are migrated the first time they load.
- **Decided 2026-11-04 (Maddox):** the old site stays exactly as it is, so it never sees `v: 2`.

## Steps
- [ ] Brody reads the events table and corrects anything that isn't how Crawl works.
- [ ] Settle the open questions below.
- [ ] `lib/character/types.ts`, `apply.ts` (Action Pool, HP, conditions) and `lib/dice.ts`.
- [ ] `derive.ts`: port the Creator's maths, checked against the Creator's own numbers for a few test characters.
- [ ] `migrate.ts`, tested on characters saved by the old Creator (files and localStorage).
- [ ] Prototypes (testing stage): the stat display / play sheet, and dice rolling, both built on these modules. Each gets a doc in `dev/testing/`.
- [ ] Update DATA-MODEL.md with the character shape when this ships.

## Open questions
- **Play state per character, or per character per campaign?** A character in two campaigns at once would need two states. Proposed: per character for now (one campaign).
- **Who can change play state?** Proposed for the MVP: the player only, the DM watches. The earlier plan says the DM controls play state on the tabletop; that's phase 4.
- **Rolls:** trust the player's device for the playtest? Server-side rolls only matter once strangers play together.
- **Spells by name:** fine for the MVP. Community spells will need ids (DATA-MODEL.md), and it's a content-shape change, so it's Brody's call when.
- **XP and levelling:** does Crawl use XP, milestones, or both?
- **Money:** one number in the smallest coin, or coins kept separately (gp, sp, cp)?
