/* Home page (index.html): cards to every part of the site. The counts on the cards are refreshed from the data files,
   so they stay right after admin edits. Runs after the shared admin code. */
const COUNT_FILES = { classes: ["crawl-classes.json", j => j.classes], races: ["crawl-races.json", j => j.races], backgrounds: ["crawl-backgrounds.json", j => j.backgrounds],
  feats: ["crawl-feats.json", j => j.feats], spells: ["crawl-spells.json", j => j], items: ["crawl-items.json", j => j.items], recipes: ["crawl-items.json", j => j.recipes], entries: ["crawl-glossary.json", j => j.entries] };
async function refreshCounts() {
  const cache = {};
  for (const [k, [file, pick]] of Object.entries(COUNT_FILES)) {
    const el = document.querySelector(`[data-count="${k}"]`); if (!el) continue;
    try { cache[file] = cache[file] || fetch(file, { cache: "no-cache" }).then(r => r.ok ? r.json() : null); const j = await cache[file]; const list = j && pick(j); if (Array.isArray(list)) el.textContent = list.length } catch (e) { }
  }
}
AdminHooks.signedIn = () => { }; AdminHooks.signedOut = () => { };
if (STATIC) { $("adminBtn").hidden = false; showAdminBtn(); restoreAdmin(); refreshCounts() }
