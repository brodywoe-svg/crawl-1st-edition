/* Shared by the Character Creator, Classes and Backgrounds pages.
   crawl-classes.json     = {v:1, classes:[cls]}
     cls  = {id, n, desc, source, cast, spells, hd, hp, saves, skills, skillPts, prof, langs,
             chart:[{lv, pool, die}], feats:[{n, d, lv}], loadouts:[{n, gear:[gear]}], money, extra:[{k,v}],
             subs:[{id, n, desc, feats:[{n, d, lv}], extra}]}
   crawl-backgrounds.json = {v:1, backgrounds:[bg]}
     bg   = {id, n, desc, skills, prof, langs, gear:[gear], wealth, feats:[{n, d}], extra}
   gear   = {n, qty, iid}  (iid links to an item on the Items page when the name matches one)
   crawl-creator.json     = {v:1, rules:{wealth, rank, spellRank, passive, langs}} */
const str = x => String(x ?? "").trim();
const arr = x => Array.isArray(x) ? x : [];
const lcs = x => String(x || "").toLowerCase();
const newId = p => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const featLv = x => { const n = parseInt(x, 10); return n > 0 ? n : "" };
const featsOf = x => arr(x).map(f => ({ n: str(f && f.n), d: str(f && f.d), ...(f && featLv(f.lv) ? { lv: featLv(f.lv) } : {}) })).filter(f => f.n || f.d);
const extrasOf = x => arr(x).map(r => ({ k: str(r && r.k), v: str(r && r.v) })).filter(r => r.k || r.v);
const byName = (a, b) => lcs(a.n).localeCompare(lcs(b.n));
const SOURCES = ["Arcane", "Divine", "Primal", "Occult"];
const ABIL = [["str", "Strength"], ["dex", "Dexterity"], ["con", "Constitution"], ["int", "Intelligence"], ["wis", "Wisdom"], ["cha", "Charisma"]];
const AB = Object.fromEntries(ABIL);
let uid = 0;

/* money: 10 (C) = 1 (S), 10 (S) = 1 (G) */
const COIN = { C: 1, S: 10, G: 100, P: 1000 };
function toC(t) { let c = 0, hit = false; String(t || "").replace(/([\d.,]+)\s*\(?\s*([CSGP])\b\s*\)?/gi, (m, n, u) => { c += parseFloat(n.replace(/,/g, "")) * COIN[u.toUpperCase()]; hit = true }); return hit ? Math.round(c) : null }
function fmtC(c) {
  c = Math.max(0, Math.round(c || 0)); if (!c) return "0 (G)";
  const g = Math.floor(c / 100), s = Math.floor(c % 100 / 10), k = c % 10;
  return [g && `${g} (G)`, s && `${s} (S)`, k && `${k} (C)`].filter(Boolean).join(" ");
}
const lbs = t => { const m = String(t || "").match(/[\d.]+/); return m ? parseFloat(m[0]) : 0 };
const fmtLbs = n => n ? `${Math.round(n * 100) / 100} lbs` : "";

/* gear lists: names are matched to items on the Items page */
let GEAR_ITEMS = arr(typeof CATALOG !== "undefined" && CATALOG ? CATALOG.items : []);
const itemByName = n => GEAR_ITEMS.find(i => lcs(i.n) === lcs(str(n))) || null;
function gearOf(x) {
  return arr(x).map(g => typeof g === "string" ? { n: g, qty: 1 } : g).filter(g => g && str(g.n)).map(g => {
    const it = itemByName(g.n) || (g.iid ? GEAR_ITEMS.find(i => i.id === g.iid) : null);
    return { n: it ? it.n : str(g.n), qty: Math.max(1, parseInt(g.qty, 10) || 1), ...(it ? { iid: it.id } : {}) };
  });
}
const chartOf = x => arr(x).map(r => ({ lv: featLv(r && r.lv), pool: str(r && r.pool), die: str(r && r.die) })).filter(r => r.lv || r.pool || r.die).sort((a, b) => (a.lv || 99) - (b.lv || 99));
function normClass(p) {
  p = p || {};
  return { id: str(p.id) || newId("class"), n: str(p.n), desc: str(p.desc), source: SOURCES.includes(str(p.source)) ? str(p.source) : "", cast: AB[str(p.cast)] ? str(p.cast) : "",
    spells: str(p.spells), hd: str(p.hd), hp: str(p.hp), saves: str(p.saves), skills: str(p.skills), skillPts: str(p.skillPts), prof: str(p.prof), langs: str(p.langs),
    chart: chartOf(p.chart), feats: featsOf(p.feats), loadouts: arr(p.loadouts).map((l, i) => ({ n: str(l && l.n) || `Loadout ${i + 1}`, gear: gearOf(l && l.gear) })).filter(l => l.gear.length || l.n),
    money: str(p.money), extra: extrasOf(p.extra),
    subs: arr(p.subs).filter(s => s && str(s.n)).map(s => ({ id: str(s.id) || newId("sub"), n: str(s.n), desc: str(s.desc), feats: featsOf(s.feats), extra: extrasOf(s.extra), _id: ++uid })).sort(byName), _id: ++uid };
}
function normBg(p) {
  p = p || {};
  return { id: str(p.id) || newId("bg"), n: str(p.n), desc: str(p.desc), skills: str(p.skills), prof: str(p.prof), langs: str(p.langs),
    gear: gearOf(p.gear).concat(p.equip && !arr(p.gear).length ? gearOf(String(p.equip).split(/[,;\n]+/)) : []), wealth: str(p.wealth), feats: featsOf(p.feats), extra: extrasOf(p.extra), _id: ++uid };
}
const normClasses = j => arr(j && j.classes).filter(c => c && str(c.n)).map(normClass).sort(byName);
const normBgs = j => arr(j && j.backgrounds).filter(b => b && str(b.n)).map(normBg).sort(byName);
const stripIds = ({ _id, _new, ...x }) => x;
const cleanClasses = list => ({ v: 1, classes: list.filter(c => !c._new).map(c => ({ ...stripIds(c), subs: c.subs.filter(s => !s._new).map(stripIds).sort(byName) })).sort(byName) });
const cleanBgs = list => ({ v: 1, backgrounds: list.filter(b => !b._new).map(stripIds).sort(byName) });
/* features a class has by a given level; features without a level count as 1st level */
const featsAt = (fs, lv) => fs.filter(f => (f.lv || 1) <= lv);
const gearLine = g => g.map(x => (x.qty > 1 ? x.qty + "× " : "") + x.n).join(", ");
