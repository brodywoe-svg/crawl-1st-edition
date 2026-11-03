/* Start-up for the page scripts still shared with the old site (src/*.js and the Spells script in src/page.html).
   web/vite/legacy-pages.ts bundles those scripts into one module per page, the way tools/build.py concatenated them,
   and starts that module with `const {...} = await boot(page)`. boot does what the old build baked into every page:
   it sets up the nav, theme and admin, and loads the data the page reads at start-up (the old embedded snapshots).
   As pages are rewritten as real TypeScript modules, they stop going through here. */
import { initNav } from "../ui/nav";
import { initTheme } from "../ui/theme";
import { initAdmin } from "../ui/admin";
import { ADMIN_BTN, MODE_BTN, TREE_BTN } from "../ui/controls.html";
import { loadJson, type ContentFile } from "../lib/data";

export type LegacyPage = "glossary" | "conditions" | "items" | "crafting" | "races" | "classes" | "backgrounds" | "feats" | "creator" | "spells";

/** What each page's scripts expect to find already defined (the prelude in tools/build.py glossary_page()). */
const NEEDS: Record<LegacyPage, string[]> = {
  glossary: ["FEAT_SRC"], conditions: ["FEAT_SRC"], items: [], crafting: [], races: ["RACES"],
  classes: ["CREATOR", "CLASSES", "BACKGROUNDS", "SCHOOLS"], backgrounds: ["CREATOR", "CLASSES", "BACKGROUNDS", "SCHOOLS"],
  feats: ["CREATOR", "FEATS", "CLASSES", "BACKGROUNDS", "SCHOOLS"],
  creator: ["RACES", "CREATOR", "SPELLS", "FEATS", "TREE", "CLASSES", "BACKGROUNDS", "SCHOOLS"],
  spells: ["SPELLS"],
};

/** Data constant -> its file, and what to use if the file is missing (tools/build.py read_json's defaults). */
const FILES: Record<string, [ContentFile, () => unknown]> = {
  GLOSSARY: ["crawl-glossary.json", () => ({ v: 1, entries: [] })],
  CATALOG: ["crawl-items.json", () => ({ v: 1, items: [], recipes: [] })],
  RACES: ["crawl-races.json", () => ({ v: 1, races: [] })],
  CREATOR: ["crawl-creator.json", () => ({ v: 1, rules: {} })],
  SPELLS: ["crawl-spells.json", () => []],
  FEATS: ["crawl-feats.json", () => ({ v: 1, feats: [] })],
  TREE: ["crawl-tree.json", () => ({ v: 1, nodes: {}, extra: [], links: [], unlinks: [] })],
  CLASSES: ["crawl-classes.json", () => ({ v: 1, classes: [] })],
  BACKGROUNDS: ["crawl-backgrounds.json", () => ({ v: 1, backgrounds: [] })],
};

/** The schools of magic named on spells (their Category), without notes such as (Ritual). */
const spellSchools = (spells: any[]) =>
  [...new Set(spells.map(s => String(s?.f?.cat || "").replace(/\s*\(.*?\)/g, "").trim()).filter(Boolean))].sort();

type Src = { n: string; lv?: number; href: string };
/** Feature name -> where it comes from, so the glossary can group actions under the feature they come from. */
function featureSources(d: Record<string, any>): Record<string, Src[]> {
  const out: Record<string, Src[]> = {};
  const put = (name: string, src: Src) => {
    if (!name) return; const list = (out[name] ||= []);
    if (!list.some(x => JSON.stringify(x) === JSON.stringify(src))) list.push(src);
  };
  const n = (x: any) => String(x?.n || "").trim();
  for (const k of d.CLASSES.classes || []) {
    for (const f of k.feats || []) put(n(f), { n: k.n || "", lv: f.lv || 1, href: "classes.html#" + (k.id || "") });
    for (const s of k.subs || []) for (const f of s.feats || []) put(n(f), { n: `${s.n || ""} (${k.n || ""})`, lv: f.lv || 1, href: "classes.html#" + (s.id || "") });
  }
  for (const r of d.RACES.races || []) for (const f of r.feats || []) put(n(f), { n: r.n || "", href: "races.html#" + (r.id || "") });
  for (const f of d.FEATS.feats || []) put(n(f), { n: "Feat", href: "feats.html#" + (f.id || "") });
  for (const b of d.BACKGROUNDS.backgrounds || []) for (const f of b.feats || []) put(n(f), { n: (b.n || "") + " background", href: "backgrounds.html#" + (b.id || "") });
  return out;
}

declare global { interface Window { CRAWL_STATIC?: boolean; GL_PAGE?: string; crawlApp?: unknown } }

/** Set up the page and load its start-up data. Returns the constants the page's scripts read. */
export async function boot(page: LegacyPage): Promise<Record<string, any>> {
  window.CRAWL_STATIC = true; // the old "GitHub Pages" mode: fetch fresh data and offer Admin
  if (page !== "spells") window.GL_PAGE = page;
  document.documentElement.classList.add("hasnav");
  initNav(page, ADMIN_BTN + (page === "spells" ? "" : TREE_BTN) + MODE_BTN);
  initTheme();
  initAdmin();

  const want = new Set(["GLOSSARY", ...(page === "spells" ? [] : ["CATALOG"]), ...NEEDS[page]]);
  if (want.has("FEAT_SRC")) ["CLASSES", "RACES", "FEATS", "BACKGROUNDS"].forEach(k => want.add(k));
  if (want.has("SCHOOLS")) want.add("SPELLS");
  const d: Record<string, any> = {};
  await Promise.all([...want].filter(k => FILES[k]).map(async k => { const [file, empty] = FILES[k]; d[k] = (await loadJson(file)) ?? empty() }));
  if (want.has("SCHOOLS")) d.SCHOOLS = spellSchools(d.SPELLS);
  if (want.has("FEAT_SRC")) d.FEAT_SRC = featureSources(d);
  const APP = window.crawlApp || null;
  return { ...d, APP, STATIC: !APP && !!window.CRAWL_STATIC };
}
