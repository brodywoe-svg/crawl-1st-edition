# Wiki menu
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** none yet

## Goal
The top bar has 12 items. On anything narrower than a wide laptop it squeezes, then turns into a sideways-scrolling row.
Eight of the items are reference sections. Grouping them under one **Wiki** tab makes the bar short and clear,
and leaves room for what's coming (accounts, the digital rules, 3D):

```
HOME   CHARACTER CREATOR   WIKI ▾   TABLETOP   ABOUT
```

## Scope
- **In:**
  - A **Wiki** dropdown listing Classes, Races, Backgrounds, Feats, Spells, Items, Crafting and Glossary, then "All of the Wiki →".
  - A new **`wiki.html`** landing page with a card per section and live counts, like the home page cards.
  - The Wiki tab is underlined on every Wiki page.
- **Out:**
  - **The per-section submenus** (every class, every race, spells by source and class, item categories, crafting trades, glossary sections).
    The dropdown links only to the sections; each page already has its own filters and search (see "What we lose").
  - **The old site.** The new nav is only on the new (Vercel) site.
  - Search across the whole Wiki. That's a good next step, but a separate plan.

## How it works
- **Nav:** `web/src/ui/nav.ts`, the `NAV_ITEMS` list. The section dropdowns become one `Wiki` entry with a plain list.
  - The code that fills the Races, Classes, Backgrounds, Feats and Glossary menus from the JSON goes away.
    The old scripts still call `window.crawlNavList` and `crawlNavSections`, so those stay as harmless no-ops.
  - **Phones** get the same short list instead of today's long scrolling menus.
- **Wiki page:** `web/wiki.html` plus `web/src/pages/wiki.ts`. It reuses the home page's card markup, styles (`home.css`) and live counts.
- **What we lose:** today you can jump straight to, say, Wizard spells or one class from the menu. After this, you click into the section and pick there.
  Each section already offers that on its page:
  - **Spells:** class and magic-source filter buttons.
  - **Items and Crafting:** a category or trade picker (`?c=` / `?p=`).
  - **Glossary:** section pages (`?s=`).
  - **Classes, Races, Backgrounds and Feats:** the full list on the page, plus search.

  Old links keep working, because the URLs don't change.

## Steps
- [ ] Brody OKs the idea and the wording ("Wiki"?) in this plan's PR.
- [ ] Nav: the Wiki dropdown, Wiki marked as current on its pages, the list-menu code removed.
- [ ] `wiki.html`, with cards and counts.
- [ ] Check it on desktop and at phone width, then update `dev/ARCHITECTURE.md` §11.

## Open questions
- **The name:** "Wiki", or something more in-world, such as "Compendium" or "Rules"?
- **The home page:** it already has a card for every section. Keep both (home = start here, Wiki = reference), or make the Wiki page the home page's job?
- **Combat:** the home page has a Combat card (`glossary.html?s=combat`). Should Combat get its own line in the Wiki menu, since it's the most-used glossary group?
- **About:** it's still "Soon". Keep it in the bar, or hide it until it exists?
