/* The top navigation bar (ported from nav_html() and NAV_JS in tools/sitekit.py).
   The eight reference sections sit under one Wiki menu (dev/planning/wiki-menu.md), so the bar stays short:
   Home · Character Creator · Wiki · Tabletop · About. Each section page has its own filters and search for going deeper.
   Signed-in admins also see Tabletop and a Testing menu of the prototypes in dev/testing/. */
import { esc } from "./dom";
import { fixLinks } from "../config";
import type { GlossaryEntry, Named } from "../lib/data";

type Menu = null | [label: string, href: string | null][];
/** Everything under the Wiki menu, in menu order. The Wiki page (web/wiki.html) shows the same sections as cards. */
export const WIKI: [label: string, href: string][] = [
  ["Classes", "classes.html"], ["Races", "races.html"], ["Backgrounds", "backgrounds.html"], ["Feats", "feats.html"],
  ["Spells", "spells.html"], ["Items", "items.html"], ["Crafting", "crafting.html"], ["Glossary", "glossary.html"],
];
/** Prototypes being tested (dev/testing/), under the admin-only Testing menu. Add a page here when it's built. */
export const TESTING: [label: string, href: string][] = [
  ["3D dice roller", "testing/dice.html"],
];
/** Nav items only a signed-in admin sees (CSS hides them unless <html> has the is-admin class), with their tooltips. */
const ADMIN_ONLY: Record<string, string> = {
  Tabletop: "Only you can see this while the Tabletop is in testing",
  Testing: "Only admins can see this: prototypes being tested",
};

// (label, href or null when the section isn't built yet, dropdown). A null entry in a dropdown is a divider.
const NAV_ITEMS: [string, string | null, Menu][] = [
  ["Home", "index.html", null],
  ["Character Creator", "creator.html", null],
  ["Wiki", "wiki.html", [...WIKI, ["", null], ["All of the Wiki →", "wiki.html"]]],
  ["Tabletop", "tabletop/", null],
  ["Testing", TESTING[0][1], TESTING],
  ["About", null, null],
];
/** Which nav item each page belongs to. */
const SECTION: Record<string, string> = {
  home: "Home", creator: "Character Creator", wiki: "Wiki", classes: "Wiki", backgrounds: "Wiki", feats: "Wiki", races: "Wiki",
  spells: "Wiki", glossary: "Wiki", conditions: "Wiki", items: "Wiki", crafting: "Wiki",
};
/** Glossary groups: each is a page of its own (glossary.html?s=<slug>). The Glossary page reads this as window.CRAWL_GTREE. */
type GNode = string | { n: string; slug: string; items: GNode[] };
const GLOSSARY_TREE: GNode[] = [{ n: "Combat", slug: "combat", items: ["Combat Rules", { n: "Actions", slug: "actions", items: ["Weapon Actions", "Combat Actions", "General Actions"] }] }];

const CARET = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const ARROW = (d: string) => `<svg viewBox="0 0 8 14" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

function navHtml(active: string, controls: string): string {
  const sec = SECTION[active];
  const items = NAV_ITEMS.map(([label, href, menu]) => {
    if (href == null) return `<span class="navitem soon" aria-disabled="true" title="Coming soon">${label}<small>Soon</small></span>`;
    const cur = active === label.toLowerCase() ? ' aria-current="page"' : sec === label ? ' data-current="1"' : "";
    const tip = ADMIN_ONLY[label], only = tip ? " adminonly" : "", title = tip ? ` title="${tip}"` : "";
    if (!menu) return `<a class="navitem${only}" href="${href}"${cur}${title}>${label}</a>`;
    const inner = menu.map(([t, h]) => (h ? `<a href="${h}">${esc(t)}</a>` : t ? `<span class="navmenuh">${esc(t)}</span>` : `<span class="navsep" role="separator"></span>`)).join("");
    return `<div class="navdrop${only}"><a class="navitem" href="${href}"${cur}${title} aria-haspopup="true">${label}${CARET}</a><div class="navmenu">${inner}</div></div>`;
  }).join("");
  return `<nav class="sitenav" aria-label="Crawl"><div class="navin">`
    + `<button type="button" class="navarr l" tabindex="-1" aria-label="Show earlier menu items">${ARROW("M7 1L1 7l6 6")}</button>`
    + `<div class="navlinks">${items}</div>`
    + `<button type="button" class="navarr r" tabindex="-1" aria-label="Show more menu items">${ARROW("M1 1l6 6-6 6")}</button>`
    + `<div class="navctl" id="navctl">${controls}</div></div></nav>`;
}

/** Underline the menu link for the page we're on. */
function markCurrent(): void {
  const page = location.pathname.split("/").pop() || "index.html", here = page === "conditions.html" ? "glossary.html" : page;
  document.querySelectorAll(".navmenu a").forEach(a => { if (a.getAttribute("href")!.split("/").pop() === here && !a.textContent!.startsWith("All of")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current") });
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

/* The page scripts still shared with the old site call these by their old global names. They used to refill the
   per-section menus; the Wiki menu has none, so they do nothing now (the Glossary page still reads CRAWL_GTREE). */
declare global {
  interface Window {
    CRAWL_GTREE: GNode[];
    crawlNavList(kind: string, items: Named[]): void;
    crawlNavRaces(data: { races?: Named[] } | null): void;
    crawlNavSections(sections: string[], entries?: GlossaryEntry[]): void;
    crawlNavMark(): void;
  }
}
Object.assign(window, { CRAWL_GTREE: GLOSSARY_TREE, crawlNavList: () => {}, crawlNavRaces: () => {}, crawlNavSections: () => {}, crawlNavMark: markCurrent });

/** Put the nav bar at the top of the page. active: the page key (e.g. "home"). controls: buttons for the right side. */
export function initNav(active: string, controls: string): void {
  // each page's HTML starts with a placeholder bar the nav's height, so the page doesn't jump when the nav arrives
  const ph = document.querySelector(".sitenav-ph");
  if (ph) ph.outerHTML = navHtml(active, controls); else document.body.insertAdjacentHTML("afterbegin", navHtml(active, controls));
  const nav = document.querySelector<HTMLElement>(".sitenav")!;
  fixLinks(nav);
  markCurrent();
  wireFit(nav);
}
