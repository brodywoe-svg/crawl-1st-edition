/* The top navigation bar (ported from nav_html() and NAV_JS in tools/sitekit.py).
   The old site baked the Races/Classes/Backgrounds/Feats/Glossary menus in at build time and refreshed them from the JSON.
   Here they're built from the JSON when the page loads, so they're never out of date. */
import "../styles/nav.css";
import { esc } from "./dom";
import { fixLinks } from "../config";
import { loadJson, type GlossaryEntry, type Named } from "../lib/data";

type ListKind = "races" | "classes" | "backgrounds" | "feats";
type Menu = null | ListKind | "glossary" | [string, string | null][];

// (label, href or null when the section isn't built yet, dropdown)
const NAV_ITEMS: [string, string | null, Menu][] = [
  ["Home", "index.html", null],
  ["Character Creator", "creator.html", null],
  ["Classes", "classes.html", "classes"],
  ["Races", "races.html", "races"],
  ["Backgrounds", "backgrounds.html", "backgrounds"],
  ["Feats", "feats.html", "feats"],
  ["Spells", "spells.html", [["All spells", "spells.html?show=all"], ["By magic source", null],
    ["Arcane", "spells.html?source=arcane"], ["Divine", "spells.html?source=divine"], ["Primal", "spells.html?source=primal"], ["Occult", "spells.html?source=occult"],
    ["By class", null],
    ["Wizard", "spells.html?class=wizard"], ["Sorcerer", "spells.html?class=sorcerer"], ["Cleric", "spells.html?class=cleric"], ["Paladin", "spells.html?class=paladin"],
    ["Druid", "spells.html?class=druid"], ["Warlock", "spells.html?class=warlock"], ["Bard", "spells.html?class=bard"]]],
  ["Crafting", "crafting.html", ["Blacksmithing", "Tailoring", "Woodworking", "Cooking", "Alchemy", "Leatherworking", "Scribing", "Tinkering", "Goldsmithing", "Enchanting"]
    .map(p => [p, "crafting.html?p=" + p.toLowerCase()] as [string, string])],
  ["Items", "items.html", [["Weapons", "items.html?c=weapons"], ["Ammunition", "items.html?c=ammunition"], ["Armor", "items.html?c=armor"], ["Consumables", "items.html?c=consumables"],
    ["Adventuring Gear", "items.html?c=adventuring-gear"], ["Materials", "items.html?c=materials"], ["Magic Items", "items.html?c=magic-items"], ["Miscellaneous", "items.html?c=miscellaneous"]]],
  ["Glossary", "glossary.html", "glossary"],
  ["Tabletop", "tabletop/", null],
  ["About", null, null],
];
/** Which nav item each page belongs to. */
const SECTION: Record<string, string> = { home: "Home", creator: "Character Creator", classes: "Classes", backgrounds: "Backgrounds", feats: "Feats", races: "Races", spells: "Spells", glossary: "Glossary", conditions: "Glossary", items: "Items", crafting: "Crafting" };
const LIST_MENUS: Record<ListKind, [page: string, allLabel: string]> = {
  races: ["races.html", "All races"], classes: ["classes.html", "All classes"], backgrounds: ["backgrounds.html", "All backgrounds"], feats: ["feats.html", "All feats"],
};
/** Glossary groups: each is a page of its own (glossary.html?s=<slug>) with a flyout of its sections. */
type GNode = string | { n: string; slug: string; items: GNode[] };
const GLOSSARY_TREE: GNode[] = [{ n: "Combat", slug: "combat", items: ["Combat Rules", { n: "Actions", slug: "actions", items: ["Weapon Actions", "Combat Actions", "General Actions"] }] }];
/** Sections whose menu item gets a flyout listing each of its entries. */
const FLY_SECTIONS = ["Damage Types"];

const CARET = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const CARET_R = '<svg class="caretr" viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const ARROW = (d: string) => `<svg viewBox="0 0 8 14" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

export const slug = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sectionHref = (s: string) => (s === "Conditions" ? "conditions.html" : "glossary.html?s=" + slug(s));
const byName = (a: Named, b: Named) => String(a.n || "").toLowerCase().localeCompare(String(b.n || "").toLowerCase());

function navHtml(active: string, controls: string): string {
  const sec = SECTION[active];
  const items = NAV_ITEMS.map(([label, href, menu]) => {
    if (href == null) return `<span class="navitem soon" aria-disabled="true" title="Coming soon">${label}<small>Soon</small></span>`;
    const cur = active === label.toLowerCase() ? ' aria-current="page"' : sec === label ? ' data-current="1"' : "";
    if (!menu) {
      const adminOnly = label === "Tabletop";
      return `<a class="navitem${adminOnly ? " adminonly" : ""}" href="${href}"${cur}${adminOnly ? ' title="Only you can see this while the Tabletop is in testing"' : ""}>${label}</a>`;
    }
    let inner: string, id = "";
    if (typeof menu === "string") { inner = ""; id = ` id="nav${menu.charAt(0).toUpperCase() + menu.slice(1)}"` }
    else inner = menu.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span class="navmenuh">${esc(t)}</span>`)).join("");
    return `<div class="navdrop"><a class="navitem" href="${href}"${cur} aria-haspopup="true">${label}${CARET}</a><div class="navmenu"${id}>${inner}</div></div>`;
  }).join("");
  return `<nav class="sitenav" aria-label="Crawl"><div class="navin">`
    + `<button type="button" class="navarr l" tabindex="-1" aria-label="Show earlier menu items">${ARROW("M7 1L1 7l6 6")}</button>`
    + `<div class="navlinks">${items}</div>`
    + `<button type="button" class="navarr r" tabindex="-1" aria-label="Show more menu items">${ARROW("M1 1l6 6-6 6")}</button>`
    + `<div class="navctl" id="navctl">${controls}</div></div></nav>`;
}

/** Fill a Races/Classes/Backgrounds/Feats menu: each entry, with its subraces or subclasses in a flyout. */
export function setNavList(kind: ListKind, items: Named[] | undefined): void {
  const m = document.getElementById("nav" + kind.charAt(0).toUpperCase() + kind.slice(1)), [page, all] = LIST_MENUS[kind];
  if (!m || !items) return;
  m.innerHTML = `<a href="${page}">${all}</a>` + items.filter(r => r && r.n && !r._new).sort(byName).map(r => {
    const subs = (r.subs || []).filter(x => x && x.n && !x._new).sort(byName), link = `<a href="${page}#${esc(r.id)}">${esc(r.n)}`;
    return subs.length ? `<div class="navsub">${link}${CARET_R}</a><div class="navfly">${subs.map(x => `<a href="${page}#${esc(x.id)}">${esc(x.n)}</a>`).join("")}</div></div>` : link + "</a>";
  }).join("");
  fixLinks(m); markCurrent();
}

/** Fill the Glossary menu: Conditions, then the groups (Combat ▸ ...), then every other section A to Z.
    sections defaults to the sections the entries are in; the Glossary page also passes ones with no entries yet. */
export function setNavSections(entries: GlossaryEntry[], sections?: string[]): void {
  const menu = document.getElementById("navGlossary"); if (!menu) return;
  const fly: Record<string, string[]> = {};
  const flyKey = (n: string) => { n = n.toLowerCase(); return (/ damage$/.test(n) && n !== "bleeding damage" ? "0" : "1") + n };
  FLY_SECTIONS.forEach(s => { fly[s] = entries.filter(e => String(e.sec || "").trim() === s).map(e => e.n).sort((a, b) => flyKey(a).localeCompare(flyKey(b))) });
  const node = (x: GNode): string => {
    if (typeof x === "string" && fly[x]?.length)
      return `<div class="navsub"><a href="${sectionHref(x)}">${esc(x)}${CARET_R}</a><div class="navfly${fly[x].length > 10 ? " cols2" : ""}">${fly[x].map(n => `<a href="${sectionHref(x)}#g-${slug(n)}">${esc(n)}</a>`).join("")}</div></div>`;
    if (typeof x === "string") return `<a href="${sectionHref(x)}">${esc(x)}</a>`;
    return `<div class="navsub"><a href="glossary.html?s=${x.slug}">${esc(x.n)}${CARET_R}</a><div class="navfly">${x.items.map(node).join("")}</div></div>`;
  };
  const leaves = (items: GNode[]): string[] => items.flatMap(x => (typeof x === "string" ? [x] : leaves(x.items)));
  const seen = new Set(["conditions", ...leaves(GLOSSARY_TREE).map(s => s.toLowerCase())]), rest: string[] = [];
  (sections || entries.map(e => e.sec || "Conditions")).map(s => String(s || "").trim()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .forEach(s => { if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); rest.push(s) } });
  menu.innerHTML = node("Conditions") + GLOSSARY_TREE.map(node).join("") + rest.map(node).join("");
  fixLinks(menu); markCurrent();
}

/** Underline the menu link for the page we're on. */
function markCurrent(): void {
  const here = location.pathname.split("/").pop() + location.search;
  document.querySelectorAll(".navmenu a").forEach(a => { if (a.getAttribute("href") === here) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current") });
}

/** Keep the links on one row: tighten them step by step, then fall back to a sideways-scrolling row with arrows. */
function wireFit(nav: HTMLElement): void {
  const links = nav.querySelector<HTMLElement>(".navlinks")!, arrL = nav.querySelector<HTMLButtonElement>(".navarr.l")!, arrR = nav.querySelector<HTMLButtonElement>(".navarr.r")!;
  const STEPS = ["nav-c1", "nav-c2", "nav-c3", "nav-c4"];
  let busy = false, centered = false;
  const over = () => links.scrollWidth > links.clientWidth + 1;
  const arrows = () => { arrL.disabled = links.scrollLeft <= 1; arrR.disabled = links.scrollLeft + links.clientWidth >= links.scrollWidth - 1 };
  const fit = () => {
    if (busy) return; busy = true;
    [...STEPS, "navscroll"].forEach(c => nav.classList.remove(c));
    if (window.innerWidth > 700) for (let i = 0; i < STEPS.length && over(); i++) nav.classList.add(STEPS[i]);
    if (over()) {
      nav.classList.add("navscroll");
      if (!centered) {
        centered = true;
        const cur = links.querySelector<HTMLElement>('[aria-current="page"],[data-current]');
        if (cur) { const b = links.style.scrollBehavior; links.style.scrollBehavior = "auto"; links.scrollLeft = cur.offsetLeft - (links.clientWidth - cur.offsetWidth) / 2; links.style.scrollBehavior = b }
      }
    }
    arrows();
    document.documentElement.style.setProperty("--navh", nav.offsetHeight + "px"); busy = false;
  };
  links.addEventListener("scroll", arrows, { passive: true });
  ([[arrL, -1], [arrR, 1]] as const).forEach(([b, dir]) => b.addEventListener("click", () => links.scrollBy({ left: dir * Math.max(120, links.clientWidth * 0.7) })));
  // A menu sits under its item (nudged only to stay on screen). Its flyouts open to the right, or to the left (.flyleft)
  // when they wouldn't fit. The old site moved the whole menu left to make room, which pulled the Glossary menu,
  // with its deep flyouts, far from its item. In the scrolling row, menus are fixed under the bar so the row doesn't clip them.
  const chainW = (el: Element): number => {
    let best = 0;
    for (const c of el.children) { if (!c.classList.contains("navsub")) continue; const f = c.querySelector<HTMLElement>(":scope>.navfly"); if (f) best = Math.max(best, f.offsetWidth + 2 + chainW(f)) }
    return best;
  };
  const place = (e: Event) => {
    const d = (e.target as HTMLElement).closest?.(".navdrop"); if (!d) return;
    const m = d.querySelector<HTMLElement>(".navmenu"); if (!m) return;
    const scroll = nav.classList.contains("navscroll");
    if (window.innerWidth <= 700) { m.style.left = ""; m.style.right = ""; m.style.transform = ""; m.style.top = scroll ? nav.getBoundingClientRect().bottom + "px" : ""; return }
    const r = d.getBoundingClientRect(), w = m.offsetWidth || 220;
    const x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
    m.classList.toggle("flyleft", x + w + chainW(m) + 8 > window.innerWidth && x - chainW(m) - 8 >= 0);
    if (scroll) { m.style.top = nav.getBoundingClientRect().bottom + "px"; m.style.left = x + "px" } else { m.style.top = ""; m.style.left = x - r.left + "px" }
    m.style.right = "auto"; m.style.transform = "none";
  };
  nav.addEventListener("mouseover", place); nav.addEventListener("focusin", place);
  links.addEventListener("scroll", () => { const a = document.activeElement as HTMLElement | null; if (a?.closest(".navdrop") && !a.closest(".navmenu")) a.blur() }, { passive: true });
  fit(); window.addEventListener("resize", fit); window.addEventListener("load", fit);
  document.fonts?.ready.then(fit);
  const refit = () => requestAnimationFrame(fit);
  new MutationObserver(refit).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  new MutationObserver(refit).observe(nav.querySelector(".navctl")!, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("keydown", e => { const a = document.activeElement as HTMLElement | null; if (e.key === "Escape" && a?.closest(".navdrop")) a.blur() });
}

/* The page scripts still shared with the old site call these by their old global names. */
declare global {
  interface Window {
    CRAWL_GTREE: GNode[];
    crawlNavList(kind: ListKind, items: Named[]): void;
    crawlNavRaces(data: { races?: Named[] } | null): void;
    crawlNavSections(sections: string[], entries?: GlossaryEntry[]): void;
    crawlNavMark(): void;
  }
}
Object.assign(window, {
  CRAWL_GTREE: GLOSSARY_TREE,
  crawlNavList: setNavList,
  crawlNavRaces: (data: { races?: Named[] } | null) => { if (data) setNavList("races", data.races) },
  crawlNavSections: (sections: string[], entries: GlossaryEntry[] = []) => setNavSections(entries, sections),
  crawlNavMark: markCurrent,
});

/** Put the nav bar at the top of the page. active: the page key (e.g. "home"). controls: buttons for the right side.
    The Glossary and Conditions pages fill the Glossary menu themselves, from their live (possibly edited) entries. */
export function initNav(active: string, controls: string): void {
  document.body.insertAdjacentHTML("afterbegin", navHtml(active, controls));
  const nav = document.querySelector<HTMLElement>(".sitenav")!;
  fixLinks(nav);
  setNavSections([]);
  wireFit(nav);
  (Object.keys(LIST_MENUS) as ListKind[]).forEach(kind => {
    loadJson(`crawl-${kind}.json`).then(j => { if (j) setNavList(kind, (j as Record<ListKind, Named[]>)[kind]) });
  });
  if (active !== "glossary" && active !== "conditions") loadJson("crawl-glossary.json").then(j => { if (j?.entries) setNavSections(j.entries) });
}
