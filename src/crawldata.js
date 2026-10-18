/* Shared by the Character Creator, Classes and Backgrounds pages.
   crawl-classes.json     = {v:1, classes:[cls]}
     cls  = {id, n, desc, source, cast, spells, hd, hp, saves, skills, skillPts, prof, langs,
             chart:[{lv, pool, die}], feats:[{n, d, lv}], loadouts:[{n, gear:[gear]}], money, moneyRoll, extra:[{k,v}],
             prepared (formula), startRank, schoolStart, oppCost, majorLv, minorLv, schools:[{s, opp}],
             subs:[{id, n, desc, feats:[{n, d, lv}], extra}]}
   crawl-backgrounds.json = {v:1, backgrounds:[bg]}
     bg   = {id, n, desc, skills, weapons, armor, trades, prof, langs, choices:[choice], gear:[gear], wealth, feats:[{n, d}], extra}
   choice = {n, cat, opts:[names]}: "Choose n <cat> from opts"; cat is skill, save, weapon, armor, trade or lang (classes have choices too)
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
    money: str(p.money), moneyRoll: str(p.moneyRoll), extra: extrasOf(p.extra), choices: choicesOf(p.choices),
    prepared: str(p.prepared), startRank: str(p.startRank), schoolStart: str(p.schoolStart), oppCost: str(p.oppCost), majorLv: str(p.majorLv), minorLv: str(p.minorLv),
    schools: arr(p.schools).map(r => ({ s: str(r && r.s), opp: str(r && r.opp) })).filter(r => r.s),
    subs: arr(p.subs).filter(s => s && str(s.n)).map(s => ({ id: str(s.id) || newId("sub"), n: str(s.n), desc: str(s.desc), feats: featsOf(s.feats), extra: extrasOf(s.extra), _id: ++uid })).sort(byName), _id: ++uid };
}
function normBg(p) {
  p = p || {};
  return { id: str(p.id) || newId("bg"), n: str(p.n), desc: str(p.desc), skills: str(p.skills), weapons: str(p.weapons), armor: str(p.armor), trades: str(p.trades), prof: str(p.prof), langs: str(p.langs), choices: choicesOf(p.choices),
    gear: gearOf(p.gear).concat(p.equip && !arr(p.gear).length ? gearOf(String(p.equip).split(/[,;\n]+/)) : []), wealth: str(p.wealth), feats: featsOf(p.feats), extra: extrasOf(p.extra), _id: ++uid };
}
/* "choose from" groups: the player picks n of the listed options */
const CHOICE_KINDS = [["skill", "skill", "skills"], ["save", "saving throw", "saving throws"], ["weapon", "weapon proficiency", "weapon proficiencies"], ["armor", "armor proficiency", "armor proficiencies"], ["trade", "trade skill", "trade skills"], ["lang", "language", "languages"]];
function choiceOptions(cat) {
  if (cat === "skill") return ["Acrobatics", "Animal Handling", "Appraisal", "Arcane", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Lore", "Medicine", "Nature", "Occult", "Perception", "Performance", "Persuasion", "Religion", "Stealth", "Thievery"];
  if (cat === "save") return ABIL.map(a => a[1]);
  if (cat === "weapon") return ["Axes", "Blades", "Bows", "Crossbows", "Cudgels", "Firearms", "Polearms", "Swords", "Special", "Miscellaneous"];
  if (cat === "armor") return ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"];
  if (cat === "trade") return [...new Set(["Alchemy", "Blacksmithing", "Cooking", "Enchanting", "Goldsmithing", "Leatherworking", "Scribing", "Tailoring", "Tinkering", "Woodworking", ...arr(typeof CATALOG !== "undefined" && CATALOG ? CATALOG.recipes : []).map(r => str(r && r.prof))].filter(Boolean))].sort();
  return [];
}
const choicesOf = x => arr(x).map(ch => ({ n: Math.max(1, Math.min(20, parseInt(ch && ch.n, 10) || 1)), cat: CHOICE_KINDS.some(k => k[0] === (ch && ch.cat)) ? ch.cat : "skill", opts: [...new Set(arr(ch && ch.opts).map(str).filter(Boolean))] })).filter(ch => ch.opts.length);
function choiceText(ch) {
  const k = CHOICE_KINDS.find(x => x[0] === ch.cat) || CHOICE_KINDS[0], words = ["", "one", "two", "three", "four", "five", "six"];
  const list = ch.opts.length > 1 ? ch.opts.slice(0, -1).join(", ") + " or " + ch.opts[ch.opts.length - 1] : ch.opts[0];
  return `Choose ${words[ch.n] || ch.n} ${ch.n === 1 ? k[1] : k[2]} from ${list}`;
}
const normClasses = j => arr(j && j.classes).filter(c => c && str(c.n)).map(normClass).sort(byName);
const normBgs = j => arr(j && j.backgrounds).filter(b => b && str(b.n)).map(normBg).sort(byName);
const stripIds = ({ _id, _new, ...x }) => x;
const cleanClasses = list => ({ v: 1, classes: list.filter(c => !c._new).map(c => ({ ...stripIds(c), subs: c.subs.filter(s => !s._new).map(stripIds).sort(byName) })).sort(byName) });
const cleanBgs = list => ({ v: 1, backgrounds: list.filter(b => !b._new).map(stripIds).sort(byName) });
/* feats (crawl-feats.json): name, category, prerequisite, description, extra details */
function normFeat(p) { p = p || {}; return { id: str(p.id) || newId("feat"), n: str(p.n), cat: str(p.cat), pre: str(p.pre), desc: str(p.desc), extra: extrasOf(p.extra), _id: ++uid } }
const normFeats = j => arr(j && j.feats).filter(f => f && str(f.n)).map(normFeat).sort(byName);
const cleanFeats = list => ({ v: 1, feats: list.filter(f => !f._new).map(stripIds).sort(byName) });
/* every class gains a feat at every Nth level (Character Creator rules: featEvery, 0 = off) */
const featEvery = () => { const r = typeof CREATOR !== "undefined" && CREATOR && CREATOR.rules ? CREATOR.rules.featEvery : undefined, n = parseInt(r, 10); return r === undefined || r === "" || isNaN(n) ? 2 : Math.max(0, n) };
const featLevels = (max = 20) => { const n = featEvery(); return n ? Array.from({ length: Math.floor(max / n) }, (_, i) => (i + 1) * n) : [] };
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
/* features a class has by a given level; features without a level count as 1st level */
const featsAt = (fs, lv) => fs.filter(f => (f.lv || 1) <= lv);
const gearLine = g => g.map(x => (x.qty > 1 ? x.qty + "× " : "") + x.n).join(", ");

/* dice: "4d8 (G)", "2d6 x 10 (S)", "3d4 + 2 (G)"; amounts are in coins of the unit given (gold when none is given) */
const DICE_RE = /(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*(?:[x×*]\s*(\d+))?\s*(?:\(?\s*([CSGP])\b\s*\)?)?/i;
function parseDice(t) {
  const m = String(t || "").match(DICE_RE); if (!m) return null;
  return { n: Math.min(50, +m[1] || 1), sides: +m[2], add: m[3] ? (m[3] === "-" ? -1 : 1) * +m[4] : 0, times: +m[5] || 1, unit: (m[6] || "G").toUpperCase(), text: m[0].trim() };
}
function rollDice(d) {
  const a = new Uint32Array(d.n); crypto.getRandomValues(a);
  const dice = [...a].map(x => x % d.sides + 1), total = Math.max(0, (dice.reduce((s, x) => s + x, 0) + d.add) * d.times);
  return { dice, total, coins: total * COIN[d.unit] };
}
/* formulas such as "max(1, INT + floor(level / 2))": ability names become modifiers, level the character's level */
function formula(expr, abilityMod, level) {
  if (!str(expr)) return null;
  let e = lcs(expr).replace(/\b(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)(?:\s+modifier)?\b/g, m => "(" + abilityMod(m.slice(0, 3)) + ")")
    .replace(/\b(?:level|lvl)\b/g, "(" + level + ")").replace(/\b(floor|ceil|max|min|round)\b/g, "Math.$1");
  if (/[^0-9+\-*/().,\s]/.test(e.replace(/Math\.(floor|ceil|max|min|round)/g, ""))) return null;
  try { const v = Function('"use strict";return (' + e + ")")(); return Number.isFinite(v) ? Math.floor(v) : null } catch (x) { return null }
}
const schoolOf = s => str(s && s.f && s.f.cat).replace(/\s*\(.*?\)\s*/g, "").trim();
