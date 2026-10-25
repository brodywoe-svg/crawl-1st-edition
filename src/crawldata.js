/* Shared by the Character Creator, Classes and Backgrounds pages.
   crawl-classes.json     = {v:1, classes:[cls]}
     cls  = {id, n, role, desc, source, cast, spells, hd, hp, saves, skills, skillPts, prof, langs,
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
/* a feature can be a choice: "choose `pick` of these `opts`", with one more pick at each level in `more` (e.g. Fighting Style) */
const featOpts = x => arr(x).map(o => ({ n: str(o && o.n), d: str(o && o.d) })).filter(o => o.n);
const levelsOf = x => [...new Set((Array.isArray(x) ? x : String(x || "").split(/[^0-9]+/)).map(v => parseInt(v, 10)).filter(v => v > 0 && v <= 30))].sort((a, b) => a - b);
const featsOf = x => arr(x).map(f => { const o = featOpts(f && f.opts); return { n: str(f && f.n), d: str(f && f.d), ...(f && featLv(f.lv) ? { lv: featLv(f.lv) } : {}), ...(o.length ? { opts: o, pick: Math.max(1, Math.min(o.length, parseInt(f.pick, 10) || 1)), more: levelsOf(f.more) } : {}) } }).filter(f => f.n || f.d);
/* how many options of a choice feature a character has by a level */
const picksAt = (f, lv) => !f.opts || (f.lv || 1) > lv ? 0 : Math.min(f.opts.length, f.pick + f.more.filter(m => m <= lv).length);
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const choiceLine = f => { const w = ["", "one", "two", "three", "four", "five"]; return `Choose ${w[f.pick] || f.pick} of the following options.${f.more.length ? ` You gain another option at ${f.more.map(ordinal).join(", ")} level.` : ""}` };
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
/* what every character with a class or background gets, set with the pickers on the Classes and Backgrounds pages:
   ptypes = {v: {Strength: "P"}, s: {Athletics: "P"}, w: {Swords: "SM"}, a: {"Light Armor": "P"}, t: {Alchemy: "B"}}.
   A weapon's letters are exactly the types it gives (Simple, Martial and/or Exotic, each separate);
   a trade's letter is the highest tier the character can craft. */
const W_TIERS = [["S", "Simple"], ["M", "Martial"], ["E", "Exotic"]], T_TIERS = [["B", "Basic"], ["A", "Advanced"], ["M", "Master"]], P_TIER = [["P", "Proficient"]];
const PT_KINDS = [["v", "save", "Saving Throws", P_TIER], ["s", "skill", "Skill Proficiencies", P_TIER], ["w", "weapon", "Weapon Proficiencies", W_TIERS], ["a", "armor", "Armor Proficiencies", P_TIER], ["t", "trade", "Trade Skill Proficiencies", T_TIERS]];
/* Unarmed and Miscellaneous weapons have no Simple/Martial/Exotic: proficient or not, like armor ("P") */
const UNTYPED_W = ["Unarmed", "Miscellaneous"];
const untyped = (cat, n) => cat === "weapon" && UNTYPED_W.includes(n);
const tierVal = (cat, v, n) => { v = str(v); if (untyped(cat, n)) return v ? "P" : ""; return cat === "weapon" ? W_TIERS.map(t => t[0]).filter(t => v.includes(t)).join("") : cat === "trade" ? (T_TIERS.some(t => t[0] === v) ? v : "") : v ? "P" : "" };
const tierWords = (cat, v) => (cat === "weapon" ? W_TIERS : cat === "trade" ? T_TIERS : []).filter(t => str(v).includes(t[0])).map(t => t[1]).join(", ");
function ptypesOf(x) {
  const out = {};
  PT_KINDS.forEach(([k, cat]) => { const m = {}, src = (x && typeof x === "object" && x[k]) || {}; choiceOptions(cat).forEach(n => { const v = tierVal(cat, src[n], n); if (v) m[n] = v }); if (Object.keys(m).length) out[k] = m });
  return out;
}
const ptypeText = (pt, k) => { const cat = PT_KINDS.find(x => x[0] === k)[1], m = (pt || {})[k] || {}; return Object.keys(m).map(n => { const w = tierWords(cat, m[n]); return w ? `${n} (${w})` : n }).join(", ") };
/* the class or background facts: what it always gives (old written-in text first), then the player's choices */
const OLD_TEXT = { save: "saves", skill: "skills", weapon: "weapons", armor: "armor", trade: "trades" };
const profFacts = p => [...PT_KINDS.map(([k, cat, label]) => [label, [p[OLD_TEXT[cat]], ptypeText(p.ptypes, k)].filter(Boolean).join(", ")]), ["Other Proficiencies", p.prof], ["Languages", p.langs], ...arr(p.choices).map(ch => ["Proficiency choice", choiceText(ch)])];
function normClass(p) {
  p = p || {};
  return { id: str(p.id) || newId("class"), n: str(p.n), role: str(p.role), desc: str(p.desc), source: SOURCES.includes(str(p.source)) ? str(p.source) : "", cast: AB[str(p.cast)] ? str(p.cast) : "",
    spells: str(p.spells), hd: str(p.hd), hp: str(p.hp), saves: str(p.saves), skills: str(p.skills), skillPts: str(p.skillPts), prof: str(p.prof), langs: str(p.langs),
    chart: chartOf(p.chart), feats: featsOf(p.feats), loadouts: arr(p.loadouts).map((l, i) => ({ n: str(l && l.n) || `Loadout ${i + 1}`, gear: gearOf(l && l.gear) })).filter(l => l.gear.length || l.n),
    money: str(p.money), moneyRoll: str(p.moneyRoll), extra: extrasOf(p.extra), choices: choicesOf(p.choices), ptypes: ptypesOf(p.ptypes),
    prepared: str(p.prepared), startRank: str(p.startRank), schoolStart: str(p.schoolStart), oppCost: str(p.oppCost), majorLv: str(p.majorLv), minorLv: str(p.minorLv),
    schools: arr(p.schools).map(r => ({ s: str(r && r.s), opp: str(r && r.opp) })).filter(r => r.s),
    subs: arr(p.subs).filter(s => s && str(s.n)).map(s => ({ id: str(s.id) || newId("sub"), n: str(s.n), desc: str(s.desc), feats: featsOf(s.feats), extra: extrasOf(s.extra), _id: ++uid })).sort(byName), _id: ++uid };
}
function normBg(p) {
  p = p || {};
  return { id: str(p.id) || newId("bg"), n: str(p.n), desc: str(p.desc), skills: str(p.skills), weapons: str(p.weapons), armor: str(p.armor), trades: str(p.trades), prof: str(p.prof), langs: str(p.langs), choices: choicesOf(p.choices), ptypes: ptypesOf(p.ptypes),
    gear: gearOf(p.gear).concat(p.equip && !arr(p.gear).length ? gearOf(String(p.equip).split(/[,;\n]+/)) : []), wealth: str(p.wealth), feats: featsOf(p.feats), extra: extrasOf(p.extra), _id: ++uid };
}
/* "choose from" groups: the player picks n of the listed options */
const CHOICE_KINDS = [["skill", "skill", "skills"], ["save", "saving throw", "saving throws"], ["weapon", "weapon proficiency", "weapon proficiencies"], ["armor", "armor proficiency", "armor proficiencies"], ["trade", "trade skill", "trade skills"], ["lang", "language", "languages"]];
function choiceOptions(cat) {
  if (cat === "skill") return ["Acrobatics", "Animal Handling", "Appraisal", "Arcane", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Lore", "Medicine", "Nature", "Occult", "Perception", "Performance", "Persuasion", "Religion", "Stealth", "Thievery"];
  if (cat === "save") return ABIL.map(a => a[1]);
  if (cat === "weapon") return ["Axes", "Blades", "Bows", "Crossbows", "Cudgels", "Firearms", "Polearms", "Swords", "Unarmed", "Miscellaneous"];
  if (cat === "armor") return ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"];
  if (cat === "trade") return [...new Set(["Alchemy", "Blacksmithing", "Cooking", "Enchanting", "Goldsmithing", "Leatherworking", "Scribing", "Tailoring", "Tinkering", "Woodworking", ...arr(typeof CATALOG !== "undefined" && CATALOG ? CATALOG.recipes : []).map(r => str(r && r.prof))].filter(Boolean))].sort();
  return [];
}
/* each weapon or trade option in a choice says what it gives (ot = {Swords: "SM"}); unset = Simple, or Basic for trades.
   The old one-type-for-the-whole-list "tier" (Martial meant Simple and Martial) is turned into ot. */
const CHOICE_TIERS = { weapon: W_TIERS, trade: T_TIERS };
const choiceDefault = cat => cat === "weapon" ? "S" : cat === "trade" ? "B" : "";
const optTier = (ch, o) => untyped(ch.cat, o) ? "" : (ch.ot && ch.ot[o]) || choiceDefault(ch.cat);
const choicesOf = x => arr(x).map(ch => { const cat = CHOICE_KINDS.some(k => k[0] === (ch && ch.cat)) ? ch.cat : "skill", opts = [...new Set(arr(ch && ch.opts).map(str).filter(Boolean))], ot = {};
  if (CHOICE_TIERS[cat]) { const t = str(ch && ch.tier), old = cat === "weapon" ? { M: "SM", E: "SME" }[t] || "" : tierVal(cat, t);
    opts.filter(o => !untyped(cat, o)).forEach(o => { const v = tierVal(cat, ((ch && ch.ot) || {})[o]) || old; if (v && v !== choiceDefault(cat)) ot[o] = v }) }
  return { n: Math.max(1, Math.min(20, parseInt(ch && ch.n, 10) || 1)), cat, opts, ...(Object.keys(ot).length ? { ot } : {}) } }).filter(ch => ch.opts.length);
function choiceText(ch) {
  const k = CHOICE_KINDS.find(x => x[0] === ch.cat) || CHOICE_KINDS[0], words = ["", "one", "two", "three", "four", "five", "six"];
  /* one type for every option goes in front ("Choose one Simple and Martial weapon proficiency"); otherwise the ones that differ from Simple/Basic say so after their name */
  const typed = ch.opts.filter(o => !untyped(ch.cat, o)), ts = [...new Set(typed.map(o => optTier(ch, o)))], same = ts.length <= 1, lead = same && ts.length && ts[0] !== choiceDefault(ch.cat) ? tierWords(ch.cat, ts[0]).replace(/, (?=[^,]*$)/, " and ") + " " : "";
  const names = ch.opts.map(o => same || !CHOICE_TIERS[ch.cat] || untyped(ch.cat, o) || optTier(ch, o) === choiceDefault(ch.cat) ? o : `${o} (${tierWords(ch.cat, optTier(ch, o))})`);
  const list = names.length > 1 ? names.slice(0, -1).join(", ") + " or " + names[names.length - 1] : names[0];
  return `Choose ${words[ch.n] || ch.n} ${lead}${ch.n === 1 ? k[1] : k[2]} from ${list}`;
}
const normClasses = j => arr(j && j.classes).filter(c => c && str(c.n)).map(normClass).sort(byName);
const normBgs = j => arr(j && j.backgrounds).filter(b => b && str(b.n)).map(normBg).sort(byName);
const stripIds = ({ _id, _new, ...x }) => x;
const cleanClasses = list => ({ v: 1, classes: list.filter(c => !c._new).map(c => ({ ...stripIds(c), subs: c.subs.filter(s => !s._new).map(stripIds).sort(byName) })).sort(byName) });
const cleanBgs = list => ({ v: 1, backgrounds: list.filter(b => !b._new).map(stripIds).sort(byName) });
/* feats (crawl-feats.json): name, category, prerequisite, description, extra details */
function normFeat(p) { p = p || {}; return { id: str(p.id) || newId("feat"), n: str(p.n), cat: str(p.cat), pre: str(p.pre), desc: str(p.desc), extra: extrasOf(p.extra), ...(p.badge === true || p.badge === "on" ? { badge: true } : {}), _id: ++uid } }
const normFeats = j => arr(j && j.feats).filter(f => f && str(f.n)).map(normFeat).sort(byName);
const cleanFeats = list => ({ v: 1, feats: list.filter(f => !f._new).map(stripIds).sort(byName) });
/* every class gains a feat at every Nth level (Character Creator rules: featEvery, 0 = off) */
const featEvery = () => { const r = typeof CREATOR !== "undefined" && CREATOR && CREATOR.rules ? CREATOR.rules.featEvery : undefined, n = parseInt(r, 10); return r === undefined || r === "" || isNaN(n) ? 2 : Math.max(0, n) };
const featLevels = (max = 20) => { const n = featEvery(); return n ? Array.from({ length: Math.floor(max / n) }, (_, i) => (i + 1) * n) : [] };
/* features a class has by a given level; features without a level count as 1st level */
const featsAt = (fs, lv) => fs.filter(f => (f.lv || 1) <= lv);
const gearLine = g => g.map(x => (x.qty > 1 ? x.qty + "× " : "") + x.n).join(", ");

/* dice: "4d8 (G)", "2d6 x 10 (S)", "3d4 + 2 (G)"; amounts are in coins of the unit given (gold when none is given) */
const DICE_RE = /(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*(?:[x×*]\s*(\d+))?\s*(?:\(?\s*([CSGP])\b\s*\)?)?/i;
function parseDice(t) {
  const m = String(t || "").match(DICE_RE); if (!m) return null;
  return { n: Math.min(50, +m[1] || 1), sides: +m[2], add: m[3] ? (m[3] === "-" ? -1 : 1) * +m[4] : 0, times: +m[5] || 1, unit: (m[6] || "G").toUpperCase(), text: m[0].trim() };
}
/* several rolls, each in its own coin: "3d6 (G) + 2d4 (S)" */
const parseRolls = t => [...String(t || "").matchAll(new RegExp(DICE_RE.source, "gi"))].map(m => parseDice(m[0])).filter(Boolean);
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
