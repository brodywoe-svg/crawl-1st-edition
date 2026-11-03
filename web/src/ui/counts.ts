/* The live counts on the home and Wiki page cards (<span class="hcount" data-count="classes" hidden>). */
import { loadJson, type ContentFile } from "../lib/data";

/** data-count key -> the file and the list in it to count. */
const COUNTS: Record<string, [ContentFile, (j: any) => unknown]> = {
  classes: ["crawl-classes.json", j => j.classes], races: ["crawl-races.json", j => j.races], backgrounds: ["crawl-backgrounds.json", j => j.backgrounds],
  feats: ["crawl-feats.json", j => j.feats], spells: ["crawl-spells.json", j => j], items: ["crawl-items.json", j => j.items],
  recipes: ["crawl-items.json", j => j.recipes], entries: ["crawl-glossary.json", j => j.entries],
};

/** Fill in every count badge on the page, showing each once its number has loaded. */
export function refreshCounts(): void {
  for (const [k, [file, pick]] of Object.entries(COUNTS)) {
    document.querySelectorAll<HTMLElement>(`[data-count="${k}"]`).forEach(el => {
      loadJson(file).then(j => { const list = j && pick(j); if (Array.isArray(list)) { el.textContent = String(list.length); el.hidden = false } });
    });
  }
}
