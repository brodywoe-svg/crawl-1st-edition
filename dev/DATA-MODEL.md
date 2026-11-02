# Data model: the `crawl-*.json` files

_Written 2026-11-02. The header comments in the source files named below are authoritative. Keep this page in sync with them._

All game content is JSON at the repo root. It's edited through the Admin UI and saved with one-space indent plus
a trailing newline. Most files are `{ "v": <version>, "<list>": [...] }`.

| File | Top level | Saved by | Read by | Schema lives in |
| --- | --- | --- | --- | --- |
| `crawl-spells.json` | **bare array** | Spells page, Windows app | Spells, Creator, Tabletop, build | `normalize()` in `src/page.html` |
| `crawl-classes.json` | `{v:1, classes}` | Classes page | Classes, Creator, Tree mode, Glossary, Tabletop | `src/crawldata.js` |
| `crawl-backgrounds.json` | `{v:1, backgrounds}` | Backgrounds page | Backgrounds, Creator, Tabletop | `src/crawldata.js` |
| `crawl-feats.json` | `{v:1, feats}` | Feats page | Feats, Creator, Tree mode, Tabletop | `src/classes.js` |
| `crawl-races.json` | `{v:1, races}` | Races page | Races, Creator, Tabletop | `src/races.js` |
| `crawl-items.json` | `{v:2, items, recipes, presets}` | Items + Crafting pages | those, Creator, Classes (loadouts), Tabletop | `src/catalog.js` |
| `crawl-glossary.json` | `{v, entries}` | Glossary pages | every page (tooltips), Tabletop | `normGlossary()` in `src/page.html` |
| `crawl-creator.json` | `{v:1, rules:{wealth, rank, spellRank, passive, langs}}` | Creator | Creator, Classes, Feats, Tabletop | `src/creator.js` |
| `crawl-tree.json` | `{v:1, nodes, extra, links, unlinks, curves}` (admin overrides only) | Tree mode | Creator | `src/skilltree.js` |
| `crawl-edits.json` | `{v:1, edits:{key:{n, f, c, how, by, at}}}` | automatically on every admin save | Admin history | `recordEdits()` in `src/page.html` |
| `admin.json` | `{v:2, users:[{name, box}]}` | Admin setup | Admin sign-in | see ARCHITECTURE §4. **Never edit.** |

Counts on 2026-11-02:

| Content | Count |
| --- | --- |
| Spells | 438 (38 with descriptions) |
| Classes | 13 (7 with features) |
| Races | 6 |
| Backgrounds | 51 |
| Feats | 35 |
| Items | 241 |
| Recipes | 75 |
| Glossary entries | 127 |

## Records

**Spell**
```
{n, tags:[Arcane|Divine|Primal|Occult], lv:1-20|null,
 f:{pre, cls, mat, cat, cost, time, dur, type, range, desc, dmg},  // all strings; cat = school, may include "(Ritual)"
 comp?:{v, s, m}, conc?:true, tbl?:{h, r, c, cells:[[…]]}, ct?:[custom tags],
 tiers:[[name, text] × 10]}                                         // the +1…+10 advancements
```
There is no `id`. Spells are identified by name.

**Class**
```
{id, n, role, desc, source, cast, spells, hd, hp, saves, skills, skillPts, prof, langs,
 chart:[{lv, pool, die}],                        // Max Pool + Action Die per level
 feats:[{n, d, lv, opts?:[{n,d}], pick?, more?:[levels]}],   // opts = a choice feature like Fighting Style
 loadouts:[{n, gear:[{n, qty, iid}]}], money, moneyRoll, extra:[{k,v}], choices:[{n, cat, opts}],
 prepared, startRank, schoolStart, oppCost, majorLv, minorLv, schools:[{s, opp}],   // spellcasting
 subs:[{id, n, desc, feats, extra}]}
```

**Background**: `{id, n, desc, skills, weapons, armor, trades, prof, langs, choices, gear, wealth, feats:[{n,d}], extra}`

**Race / subrace**: `{id, n, desc, asi, prof, langs, feats:[{n,d}], extra:[{k,v}], subs:[subrace]}`

**Feat**: `{id, n, cat, pre, desc, extra}`. `cat` is one of: Aggro, Control, Roleplay, Fortitude, Weapon Mastery, Spellcraft.

**Item**
```
{id, n, nc, cat, sub, slot, badge, rarity, magic, value, weight,
 actions, wacts:[{n, ap, dmg, type, d}], props, pdefs:[{n,d}], desc, extra}   // weapons also: tier, ap
```

**Recipe**
```
{id, n, tier, badge, kind, prof, pre, ing:[{item, qty}], matNote, applies, ws, time, dc, tc,
 qty:{l,v}, makes:[{item, qty}], props, grants, feat, quote, extra}
```

**Glossary entry**
```
{n, sec, lead, fx:[…], notes:[{l,t}], aka:[{w, ref}], tip,
 tipItems?, tipClasses?, tipFeats?, tipCreator?, hideRefs?, ap?, req?}
```

## Cross-references (easy to break)
- **Recipes reference items by `id`**, and class/background gear references items through `iid`.
- **Tree-mode node keys embed ids:** `cls:<class-id>` and `f:<class-id>:<feature-slug>`.
- **Some things are matched by name:**
  - spells,
  - glossary tooltips (an entry's name and `aka` words are matched in all text),
  - feature-source grouping on the glossary (`feature_sources()` in `tools/build.py`).
- **The creator parses proficiency wording** ("Either X or Y", "Two skills of your choice").
- **The tabletop caches everything except tree, edits and admin** (`tabletop/content.js`). A shape change must work there too.
