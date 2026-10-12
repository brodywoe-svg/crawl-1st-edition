# Crawl Spell Compendium

Every spell in **Crawl 1st Edition**, in one place. Filter by class or by magic
source (Arcane, Divine, Primal, Occult), open any spell to read its card and its
+1 to +10 advancements, and export a card as a PNG or JPEG.

- **Website:** https://brodywoe-svg.github.io/crawl-spell-compendium/
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
