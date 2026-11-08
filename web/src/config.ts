/* Site-wide settings for the new (Vite) site. */

/** Where Admin saves go. Replaces window.CRAWL_REPO from tools/build.py. */
export const REPO = { owner: "brodywoe-svg", repo: "crawl-1st-edition", branch: "main" };

/** The old GitHub Pages site. Links to pages not yet ported go there until cutover. */
export const LEGACY_SITE = "https://brodywoe-svg.github.io/crawl-1st-edition/";

/** Pages that exist in this build. Links to anything else that's relative (the tabletop, the installer zip) go to the old site. */
export const PORTED = new Set(["index.html", "wiki.html", "spells.html", "glossary.html", "conditions.html", "items.html", "crafting.html",
  "races.html", "classes.html", "backgrounds.html", "feats.html", "creator.html", "account.html", "tabletop/", "testing/dice.html",
  "testing/sheet", "testing/roll"]); // routes in the React app (web/src/app/main.tsx)

/** Make a relative link absolute: from the site root if its page is in this build, else on the old site.
    Absolute, because the React app's nested routes (/characters/abc) would resolve a relative "creator.html" under them. */
export function siteHref(href: string): string {
  if (/^[a-z]+:|^\/|^#/i.test(href)) return href;
  const page = href.split(/[?#]/)[0] || "index.html";
  return PORTED.has(page) ? import.meta.env.BASE_URL + href : LEGACY_SITE + href;
}

/** Rewrite every relative link under root with siteHref. Safe to run more than once. */
export function fixLinks(root: ParentNode = document): void {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(a => {
    const h = a.getAttribute("href")!, to = siteHref(h);
    if (to !== h) a.setAttribute("href", to);
  });
}
