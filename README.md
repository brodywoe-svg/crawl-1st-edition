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
