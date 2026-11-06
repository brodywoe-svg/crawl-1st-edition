/* How many classes, spells, items… there are, for the home page cards. The React version of web/src/ui/counts.ts
   (which the Wiki page still uses). Each count appears once its file has loaded. */
import { useEffect, useState } from "react";
import { loadJson, type ContentFile } from "../../lib/data";

const COUNTS = {
  classes: ["crawl-classes.json", (j: any) => j.classes], races: ["crawl-races.json", (j: any) => j.races],
  backgrounds: ["crawl-backgrounds.json", (j: any) => j.backgrounds], feats: ["crawl-feats.json", (j: any) => j.feats],
  spells: ["crawl-spells.json", (j: any) => j], items: ["crawl-items.json", (j: any) => j.items],
  recipes: ["crawl-items.json", (j: any) => j.recipes], entries: ["crawl-glossary.json", (j: any) => j.entries],
} satisfies Record<string, [ContentFile, (j: any) => unknown]>;
export type CountKey = keyof typeof COUNTS;

export function useCounts(): Partial<Record<CountKey, number>> {
  const [counts, setCounts] = useState<Partial<Record<CountKey, number>>>({});
  useEffect(() => {
    let live = true;
    for (const [k, [file, pick]] of Object.entries(COUNTS) as [CountKey, [ContentFile, (j: any) => unknown]][]) {
      loadJson(file).then(j => {
        const list = j && pick(j);
        if (live && Array.isArray(list)) setCounts(c => ({ ...c, [k]: list.length }));
      });
    }
    return () => { live = false };
  }, []);
  return counts;
}
