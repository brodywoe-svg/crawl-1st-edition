/* Loading the game content (crawl-*.json). The files sit next to the page, and Admin saves replace them on main.
   Full shapes are described in dev/DATA-MODEL.md; only the fields the code reads so far are typed here. */

/** A race, class, background or feat: anything with a name, an id and optional sub-entries. */
export interface Named { id?: string; n?: string; subs?: Named[]; _new?: boolean }
export interface GlossaryEntry { n: string; sec?: string }

export interface ContentFiles {
  "crawl-classes.json": { classes: Named[] };
  "crawl-races.json": { races: Named[] };
  "crawl-backgrounds.json": { backgrounds: Named[] };
  "crawl-feats.json": { feats: Named[] };
  "crawl-spells.json": unknown[];
  "crawl-items.json": { items: unknown[]; recipes: unknown[] };
  "crawl-glossary.json": { entries: GlossaryEntry[] };
}
export type ContentFile = keyof ContentFiles;

const cache = new Map<string, Promise<unknown>>();

/** Fetch a content file once per page load, always revalidating with the server. Resolves to null on any failure. */
export function loadJson<F extends ContentFile>(file: F): Promise<ContentFiles[F] | null> {
  if (!cache.has(file)) {
    cache.set(file, fetch(file, { cache: "no-cache" }).then(r => (r.ok ? r.json() : null)).catch(() => null));
  }
  return cache.get(file) as Promise<ContentFiles[F] | null>;
}
