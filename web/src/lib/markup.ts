/* Crawl's text markup and glossary matching (ported from the /*@GLCORE@*\/ block in src/page.html). No DOM code here;
   the tooltip runtime that uses this is in ui/tips.ts.
   Markup: blank line = new paragraph, "- " lines = a bulleted list, [color=#hex]…[/color], [link=page.html#id]…[/link],
   and [table] rows split by | [/table]. */
import { esc } from "./text";

/** A glossary entry after normGlossary. */
export interface GEntry {
  n: string; sec: string; lead: string; fx: string[]; notes: { l: string; t: string }[]; aka: { w: string; ref: string }[];
  tip: boolean; tipItems?: boolean; tipClasses?: boolean; tipFeats?: boolean; tipCreator?: boolean; hideRefs?: boolean; ap?: string; req?: string;
}
/** A glossary word found in text: the entry, the word as matched, and (for "aka" words) the text it refers to. */
export interface GHit { e: GEntry; w: string; ref: string }
export interface GMap { map: Map<string, GHit>; re: RegExp | null }
type Render = (t: string) => string;

/* glossary data (crawl-glossary.json): {v:1, entries:[{n, sec, lead, fx:[effects], notes:[{l,t}], aka:[{w,ref}], tip}]}
   tip:false keeps an entry out of the spell tooltips (for everyday words such as Light) */
export function normGlossary(j: any): GEntry[] | null {
  const a = j && Array.isArray(j.entries) ? j.entries : null; if (!a) return null;
  const list = (x: any): any[] => (Array.isArray(x) ? x : []);
  return a.filter((e: any) => e && typeof e.n === "string" && e.n.trim()).map((e: any) => ({
    n: e.n.trim(), sec: String(e.sec || "Conditions").trim() || "Conditions", lead: String(e.lead || "").trim(),
    fx: list(e.fx).map(x => String(x).trim()).filter(Boolean),
    notes: list(e.notes).filter(n => n && String(n.t || "").trim()).map(n => ({ l: String(n.l || "Note").trim() || "Note", t: String(n.t).trim() })),
    aka: list(e.aka).map(x => (typeof x === "string" ? { w: x, ref: "" } : { w: String((x && x.w) || ""), ref: String((x && x.ref) || "") })).map(x => ({ w: x.w.trim(), ref: x.ref.trim() })).filter(x => x.w),
    tip: e.tip !== false,
    ...Object.fromEntries(["tipItems", "tipClasses", "tipFeats", "tipCreator"].filter(k => typeof e[k] === "boolean").map(k => [k, e[k]])),
    ...(e.hideRefs ? { hideRefs: true } : {}),
    ...(String(e.ap || "").trim() ? { ap: String(e.ap).trim() } : {}),
    ...(String(e.req || "").trim() ? { req: String(e.req).trim() } : {}),
  }));
}

const COLOR_RE = /\[color=(#[0-9a-f]{3,8})\]([\s\S]*?)\[\/color\]/gi;
const LINK_RE = /\[link=([a-z-]+\.html(?:\?[\w=&-]*)?(?:#[\w-]*)?)\]([\s\S]*?)\[\/link\]/gi;
/** One line of text: escaped, with colors, links and line breaks. */
export function richInline(t: string): string {
  return esc(t).replace(COLOR_RE, (_m, c, x) => `<span class="tc" style="--c:${c}">${x}</span>`).replace(LINK_RE, (_m, u, x) => `<a class="ilink" href="${u}">${x}</a>`).replace(/\n/g, "<br>");
}

/* small charts: [table] one row per line, cells split by | (or tabs), first row is the heading [/table] */
const TABLE_RE = /\[table\]([\s\S]*?)\[\/table\]/gi;
function tableHTML(src: string, fn: Render): string {
  const rows = String(src).split("\n").map(r => r.trim()).filter(Boolean).map(r => r.split(r.includes("|") ? "|" : /\t+/).map(c => c.trim()));
  if (!rows.length) return "";
  const n = Math.max(...rows.map(r => r.length)), pad = (r: string[]) => r.concat(Array(n - r.length).fill(""));
  return `<div class="rtablew"><table class="rtable"><thead><tr>${pad(rows[0]).map(c => `<th>${fn(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${pad(r).map(c => `<td>${fn(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/** Paragraphs, bulleted lists and charts; fn renders the text inside them (richInline by default). */
export function blocks(t: string, fn?: Render, cls?: string): string {
  const render = fn || richInline, tabs: string[] = [], pAttr = cls ? ` class="${cls}"` : "";
  t = String(t || "").replace(TABLE_RE, (_m, x) => { tabs.push(x); return `\n\n\u0001${tabs.length - 1}\u0001\n\n` });
  /* lines starting with "- " become a bulleted list */
  const para = (x: string) => {
    if (!/^- /m.test(x)) return `<p${pAttr}>${render(x)}</p>`;
    let out = "", txt: string[] = [], li: string[] = [];
    const end = () => {
      if (txt.length) { out += `<p${pAttr}>${render(txt.join("\n"))}</p>`; txt = [] }
      if (li.length) { out += `<ul class="tlist">${li.map(l => `<li>${render(l)}</li>`).join("")}</ul>`; li = [] }
    };
    x.split("\n").forEach(l => {
      if (/^- /.test(l)) { if (txt.length) { const tt = txt; txt = []; out += `<p${pAttr}>${render(tt.join("\n"))}</p>` } li.push(l.slice(2).trim()) }
      else { if (li.length) end(); txt.push(l) }
    });
    end(); return out;
  };
  return t.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^\u0001(\d+)\u0001$/); return m ? tableHTML(tabs[+m[1]], render) : para(x) }).join("");
}
export function paras(t: string, cls?: string): string { return blocks(t, richInline, cls) }

/** A feature: its red name, then its text; the first paragraph runs on after the name. */
export function featBlock(name: string, desc: string, fn?: Render, tag?: string): string {
  const h = blocks(desc, fn || richInline), head = `<span class="pdn">${esc(name)}</span>${tag || ""}`;
  return `<div class="featb">${h.startsWith("<p>") ? h.replace("<p>", `<p>${name ? head + " - " : ""}`) : (name ? `<p>${head}</p>` : "") + h}</div>`;
}
export const plainText = (t: string): string => String(t || "").replace(/\[\/?(?:color|link|table)[^\]]*\]/gi, "");
export const singular = (s: string): string => (/ies$/i.test(s) ? s.slice(0, -3) + "y" : /[^s]s$/i.test(s) ? s.slice(0, -1) : s);

/* glossary words in text. A word also matches its singular or plural ("Exhaustion Point (EP)" for "Exhaustion Points (EP)")
   and, when it ends in brackets, the same word without them ("Action Points"). Words may end in punctuation such as ")". */
function glVariants(w: string): string[] {
  const m = String(w).match(/^(.*?)(\s*\([^)]*\))?$/)!, base = m[1].trim(), par = m[2] || "";
  const other = /die$/i.test(base) ? base.slice(0, -1) + "ce" : /dice$/i.test(base) ? base.slice(0, -2) + "e" : /[^s]s$/i.test(base) ? base.slice(0, -1) : base + "s";
  const out = [w];
  [base, other].forEach(b => { out.push(b + par); if (par) out.push(b) });
  if (/\sX$/.test(base)) out.push(base.replace(/\s+X$/, ""));
  return [...new Set(out.map(x => x.trim()))].filter(x => x.length > 1);
}

/* where an entry shows as a tooltip: tip = Spells; the others default to following Spells,
   except Items, which defaults to on for Properties, Damage Types and the Actions sections */
const TIP_ITEM_SECS = ["Properties", "Damage Types", "Weapon Actions", "Combat Actions", "General Actions"];
export function tipOn(e: GEntry, scope: string): boolean {
  if (scope === "items") return typeof e.tipItems === "boolean" ? e.tipItems : TIP_ITEM_SECS.includes(e.sec);
  const k = ({ classes: "tipClasses", feats: "tipFeats", creator: "tipCreator" } as Record<string, keyof GEntry>)[scope];
  return k && typeof e[k] === "boolean" ? (e[k] as boolean) : e.tip !== false;
}

/** Every glossary word (and its variants) that shows a tooltip in this scope, plus one regex that finds them all, longest first. */
export function glMapOf(entries: GEntry[], scope?: string): GMap {
  const map = new Map<string, GHit>(), tips = entries.filter(e => tipOn(e, scope || "spells")), all: GHit[] = [];
  tips.forEach(e => all.push({ e, w: e.n, ref: "" })); tips.forEach(e => e.aka.forEach(x => all.push({ e, w: x.w, ref: x.ref })));
  all.forEach(h => { const k = h.w.toLowerCase(), o = map.get(k); if (!o || (h.ref && !o.ref && o.e === h.e)) map.set(k, h) });
  all.forEach(h => glVariants(h.w).forEach(v => { const k = v.toLowerCase(); if (!map.has(k)) map.set(k, { ...h, w: v }) }));
  const terms = [...map.keys()].sort((x, y) => y.length - x.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return { map, re: terms.length ? new RegExp("(?<![\\w])(" + terms.join("|") + ")(?![\\w])", "gi") : null };
}

/** A glossary word's popup. Weapon Actions and Combat Actions get a special red one: AP cost, the kind of action, and what it needs. */
export const ACTION_SECS = ["Weapon Actions", "Combat Actions", "General Actions"];
export function tipHTML(hit: GHit): { act: boolean; html: string } {
  const e = hit.e, act = ACTION_SECS.includes(e.sec), ap = e.ap ? (/^\d+$/.test(e.ap) ? e.ap + " AP" : e.ap) : "";
  const body = hit.ref ? `${paras(hit.ref)}<p class="gfrom">From ${esc(e.n)}</p>` : `${paras(e.lead)}${e.fx.length ? `<ul>${e.fx.map(x => `<li>${richInline(x)}</li>`).join("")}</ul>` : ""}`;
  if (!act) return { act, html: `<div class="gth"><span>${esc(hit.ref ? hit.w : e.n)}</span><span class="gtag">${esc(singular(e.sec))}</span></div><div class="gtb">${body}</div>` };
  return {
    act, html: `<div class="gth"><span>${esc(hit.ref ? hit.w : e.n)}</span><span class="gtag">${esc(ap || "Action")}</span></div><div class="gtb"><p class="gtkind">${esc(singular(e.sec))}</p>`
      + `<dl class="gtfacts"><dt>AP cost</dt><dd>${esc(ap || "—")}</dd>${e.req ? `<dt>Requirements</dt><dd>${richInline(e.req)}</dd>` : ""}</dl>${body}</div>`,
  };
}
