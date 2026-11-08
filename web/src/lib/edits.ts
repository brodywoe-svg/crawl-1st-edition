/* What's new: the Admin edit log (crawl-edits.json) summarised for players (dev/planning/home-page.md). No DOM code here.
   The log keeps the latest change to each record, keyed "<file>.<category>/<id or name>[.<sub-category>/<name>]",
   e.g. "crawl-classes.json.classes/class-monk.feats/Resolve". This groups those into one line per thing that changed, per day. */

export interface EditEntry { n: string; f: string; c: string; how: "added" | "edited" | "removed" | string; by: string; at: string }
export interface EditLog { v?: number; edits?: Record<string, EditEntry> }

export interface Change {
  day: string;               // YYYY-MM-DD (UTC)
  at: string;                // the newest edit in the group
  page: string;              // "Classes"
  title: string;             // "Monk", or "Glossary" for a group of entries
  href: string;              // the page, at the record when it can
  parts: { n: string; how: string }[];  // what changed inside it, newest first
  by: string[];
}

/** Content players read, and the page each is on. Skill-tree layout and Creator settings are left out. */
const PAGES: Record<string, [label: string, href: string]> = {
  "crawl-classes.json": ["Classes", "classes.html"], "crawl-races.json": ["Races", "races.html"],
  "crawl-backgrounds.json": ["Backgrounds", "backgrounds.html"], "crawl-feats.json": ["Feats", "feats.html"],
  "crawl-spells.json": ["Spells", "spells.html"], "crawl-items.json": ["Items", "items.html"],
  "crawl-glossary.json": ["Glossary", "glossary.html"],
};
/** Categories whose records are big enough to be a line each (a class, a race); the rest are grouped per page and day. */
const OWN_LINE = new Set(["classes", "races", "backgrounds"]);

const titleFromId = (id: string) => id.replace(/^[a-z]+-/, "").split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

/** The newest changes, one per thing per day, newest first. */
export function changelog(log: EditLog | null | undefined, limit = 20): Change[] {
  const groups = new Map<string, Change>();
  const entries = Object.entries(log?.edits || {}).filter(([, e]) => e && PAGES[e.f] && e.at).sort((a, b) => b[1].at.localeCompare(a[1].at));
  for (const [key, e] of entries) {
    const [page, href] = PAGES[e.f], day = e.at.slice(0, 10);
    const rest = key.startsWith(e.f + ".") ? key.slice(e.f.length + 1) : "";
    const dot = rest.indexOf("."), top = dot < 0 ? rest : rest.slice(0, dot), nested = dot >= 0;
    const [cat, id] = [top.slice(0, top.indexOf("/")), top.slice(top.indexOf("/") + 1)];
    const own = OWN_LINE.has(cat) && id;
    const gk = own ? `${day}|${e.f}|${top}` : `${day}|${e.f}`;
    let g = groups.get(gk);
    if (!g) {
      g = { day, at: e.at, page, title: own ? (nested ? titleFromId(id) : e.n) : page, href: own ? `${href}#${encodeURIComponent(id)}` : href, parts: [], by: [] };
      groups.set(gk, g);
    }
    if (own && !nested) {                        // the record itself: it has its real name, and "edited" goes without saying
      g.title = e.n;
      if (e.how !== "edited") g.parts.push({ n: e.n, how: e.how });
    } else {
      // a bare number ("5") is a numbered choice or row: say what it is ("choice 5")
      const sub = nested ? rest.slice(dot + 1, rest.indexOf("/", dot + 1)) : "";
      g.parts.push({ n: /^\d+$/.test(e.n) && sub ? `${sub.replace(/s$/, "")} ${e.n}` : e.n, how: e.how });
    }
    if (e.by && !g.by.includes(e.by)) g.by.push(e.by);
  }
  return [...groups.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** "added Resolve · removed Prowess", or "3 entries updated" when there are many. Records that were only edited say "updated". */
export function changeText(c: Change, max = 3): string {
  if (!c.parts.length) return "updated";
  const order = ["added", "edited", "removed"], word: Record<string, string> = { added: "added", edited: "updated", removed: "removed" };
  const byHow = order.map(h => [h, c.parts.filter(p => p.how === h).map(p => p.n)] as const).filter(([, ns]) => ns.length);
  return byHow.map(([h, ns]) => `${word[h] || h} ${ns.length > max ? `${ns.slice(0, max).join(", ")} and ${ns.length - max} more` : ns.join(", ")}`).join(" · ");
}

/** "Today", "Yesterday", "3 days ago", or the date. */
export function dayLabel(day: string, now = new Date()): string {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()), d = Date.parse(day + "T00:00:00Z");
  const n = Math.round((today - d) / 86400000);
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return `${n} days ago`;
  return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}
