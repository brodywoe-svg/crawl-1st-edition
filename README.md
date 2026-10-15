# Crawl Spell Compendium

Every spell in **Crawl 1st Edition**, in one place. Filter by class or by magic
source (Arcane, Divine, Primal, Occult), open any spell to read its card and its
+1 to +10 advancements, and export a card as a PNG or JPEG.

- **Website:** https://brodywoe-svg.github.io/crawl-spell-compendium/
- **Glossary (search every term):** https://brodywoe-svg.github.io/crawl-spell-compendium/glossary.html
- **Conditions:** https://brodywoe-svg.github.io/crawl-spell-compendium/conditions.html
- **Items:** https://brodywoe-svg.github.io/crawl-spell-compendium/items.html
- **Crafting:** https://brodywoe-svg.github.io/crawl-spell-compendium/crafting.html
- **Windows app (works offline):** [Download the installer](downloads/Crawl-Spell-Compendium-Installer.zip)

## Installing the Windows app

1. Download `Crawl-Spell-Compendium-Installer.zip`, right-click it and choose **Extract All**.
2. Open the extracted folder and double-click **Install Crawl Spell Compendium.bat**.
   If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**.
3. The first install downloads the app engine (Electron, about 110 MB) from GitHub and checks
   its fingerprint. After that the app runs fully offline.

The app opens when the install finishes and adds Desktop and Start menu shortcuts.
In the app you can edit spells, add new ones and export cards; changes save
automatically to `%APPDATA%\Crawl Spell Compendium\spells.json`.
Run `Uninstall.bat` to remove the app; your saved spells are kept.

## Admin editing on the website

Click **Admin** (right side of the black header on the Spells page) and enter the admin password to unlock
**Edit** on every spell, plus **Add spell**, **Import data** and **Export data**.
**Save changes** writes `crawl-spells.json` to this repo, and the public site
updates for everyone in about a minute. Visitors without the password see a
read-only site.

How it works: the site has no server, so the password protects a GitHub access
key instead. `admin.json` holds that key encrypted with AES-256-GCM, using a key
derived from the password with PBKDF2-SHA256 (600,000 rounds). Typing the right
password decrypts the GitHub key in your browser for that tab only.

**First-time setup / changing the password**

1. On GitHub, make a fine-grained access key at
   <https://github.com/settings/personal-access-tokens/new>: under
   **Repository access** choose **Only select repositories** → this repo, and under
   **Permissions → Repository permissions** set **Contents** to **Read and write**.
2. On the site, click **Admin → First time? Set up admin access**, paste the key,
   and choose a password of at least 12 characters (a few random words works well).

Because `admin.json` is public, the password is what keeps the key safe: use a
long one. Repeat the setup any time to change the password or replace an
expired key.

## Editing the glossary

Signed in as admin, open **Glossary** or **Conditions**. Every entry gets an
**Edit** button, and **Add entry** adds a new one. Put an entry in the
**Conditions** section to show it on the Conditions page too; any other section
name (for example *Keywords*) makes a new section on the Glossary page. Click
**Save changes** to write `crawl-glossary.json`.

Glossary names show in red, underlined, in spell text (when a spell isn't being
edited). Hover over one, or tap it on a phone, to see its tooltip. Under
**Tooltip words**, click **Create tooltip word** to add other words (for example
*Target Area*), each with its own tooltip text; leave the text empty to show the
whole entry.

In the editor, leave a blank line between paragraphs. The **Text color** sidebar
appears on the right while you edit: select text in any box and click a color. This
adds `[color=#hex]...[/color]` around it; **Remove color** takes it off. The preview
shows the result.

Searching the glossary lists the best matches first: entries whose name matches,
then tooltip words, then entries that only mention the word.

Every glossary section gets its own page and a link in the **Glossary** menu
(for example *Combat Rules* → `glossary.html?s=combat-rules`). Typing a new
section name on an entry creates the section.

## Races

The **Races** page lists each race with its description, ability score
increases, starting proficiencies, languages, features (name in red, then what it
does) and any extra details such as Size or Speed, followed by its subraces. Signed
in as admin: **Add race**, **Edit** on a race, **Add a subrace to …** under a race,
and **Edit** on a subrace. Saves to `crawl-races.json`.

## Character Creator

`creator.html` builds a character in ten steps, Baldur's Gate style: Race,
Class, Background, Abilities, Skills, Proficiencies, Spells, Equipment,
Appearance and Name. A description panel on the right shows whatever choice
you point at. The steps pull from the rest of the site:

- **Races** come from `crawl-races.json`.
- **Spells** come from `crawl-spells.json`, filtered by the class's magic source.
- **Gear** comes from `crawl-items.json`, priced in the same (G)/(S)/(C) money.
- **Conditions and tooltip words** come from the glossary.

Ability scores roll **4d6 and drop the lowest**, with Reroll, Store, Recall and
click-to-swap; they can also be typed in by hand. Proficiency text is read
automatically:

- Named skills, weapon types, armor and trade skills are granted.
- "Either X or Y" becomes a choice.
- "Two skills of your choice" becomes free picks.

Finishing opens a three-page character sheet laid out like the paper one. Every
box on it can be typed into, and **Print or save as PDF** fits each page on one
letter page. Characters are saved in the browser, and **Save to file** /
**Open a character file** moves them between devices.

Classes come from the **Classes** page and backgrounds from the **Backgrounds**
page, so anything added there can be chosen in the creator. In the creator:

- **Skill Points** from the class are one pool, spent only on things the character is
  proficient in: skill and saving throw ranks (Skills step), Weapon, Armor and Trade Skill
  Proficiency ranks (+1 to +10 circles on the Proficiencies step) and spell Ranks (Spells
  step). Becoming proficient in a saving throw costs 3 skill points (set under Edit
  creator rules).
- **Spells:** click a spell's name to keep its description in the right-hand panel until
  you click another spell or click away.
- **Equipment** offers the class's loadouts, or its Starting Currency to buy gear
  instead; a background's gear and wealth are added on top.
- The sheet fills Max Pool and Action Die from level 1 of the class chart, and
  lists the class and subclass features gained at level 1.

Signed in as admin, **Edit creator rules** sets the standard starting wealth,
starting skill rank, highest starting spell rank, passive base and suggested
languages. These save to `crawl-creator.json`.

## Classes and Backgrounds

The **Classes** page shows each class with its class chart on the left (Level,
Max Pool, Action Die, Features) and a scrolling box of its features on the right;
click a feature in the chart to jump to it. Below that are hit die and hit
points, Saving Throws, Starting Skill Proficiencies, Skill Points, other
proficiencies, languages, magic source and Equipment Loadouts with the Starting
Currency alternative, then subclasses. Signed in as admin: **Add class**,
**Edit** (with **Fill in levels 1 to 20** for the chart, features with the level
they're gained, and loadouts built from Items page gear), and **Add a subclass**.
Saves to `crawl-classes.json`.

Each class also has **Roll for Starting Currency** (for example `4d8 (G)`), rolled
when a player reaches Equipment in the creator and added to the Starting Currency,
and **Spellcasting details** for casters: a Prepared spells formula, the highest
spell Rank formula (formulas can use STR…CHA modifiers, `level`, `floor()`,
`ceil()`, `max()`, `min()`), the Rank spells start at, the Rank Major and Minor
spells start at, the levels the Major and Minor are chosen, the skill-point cost
per Rank for the Opposing School, and the list of schools with their Opposing
Schools. The creator uses these to ask for the Major (and Minor), tag spells as
Major / Minor / Opposing, let skill points raise spell Ranks, and fill Prepared
spells, Arcane Major/Minor and spell Ranks, DCs and attack bonuses on the sheet.

**Backgrounds** have separate Skill, Weapon, Armor, Trade Skill and Language
Proficiency fields, and both classes and backgrounds have **Proficiency choices**:
"Choose N skills / saving throws / weapon or armor proficiencies / trade skills /
languages from" a group you tick. The creator shows these as pick-lists.

In the creator, **weapon and armor proficiency** can be bought for 3 skill points per
type (Simple, then Martial, then Exotic; set under Edit creator rules). Bought
proficiency starts at rank +0 and can then be raised with skill points.

**Charts in descriptions:** while editing, the sidebar's **Insert a chart** button
adds a small chart: `[table]` … `[/table]`, one row per line, cells split by `|`,
the first row is the heading. Select tab-separated lines first to turn them into
a chart. Charts work in any description on the site.

The **Backgrounds** page works the same way for backgrounds: skill and other
proficiencies, languages, starting gear, starting wealth and features. Saves to
`crawl-backgrounds.json`.

## Items and Crafting

The **Items** page is a chart grouped by category: Weapons (by weapon type), Armor
(by armor type, then slot), Consumables, Crafting Materials and Magic Items. Each row shows the
item's name, rarity, a Magic? check box, value and weight; click it to see its properties, weapon actions,
description and crafting recipe. Signed in as admin, click **Edit** on any row, or
use **Add item**. The **Items** menu opens one category at a time (Weapons, Ammunition, Armor,
Consumables, Materials, Magic Items), e.g. `items.html?c=weapons`.

The **Crafting** page is a chart of recipes by profession (Recipe, Yield, DC, TC,
Time). Click a recipe to open its card, in the same layout as the Crafting
Compendium, with the item it yields shown beside it (category, rarity, value,
weight and properties come straight from the Items page). The card shows: tier badge, prerequisites, material cost, workstations,
time, DC and TC, servings or batch, yield, features and the quote. Materials and
yields link to their items. Typing a new item name in a recipe creates that item
(under Crafting Materials). Both pages save to `crawl-items.json`.

Signing in as admin lasts for the browser tab, across all pages, until you
click **Admin · Sign out** or close the tab.

## Keeping everything in sync

The spell list lives in [`crawl-spells.json`](crawl-spells.json).

- **App → website:** in the app, click **Export data** to save `crawl-spells.json`,
  then replace the file of the same name in this repo (on GitHub: open the file,
  click the pencil or **Add file → Upload files**, and commit). The website shows
  the new list within a minute or two.
- **Website → app:** click **Export data** on the website, then **Import data** in the app.

## What's in this repo

| Path | What it is |
| --- | --- |
| `index.html` | The GitHub Pages website (read-only, loads `crawl-spells.json`) |
| `crawl-spells.json` | The spell list |
| `src/page.html` | The page template shared by the website and the app |
| `crawl-glossary.json` | The glossary entries (all the conditions, plus any keywords you add) |
| `src/glossary.js` | The Glossary and Conditions pages: search, and admin editing |
| `crawl-items.json` | Items and crafting recipes |
| `src/catalog.js` | The Items and Crafting pages |
| `crawl-races.json` | Races and subraces |
| `src/races.js` | The Races page |
| `crawl-creator.json` | Character Creator rules |
| `crawl-classes.json` | Classes, subclasses, class charts and loadouts |
| `crawl-backgrounds.json` | Backgrounds |
| `src/classes.js` | The Classes and Backgrounds pages |
| `src/crawldata.js` | Class and background data shared by those pages and the creator |
| `src/creator.js` | The Character Creator page and character sheet |
| `src/editkit.js` | The Text color sidebar shared by the editing pages |
| `tools/sitekit.py` | The top navigation bar and the Glossary and Conditions page layouts |
| `app/` | The Windows app (Electron) |
| `installer/` | Install and uninstall scripts for Windows |
| `downloads/` | The ready-to-download installer zip |
| `tools/build.py` | Rebuilds `index.html`, `app/index.html` and the installer zip |

To rebuild after changing `src/page.html`: `python tools/build.py`

## License

- **Code** (template, app, installer and build scripts): [MIT](LICENSE)
- **Game content and the Crawl logo:** © 2026 Brody Woelke, all rights reserved — see [CONTENT-LICENSE.md](CONTENT-LICENSE.md)
- Includes material from the SRD 5.1 by Wizards of the Coast LLC, licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode).
- Third-party software: see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)
