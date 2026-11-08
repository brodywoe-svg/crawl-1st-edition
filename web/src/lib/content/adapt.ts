/* Stage A of the content schema (dev/planning/content-schema.md): read today's crawl-*.json and return typed records.
   No file changes: the Admin editors drop fields they don't know, so structured data can't live in those files yet.
   Anything that can't be read is kept as text and reported in warnings. No DOM code here. */
import type { Action, ClassInfo, Condition, Content, Cost, Damage, DamageType, Item, Property, Rule } from "./types";

const str = (v: unknown) => (v == null ? "" : String(v)).trim();
const arr = <T = any>(v: unknown): T[] => (Array.isArray(v) ? v : []);
/** "Forgery (DC X)" → "forgery", "Quick Draw X" → "quick-draw", "Bleeding Damage" → "bleeding-damage". */
export const slug = (n: string) => str(n).toLowerCase().replace(/\(.*?\)/g, "").replace(/\s+x$/i, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Glossary sections that are actions (ACTION_SECS in lib/markup.ts). */
const ACTION_SECS = ["Weapon Actions", "Combat Actions", "General Actions"];
/** Coins in copper. Brody to confirm (content-schema.md open questions); src/crawldata.js uses the same. */
const COIN: Record<string, number> = { C: 1, S: 10, G: 100, P: 1000 };

/** "3 (G)" → 300, "1 (G) 5 (S)" → 150. null for "(Varies)", blank or unreadable. */
export function toCopper(v: unknown): number | null {
  let c = 0, hit = false;
  str(v).replace(/([\d.,]+)\s*\(?\s*([CSGP])\b\s*\)?/gi, (_m, n: string, u: string) => { c += parseFloat(n.replace(/,/g, "")) * COIN[u.toUpperCase()]; hit = true; return "" });
  return hit ? Math.round(c) : null;
}
/** "2 lbs" → 2, "0.5 lb" → 0.5. */
export function toPounds(v: unknown): number | null {
  const m = str(v).match(/([\d.]+)\s*lbs?\b/i);
  return m ? parseFloat(m[1]) : null;
}
/** A glossary or item action's AP: "3" → {ap: 3}, "+1 AP" → {ap: 1, extra: true}. */
export function toCost(v: unknown): Cost | null | undefined {
  const s = str(v);
  if (!s) return undefined;
  let m = s.match(/^(\d+)(?:\s*AP)?$/i); if (m) return { ap: +m[1] };
  m = s.match(/^\+\s*(\d+)\s*AP$/i); if (m) return { ap: +m[1], extra: true };
  return null;
}

/** An entry's prose: its lead and effect paragraphs. */
const glossText = (e: any) => [str(e.lead), ...arr<string>(e.fx).map(str)].filter(Boolean).join("\n\n");

export interface RawContent { classes?: any; items?: any; glossary?: any }

export function adapt(raw: RawContent): Content {
  const out: Content = { classes: new Map(), items: new Map(), conditions: new Map(), properties: new Map(), damageTypes: new Map(), actions: new Map(), rules: new Map(), warnings: [] };
  const warn = (w: string) => out.warnings.push(w);
  const put = <T extends { id: string; n: string }>(m: Map<string, T>, rec: T) => {
    if (m.has(rec.id)) warn(`Two entries have the id ${rec.id} ("${m.get(rec.id)!.n}" and "${rec.n}"); the second is skipped.`);
    else m.set(rec.id, rec);
  };

  // ---------------------------------------------------------------- glossary: conditions, properties, damage types, actions, rules
  for (const e of arr(raw.glossary?.entries)) {
    const n = str(e.n), sec = str(e.sec), text = glossText(e);
    if (!n || !slug(n)) continue;
    if (sec === "Conditions") put<Condition>(out.conditions, { id: "cond-" + slug(n), kind: "condition", n, text });
    else if (sec === "Properties") put<Property>(out.properties, { id: "prop-" + slug(n), kind: "property", n, text });
    else if (sec === "Damage Types") put<DamageType>(out.damageTypes, { id: "dmg-" + slug(n), kind: "damage", n, text });
    else if (ACTION_SECS.includes(sec)) {
      const cost = toCost(e.ap);
      if (cost === null) warn(`Action "${n}": can't read its cost "${str(e.ap)}".`);
      put<Action>(out.actions, { id: "action-" + slug(n), kind: "action", n, text, sec, ...(cost ? { cost } : {}),
        requires: str(e.req).split(",").map(str).filter(Boolean), effects: [{ do: "text", text }] });
    }
    else put<Rule>(out.rules, { id: "rule-" + slug(n), kind: "rule", n, text, sec });
  }

  // ---------------------------------------------------------------- classes: the Max Pool and Action Die chart
  for (const k of arr(raw.classes?.classes)) {
    const id = str(k.id), n = str(k.n);
    if (!id) { warn(`Class "${n}" has no id.`); continue }
    const chart = arr(k.chart).map(r => {
      const pool = parseInt(str(r.pool), 10), die = str(r.die).toLowerCase();
      return { lv: +r.lv || 0, pool: Number.isFinite(pool) && pool > 0 ? pool : null, die: /^d\d+$/.test(die) ? die : null };
    }).filter(r => r.lv >= 1 && r.lv <= 20).sort((a, b) => a.lv - b.lv);
    if (!chart.length) warn(`Class "${n}" has no chart yet, so no Max Pool or Action Die.`);
    else if (chart.some(r => r.pool == null || r.die == null)) warn(`Class "${n}": ${chart.filter(r => r.pool == null || r.die == null).length} chart levels are missing a Max Pool or Action Die.`);
    out.classes.set(id, { id, n, hd: str(k.hd), chart } satisfies ClassInfo);
  }

  // ---------------------------------------------------------------- items
  // property names, longest first, so "Quick Draw" wins over "Quick Bite" and the like
  const propNames = [...out.properties.values()].map(p => ({ id: p.id, re: new RegExp("^" + p.n.replace(/\(.*?\)/g, "").replace(/\s+X$/i, "").trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i") }))
    .sort((a, b) => b.re.source.length - a.re.source.length);
  const dmgByName = new Map([...out.damageTypes.values()].map(d => [d.n.toLowerCase(), d.id]));
  for (const i of arr(raw.items?.items)) {
    const id = str(i.id), n = str(i.n), propText = str(i.props);
    if (!id || !/^[a-z]+-[a-z0-9-]+$/.test(id)) { warn(`Item "${n}" has an unusable id "${id}".`); continue }
    const props: string[] = [], damage: Damage[] = [];
    let range: Item["range"] = null;
    for (const tok of propText.split(",").map(str).filter(Boolean)) {
      const dm = tok.match(/^(\d*d\d+(?:\s*[+-]\s*\d+)?|\d+)\s+([A-Za-z]+)$/);
      if (dm) {
        const type = dmgByName.get(dm[2].toLowerCase());
        damage.push({ dice: dm[1].replace(/\s+/g, ""), typeName: dm[2], ...(type ? { type } : {}) });
        if (!type) warn(`Item "${n}": unknown damage type "${dm[2]}".`);
        continue;
      }
      const p = propNames.find(p => p.re.test(tok));
      if (p && !props.includes(p.id)) props.push(p.id);
      const rg = tok.match(/^(?:Thrown|Ammunition|Range)\s*\(?\s*(\d+)\s*\/\s*(\d+)/i);
      if (rg) range = { ft: +rg[1], long: +rg[2] };
    }
    const actions: string[] = [];
    for (const w of arr(i.wacts)) {
      const wn = str(w.n).replace(/\s*\((?:Reaction|Action)\)\s*$/i, "");
      if (!wn) continue;
      const aid = "action-" + slug(id.replace(/^i-/, "") + "-" + wn), cost = toCost(w.ap), text = str(w.d);
      if (cost === null) warn(`Item "${n}", action "${wn}": can't read its cost "${str(w.ap)}".`);
      put<Action>(out.actions, { id: aid, kind: "action", n: wn, text, sec: "Item", ...(cost ? { cost } : {}), requires: [], effects: [{ do: "text", text }] });
      actions.push(aid);
    }
    const cp = toCopper(i.value);
    if (cp == null && str(i.value) && !/varies/i.test(str(i.value))) warn(`Item "${n}": can't read its value "${str(i.value)}".`);
    put<Item>(out.items, { id, n, text: str(i.desc), cat: str(i.cat), sub: str(i.sub), slot: str(i.slot), cp, lb: toPounds(i.weight), props, propText, damage, range, actions });
  }
  return out;
}
