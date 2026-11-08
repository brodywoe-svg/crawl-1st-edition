# The wiki's content schema, ready for a virtual tabletop
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** [digital-tabletop.md](../roadmap/digital-tabletop.md), with a first slice for [playtest-mvp.md](../roadmap/playtest-mvp.md)
**Needs:** Brody's OK. This changes the shape of game content (CLAUDE.md: shape changes are agreed first), and the structured rules data is a translation of his rules.
**Decision:** "Game content gets a typed schema" in [DECISIONS.md](../DECISIONS.md) (proposed 2026-11-04).

## Goal
Today the wiki's content (`crawl-*.json`) is written for people to read: most mechanics live in prose and loosely formatted strings.
A virtual tabletop needs the same content in a form a program can use:
- to show a player what they can do right now and what it costs;
- to roll the right dice;
- to apply a condition and know what it changes;
- to validate community-made content.

This plan defines one schema for all content, built up in steps. **Brody's prose stays exactly as it is.** The structured data sits beside it, never replaces it.

## Scope
- **In:**
  - stable ids for every record;
  - shared building blocks (cost, roll, damage, effect, modifier, grant, choice);
  - a typed shape for each kind of content;
  - new kinds the tabletop will need;
  - where the data lives during the transition;
  - validation;
  - the order of work.
- **Out:**
  - writing the structured data for all 438 spells: that's ongoing content work, done a slice at a time;
  - moving content into the database (still "`crawl-*.json` stays the source of truth");
  - community content tooling (sketched only).

## What's in the data today (2026-11-04)
| Kind | Where | Machine-readable | Prose or loose strings |
| --- | --- | --- | --- |
| Class | `crawl-classes.json` | `id`, `chart` levels | `chart` pool `"5"` and die `"d4"` as strings; `saves`, `skills`, `prof` free text (the Creator parses the wording); features are `{n, d}` with no id |
| Item | `crawl-items.json` | `id`, `cat`, `sub`, `slot`, `wacts[].ap` | `value: "3 (G)"`, `weight: "2 lbs"`, `props: "Off-Hand, Shield, 5% Armor"`, weapon damage inside `props` text |
| Spell | `crawl-spells.json` | `lv`, `tags`, `comp`, `conc` | **no id** (keyed by name); `cost`, `time`, `range`, `dur`, `dmg` all free text (`"5ft (Touch) (Single Target)"`); trailing spaces in `cat` |
| Glossary | `crawl-glossary.json` | `sec`, `ap`, `req` | **no id**; conditions, properties, actions and damage types all one kind of entry; `req` is a list of names in a string |
| Feat, race, background | their files | `id` | Benefits are prose; race `asi` is `"+1 Constitution"` |

**The constraint that shapes this plan.** Every Admin editor rebuilds each record from a fixed list of fields when it saves:
`normItem` and `normRecipe` (`src/catalog.js`), `normClass`, `normBg` and `normFeat` (`src/crawldata.js`), `normalize` and `normGlossary` (`src/page.html`), and `normPart` (`src/races.js`).
**Any field we add to a `crawl-*.json` record is erased the next time Brody saves that file**, on the old site and on the new one, which runs the same scripts.
Those editors stay until the compendium pages are rebuilt in React (after the MVP, [react-migration.md](react-migration.md)), and the old site's stay until cutover.

## How it works

### Principles
1. **Prose is the rule, structure is how the app runs it.**
   - Every record keeps its text.
   - Structured fields are optional and added a slice at a time.
   - A record without them still shows and still works on the sheet; it's just tracked by hand.
   - The admin screen shows the prose next to the structured version, so they can be checked against each other.
2. **Every record has a stable `id`**, prefixed by kind (`spell-absolution`, `cond-restrained`, `i-buckler`).
   - An id never changes when the name changes, and is never reused.
   - Everything refers to everything else by id, never by name.
3. **Numbers are numbers.** `"5"`, `"3 (G)"` and `"2 lbs"` become `5`, `{cp: 300}` and `2`, and units are fixed by the schema.
4. **One vocabulary across kinds.** A spell's cost, a weapon action's cost and a feature's cost are the same `Cost` type.
   That's what lets one tabletop UI handle all of them.
5. **The schema is code.**
   - TypeScript types plus runtime validation (Zod) in `web/src/lib/content/`, framework-free.
   - It validates content on load and on Admin save.
   - It exports a JSON Schema for community tools later.

### Building blocks (draft)
```ts
type Id = string;                                  // "spell-absolution"
type Ref<K extends Kind> = { k: K; id: Id };       // a typed reference
type Formula = string;                             // "8 + mod.dex + rank.w.bows", evaluated by lib/content/formula.ts
                                                   // (the Creator's spellcasting formulas, fml(), become this)

type Cost = { ap?: number; mp?: number; gainEp?: number; varies?: string };   // spending rules (AP for spells only outside combat…) live in the engine
type Timing = { kind: "action" | "reaction" | "free" | "ritual" | "minutes" | "hours"; amount?: number; trigger?: string };
type Range = { kind: "self" | "touch" | "reach" | "ranged" | "sight"; ft?: number; long?: number;
               area?: { shape: "cone" | "line" | "sphere" | "cube"; ft: number }; targets?: number | "any" };
type Duration = { kind: "instant" | "rounds" | "minutes" | "hours" | "days" | "until"; amount?: number;
                  until?: "turnStart" | "turnEnd" | "combatEnd" | "rest"; conc?: boolean };
type Roll =
  | { kind: "attack"; ability: Ability | "best"; rank?: string }            // "best" = Finesse
  | { kind: "save"; ability: Ability; dc: Formula }
  | { kind: "check"; skill: Id; dc?: Formula };
type Damage = { dice: string; type: Ref<"damage"> };                       // dice in lib/dice.ts syntax

type Effect =                                      // what happens when something resolves
  | { do: "damage"; damage: Damage[]; half?: "onSave" }
  | { do: "heal"; dice: string } | { do: "tempHp"; dice: string }
  | { do: "condition"; cond: Ref<"condition">; duration?: Duration }
  | { do: "gain"; pool: { ap?: number; mp?: number; ep?: number } }        // the Action Pool events (character-data.md)
  | { do: "modify"; mod: Modifier; duration?: Duration }
  | { do: "text"; text: string };                  // not automated yet: shown, applied by hand

type Modifier = { stat: Stat; op: "add" | "set" | "adv" | "dis" | "min"; value: Formula; when?: Situation };
// Stat:      "ac" | "speed.ground" | "carry" | "crit.min" | "save.dex" | "skill.<id>" | "pool.max" | …  (a closed list, grown as needed)
// Situation: "wielding:<item sub>" | "unarmored" | "raging" | …  (also a closed list)

type Grant = {                                     // what a feature, feat, race, background or item gives
  actions?: Ref<"action">[]; mods?: Modifier[]; prof?: { kind: "skill" | "save" | "weapon" | "armor" | "trade" | "lang"; id: Id }[];
  choices?: Choice[]; items?: { item: Ref<"item">; qty: number }[];
};
type Choice = { id: Id; n: string; pick: number; from: Ref<any>[] | { k: Kind; filter: Record<string, unknown> } };
```

### The kinds
| Kind | From | Structured shape (on top of the envelope `{id, n, text…}`) |
| --- | --- | --- |
| **action** *(new as its own kind)* | Glossary "Combat Actions" and "Weapon Actions", item `wacts`, class features that are actions | `cost: Cost, timing, range, roll?, effects: Effect[], requires: Ref[]` (from `req`). **The biggest tabletop win:** "what can I do, and what does it cost" becomes one list |
| **condition** | Glossary "Conditions" | `mods: Modifier[], effects?, ends?: Duration` |
| **property** | Glossary "Properties" | `mods?`, `grant?` (e.g. Two-Handed, Filling) |
| **damage** | Glossary "Damage Types" | Just the envelope: an id to point at |
| **item** | `crawl-items.json` | `value: {cp}, weight: number, slot, props: Ref<"property">[]`, weapon `{damage: Damage[], range, tier, hands}`, armor `{armorPct}`, consumable `{use: Ref<"action">}`, `grant?` |
| **spell** | `crawl-spells.json` | `lv, school: Id, traditions, cost, timing, range, duration, comp, roll?, effects, tiers: [{n, text, effects?}]` |
| **class** | `crawl-classes.json` | `chart: [{lv, pool: number, die: "d4"…}]`, `saves`/`skills`/`prof` as `Grant` + `Choice`, `features: [{id, lv, text, grant?}]`, spellcasting as `Formula`s |
| **feat, race, background** | their files | `grant: Grant`, `pre?: Ref[]`, race `asi` as `Modifier[]` |
| **recipe** | `crawl-items.json` | Already has ids and item refs. Add `dc: Formula`, `time: Duration` |

**New kinds the tabletop will need.** None of these exist in the content yet, and what goes in them is Brody's design:
- **creature:** monster stat blocks, with an Action Pool, Action Die, actions, mods. Needed before a DM can run combat in the app.
- **lootTable:** weighted rolls that produce items (`{dice, rows: [{range, item | table, qty}]}`).
- **dungeon:** a map image, grid, rooms or areas, and placed creatures, loot and notes. The unit of community dungeons.
- **pack:** a bundle of any of the above with an author and version (see "Packs").

### Where it lives during the transition
Because the editors erase unknown fields (see above), the work happens in three stages:

| Stage | When | Where the typed data comes from |
| --- | --- | --- |
| **A. Adapters** | With the MVP | **No file changes.** `lib/content/adapt.ts` reads today's files and converts them on load: `"5"` → `5`, `"3 (G)"` → `{cp: 300}`, glossary sections → kinds, slug ids for spells and glossary entries. Anything it can't parse becomes a `text` effect and a validation warning |
| **B. A side file** | After the MVP | **`crawl-rules.json`**, a new content file the old editors never touch: `{v: 1, ids: {…}, records: {<id>: {structured fields}}}`, merged over the adapted records by id. It's edited from a new React "Rules data" admin screen (prose on the left, structured fields on the right), saved through the existing `github` function |
| **C. Merged** | Once the compendium editors are React and the old site is retired | The structured fields move into each `crawl-*.json` record. Each file's `v` goes up, `crawl-rules.json` and the adapters are deleted, and DATA-MODEL.md is rewritten |

- **The name `crawl-rules.json`:** the `github` function only accepts `^crawl-[a-z]+\.json$`, so one file fits as is. Splitting it per kind later means loosening that pattern.
- **Spell and glossary ids:** the old editors would erase an `id` field too. Until stage C, `crawl-rules.json` keeps a registry of `name → id`.
  If Brody renames an entry, validation reports the orphaned id, and the rules screen offers to re-attach it. That's one click, not lost data.

### Validation
`npm run content:check`:
- validates every content file and `crawl-rules.json` against the schema;
- checks every `Ref` points at something that exists;
- reports orphaned ids;
- prints coverage, e.g. "spells: 12 of 438 automated".

It runs in the Vercel build as **warnings only**, because Admin saves land on `main` directly and must never break the site.

### Packs and community content (sketch)
- Official content is the pack `crawl` (today's files).
- A community pack is a file with the same schema and `{pack: {id, n, author, v}}`. Ids are prefixed by pack (`pack.goblin-warrens/creature-goblin`), so they never clash with official ones.
- A campaign lists the packs it uses.
- Community packs probably live in Supabase Storage or the database, not git. That's its own decision when we get there.

## Steps
- [ ] Brody OKs the approach and the decision. In particular: prose stays his, the structured data is a translation he signs off.
- [x] Stage A, with the MVP (PR B). `npm run content:check` on 2026-11-04: 7 of 13 classes have a usable chart, 234 of 241 item values and 239 weights read, 22 of 23 weapons' damage, 20 conditions, 40 properties, 16 damage types, 32 actions (30 with a cost):
  - `lib/content/` types and Zod schemas for the kinds the play sheet needs (class chart, item, condition, action, damage);
  - the adapters;
  - `content:check`.
- [ ] Stage A, rest: spell, feat, race, background, recipe adapters.
- [ ] Stage B: `crawl-rules.json`, the "Rules data" admin screen, and the first automated slice: conditions and weapon actions (small, and used every combat).
- [ ] Stage C: at cutover, after the compendium editors are React.
- [ ] Later: creature, lootTable, dungeon, packs. Each gets its own plan, and Brody's design first.

## Open questions
- **Who writes the structured data?**
  - Brody, in the rules screen;
  - or Maddox / Claude drafts it from the prose and Brody approves each record.

  The second is faster, but it's translating his rules. CLAUDE.md says we don't rewrite content unless asked, so this needs his explicit yes.
- **Currency:** the code already counts C = 1, S = 10, G = 100, P = 1000 (`COIN` in `src/crawldata.js`). But `src/catalog.js` leaves out platinum (P).
  Brody to confirm the rates, and whether platinum exists.
- **Prose vs structure disagreeing:** which one wins at the table? Proposed: the prose; the structured version is fixed to match.
- **Actions as their own wiki section?** Actions are spread over the glossary, items and class features today. Once they're one kind, an "Actions" page is easy. Brody's call.
- **Creatures:** are monster stat blocks planned as content, and in what format does Brody write them now?
