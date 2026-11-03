/* Site-wide settings for the new (Vite) site. */

/** Where Admin saves go. Replaces window.CRAWL_REPO from tools/build.py. */
export const REPO = { owner: "brodywoe-svg", repo: "crawl-1st-edition", branch: "main" };

/** The old GitHub Pages site. Links to pages not yet ported go there until cutover. */
export const LEGACY_SITE = "https://brodywoe-svg.github.io/crawl-1st-edition/";

/** Pages that exist in this build. Links to anything else that's relative (the tabletop, the installer zip) go to the old site. */
export const PORTED = new Set(["index.html", "spells.html", "glossary.html", "conditions.html", "items.html", "crafting.html",
  "races.html", "classes.html", "backgrounds.html", "feats.html", "creator.html", "tabletop/"]);

/** Point a relative link at the old site if its page hasn't been ported yet. */
export function siteHref(href: string): string {
  if (/^[a-z]+:|^\/\/|^#/i.test(href)) return href;
  const page = href.split(/[?#]/)[0] || "index.html";
  return PORTED.has(page) ? href : LEGACY_SITE + href;
}

/** Rewrite every relative link under root with siteHref. Safe to run more than once. */
export function fixLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(a => {
    const h = a.getAttribute("href")!, to = siteHref(h);
    if (to !== h) a.setAttribute("href", to);
  });
}
