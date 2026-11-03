/* Home page (index.html): cards to every part of the site, with live counts from the content files.
   Ported from src/home.js and home_shell() in tools/sitekit.py. */
import "../styles/reset.css";
import "../styles/base.css";
import "../styles/nav.css"; // same cascade order as the old site: page, nav, layout, home
import "../styles/conditions.css";
import "../styles/home.css";
import "../styles/footer.css";
import { fixLinks } from "../config";
import { loadJson, type ContentFile } from "../lib/data";
import { initNav } from "../ui/nav";
import { initTheme } from "../ui/theme";
import { initAdmin, restoreAdmin } from "../ui/admin";
import { ADMIN_BTN, MODE_BTN, TREE_BTN } from "../ui/controls.html";

/** data-count key -> the file and the list in it to count. */
const COUNTS: Record<string, [ContentFile, (j: any) => unknown]> = {
  classes: ["crawl-classes.json", j => j.classes], races: ["crawl-races.json", j => j.races], backgrounds: ["crawl-backgrounds.json", j => j.backgrounds],
  feats: ["crawl-feats.json", j => j.feats], spells: ["crawl-spells.json", j => j], items: ["crawl-items.json", j => j.items],
  recipes: ["crawl-items.json", j => j.recipes], entries: ["crawl-glossary.json", j => j.entries],
};

function refreshCounts(): void {
  for (const [k, [file, pick]] of Object.entries(COUNTS)) {
    const el = document.querySelector<HTMLElement>(`[data-count="${k}"]`); if (!el) continue;
    loadJson(file).then(j => { const list = j && pick(j); if (Array.isArray(list)) { el.textContent = String(list.length); el.hidden = false } });
  }
}

initNav("home", ADMIN_BTN + TREE_BTN + MODE_BTN);
initTheme();
initAdmin();
restoreAdmin();
fixLinks(document.querySelector("main")!);
refreshCounts();
