/* Character Creator.
   Classes come from crawl-classes.json (the Classes page), backgrounds from crawl-backgrounds.json
   (the Backgrounds page) and rules from crawl-creator.json = {v:1, rules:{wealth, rank, spellRank, passive, langs}}.
   Races come from crawl-races.json, spells from crawl-spells.json, items from crawl-items.json and
   conditions and tooltips from crawl-glossary.json, so the creator follows every other page.
   Characters live in this browser (localStorage "crawl-characters") and can be saved to a file.
   Runs after the shared admin code, src/editkit.js and src/crawldata.js. */
const sign = n => (n >= 0 ? "+" : "−") + Math.abs(n);
const modOf = s => Math.floor((s - 10) / 2);
const RM = matchMedia("(prefers-reduced-motion: reduce)");
const LEVEL = 1;

/* ---------------------------------------------------------------- the rules on the sheet */
const SKILLS = { str: ["Athletics"], dex: ["Acrobatics", "Thievery", "Stealth"], con: [], int: ["Appraisal", "Arcane", "Investigation", "Lore", "Nature"], wis: ["Animal Handling", "Insight", "Medicine", "Perception", "Religion"], cha: ["Deception", "Intimidation", "Occult", "Performance", "Persuasion"] };
const SKILL_AB = Object.fromEntries(ABIL.flatMap(([k]) => SKILLS[k].map(n => [n, k])));
const WEAPONS = ["Axes", "Blades", "Bows", "Crossbows", "Cudgels", "Firearms", "Polearms", "Swords", "Special", "Miscellaneous"];
const ARMORS = ["Light Armor", "Medium Armor", "Heavy Armor", "Shields"];
const TRADES = [...new Set(["Alchemy", "Blacksmithing", "Cooking", "Enchanting", "Goldsmithing", "Leatherworking", "Scribing", "Tailoring", "Tinkering", "Woodworking",
  ...arr(CATALOG.recipes).map(r => str(r && r.prof))].filter(Boolean))].sort();
const WTIERS = [["S", "Simple"], ["M", "Martial"], ["E", "Exotic"]];
const TTIERS = [["B", "Basic"], ["A", "Advanced"], ["M", "Master"]];
const SLOTS = [["main", "Main-Hand"], ["off", "Off-Hand"], ["head", "Head"], ["neck", "Neck"], ["shoulders", "Shoulders"], ["torso", "Torso"], ["waist", "Waist"], ["arms", "Arms"], ["hands", "Hands"], ["legs", "Legs"], ["feet", "Feet"], ["ring1", "Rings"], ["ring2", "Rings"], ["other", "Others"]];
const EXPERTISE = [["Identify Poison", "Medicine", "MED"], ["Detect Traps", "Thievery", "THI"], ["Detect Illusions", "Arcane", "ARC"], ["Identify Item", "Appraisal", "APP"], ["Decipher Script", "Lore", "LOR"], ["Identify Creature", "Nature", "NAT"], ["Identify Tracks", "Animal Handling", "ANI"], ["Detect Curses", "Religion", "REL"]];
const SENSES = ["Darkvision", "Infravision", "Truesight", "Echolocation", "Tremorsense"];
const MOVES = ["Ground", "Climbing", "Swimming", "Flying"];
const PASSIVE = ["Perception", "Investigation", "Insight", "Stealth"];
const SHEET_CONDITIONS = ["Bleeding", "Blinded", "Charmed", "Drenched", "Dazed", "Deafened", "Enflamed", "Frightened", "Grappled", "Incapacitated", "Invisible", "Muted", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Sickened", "Stunned", "Unconscious"];

/* ---------------------------------------------------------------- data */
function normRaces(j) {
  const part = p => ({ id: str(p.id), n: str(p.n), desc: str(p.desc), asi: str(p.asi), prof: str(p.prof), langs: str(p.langs), feats: featsOf(p.feats), extra: extrasOf(p.extra) });
  return arr(j && j.races).filter(r => r && str(r.n)).map(r => ({ ...part(r), subs: arr(r.subs).filter(s => s && str(s.n)).map(part).sort(byName) })).sort(byName);
}
const RULE_DEFAULTS = { wealth: "25 (G)", rank: "1", spellRank: "1", passive: "10", langs: "Common" };
function normRules(j) {
  if (!j || typeof j !== "object") return null;
  const rules = { ...RULE_DEFAULTS }; for (const k in RULE_DEFAULTS) if (j.rules && j.rules[k] != null) rules[k] = str(j.rules[k]);
  return rules;
}
const CR = { classes: normClasses(CLASSES), backgrounds: normBgs(BACKGROUNDS), rules: normRules(CREATOR) || { ...RULE_DEFAULTS } };
const cleanCreator = () => ({ v: 1, rules: { ...CR.rules } });
let RULES_ORIG = JSON.stringify(cleanCreator());
let RACE_LIST = normRaces(RACES);
let SPELL_LIST = arr(SPELLS);
let ITEMS = arr(CATALOG.items);

/* ---------------------------------------------------------------- reading the race, class and background text */
const NUMS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, any: 1 };
const numberIn = p => { const m = lcs(p).match(/\b(\d+|a|an|one|two|three|four|five|six)\b(?!\s*(?:\(|ft|lbs))/); return m ? (+m[1] || NUMS[m[1]] || 1) : 1 };
const NAME_INDEX = [
  ...Object.keys(SKILL_AB).map(n => ({ cat: "skill", name: n, re: n })),
  ...WEAPONS.map(n => ({ cat: "weapon", name: n, re: n.endsWith("s") && n !== "Miscellaneous" ? n.slice(0, -1) + "s?" : n })),
  ...ARMORS.map(n => ({ cat: "armor", name: n, re: n === "Shields" ? "Shields?" : n.replace(" Armor", " Armou?r") })),
  ...TRADES.map(n => ({ cat: "trade", name: n, re: n }))
].map(x => ({ ...x, rx: new RegExp("\\b" + x.re + "\\b", "i") }));
function catIn(p) {
  p = lcs(p);
  return /trade skill|tool|profession|craft/.test(p) ? "trade" : /saving throw|\bsaves?\b/.test(p) ? "save" : /skill/.test(p) ? "skill" : /weapon/.test(p) ? "weapon" : /armou?r|shield/.test(p) ? "armor" : /language/.test(p) ? "lang" : "";
}
function tiersIn(p, cat) {
  const w = cat === "trade" ? [["B", /basic|novice|apprentice/i], ["A", /advanced|adept|journeyman/i], ["M", /master/i]] : [["S", /simple/i], ["M", /martial/i], ["E", /exotic/i]];
  const t = w.filter(([, re]) => re.test(p)).map(x => x[0]);
  return t.length ? t : [cat === "trade" ? "B" : "S"];
}
const findNames = p => NAME_INDEX.filter(x => x.rx.test(p));
const CHOICE_RE = /\bchoice\b|\bchoose\b|\badditional\b|\bany\b|\bextra\b/i;
/* "Athletics, Either Goldsmithing or Tinkering, Two skills of your choice" -> fixed names, either-or choices and free picks */
function parseProf(text, src, key) {
  const out = { fixed: [], picks: [] };
  plainText(text).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach((p, i) => {
    const names = findNames(p);
    if (/\beither\b|\bor\b/i.test(p) && names.length >= 2) { out.picks.push({ key: key + i, cat: names[0].cat, n: 1, opts: names.map(x => x.name), src }); return }
    if (CHOICE_RE.test(p) && !names.length) { const cat = catIn(p); if (cat && cat !== "lang") out.picks.push({ key: key + i, cat, n: numberIn(p), src }); return }
    names.forEach(x => out.fixed.push({ cat: x.cat, name: x.name, tiers: x.cat === "weapon" || x.cat === "armor" || x.cat === "trade" ? tiersIn(p, x.cat) : [], src }));
  });
  return out;
}
function parseLangs(text, src) {
  const out = { fixed: [], picks: 0 };
  plainText(text).split(/[,;\n]+|\band\b/i).map(s => s.trim().replace(/[.]+$/, "")).filter(Boolean).forEach(p => {
    if (CHOICE_RE.test(p) || /language/i.test(p)) { if (/language|choice/i.test(p)) out.picks += numberIn(p); return }
    if (p.length <= 30) out.fixed.push({ name: p.replace(/^\w/, c => c.toUpperCase()), src });
  });
  return out;
}
const AB_RE = "(strength|dexterity|constitution|intelligence|wisdom|charisma|str|dex|con|int|wis|cha)\\b";
function parseASI(text) {
  const out = { fixed: {}, picks: [] }; const t = plainText(text);
  const pick = t.match(/([+-]?\d+)\s+to\s+(?:(\w+)\s+)?(?:different\s+)?ability\s+scores?/i);
  if (pick) out.picks.push({ n: pick[2] ? (+pick[2] || NUMS[lcs(pick[2])] || 1) : 1, amt: parseInt(pick[1], 10) || 1 });
  t.replace(new RegExp("([+-]\\d+)\\s*(?:to\\s+)?(?:your\\s+)?" + AB_RE, "gi"), (m, n, a) => { const k = lcs(a).slice(0, 3); out.fixed[k] = (out.fixed[k] || 0) + parseInt(n, 10); return m });
  return out;
}
const abilsIn = t => ABIL.filter(([k, n]) => new RegExp("\\b(" + n + "|" + k + ")\\b", "i").test(plainText(t))).map(x => x[0]);

/* ---------------------------------------------------------------- the character */
const LS = "crawl-characters";
let chars = [], cur = null, view = "home", saveT = 0;
try { chars = arr(JSON.parse(localStorage.getItem(LS) || "[]")).filter(c => c && c.id) } catch (e) { chars = [] }
function blankChar() {
  return { id: newId("pc"), v: 1, name: "", race: "", sub: "", cls: "", subcls: "", bg: "", bgCustom: null, loadout: "", method: "roll", base: {}, dice: {}, stored: null, rolls: 0, asi: [],
    prof: { skill: {}, save: {}, weapon: {}, armor: {}, trade: {} }, choice: {}, langs: [], spells: [], inv: [], details: {}, rank: {}, sheet: {}, seen: {}, step: 0, done: false, made: Date.now() };
}
function fixChar(c) {
  const b = blankChar(); c = { ...b, ...c }; c.prof = { ...b.prof, ...(c.prof || {}) }; for (const k of ["base", "dice", "choice", "details", "rank", "sheet", "seen"]) c[k] = c[k] && typeof c[k] === "object" ? c[k] : {};
  for (const k of ["asi", "langs", "spells", "inv"]) c[k] = arr(c[k]); return c;
}
chars = chars.map(fixChar);
function persist(now) {
  clearTimeout(saveT);
  const go = () => { try { localStorage.setItem(LS, JSON.stringify(chars)) } catch (e) { say("This browser couldn't save your character. Use Save to file so you don't lose it.") } };
  if (now) go(); else saveT = setTimeout(go, 250);
}
function touch() { if (!cur) return; cur.edited = Date.now(); if (!chars.includes(cur)) chars.unshift(cur); persist() }
const raceOf = c => RACE_LIST.find(r => r.id === c.race) || null;
const subOf = c => { const r = raceOf(c); return r && r.subs.find(s => s.id === c.sub) || null };
const clsOf = c => CR.classes.find(x => x.id === c.cls) || null;
const subclsOf = c => { const k = clsOf(c); return k && k.subs.find(s => s.id === c.subcls) || null };
const bgOf = c => c.bg === "custom" ? (c.bgCustom ? { n: str(c.bgCustom.n) || "Custom background", desc: str(c.bgCustom.desc), skills: "", prof: "", langs: "", gear: [], wealth: "", feats: [], extra: [] } : null) : CR.backgrounds.find(b => b.id === c.bg) || null;
/* everything that gives the character something; class and subclass features only count up to the character's level */
function sources(c) {
  return [[raceOf(c), "race"], [subOf(c), "sub"], [clsOf(c), "class"], [subclsOf(c), "subclass"], [bgOf(c), "bg"]].filter(x => x[0])
    .map(([p, kind]) => ({ p, kind, label: p.n, feats: kind === "class" || kind === "subclass" ? featsAt(p.feats, LEVEL) : p.feats }));
}
const chartRow = c => { const k = clsOf(c); return k ? k.chart.filter(r => (r.lv || 1) <= LEVEL).pop() || null : null };
const skillPoints = c => { const k = clsOf(c); return k ? Math.max(0, parseInt(k.skillPts, 10) || 0) : 0 };
function grants(c) {
  const fixed = new Map(), picks = [];
  const add = (f, src) => { const k = f.cat + "|" + f.name; const g = fixed.get(k) || { cat: f.cat, name: f.name, tiers: new Set(), src: [] }; f.tiers.forEach(t => g.tiers.add(t)); if (!g.src.includes(src)) g.src.push(src); fixed.set(k, g) };
  for (const s of sources(c)) {
    const parts = [parseProf(s.p.skills || "", s.label, s.kind + ":s"), parseProf(s.p.prof || "", s.label, s.kind + ":p")];
    s.feats.forEach((f, i) => { const m = f.d.match(/proficien\w*\s+(?:in|with)\s+([^.]+)/i); if (m) parts.push(parseProf(m[1], `${s.label} (${f.n})`, s.kind + ":f" + i)) });
    if (s.kind === "class") abilsIn(s.p.saves).forEach(k => add({ cat: "save", name: k, tiers: [] }, s.label));
    for (const pr of parts) {
      pr.fixed.forEach(f => add(f, s.label));
      pr.picks.forEach(p => {
        if (p.opts) { const ch = c.choice[p.key]; if (ch && p.opts.includes(ch)) add({ cat: p.cat, name: ch, tiers: [p.cat === "trade" ? "B" : p.cat === "skill" ? "" : "S"].filter(Boolean) }, s.label + " (your choice)"); }
        picks.push(p);
      });
    }
  }
  return { fixed, picks };
}
function langGrants(c) {
  const fixed = new Map(); let picks = 0, from = [];
  for (const s of sources(c)) { const l = parseLangs(s.p.langs || "", s.label); l.fixed.forEach(f => { if (!fixed.has(lcs(f.name))) fixed.set(lcs(f.name), f) }); if (l.picks) { picks += l.picks; from.push(`${s.label} ${l.picks}`) } }
  return { fixed: [...fixed.values()], picks, from };
}
function asiInfo(c) {
  const fixed = {}, picks = [], from = [];
  for (const s of sources(c)) {
    if (!s.p.asi) continue; const a = parseASI(s.p.asi);
    for (const k in a.fixed) { fixed[k] = (fixed[k] || 0) + a.fixed[k]; from.push(`${s.label}: ${sign(a.fixed[k])} ${AB[k]}`) }
    a.picks.forEach(p => { for (let i = 0; i < p.n; i++) picks.push({ amt: p.amt, src: s.label }) });
  }
  return { fixed, picks, from };
}
function racial(c, k) {
  const a = asiInfo(c); let n = a.fixed[k] || 0;
  a.picks.forEach((p, i) => { if (c.asi[i] === k) n += p.amt });
  return n;
}
const baseOf = (c, k) => Number.isFinite(+c.base[k]) && c.base[k] !== "" && c.base[k] != null ? +c.base[k] : null;
const score = (c, k) => { const b = baseOf(c, k); return b == null ? null : b + racial(c, k) };
const mod = (c, k) => { const s = score(c, k); return s == null ? 0 : modOf(s) };
/* proficiency checks: given by the race, class or background, or picked by the player */
function profState(c, g = grants(c)) {
  const has = (cat, name) => g.fixed.has(cat + "|" + name);
  return {
    g,
    skill: n => has("skill", n) || !!c.prof.skill[n],
    save: k => has("save", k) || !!c.prof.save[k],
    tiers: (cat, n) => { const t = new Set(has(cat, n) ? g.fixed.get(cat + "|" + n).tiers : []); Object.keys(c.prof[cat][n] || {}).forEach(x => { if (c.prof[cat][n][x]) t.add(x) }); return t },
    trade: n => { const order = ["B", "A", "M"], f = has("trade", n) ? [...g.fixed.get("trade|" + n).tiers] : [], m = c.prof.trade[n] ? [c.prof.trade[n]] : []; return [...f, ...m].sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] || "" },
    given: (cat, n) => has(cat, n) ? g.fixed.get(cat + "|" + n) : null
  };
}
const defRank = () => Math.max(0, parseInt(CR.rules.rank, 10) || 0);
const rankOf = (c, key, prof) => c.rank[key] != null ? +c.rank[key] : prof ? defRank() : 0;
const skillTotal = (c, n, ps) => mod(c, SKILL_AB[n]) + rankOf(c, "skill:" + n, ps.skill(n));
const saveTotal = (c, k, ps) => mod(c, k) + rankOf(c, "save:" + k, ps.save(k));
function pickCount(c, ps, cat) {
  const allow = ps.g.picks.filter(p => p.cat === cat && !p.opts).reduce((n, p) => n + p.n, 0);
  let chosen = 0;
  if (cat === "skill") chosen = Object.keys(c.prof.skill).filter(n => c.prof.skill[n] && !ps.given("skill", n)).length;
  else if (cat === "save") chosen = Object.keys(c.prof.save).filter(k => c.prof.save[k] && !ps.given("save", k)).length;
  else if (cat === "trade") chosen = Object.keys(c.prof.trade).filter(n => c.prof.trade[n] && !ps.given("trade", n)).length;
  else chosen = Object.keys(c.prof[cat]).filter(n => !ps.given(cat, n) && Object.values(c.prof[cat][n] || {}).some(Boolean)).length;
  return { allow, chosen, from: ps.g.picks.filter(p => p.cat === cat && !p.opts).map(p => `${p.src} ${p.n}`) };
}
function hpOf(c) {
  const k = clsOf(c); if (!k || !k.hp) return null;
  const m = k.hp.match(/\d+/); if (!m) return null;
  const con = /con/i.test(k.hp) || /^\s*\d+\s*$/.test(k.hp) ? mod(c, "con") : 0;
  return Math.max(1, +m[0] + con);
}
/* a class either hands out a loadout or its Starting Currency to buy gear with; a background can add wealth on top */
const buying = c => { const k = clsOf(c); return !k || !k.loadouts.length || c.loadout === "buy" };
function classMoney(c) { const k = clsOf(c); const m = k && toC(k.money); return m != null ? m : (toC(CR.rules.wealth) || 0) }
function startingWealth(c) { const b = bgOf(c); return (buying(c) ? classMoney(c) : 0) + ((b && toC(b.wealth)) || 0) }
function skillSpent(c, ps) { return Object.keys(SKILL_AB).reduce((n, s) => { const r = c.rank["skill:" + s]; return r == null ? n : n + Math.max(0, +r - (ps.skill(s) ? defRank() : 0)) }, 0) }
const spentC = c => c.inv.reduce((n, x) => n + (x.paid || 0) * (x.qty || 1), 0);
const itemById = id => ITEMS.find(i => i.id === id) || null;
const invName = x => { const it = x.iid && itemById(x.iid); return it ? it.n : str(x.n) };
function canLearn(s, k) {
  if (!k || !k.source) return false;
  const req = str(s.f && s.f.cls);
  if (req) return new RegExp("\\b" + k.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?\\b", "i").test(req);
  return arr(s.tags).includes(k.source);
}
const maxRank = () => parseInt(CR.rules.spellRank, 10) || 1;
const spellLimit = c => { const k = clsOf(c); const n = k && parseInt(k.spells, 10); return n > 0 ? n : 0 };

/* ---------------------------------------------------------------- glossary tooltips (red underline, popup on hover or tap) */
let GL_RE = null; const GL_MAP = new Map();
(function () {
  const a = normGlossary(GLOSSARY) || []; const tips = a.filter(e => e.tip);
  tips.forEach(e => { const k = e.n.toLowerCase(); if (!GL_MAP.has(k)) GL_MAP.set(k, { e, w: e.n, ref: "" }) });
  tips.forEach(e => e.aka.forEach(x => { const k = x.w.toLowerCase(); if (!GL_MAP.has(k)) GL_MAP.set(k, { e, w: x.w, ref: x.ref }) }));
  const terms = [...GL_MAP.keys()].sort((x, y) => y.length - x.length).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  GL_RE = terms.length ? new RegExp("\\b(" + terms.join("|") + ")\\b", "gi") : null;
})();
/* rich text with glossary words marked, without touching the inside of tags */
function rich(t) { const h = richInline(t); return GL_RE ? h.split(/(<[^>]+>)/).map(s => s.startsWith("<") ? s : s.replace(GL_RE, m => `<span class="gl" tabindex="0" data-g="${m.toLowerCase()}">${m}</span>`)).join("") : h }
function richParas(t) { return String(t || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => `<p>${rich(x)}</p>`).join("") }
const gtip = document.createElement("div"); gtip.className = "gtip"; gtip.id = "gtip"; gtip.setAttribute("role", "tooltip"); gtip.hidden = true; document.body.appendChild(gtip);
let gCur = null;
function showTip(el) {
  const hit = GL_MAP.get(el.dataset.g); if (!hit) return; const e = hit.e; gCur = el;
  gtip.innerHTML = hit.ref ? `<div class="gth"><span>${esc(hit.w)}</span><span class="gtag">${esc(singular(e.sec))}</span></div><div class="gtb">${paras(hit.ref)}<p class="gfrom">From ${esc(e.n)}</p></div>`
    : `<div class="gth"><span>${esc(e.n)}</span><span class="gtag">${esc(singular(e.sec))}</span></div><div class="gtb">${paras(e.lead)}${e.fx.length ? `<ul>${e.fx.map(x => `<li>${richInline(x)}</li>`).join("")}</ul>` : ""}</div>`;
  gtip.hidden = false;
  const r = el.getBoundingClientRect(), w = gtip.offsetWidth, h = gtip.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  let y = r.bottom + 8; if (y + h > vh - 12 && r.top - h - 8 > 12) y = r.top - h - 8;
  gtip.style.left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12) + "px"; gtip.style.top = Math.max(12, y) + "px";
}
const hideTip = () => { gCur = null; gtip.hidden = true };
const glAt = t => t && t.closest ? t.closest(".gl") : null;
document.addEventListener("pointerover", ev => { if (ev.pointerType === "mouse") { const el = glAt(ev.target); if (el) showTip(el) } });
document.addEventListener("pointerout", ev => { if (ev.pointerType === "mouse") { const el = glAt(ev.target); if (el && !el.contains(ev.relatedTarget)) hideTip() } });
document.addEventListener("focusin", ev => { const el = glAt(ev.target); if (el) showTip(el) });
document.addEventListener("click", ev => { const el = glAt(ev.target); if (el) showTip(el); else hideTip() });
window.addEventListener("scroll", hideTip, { passive: true, capture: true });

/* ---------------------------------------------------------------- shared bits of markup */
const say = m => { $("gmsg").textContent = m || "" };
const factsHTML = rows => { rows = rows.filter(r => r[1]); return rows.length ? `<dl class="gfacts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${rich(v)}</dd>`).join("")}</dl>` : "" };
const featHTML = fs => fs.length ? `<div class="rfeats">${fs.map(f => `<p>${f.n ? `<span class="pdn">${esc(f.n)}</span> - ` : ""}${rich(f.d)}</p>`).join("")}</div>` : "";
const infoBox = (title, tag, body, link) => `<div class="cih"><span>${esc(title)}</span>${tag ? `<span class="ctag">${esc(tag)}</span>` : ""}</div><div class="cib">${body || `<p class="muted">Nothing written here yet.</p>`}${link || ""}</div>`;
function partInfo(p, tag, link, feats) {
  const row1 = p.chart && p.chart.filter(r => (r.lv || 1) <= LEVEL).pop();
  return infoBox(p.n, tag, (p.desc ? `<div class="clead">${richParas(p.desc)}</div>` : "") +
    factsHTML([["Ability Score Increases", p.asi], ["Magic source", p.source], ["Spellcasting ability", p.cast && AB[p.cast]], ["Hit die", p.hd], ["Hit points at 1st level", p.hp],
      ["Max Pool at 1st level", row1 && row1.pool], ["Action Die at 1st level", row1 && row1.die], ["Saving throws", p.saves], ["Starting Skill Proficiencies", p.skills], ["Skill points", p.skillPts],
      [p.skills != null ? "Other proficiencies" : "Starting Proficiencies", p.prof], ["Languages", p.langs],
      ...arr(p.loadouts).map(l => [l.n, gearLine(l.gear)]), ["Starting Currency", p.money], ["Starting equipment", p.gear && gearLine(p.gear)], ["Starting wealth", p.wealth],
      ...p.extra.map(x => [x.k || "Detail", x.v])]) + featHTML(feats || p.feats), link);
}
function spellInfo(s) {
  const f = s.f || {};
  return infoBox(s.n, `Rank ${s.lv || "?"}`, factsHTML([["Magic source", arr(s.tags).join(", ")], ["Casting cost", f.cost], ["Casting time", f.time], ["Range", f.range], ["Damage", f.dmg], ["Type", f.type], ["Materials", f.mat], ["Requires", f.pre]]) +
    (f.desc ? `<div class="clead">${richParas(f.desc)}</div>` : ""), `<a class="glink" href="index.html?show=all#${encodeURIComponent(slugOf(s.n))}" target="_blank" rel="noopener">Open in the spell list</a>`);
}
function itemInfo(it) {
  return infoBox(it.n, [it.rarity, it.cat].filter(Boolean).join(" · "), factsHTML([["Value", it.value], ["Weight", it.weight], ["Type", [it.sub, it.slot].filter(Boolean).join(", ")], ["Properties", it.props], ["Weapon actions", it.actions]]) +
    (it.desc ? `<div class="clead">${richParas(it.desc)}</div>` : "") + featHTML(arr(it.pdefs).map(p => ({ n: p.n, d: p.d }))), `<a class="glink" href="items.html#${encodeURIComponent(it.id)}" target="_blank" rel="noopener">Open on the Items page</a>`);
}

/* ---------------------------------------------------------------- steps */
const STEPS = [
  ["race", "Race", "Choose your race"], ["class", "Class", "Choose your class"], ["bg", "Background", "Choose your background"],
  ["abil", "Abilities", "Roll your ability scores"], ["skills", "Skills", "Choose your skills"], ["prof", "Proficiencies", "Weapons, armor, trades and languages"],
  ["spells", "Spells", "Choose your spells"], ["equip", "Equipment", "Gear up"], ["look", "Appearance", "Appearance and story"], ["name", "Name", "Name your character"]
];
function stepOk(c, k) {
  const ps = profState(c);
  switch (k) {
    case "race": { const r = raceOf(c); return !!r && (!r.subs.length || !!subOf(c)) }
    case "class": { const k2 = clsOf(c); return !!k2 && (!k2.subs.length || !!subclsOf(c)) }
    case "bg": return !!bgOf(c) || (!CR.backgrounds.length && !!c.seen.bg);
    case "abil": return ABIL.every(([a]) => baseOf(c, a) != null) && asiInfo(c).picks.every((p, i) => !!AB[c.asi[i]]);
    case "skills": return !!c.seen.skills && ps.g.picks.filter(p => p.opts && p.cat === "skill").every(p => c.choice[p.key]) && ["skill", "save"].every(cat => { const n = pickCount(c, ps, cat); return n.chosen >= n.allow });
    case "prof": return !!c.seen.prof && ps.g.picks.filter(p => p.opts && p.cat !== "skill").every(p => c.choice[p.key]) && ["weapon", "armor", "trade"].every(cat => { const n = pickCount(c, ps, cat); return n.chosen >= n.allow }) && c.langs.filter(Boolean).length >= langGrants(c).picks;
    case "spells": { const k2 = clsOf(c); if (k2 && !k2.source) return !!k2; const lim = spellLimit(c); return !!c.seen.spells && (!lim || c.spells.length >= lim) }
    case "equip": { const k2 = clsOf(c); return !!c.seen.equip && (!k2 || !k2.loadouts.length || c.loadout !== "") }
    case "look": return !!c.seen[k];
    case "name": return !!str(c.name);
  }
  return false;
}
let infoDefault = "", infoMap = new Map();
function setInfo(html) { $("ccinfo").innerHTML = html || infoDefault }
function renderCreate() {
  const c = cur, i = Math.min(Math.max(0, c.step | 0), STEPS.length - 1), [k, , title] = STEPS[i];
  $("ccsteps").innerHTML = STEPS.map(([sk, t], j) => `<button type="button" class="ccstep${j === i ? " on" : ""}${stepOk(c, sk) ? " ok" : ""}" data-step="${j}"${j === i ? ' aria-current="step"' : ""}><span class="ccn">${stepOk(c, sk) ? "✓" : j + 1}</span>${esc(t)}</button>`).join("");
  infoMap = new Map(); infoDefault = "";
  const body = (STEP_VIEWS[k] || (() => ""))(c);
  $("ccmain").innerHTML = `<div class="cch"><h2>${esc(title)}</h2><span class="ccof">Step ${i + 1} of ${STEPS.length}</span></div><div class="ccbody" data-k="${k}">${body}</div>`;
  setInfo();
  $("ccBack").disabled = i === 0;
  $("ccNext").textContent = i === STEPS.length - 1 ? "Finish" : "Next";
  $("ccNext").classList.toggle("go", i === STEPS.length - 1 && STEPS.every(([sk]) => stepOk(c, sk)));
  $("ccName").textContent = str(c.name) || "New character";
}
const optBtn = (ik, on, label, sub) => `<button type="button" class="ccopt${on ? " on" : ""}" data-ik="${esc(ik)}" aria-pressed="${on}"><span>${esc(label)}</span>${sub ? `<small>${esc(sub)}</small>` : ""}</button>`;
const STEP_VIEWS = {
  race(c) {
    if (!RACE_LIST.length) return `<p class="cempty">No races yet. Add them on the <a href="races.html">Races page</a>.</p>`;
    const r = raceOf(c), s = subOf(c);
    RACE_LIST.forEach(x => { infoMap.set("race:" + x.id, partInfo(x, "Race", `<a class="glink" href="races.html#${encodeURIComponent(x.id)}" target="_blank" rel="noopener">Open on the Races page</a>`)); x.subs.forEach(y => infoMap.set("sub:" + y.id, partInfo(y, "Subrace of " + x.n, `<a class="glink" href="races.html#${encodeURIComponent(y.id)}" target="_blank" rel="noopener">Open on the Races page</a>`))) });
    infoDefault = s ? infoMap.get("sub:" + s.id) : r ? infoMap.get("race:" + r.id) : infoBox("Races", "", `<p>Pick a race to read about it here. Hover over or focus any choice to preview it.</p>`);
    return `<div class="ccopts">${RACE_LIST.map(x => optBtn("race:" + x.id, r === x, x.n, x.subs.length ? `${x.subs.length} subrace${x.subs.length === 1 ? "" : "s"}` : "")).join("")}</div>` +
      (r && r.subs.length ? `<h3 class="cch3">Subrace</h3><div class="ccopts sub">${r.subs.map(y => optBtn("sub:" + y.id, s === y, y.n)).join("")}</div>` : "");
  },
  class(c) {
    if (!CR.classes.length) return `<p class="cempty">No classes yet.${ADMIN ? ` Add them on the <a href="classes.html">Classes page</a>.` : ""}</p>`;
    const k = clsOf(c), s = subclsOf(c);
    const clink = (x, extra) => `<p class="cclinks"><a class="glink" href="classes.html#${encodeURIComponent(x.id)}" target="_blank" rel="noopener">Open on the Classes page</a>${extra || ""}</p>`;
    CR.classes.forEach(x => { infoMap.set("class:" + x.id, partInfo(x, "Class", clink(x, x.source ? ` · <a class="glink" href="index.html?class=${encodeURIComponent(lcs(x.n))}" target="_blank" rel="noopener">${esc(x.n)} spells</a>` : ""), featsAt(x.feats, LEVEL))); x.subs.forEach(y => infoMap.set("subcls:" + y.id, partInfo(y, "Subclass of " + x.n, clink(y), featsAt(y.feats, LEVEL)))) });
    infoDefault = s ? infoMap.get("subcls:" + s.id) : k ? infoMap.get("class:" + k.id) : infoBox("Classes", "", `<p>Your class decides how you fight, what you're trained in and whether you cast spells.</p>`);
    return `<div class="ccopts">${CR.classes.map(x => optBtn("class:" + x.id, k === x, x.n, x.source ? x.source + " magic" : "")).join("")}</div>` +
      (k && k.subs.length ? `<h3 class="cch3">Subclass</h3><div class="ccopts sub">${k.subs.map(y => optBtn("subcls:" + y.id, s === y, y.n)).join("")}</div>` : "");
  },
  bg(c) {
    const b = c.bg;
    CR.backgrounds.forEach(x => infoMap.set("bg:" + x.id, partInfo(x, "Background", `<a class="glink" href="backgrounds.html#${encodeURIComponent(x.id)}" target="_blank" rel="noopener">Open on the Backgrounds page</a>`)));
    infoMap.set("bg:custom", infoBox("Your own background", "", `<p>Write a background of your own. Talk it over with your Game Master.</p>`));
    infoDefault = b && infoMap.get("bg:" + b) || infoBox("Backgrounds", "", `<p>Your background is the life you lived before adventuring.</p>`);
    const cu = c.bgCustom || { n: "", desc: "" };
    return (CR.backgrounds.length ? "" : `<p class="ccnote">No backgrounds have been written yet${ADMIN ? `. Add them on the <a href="backgrounds.html">Backgrounds page</a>` : ""}. You can write your own, or click Next to skip this step.</p>`) +
      `<div class="ccopts">${CR.backgrounds.map(x => optBtn("bg:" + x.id, b === x.id, x.n)).join("")}${optBtn("bg:custom", b === "custom", "Write my own")}</div>` +
      (b === "custom" ? `<div class="ccform"><label>Background name<input type="text" data-f="bgn" value="${esc(cu.n)}" placeholder="e.g. Ferryman's child" autocomplete="off"></label><label>What happened before you started adventuring?<textarea data-f="bgd" rows="3">${esc(cu.desc)}</textarea></label></div>` : "");
  },
  abil(c) {
    const a = asiInfo(c), manual = c.method === "manual";
    infoDefault = infoBox("Ability scores", manual ? "By hand" : "4d6, drop the lowest", manual ? `<p>Type in each score. Racial bonuses are added for you.</p>` :
      `<p>Each score is the total of four six-sided dice with the lowest die dropped. The dropped die is crossed out.</p><p><b>Reroll</b> rolls all six again. <b>Store</b> keeps this set so you can <b>Recall</b> it after rerolling.</p><p>Click one score and then another to swap them.</p>`) ;
    const rows = ABIL.map(([k, n]) => {
      const b = baseOf(c, k), r = racial(c, k), s = score(c, k), d = arr(c.dice[k]);
      const low = d.length === 4 ? d.indexOf(Math.min(...d)) : -1;
      return `<tr data-ab="${k}"><th scope="row"><span class="full">${n}</span><span class="short" aria-hidden="true">${k.toUpperCase()}</span></th>
<td class="ccdice">${manual ? `<input type="number" min="1" max="30" inputmode="numeric" data-f="base" data-ab="${k}" value="${b ?? ""}" aria-label="${n} score">` : d.map((v, j) => `<span class="die${j === low ? " drop" : ""}">${v}</span>`).join("")}</td>
<td>${manual ? "" : `<button type="button" class="ccscore${swapSel === k ? " sel" : ""}" data-swap="${k}" aria-label="${n} ${b ?? "not rolled"}, click to swap">${b ?? "–"}</button>`}</td>
<td class="ccrac">${r ? sign(r) : ""}</td><td class="cctot">${s ?? "–"}</td><td class="ccmod">${s == null ? "" : sign(modOf(s))}</td></tr>`;
    }).join("");
    const total = ABIL.reduce((t, [k]) => t + (baseOf(c, k) || 0), 0);
    const picks = a.picks.length ? `<div class="ccasi"><b>Racial choices</b>${a.picks.map((p, i) => `<label>${sign(p.amt)} from ${esc(p.src)} <select data-f="asi" data-i="${i}"><option value="">Choose an ability</option>${ABIL.map(([k, n]) => `<option value="${k}"${c.asi[i] === k ? " selected" : ""}${c.asi.some((x, j) => j !== i && x === k) ? " disabled" : ""}>${n}</option>`).join("")}</select></label>`).join("")}</div>` : "";
    return `<div class="ccmeth" role="group" aria-label="How to get your scores"><button type="button" data-meth="roll" aria-pressed="${!manual}">Roll 4d6, drop the lowest</button><button type="button" data-meth="manual" aria-pressed="${manual}">Enter by hand</button></div>
<table class="ccab"><thead><tr><th>Ability</th><th>${manual ? "Score" : "Dice"}</th><th>${manual ? "" : "Roll"}</th><th>Racial</th><th>Total</th><th>Mod</th></tr></thead><tbody>${rows}</tbody></table>
${manual ? "" : `<div class="ccroll"><span class="cctotal">Total roll <b>${total || "–"}</b>${c.rolls ? ` <small>· rolled ${c.rolls} time${c.rolls === 1 ? "" : "s"}</small>` : ""}</span><button type="button" class="btn solid" data-act="reroll">${c.rolls ? "Reroll" : "Roll"}</button><button type="button" class="btn" data-act="store"${c.rolls ? "" : " disabled"}>Store</button><button type="button" class="btn" data-act="recall"${c.stored ? "" : " disabled"}>Recall</button></div>`}
${picks}${a.from.length ? `<p class="ccnote">Racial bonuses: ${esc(a.from.join(", "))}</p>` : ""}`;
  },
  skills(c) {
    const ps = profState(c), sk = pickCount(c, ps, "skill"), sv = pickCount(c, ps, "save"), pts = skillPoints(c), spent = skillSpent(c, ps);
    infoDefault = infoBox("Skills and saving throws", "", `<p>Tick the skills you're proficient in. Skills given by your race, class or background are already ticked.</p><p>A proficient skill starts at rank +${defRank()}. Its bonus is the ability modifier plus its rank.</p>${pts ? `<p>Your class gives you <b>${pts} skill point${pts === 1 ? "" : "s"}</b>. Each point raises a skill's rank by 1; use the − and + buttons.</p>` : ""}`);
    const either = eitherHTML(c, ps, p => p.cat === "skill");
    const row = (cat, key, label) => {
      const g = ps.given(cat, key), on = cat === "skill" ? ps.skill(key) : ps.save(key);
      const tot = cat === "skill" ? skillTotal(c, key, ps) : saveTotal(c, key, ps), r = rankOf(c, cat + ":" + key, on);
      const step = pts && cat === "skill" ? `<span class="ccstepper"><button type="button" data-pt="-1" data-n="${esc(key)}" aria-label="Lower ${esc(label)} rank"${r <= (on ? defRank() : 0) ? " disabled" : ""}>−</button><span title="Rank">+${r}</span><button type="button" data-pt="1" data-n="${esc(key)}" aria-label="Raise ${esc(label)} rank"${r >= 10 ? " disabled" : ""}>+</button></span>` : "";
      return `<div class="ccchk${g ? " given" : ""}"><input type="checkbox" id="ck-${cat}-${esc(slugOf(key))}" data-f="${cat}" data-n="${esc(key)}"${on ? " checked" : ""}${g ? " disabled" : ""}><label for="ck-${cat}-${esc(slugOf(key))}">${esc(label)}</label>${g ? `<small>${esc(g.src.join(", "))}</small>` : ""}${step}<b class="ccb">${sign(tot)}</b></div>`;
    };
    const ptsLine = pts ? `<p class="cccounter${spent >= pts ? " done" : ""}${spent > pts ? " over" : ""}">Skill points (${esc(clsOf(c).n)}): <b>${spent} of ${pts} spent</b>${spent > pts ? " · that's more than you have" : ""}</p>` : "";
    return either + counter("skill", sk, "skill") + counter("save", sv, "saving throw") + ptsLine +
      `<div class="ccskills">${ABIL.map(([k, n]) => `<div class="ccsk"><h3>${n} <span>${score(c, k) ?? "–"} (${sign(mod(c, k))})</span></h3>${row("save", k, "Saving throws")}${SKILLS[k].map(s => row("skill", s, s)).join("")}</div>`).join("")}</div>`;
  },
  prof(c) {
    const ps = profState(c), lg = langGrants(c);
    infoDefault = infoBox("Proficiencies", "", `<p><b>Weapons and armor</b> have three types: S (Simple), M (Martial) and E (Exotic).</p><p><b>Trade skills</b> have three tiers: B, A and M. They decide which crafting recipes you can make.</p><p>Anything given by your race, class or background is already marked.</p>`);
    const tierRow = (cat, n, tiers) => { const t = ps.tiers(cat, n), g = ps.given(cat, n); return `<div class="ccprow"><span>${esc(n)}${g ? `<small>${esc(g.src.join(", "))}</small>` : ""}</span><span class="cctiers">${tiers.map(([x, l]) => { const lock = g && g.tiers.has(x); return `<button type="button" class="ctier${t.has(x) ? " on" : ""}" data-f="${cat}" data-n="${esc(n)}" data-t="${x}" title="${l}" aria-label="${esc(n)}: ${l}" aria-pressed="${t.has(x)}"${lock ? " disabled" : ""}>${x}</button>` }).join("")}</span></div>` };
    const tradeRow = n => { const t = ps.trade(n), g = ps.given("trade", n); return `<div class="ccprow"><span><a class="ilink" href="crafting.html?p=${encodeURIComponent(lcs(n))}" target="_blank" rel="noopener">${esc(n)}</a>${g ? `<small>${esc(g.src.join(", "))}</small>` : ""}</span><span class="cctiers">${TTIERS.map(([x, l]) => `<button type="button" class="ctier${t === x ? " on" : ""}" data-f="trade" data-n="${esc(n)}" data-t="${x}" title="${l}" aria-label="${esc(n)}: ${l}" aria-pressed="${t === x}"${g && [...g.tiers].includes(x) ? " disabled" : ""}>${x}</button>`).join("")}</span></div>` };
    const known = [...new Set([...splitList(CR.rules.langs), ...RACE_LIST.flatMap(r => [r, ...r.subs]).flatMap(p => parseLangs(p.langs).fixed.map(f => f.name))])].sort();
    const nLang = Math.max(lg.picks, c.langs.length);
    const langs = `<div class="ccsec"><h3>Languages</h3><p class="ccnote">${lg.fixed.length ? "You speak " + esc(lg.fixed.map(f => f.name).join(", ")) + "." : "No languages given yet."}${lg.picks ? ` Choose ${lg.picks} more (${esc(lg.from.join(", "))}).` : ""}</p>
<datalist id="cclangs">${known.map(l => `<option value="${esc(l)}">`).join("")}</datalist><div class="cclangs">${Array.from({ length: nLang }, (_, i) => `<input type="text" list="cclangs" data-f="lang" data-i="${i}" value="${esc(c.langs[i] || "")}" placeholder="Language" aria-label="Language ${i + 1}" autocomplete="off">`).join("")}<button type="button" class="btn" data-act="addlang">Add a language</button></div></div>`;
    return eitherHTML(c, ps, p => p.cat !== "skill") + counter("weapon", pickCount(c, ps, "weapon"), "weapon proficiency", "weapon proficiencies") + counter("armor", pickCount(c, ps, "armor"), "armor proficiency", "armor proficiencies") + counter("trade", pickCount(c, ps, "trade"), "trade skill") +
      `<div class="ccgrid2"><div class="ccsec"><h3>Weapons</h3>${WEAPONS.map(n => tierRow("weapon", n, WTIERS)).join("")}<h3>Armor</h3>${ARMORS.map(n => tierRow("armor", n, WTIERS)).join("")}</div>
<div class="ccsec"><h3>Trade skills</h3>${TRADES.map(tradeRow).join("")}</div></div>${langs}`;
  },
  spells(c) {
    const k = clsOf(c);
    if (!k) return `<p class="cempty">Choose a class first.</p>`;
    if (!k.source) { infoDefault = infoBox("Spells", "", `<p>${esc(k.n)}s don't cast spells.</p>`); return `<p class="cempty">${esc(k.n)}s don't cast spells. Click Next.</p>` }
    const lim = spellLimit(c), max = maxRank(), q = lcs(spellQ.trim());
    const list = SPELL_LIST.filter(s => canLearn(s, k) && (s.lv || 1) <= max && (!q || lcs(s.n).includes(q))).sort((a, b) => (a.lv - b.lv) || byName(a, b));
    list.forEach(s => infoMap.set("spell:" + s.n, spellInfo(s)));
    infoDefault = infoBox("Spells", `${k.source} magic`, `<p>${esc(k.n)}s cast ${esc(k.source)} spells. At character creation you can choose spells up to rank ${max}.</p>${lim ? `<p>Choose <b>${lim}</b>.</p>` : ""}${k.cast ? `<p>Your spellcasting ability is <b>${AB[k.cast]}</b> (${sign(mod(c, k.cast))}).</p>` : ""}`);
    return `<div class="cctool"><input type="search" id="ccSpellQ" value="${esc(spellQ)}" placeholder="Search ${esc(k.source)} spells" aria-label="Search spells" autocomplete="off"><span class="cccount">${c.spells.length}${lim ? " of " + lim : ""} chosen</span></div>
<div class="cclist">${list.map(s => { const on = c.spells.includes(s.n); return `<label class="ccrow${on ? " on" : ""}" data-ik="spell:${esc(s.n)}"><input type="checkbox" data-f="spell" data-n="${esc(s.n)}"${on ? " checked" : ""}${!on && lim && c.spells.length >= lim ? " disabled" : ""}><span class="ccrn">${esc(s.n)}</span><span class="ccrm">Rank ${s.lv || "?"}</span><span class="ccrm">${esc(str(s.f && s.f.cost))}</span></label>` }).join("") || `<p class="cempty">No spells match.</p>`}</div>`;
  },
  equip(c) {
    const start = startingWealth(c), spent = spentC(c), left = start - spent, b = bgOf(c);
    const cats = [...new Set(ITEMS.map(i => i.cat).filter(Boolean))];
    const q = lcs(shopQ.trim());
    const list = ITEMS.filter(i => (shopCat === "all" ? i.cat !== "Crafting Material" : i.cat === shopCat) && (!q || lcs(i.n).includes(q))).sort(byName);
    list.forEach(i => infoMap.set("item:" + i.id, itemInfo(i)));
    c.inv.forEach((x, j) => { const it = x.iid && itemById(x.iid); if (it) infoMap.set("item:" + it.id, itemInfo(it)) });
    const k = clsOf(c), lo = k ? k.loadouts : [];
    infoDefault = infoBox("Equipment", "", `${lo.length ? `<p>Take one of your class's <b>loadouts</b>, or take its <b>Starting Currency</b> (${esc(fmtC(classMoney(c)))}) and buy your own gear.</p>` : `<p>You start with <b>${esc(fmtC(start))}</b>.</p>`}<p><b>Buy</b> takes the price from your purse; <b>Take</b> adds the item for free, for gear your Game Master gives you.</p><p>Pick a slot for anything you're wearing or holding. The rest goes in your pack.</p>`);
    const bgTaken = c.inv.some(x => x.from === "bg");
    const loadouts = lo.length ? `<fieldset class="ccload"><legend>${esc(k.n)} starting equipment</legend>${lo.map((l, i) => `<label class="${c.loadout === String(i) ? "on" : ""}"><input type="radio" name="ccload" data-f="loadout" value="${i}"${c.loadout === String(i) ? " checked" : ""}><span><b>${esc(l.n)}</b><small>${esc(gearLine(l.gear)) || "No gear listed"}</small></span></label>`).join("")}<label class="${c.loadout === "buy" ? "on" : ""}"><input type="radio" name="ccload" data-f="loadout" value="buy"${c.loadout === "buy" ? " checked" : ""}><span><b>Buy my own</b><small>Start with ${esc(fmtC(classMoney(c)))}</small></span></label></fieldset>` : "";
    return `${loadouts}<div class="ccpurse"><span>Purse <b>${esc(fmtC(left))}</b></span><small>Started with ${esc(fmtC(start))}${b && toC(b.wealth) ? ` (${esc(fmtC(toC(b.wealth)))} from ${esc(b.n)})` : ""} · spent ${esc(fmtC(spent))}</small>${left < 0 ? `<span class="ccwarn">You've spent more than you have.</span>` : ""}</div>
${b && b.gear && b.gear.length ? `<p class="ccnote">${esc(b.n)} gear: ${esc(gearLine(b.gear))} <button type="button" class="btn" data-act="bggear"${bgTaken ? " disabled" : ""}>${bgTaken ? "Taken" : "Take it"}</button></p>` : ""}
<div class="cctool"><select id="ccShopCat" aria-label="Item category"><option value="all"${shopCat === "all" ? " selected" : ""}>All gear</option>${cats.map(x => `<option${shopCat === x ? " selected" : ""}>${esc(x)}</option>`).join("")}</select><input type="search" id="ccShopQ" value="${esc(shopQ)}" placeholder="Search items" aria-label="Search items" autocomplete="off"></div>
<div class="cclist shop">${list.map(i => `<div class="ccrow" data-ik="item:${esc(i.id)}"><span class="ccrn"><span class="tc"${i.nc ? ` style="--c:${esc(i.nc)}"` : ""}>${esc(i.n)}</span></span><span class="ccrm">${esc(i.value || "")}</span><span class="ccrm">${esc(i.weight || "")}</span><span class="ccbtns"><button type="button" class="btn" data-act="buy" data-id="${esc(i.id)}"${toC(i.value) == null || toC(i.value) > left ? ` disabled title="${toC(i.value) == null ? "No price" : "Not enough money"}"` : ""}>Buy</button><button type="button" class="btn" data-act="take" data-id="${esc(i.id)}">Take</button></span></div>`).join("") || `<p class="cempty">No items match.</p>`}</div>
<h3 class="cch3">Your gear</h3>
<div class="ccgear">${c.inv.map((x, j) => { const it = x.iid && itemById(x.iid); return `<div class="ccrow"${it ? ` data-ik="item:${esc(it.id)}"` : ""}><span class="ccrn">${esc(invName(x))}${x.paid ? `<small>${esc(fmtC(x.paid))} each</small>` : x.from === "loadout" ? `<small>Loadout</small>` : x.from === "bg" ? `<small>Background</small>` : ""}</span><input type="number" min="1" max="999" data-f="qty" data-i="${j}" value="${x.qty || 1}" aria-label="How many"><select data-f="slot" data-i="${j}" aria-label="Where it goes"><option value="">In my pack</option>${SLOTS.map(([k, l]) => `<option value="${k}"${x.slot === k ? " selected" : ""}>${l}${k === "ring2" ? " (2nd)" : ""}</option>`).join("")}</select><button type="button" class="btn" data-act="drop" data-i="${j}">${x.paid ? "Sell back" : "Remove"}</button></div>` }).join("") || `<p class="cempty">Nothing yet.</p>`}
<div class="ccadd"><input type="text" id="ccOwn" placeholder="Something not on the list, e.g. Lucky coin" aria-label="Add your own item" autocomplete="off"><button type="button" class="btn" data-act="own">Add</button></div></div>`;
  },
  look(c) {
    const d = c.details;
    infoDefault = infoBox("Appearance", "", `<p>A portrait shows on your character list and your sheet. It stays in this browser and in files you save.</p>`);
    return `<div class="cclook"><div class="ccportrait">${d.portrait ? `<img src="${esc(d.portrait)}" alt="Portrait">` : `<span>No portrait</span>`}<label class="btn">Choose a picture<input type="file" accept="image/*" id="ccPic" hidden></label>${d.portrait ? `<button type="button" class="btn" data-act="nopic">Remove</button>` : ""}</div>
<div class="ccform"><label>Height and weight<input type="text" data-f="d" data-k="hw" value="${esc(d.hw || "")}" placeholder="e.g. 4 ft 6 in, 180 lbs" autocomplete="off"></label>
<label>Age<input type="text" data-f="d" data-k="age" value="${esc(d.age || "")}" autocomplete="off"></label>
<label>Pronouns<input type="text" data-f="d" data-k="pron" value="${esc(d.pron || "")}" autocomplete="off"></label>
<label>Appearance<textarea data-f="d" data-k="looks" rows="3" placeholder="Eyes, hair, scars, the way they carry themselves…">${esc(d.looks || "")}</textarea></label>
<label>Personality and story<textarea data-f="d" data-k="story" rows="4">${esc(d.story || "")}</textarea></label></div></div>`;
  },
  name(c) {
    const r = raceOf(c), s = subOf(c), k = clsOf(c), sk = subclsOf(c), b = bgOf(c);
    infoDefault = infoBox(str(c.name) || "Your character", "", `<p>Check everything over, then click <b>Finish</b> to open your character sheet. You can come back and change anything later.</p>`);
    const missing = STEPS.filter(([sk2]) => !stepOk(c, sk2) && sk2 !== "name").map(x => x[1]);
    return `<div class="ccform"><label>Character name<input type="text" data-f="name" class="ccbig" value="${esc(c.name)}" placeholder="What are you called?" autocomplete="off"></label></div>
<div class="ccsum">${c.details.portrait ? `<img src="${esc(c.details.portrait)}" alt="">` : ""}<dl class="gfacts">
<dt>Race</dt><dd>${esc([s && s.n, r && r.n].filter(Boolean)[0] || "–")}</dd><dt>Class</dt><dd>${esc([k && k.n, sk && sk.n].filter(Boolean).join(", ") || "–")}</dd><dt>Background</dt><dd>${esc(b ? b.n : "–")}</dd>
<dt>Abilities</dt><dd>${ABIL.map(([a, n]) => `${n.slice(0, 3).toUpperCase()} ${score(c, a) ?? "–"}`).join(" · ")}</dd><dt>Hit points</dt><dd>${hpOf(c) ?? "–"}</dd>
${c.spells.length ? `<dt>Spells</dt><dd>${esc(c.spells.join(", "))}</dd>` : ""}<dt>Gear</dt><dd>${esc(c.inv.map(invName).join(", ") || "–")}</dd></dl></div>
${missing.length ? `<p class="ccnote">Still to do: ${esc(missing.join(", "))}. You can finish anyway and fill these in on the sheet.</p>` : ""}`;
  }
};
const splitList = t => plainText(t).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
function counter(cat, n, one, many) {
  if (!n.allow) return "";
  const over = n.chosen > n.allow;
  return `<p class="cccounter${n.chosen >= n.allow ? " done" : ""}${over ? " over" : ""}">Choose ${n.allow} ${n.allow === 1 ? one : (many || one + "s")} (${esc(n.from.join(", "))}): <b>${n.chosen} of ${n.allow}</b>${over ? " · that's more than you're given" : ""}</p>`;
}
function eitherHTML(c, ps, keep) {
  const ps2 = ps.g.picks.filter(p => p.opts && keep(p));
  return ps2.map(p => `<fieldset class="cceither"><legend>${esc(p.src)}: choose one</legend>${p.opts.map(o => `<label><input type="radio" name="ch-${esc(p.key)}" data-f="choice" data-k="${esc(p.key)}" value="${esc(o)}"${c.choice[p.key] === o ? " checked" : ""}> ${esc(o)}</label>`).join("")}</fieldset>`).join("");
}
function addGear(c, gear, from) {
  gear.forEach(g => { const it = g.iid && itemById(g.iid); c.inv.push({ ...(it ? { iid: it.id } : { n: g.n }), qty: g.qty || 1, paid: 0, slot: it ? defaultSlot(c, it) : "", from }) });
}
function setLoadout(c, v) {
  c.inv = c.inv.filter(x => x.from !== "loadout"); c.loadout = v;
  const k = clsOf(c), l = k && v !== "buy" && v !== "" ? k.loadouts[+v] : null;
  if (l) addGear(c, l.gear, "loadout");
  /* gear bought with money that's no longer there goes back */
  if (!buying(c)) c.inv = c.inv.filter(x => !x.paid || startingWealth(c) - spentC(c) >= 0);
}
function gearFrom(text) { return ITEMS.filter(i => new RegExp("\\b" + i.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "s?\\b", "i").test(plainText(text))) }
function defaultSlot(c, it) {
  const used = new Set(c.inv.map(x => x.slot).filter(Boolean));
  const s = lcs(it.slot), want = it.cat === "Weapon" ? ["main", "off"] : /shield/i.test(it.n + " " + it.sub) ? ["off"] : s === "rings" ? ["ring1", "ring2"] : s === "other" ? ["other"] : SLOTS.some(x => x[0] === s) ? [s] : [];
  return want.find(k => !used.has(k)) || "";
}

/* the dice: 4d6, drop the lowest */
const d6 = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % 6 + 1 };
let swapSel = "", spellQ = "", shopQ = "", shopCat = "all";
function rollAll() {
  const c = cur;
  ABIL.forEach(([k]) => { const d = [d6(), d6(), d6(), d6()]; c.dice[k] = d; c.base[k] = d.reduce((a, b) => a + b, 0) - Math.min(...d) });
  c.rolls = (c.rolls || 0) + 1; swapSel = ""; touch(); renderCreate();
  if (RM.matches) return;
  const dice = [...document.querySelectorAll(".ccdice .die")]; const real = dice.map(d => d.textContent); let n = 0;
  dice.forEach(d => d.classList.add("spin"));
  const t = setInterval(() => { n++; dice.forEach((d, i) => { d.textContent = n < 6 ? d6() : real[i] }); if (n >= 6) { clearInterval(t); dice.forEach(d => d.classList.remove("spin")) } }, 60);
}

/* ---------------------------------------------------------------- events in the creator */
$("ccmain").addEventListener("pointerover", ev => { const o = ev.target.closest("[data-ik]"); if (o && infoMap.has(o.dataset.ik)) setInfo(infoMap.get(o.dataset.ik)) });
$("ccmain").addEventListener("focusin", ev => { const o = ev.target.closest("[data-ik]"); if (o && infoMap.has(o.dataset.ik)) setInfo(infoMap.get(o.dataset.ik)) });
$("ccmain").addEventListener("pointerleave", () => setInfo());
$("ccmain").addEventListener("click", ev => {
  const c = cur; if (!c) return;
  const o = ev.target.closest(".ccopt");
  if (o) {
    const [kind, id] = o.dataset.ik.split(/:(.*)/s);
    if (kind === "race") { if (c.race !== id) { c.race = id; c.sub = ""; c.asi = []; c.choice = {} } }
    else if (kind === "sub") c.sub = id;
    else if (kind === "class") { if (c.cls !== id) { c.cls = id; c.subcls = ""; c.spells = []; setLoadout(c, "") } }
    else if (kind === "subcls") c.subcls = id;
    else if (kind === "bg") { c.bg = id; if (id === "custom" && !c.bgCustom) c.bgCustom = { n: "", desc: "" } }
    touch(); renderCreate(); const again = document.querySelector(`.ccopt[data-ik="${CSS.escape(o.dataset.ik)}"]`); if (again) again.focus(); return;
  }
  const b = ev.target.closest("button"); if (!b) return;
  const act = b.dataset.act;
  if (b.dataset.pt) {
    const n = b.dataset.n, ps = profState(c), key = "skill:" + n, r = rankOf(c, key, ps.skill(n)) + +b.dataset.pt;
    c.rank[key] = Math.min(10, Math.max(ps.skill(n) ? defRank() : 0, r)); touch(); renderCreate(); focusSel(`[data-pt="${b.dataset.pt}"][data-n="${CSS.escape(n)}"]`); return;
  }
  if (b.dataset.meth) { c.method = b.dataset.meth; swapSel = ""; touch(); renderCreate(); return }
  if (b.dataset.swap) {
    const k = b.dataset.swap;
    if (!swapSel) swapSel = k;
    else if (swapSel === k) swapSel = "";
    else { [c.base[k], c.base[swapSel]] = [c.base[swapSel], c.base[k]]; [c.dice[k], c.dice[swapSel]] = [c.dice[swapSel], c.dice[k]]; swapSel = ""; touch() }
    renderCreate(); const f = document.querySelector(`[data-swap="${k}"]`); if (f) f.focus(); return;
  }
  if (b.classList.contains("ctier")) {
    const cat = b.dataset.f, n = b.dataset.n, t = b.dataset.t;
    if (cat === "trade") c.prof.trade[n] = c.prof.trade[n] === t ? "" : t;
    else { const o2 = c.prof[cat][n] = { ...(c.prof[cat][n] || {}) }; o2[t] = !o2[t] }
    touch(); renderCreate(); const f = document.querySelector(`.ctier[data-f="${cat}"][data-n="${CSS.escape(n)}"][data-t="${t}"]`); if (f) f.focus(); return;
  }
  if (act === "reroll") { rollAll(); return }
  if (act === "store") { c.stored = { base: { ...c.base }, dice: JSON.parse(JSON.stringify(c.dice)) }; touch(); renderCreate(); say("Scores stored. Click Recall to bring them back."); return }
  if (act === "recall" && c.stored) { c.base = { ...c.stored.base }; c.dice = JSON.parse(JSON.stringify(c.stored.dice)); touch(); renderCreate(); say("Stored scores recalled."); return }
  if (act === "addlang") { c.langs.push(""); touch(); renderCreate(); const ins = document.querySelectorAll('[data-f="lang"]'); if (ins.length) ins[ins.length - 1].focus(); return }
  if (act === "buy" || act === "take") {
    const it = itemById(b.dataset.id); if (!it) return;
    const paid = act === "buy" ? toC(it.value) || 0 : 0;
    if (paid > startingWealth(c) - spentC(c)) { say(`You can't afford ${it.n}.`); return }
    const same = c.inv.find(x => x.iid === it.id && (x.paid || 0) === paid && !x.slot);
    if (same && it.cat !== "Weapon" && it.cat !== "Armor") same.qty = (same.qty || 1) + 1; else c.inv.push({ iid: it.id, qty: 1, paid, slot: defaultSlot(c, it) });
    touch(); renderCreate(); say(`${act === "buy" ? "Bought" : "Added"} ${it.n}.`); return;
  }
  if (act === "bggear") { const b2 = bgOf(c); addGear(c, b2 ? b2.gear : [], "bg"); touch(); renderCreate(); say("Background gear added."); return }
  if (act === "drop") { c.inv.splice(+b.dataset.i, 1); touch(); renderCreate(); return }
  if (act === "own") { const t = str($("ccOwn").value); if (!t) { $("ccOwn").focus(); return } c.inv.push({ n: t, qty: 1, paid: 0, slot: "" }); touch(); renderCreate(); $("ccOwn").focus(); return }
  if (act === "nopic") { delete c.details.portrait; touch(); renderCreate(); return }
});
$("ccmain").addEventListener("input", ev => {
  const c = cur, t = ev.target, f = t.dataset.f; if (!c || !f) return;
  if (f === "name") { c.name = t.value; $("ccName").textContent = str(c.name) || "New character"; touch(); refreshSteps(); return }
  if (f === "bgn" || f === "bgd") { c.bgCustom = c.bgCustom || { n: "", desc: "" }; c.bgCustom[f === "bgn" ? "n" : "desc"] = t.value; touch(); refreshSteps(); return }
  if (f === "d") { c.details[t.dataset.k] = t.value; touch(); return }
  if (f === "lang") { c.langs[+t.dataset.i] = t.value; touch(); refreshSteps(); return }
  if (f === "base") { const v = parseInt(t.value, 10); c.base[t.dataset.ab] = Number.isFinite(v) ? Math.min(30, Math.max(1, v)) : ""; touch(); refreshAbil(); return }
  if (f === "qty") { c.inv[+t.dataset.i].qty = Math.max(1, parseInt(t.value, 10) || 1); touch(); refreshPurse(); return }
  if (ev.target.id === "ccSpellQ") return;
});
$("ccmain").addEventListener("change", ev => {
  const c = cur, t = ev.target, f = t.dataset.f; if (!c) return;
  if (t.id === "ccShopCat") { shopCat = t.value; renderCreate(); $("ccShopCat").focus(); return }
  if (t.id === "ccPic") { loadPortrait(t.files && t.files[0]); return }
  if (!f) return;
  if (f === "asi") { c.asi[+t.dataset.i] = t.value; touch(); renderCreate(); return }
  if (f === "skill" || f === "save") { c.prof[f][t.dataset.n] = t.checked; touch(); renderCreate(); const x = document.querySelector(`[data-f="${f}"][data-n="${CSS.escape(t.dataset.n)}"]`); if (x) x.focus(); return }
  if (f === "choice") { c.choice[t.dataset.k] = t.value; touch(); renderCreate(); return }
  if (f === "loadout") { setLoadout(c, t.value); touch(); renderCreate(); const x = document.querySelector(`[data-f="loadout"][value="${t.value}"]`); if (x) x.focus(); return }
  if (f === "spell") { const n = t.dataset.n; c.spells = t.checked ? [...new Set([...c.spells, n])] : c.spells.filter(x => x !== n); touch(); renderCreate(); const x = document.querySelector(`[data-f="spell"][data-n="${CSS.escape(n)}"]`); if (x) x.focus(); return }
  if (f === "slot") { const x = c.inv[+t.dataset.i]; x.slot = t.value; if (t.value) c.inv.forEach(y => { if (y !== x && y.slot === t.value) y.slot = "" }); touch(); renderCreate(); return }
});
document.addEventListener("input", ev => {
  if (ev.target.id === "ccSpellQ") { spellQ = ev.target.value; renderCreate(); const q = $("ccSpellQ"); q.focus(); q.setSelectionRange(q.value.length, q.value.length) }
  if (ev.target.id === "ccShopQ") { shopQ = ev.target.value; renderCreate(); const q = $("ccShopQ"); q.focus(); q.setSelectionRange(q.value.length, q.value.length) }
});
function refreshSteps() { const c = cur; document.querySelectorAll(".ccstep").forEach((b, j) => { const ok = stepOk(c, STEPS[j][0]); b.classList.toggle("ok", ok); b.querySelector(".ccn").textContent = ok ? "✓" : j + 1 }) }
function refreshAbil() {
  const c = cur; ABIL.forEach(([k]) => { const tr = document.querySelector(`tr[data-ab="${k}"]`); if (!tr) return; const s = score(c, k); tr.querySelector(".cctot").textContent = s ?? "–"; tr.querySelector(".ccmod").textContent = s == null ? "" : sign(modOf(s)) }); refreshSteps();
}
function refreshPurse() { const c = cur, p = document.querySelector(".ccpurse b"); if (p) p.textContent = fmtC(startingWealth(c) - spentC(c)) }
function loadPortrait(file) {
  if (!file) return;
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const s = 320, cv = document.createElement("canvas"); cv.width = cv.height = s; const cx = cv.getContext("2d");
    const m = Math.min(img.width, img.height); cx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
    cur.details.portrait = cv.toDataURL("image/jpeg", .85); URL.revokeObjectURL(url); touch(); renderCreate();
  };
  img.onerror = () => { URL.revokeObjectURL(url); say("That picture couldn't be opened. Try a JPG or PNG.") };
  img.src = url;
}
function goStep(i) {
  const c = cur, k = STEPS[c.step | 0][0];
  c.seen[k] = true; if (k === "spells" || k === "skills" || k === "prof") c.seen[k] = true;
  c.step = Math.min(Math.max(0, i), STEPS.length - 1); swapSel = ""; touch(); renderCreate(); say("");
  $("ccgame").scrollIntoView({ block: "start", behavior: RM.matches ? "auto" : "smooth" });
}
$("ccsteps").addEventListener("click", ev => { const b = ev.target.closest("[data-step]"); if (b) goStep(+b.dataset.step) });
$("ccBack").addEventListener("click", () => goStep((cur.step | 0) - 1));
$("ccNext").addEventListener("click", () => {
  const c = cur, i = c.step | 0;
  if (i === STEPS.length - 1) {
    c.seen.name = true;
    if (!str(c.name)) { say("Give your character a name first."); const n = document.querySelector('[data-f="name"]'); if (n) n.focus(); return }
    c.done = true; touch(); persist(true); show("sheet"); return;
  }
  if (STEPS[i][0] === "abil" && !c.rolls && c.method === "roll" && ABIL.some(([k]) => baseOf(c, k) == null)) { say("Roll your scores first."); return }
  goStep(i + 1);
});
$("ccRestart").addEventListener("click", ev => {
  const b = ev.currentTarget;
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to start over"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Start over" }, 3000); return }
  delete b.dataset.sure; b.textContent = "Start over";
  const id = cur.id, made = cur.made; Object.assign(cur, blankChar(), { id, made }); touch(); renderCreate();
});
$("ccToSheet").addEventListener("click", () => { persist(true); show("sheet") });

/* ---------------------------------------------------------------- the character sheet */
function sheetVal(c, key, dflt) { return c.sheet[key] != null ? c.sheet[key] : dflt == null ? "" : String(dflt) }
const sf = (c, key, dflt, cls, ph, aria) => `<input type="text" class="sf${cls ? " " + cls : ""}" data-s="${esc(key)}" value="${esc(sheetVal(c, key, dflt))}"${ph ? ` placeholder="${esc(ph)}"` : ""} aria-label="${esc(aria || key)}" autocomplete="off">`;
const sbox = (c, key, aria) => `<input type="checkbox" class="sck" data-s="${esc(key)}"${c.sheet[key] ? " checked" : ""} aria-label="${esc(aria || key)}">`;
const STAR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1l2.2 3.4 4-.6-.6 4L19 10l-3.4 2.2.6 4-4-.6L10 19l-2.2-3.4-4 .6.6-4L1 10l3.4-2.2-.6-4 4 .6z"/></svg>';
/* the proficiency star and the rank bubbles are separate, as on the paper sheet */
const RANK_SCALE = `<span class="sscale" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<span>+${i + 1}</span>`).join("")}</span>`;
function pips(c, key, prof, label) {
  const r = rankOf(c, key, prof);
  return `<button type="button" class="sstar${prof ? " on" : ""}" data-prof="${esc(key)}" aria-pressed="${prof}" title="Proficient" aria-label="${esc(label)}: proficient">${STAR}</button><span class="spips" role="group" aria-label="${esc(label)} rank">${Array.from({ length: 10 }, (_, i) => `<button type="button" class="spip${i < r ? " on" : ""}" data-rank="${esc(key)}" data-v="${i + 1}" aria-label="${esc(label)} rank +${i + 1}" aria-pressed="${i < r}"></button>`).join("")}</span>`;
}
function attackRows(c) {
  const rows = [];
  c.inv.filter(x => x.slot === "main" || x.slot === "off").forEach(x => { const it = x.iid && itemById(x.iid); rows.push({ n: invName(x), cost: "", range: it ? (str(it.props).match(/\d+\s*\/\s*\d+\s*ft|\d+\s*ft/i) || [""])[0] : "", note: it ? it.actions : "" }) });
  const k = clsOf(c);
  c.spells.forEach(n => { const s = SPELL_LIST.find(x => x.n === n); if (s) rows.push({ n: s.n, cost: str(s.f.cost), range: str(s.f.range), dmg: /^n\/?a$/i.test(str(s.f.dmg)) ? "" : str(s.f.dmg), rank: s.lv, ab: k && k.cast ? sign(mod(c, k.cast)) : "" }) });
  return rows;
}
function renderSheet() {
  const c = cur, ps = profState(c), r = raceOf(c), s = subOf(c), k = clsOf(c), sk = subclsOf(c), b = bgOf(c), lg = langGrants(c);
  $("sheetName").textContent = str(c.name) || "Unnamed character";
  const atk = attackRows(c), atkN = Math.max(8, atk.length);
  const extras = [...(r ? r.extra : []), ...(s ? s.extra : [])];
  const lev = (a, b2) => { a = lcs(a); b2 = lcs(b2); const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b2.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b2.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b2[j - 1] ? 0 : 1)); return d[a.length][b2.length] };
  const extraFor = name => { const x = extras.find(e => lev(e.k, name) <= 2 || lcs(e.k).includes(lcs(name))); return x ? x.v : "" };
  const passive = parseInt(CR.rules.passive, 10) || 10;
  const conds = (() => { const g = (normGlossary(GLOSSARY) || []).filter(e => e.sec === "Conditions").map(e => e.n); return (g.length ? g : SHEET_CONDITIONS).slice().sort() })();
  const slotItems = Object.fromEntries(SLOTS.map(([key]) => [key, c.inv.find(x => x.slot === key)]));
  const wt = x => { const it = x && x.iid && itemById(x.iid); return it ? lbs(it.weight) * (x.qty || 1) : 0 };
  const totalWt = c.inv.reduce((n, x) => n + wt(x), 0);
  const pack = c.inv.filter(x => !x.slot);
  const left = startingWealth(c) - spentC(c);
  const coins = { g: Math.floor(Math.max(0, left) / 100), s: Math.floor(Math.max(0, left) % 100 / 10), c: Math.max(0, left) % 10 };
  const allFeats = sources(c).flatMap(x => x.feats.map(f => ({ ...f, src: x.label })));
  const row1 = chartRow(c);
  const spells = c.spells.map(n => SPELL_LIST.find(x => x.n === n)).filter(Boolean).sort((a, b2) => a.lv - b2.lv || byName(a, b2));
  const castMod = k && k.cast ? mod(c, k.cast) : null;
  const abilBlock = ([a, n]) => {
    const sc = score(c, a);
    const rows = [["save:" + a, "Saving throws", ps.save(a), saveTotal(c, a, ps)], ...SKILLS[a].map(x => ["skill:" + x, x, ps.skill(x), skillTotal(c, x, ps)])];
    return `<div class="sab"><div class="sabox"><div class="sabn">${n}</div><div class="sabs">${sc ?? "–"}</div><div class="sabm">${sc == null ? "" : sign(modOf(sc))}</div></div>
<div class="sabrows">${rows.map(([key, label, prof, tot]) => `<div class="srow"><span class="srl">${esc(label)}</span>${pips(c, key, prof, label === "Saving throws" ? n + " saving throws" : label)}<span class="stot">${sign(tot)}</span></div>`).join("")}</div></div>`;
  };
  const tierMarks = (have, tiers) => `<span class="stiers">${tiers.map(([x, l]) => `<span class="stier${have.has ? (have.has(x) ? " on" : "") : have === x ? " on" : ""}" title="${l}">${x}</span>`).join("")}</span>`;
  const profRow = (cat, n, key, have, tiers, prof) => `<div class="srow"><span class="srl">${esc(n)}</span>${tierMarks(have, tiers)}${pips(c, key, prof, n)}<span class="stot">${sf(c, "pt:" + key, "", "sq", "", n + " total")}</span></div>`;
  const lines = (key, n, dflt) => Array.from({ length: n }, (_, i) => sf(c, key + i, dflt ? dflt[i] : "", "sline", "", key + " line " + (i + 1))).join("");
  const page1 = `<section class="spage">
<div class="shead"><div class="slogo">${$("ccLogo").innerHTML}${c.details.portrait ? `<img class="sportrait" src="${esc(c.details.portrait)}" alt="">` : ""}</div>
<div class="sid">${[["Character name", "name", c.name], ["Class & subclass", "cls", [k && k.n, sk && sk.n].filter(Boolean).join(" / ")], ["Race & subrace", "race", [r && r.n, s && s.n].filter(Boolean).join(" / ")], ["Background", "bg", b ? b.n : ""], ["Height & weight", "hw", c.details.hw || ""], ["Experience", "xp", ""]].map(([l, key, v]) => `<label><span>${l}</span>${key === "name" ? `<input type="text" class="sf" data-name="1" value="${esc(c.name)}" aria-label="Character name">` : sf(c, "id:" + key, v, "", "", l)}</label>`).join("")}</div></div>
<div class="sblock satk"><div class="sbar sgrid9"><span>Weapon / Spell / Actions</span><span>Action cost</span><span>Range</span><span>Mod / DC</span><span>Skill / Spell rank</span><span>Ability modifier</span><span>Damage</span><span>Damage type</span><span>Critical multiplier</span></div>
${Array.from({ length: atkN }, (_, i) => { const a = atk[i] || {}; return `<div class="sgrid9 satr">${[["n", a.n], ["cost", a.cost], ["range", a.range], ["dc", a.rank && castMod != null ? 8 + castMod + a.rank : ""], ["rank", a.rank ? "+" + a.rank : ""], ["ab", a.ab], ["dmg", a.dmg], ["type", ""], ["crit", ""]].map(([col, v]) => sf(c, `atk${i}:${col}`, v || "", "", "", `Attack row ${i + 1} ${col}`)).join("")}</div>` }).join("")}</div>
<div class="sbar sinit"><span>${STAR} Initiative ${sf(c, "init", sign(mod(c, "dex")), "sq", "", "Initiative")}</span><span>${STAR} Concentration ${sf(c, "conc", "", "sq", "", "Concentration")}</span></div>
<div class="scols"><div class="sleft"><div class="ssub"><span>Ability scores & modifiers</span><div class="srowh"><span>Skills & saves</span><span>Prof.</span><span class="sscalew"><small>Skill rank</small>${RANK_SCALE}</span><span>Total bonus</span></div></div>${ABIL.map(abilBlock).join("")}</div>
<div class="sright">
<div class="sbox"><div class="stab">Action pool</div><div class="spool">${[["ap", "Action points"], ["mp", "Magic points"], ["ep", "Exhaustion points"], ["pool", "Max pool", row1 && row1.pool], ["ad", "Action die", row1 && row1.die]].map(([key, l, d]) => `<label class="scell"><span>${l}</span>${sf(c, key, d || "", "", "", l)}</label>`).join("")}</div></div>
<div class="sbox"><div class="stab">Status</div><div class="sstatus">
<div class="sac"><div class="sacr sach"><span>Armor class</span><span>AC</span></div>${["Natural", "Armored", "Shield"].map(x => `<label class="sacr"><span>${x}</span>${sf(c, "ac:" + x, "", "", "", x + " AC")}</label>`).join("")}<div class="sacr sacx"><span>Others</span>${sf(c, "ac:minus", "", "", "−", "Other AC minus")}${sf(c, "ac:plus", "", "", "+", "Other AC plus")}</div></div>
<div class="scell sduo"><label class="sduot"><span>Hit points</span>${sf(c, "hp", "", "big", "", "Current hit points")}</label><label class="sduob"><span>Max</span>${sf(c, "hpmax", hpOf(c) ?? "", "", "", "Maximum hit points")}</label></div>
<div class="scell sduo"><label class="sduot"><span>Hit dice</span>${sf(c, "hd", k && k.hd ? k.hd : "", "big", "", "Hit dice")}</label><label class="sduob"><span>Total</span>${sf(c, "hdt", k && k.hd ? LEVEL : "", "", "", "Hit dice total")}</label></div>
<div class="scell sdeath"><span>Death saves</span><small>Successes</small><span>${[0, 1, 2].map(i => sbox(c, "ds" + i, "Death save success " + (i + 1))).join("")}</span><small>Failures</small><span>${[0, 1, 2].map(i => sbox(c, "df" + i, "Death save failure " + (i + 1))).join("")}</span></div></div></div>
<div class="scond"><div class="sbox sblack"><div class="stab">Conditions</div><div class="sconds">${conds.map(n => `<label>${sbox(c, "cond:" + n, n)}<span class="gl" tabindex="0" data-g="${esc(lcs(n))}">${esc(n)}</span></label>`).join("")}</div></div>
<div class="stack"><div class="stbl"><div class="sth"><span>Movement</span><span>ft</span></div>${MOVES.map(m => `<label><span>${m}</span>${sf(c, "mv:" + m, extraFor(m === "Ground" ? "Speed" : m) || (m === "Ground" ? extraFor("Ground") : ""), "", "", m + " speed")}</label>`).join("")}</div>
<div class="stbl"><div class="sth"><span>Passive skills</span><span>DC</span></div>${PASSIVE.map(n => `<label><span>${n}</span>${sf(c, "pv:" + n, passive + skillTotal(c, n, ps), "", "", "Passive " + n)}</label>`).join("")}</div></div></div>
<div class="sbox snotes"><div class="stab">Notes</div><textarea class="sf" data-s="notes" rows="9" aria-label="Notes">${esc(sheetVal(c, "notes", ""))}</textarea></div>
</div></div></section>`;
  const page2 = `<section class="spage"><div class="scols">
<div class="sleft"><div class="sblock ssq"><div class="sbar">Proficiencies</div>
<div class="srowh sprofh"><span>Category</span><span>Type</span><span>Prof.</span><span class="sscalew"><small>Skill rank</small>${RANK_SCALE}</span><span>Total</span></div>
<div class="sgroup">Weapons</div>${WEAPONS.map(n => { const t = ps.tiers("weapon", n); return profRow("weapon", n, "w:" + n, t, WTIERS, t.size > 0) }).join("")}
<div class="sgroup">Armor</div>${ARMORS.map(n => { const t = ps.tiers("armor", n); return profRow("armor", n, "a:" + n, t, WTIERS, t.size > 0) }).join("")}
<div class="sgroup">Trade skills</div>${TRADES.map(n => { const t = ps.trade(n); return profRow("trade", n, "t:" + n, t, TTIERS, !!t) }).join("")}</div>
<div class="sbox"><div class="stab">Languages</div>${lines("lang", 6, [...lg.fixed.map(f => f.name), ...c.langs.filter(Boolean)])}</div>
<div class="spair"><div class="stbl"><div class="sth"><span>Expertise</span><span>TC</span></div>${EXPERTISE.map(([n, sk2, ab]) => `<label><span>${n} <small>(${ab})</small></span>${sf(c, "ex:" + n, "", "", sign(skillTotal(c, sk2, ps)), n)}</label>`).join("")}</div>
<div class="stbl"><div class="sth"><span>Senses</span><span>ft</span></div>${SENSES.map(n => `<label><span>${n}</span>${sf(c, "se:" + n, extraFor(n), "", "", n)}</label>`).join("")}</div></div>
<div class="stbl swealth"><div class="sth"><span>Wealth</span><span>Total</span><span>Weight</span></div>${[["Copper", "c"], ["Silver", "s"], ["Gold", "g"], ["Platinum", "p"]].map(([n, key]) => `<label><span>${n}</span>${sf(c, "coin:" + key, key === "p" ? "" : coins[key], "", "", n)}${sf(c, "coinw:" + key, "", "", "", n + " weight")}</label>`).join("")}</div></div>
<div class="sright"><div class="sblock ssq"><div class="sbar seqh"><span>Equipment</span><span>Armor (%)</span><span>Weight</span></div>
${SLOTS.map(([key, l]) => { const x = slotItems[key]; return `<div class="sgrid3 seq"><span class="sslot">${l}</span>${sf(c, "eq:" + key, x ? invName(x) : "", "", "", l)}${sf(c, "eqa:" + key, "", "", "", l + " armor percent")}${sf(c, "eqw:" + key, x ? fmtLbs(wt(x)) : "", "", "", l + " weight")}</div>` }).join("")}
<div class="seq stot2"><span class="stotl">Totals</span><label><span>Total (%)</span>${sf(c, "eqat", "", "", "", "Total armor percent")}</label><label><span>Total wgt.</span>${sf(c, "eqwt", fmtLbs(totalWt), "", "", "Total weight")}</label></div>
<div class="seq stot2"><span class="stotl"></span><label><span>Total (AC)</span>${sf(c, "eqac", "", "", "", "Total AC")}</label><label><span>Capacity</span>${sf(c, "cap", "", "", "", "Carry capacity")}</label></div></div>
<div class="sblock ssq"><div class="sbar sgrid4"><span>Inventory & gear</span><span>Magic</span><span>Weight</span><span>Worth</span></div>
${Array.from({ length: Math.max(20, pack.length) }, (_, i) => { const x = pack[i], it = x && x.iid && itemById(x.iid); return `<div class="sgrid4 sinv">${sf(c, "inv" + i + ":n", x ? invName(x) + ((x.qty || 1) > 1 ? ` ×${x.qty}` : "") : "", "", "", "Item " + (i + 1))}${sf(c, "inv" + i + ":m", it && it.magic ? "Yes" : "", "", "", "Magic")}${sf(c, "inv" + i + ":w", x ? fmtLbs(wt(x)) : "", "", "", "Weight")}${sf(c, "inv" + i + ":v", it ? it.value : "", "", "", "Worth")}</div>` }).join("")}</div></div></div></section>`;
  const page3 = `<section class="spage"><div class="scols">
<div class="sleft"><div class="sblock"><div class="sbar sgrid5"><span>Rank</span><span>Spell name</span><span>Casting cost</span><span>Range</span><span>Damage</span></div>
${Array.from({ length: Math.max(18, spells.length) }, (_, i) => { const sp = spells[i]; return `<div class="sgrid5 sspell">${sbox(c, "prep" + i, "Prepared " + (i + 1))}${[["rank", sp ? sp.lv : ""], ["n", sp ? sp.n : ""], ["cost", sp ? sp.f.cost : ""], ["range", sp ? sp.f.range : ""], ["dmg", sp && !/^n\/?a$/i.test(str(sp.f.dmg)) ? sp.f.dmg : ""]].map(([col, v]) => sf(c, `sp${i}:${col}`, v ?? "", "", "", "Spell " + (i + 1) + " " + col)).join("")}</div>` }).join("")}</div>
<div class="spair"><div class="stbl scast"><div class="sth"><span># of prepared spells</span></div>${sf(c, "prep", "", "", "", "Number of prepared spells")}<div class="sth"><span>${esc(k && k.source ? k.source : "Arcane")} major</span></div>${sf(c, "major", "", "", "", "Major")}<div class="sth"><span>${esc(k && k.source ? k.source : "Arcane")} minor</span></div>${sf(c, "minor", "", "", "", "Minor")}</div>
<div class="stbl scast"><div class="sth"><span>Spellcasting ability</span></div>${sf(c, "cast", k && k.cast ? `${AB[k.cast]} (${sign(castMod)})` : "", "", "", "Spellcasting ability")}<div class="sth"><span>Spellcasting DC</span></div><p>8 + Ability Modifier + Spell Rank = DC${castMod != null ? `<br><b>8 ${sign(castMod)} + rank</b>` : ""}</p><div class="sth"><span>Spell attack bonus +/−</span></div><p>Ability Modifier + Spell Rank = Atk Bonus${castMod != null ? `<br><b>${sign(castMod)} + rank</b>` : ""}</p></div></div>
<div class="sbox"><div class="stab">Spell components</div>${lines("comp", 8, spells.filter(x => str(x.f.mat) && !/^n\/?a$/i.test(str(x.f.mat))).map(x => `${x.n}: ${plainText(x.f.mat)}`))}</div></div>
<div class="sright"><div class="sbox sfeat"><div class="stab">Features and traits</div><div class="sfeats">${allFeats.map(f => `<p><span class="pdn">${esc(f.n)}</span> <small>(${esc(f.src)})</small> - ${rich(f.d)}</p>`).join("") || `<p class="muted">Your race, class and background features show here.</p>`}</div>
<textarea class="sf" data-s="traits" rows="8" placeholder="More features and traits" aria-label="More features and traits">${esc(sheetVal(c, "traits", ""))}</textarea></div></div></div></section>`;
  $("sheetPages").innerHTML = page1 + page2 + page3;
}
$("sheetPages").addEventListener("input", ev => {
  const t = ev.target, c = cur; if (!c) return;
  if (t.dataset.name) { c.name = t.value; $("sheetName").textContent = str(c.name) || "Unnamed character"; touch(); return }
  if (t.dataset.s) { c.sheet[t.dataset.s] = t.type === "checkbox" ? t.checked : t.value; touch() }
});
$("sheetPages").addEventListener("change", ev => { const t = ev.target; if (t.type === "checkbox" && t.dataset.s) { cur.sheet[t.dataset.s] = t.checked; touch() } });
$("sheetPages").addEventListener("click", ev => {
  const c = cur, b = ev.target.closest("button"); if (!b || !c) return;
  if (b.dataset.rank) { const key = b.dataset.rank, v = +b.dataset.v; c.rank[key] = rankOf(c, key, true) === v && c.rank[key] != null ? v - 1 : v; touch(); renderSheet(); focusSel(`[data-rank="${CSS.escape(key)}"][data-v="${v}"]`); return }
  if (b.dataset.prof) {
    const key = b.dataset.prof, [cat, n] = key.split(/:(.*)/s), ps = profState(c);
    if (cat === "skill") { if (ps.given("skill", n)) { say(`${n} comes from your ${ps.given("skill", n).src.join(", ")}.`); return } c.prof.skill[n] = !c.prof.skill[n] }
    else if (cat === "save") { if (ps.given("save", n)) { say(`This saving throw comes from your ${ps.given("save", n).src.join(", ")}.`); return } c.prof.save[n] = !c.prof.save[n] }
    else if (cat === "w" || cat === "a") { const pc = cat === "w" ? "weapon" : "armor"; if (ps.given(pc, n)) { say(`${n} comes from your ${ps.given(pc, n).src.join(", ")}.`); return } const o = c.prof[pc][n] || {}; c.prof[pc][n] = Object.values(o).some(Boolean) ? {} : { S: true } }
    else if (cat === "t") { if (ps.given("trade", n)) { say(`${n} comes from your ${ps.given("trade", n).src.join(", ")}.`); return } c.prof.trade[n] = c.prof.trade[n] ? "" : "B" }
    touch(); renderSheet(); focusSel(`[data-prof="${CSS.escape(key)}"]`);
  }
});
const focusSel = sel => { const el = document.querySelector(sel); if (el) el.focus() };
$("sheetPrint").addEventListener("click", () => window.print());
/* printing: each sheet page is scaled to fill one letter page (8.5 x 11 in with 0.3 in margins) */
const PRINT_W = 758, PRINT_H = 980;
function fitPrint() {
  if (view !== "sheet") return;
  document.body.classList.add("cc-printing");
  document.querySelectorAll(".spage").forEach(p => {
    let z = 1; p.style.zoom = ""; p.style.width = PRINT_W + "px";
    for (let i = 0; i < 5; i++) { const h = p.getBoundingClientRect().height; if (h <= PRINT_H) break; z *= PRINT_H / h * .995; p.style.zoom = z; p.style.width = PRINT_W / z + "px" }
  });
}
function unfitPrint() { document.body.classList.remove("cc-printing"); document.querySelectorAll(".spage").forEach(p => { p.style.zoom = ""; p.style.width = "" }) }
window.addEventListener("beforeprint", fitPrint);
window.addEventListener("afterprint", unfitPrint);
$("sheetEdit").addEventListener("click", () => show("create"));
$("sheetReset").addEventListener("click", ev => {
  const b = ev.currentTarget;
  if (!Object.keys(cur.sheet).length) { say("Nothing on this sheet has been typed over."); return }
  if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to clear what you typed"; setTimeout(() => { delete b.dataset.sure; b.textContent = "Clear typed-in values" }, 3000); return }
  delete b.dataset.sure; b.textContent = "Clear typed-in values"; cur.sheet = {}; touch(); renderSheet(); say("The sheet is back to the values worked out from your choices.");
});

/* ---------------------------------------------------------------- my characters */
function renderHome() {
  const list = chars.slice().sort((a, b) => (b.edited || b.made || 0) - (a.edited || a.made || 0));
  $("cchome").innerHTML = `<div class="cchero"><button type="button" class="ccnew" data-act="new"><span>+</span>Create a new character</button>
<label class="btn">Open a character file<input type="file" accept=".json,application/json" id="ccImport" hidden></label></div>
${list.length ? `<h2 class="cch2">My characters <small>Saved in this browser</small></h2><div class="ccchars">${list.map(c => { const r = raceOf(c), s = subOf(c), k = clsOf(c); return `<div class="ccchar" data-id="${esc(c.id)}">
${c.details.portrait ? `<img src="${esc(c.details.portrait)}" alt="">` : `<span class="ccnopic" aria-hidden="true">${esc((str(c.name) || "?")[0].toUpperCase())}</span>`}
<div><b>${esc(str(c.name) || "Unnamed character")}</b><small>${esc([s ? s.n : r && r.n, k && k.n].filter(Boolean).join(" · ") || "Not finished")}</small></div>
<div class="ccbtns"><button type="button" class="btn solid" data-act="open">${c.done ? "Sheet" : "Continue"}</button><button type="button" class="btn" data-act="edit">Edit</button><button type="button" class="btn" data-act="file">Save to file</button><button type="button" class="btn gdel" data-act="del">Delete</button></div></div>` }).join("")}</div>` : `<p class="ccnote">Characters you make are saved in this browser. Use <b>Save to file</b> to keep a copy or move it to another device.</p>`}`;
}
$("cchome").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.dataset.act === "new") { cur = blankChar(); chars.unshift(cur); persist(true); show("create"); return }
  const row = b.closest(".ccchar"), c = row && chars.find(x => x.id === row.dataset.id); if (!c) return;
  if (b.dataset.act === "open") { cur = c; show(c.done ? "sheet" : "create"); return }
  if (b.dataset.act === "edit") { cur = c; show("create"); return }
  if (b.dataset.act === "file") { saveFile(c); return }
  if (b.dataset.act === "del") {
    if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to delete"; return }
    chars = chars.filter(x => x !== c); if (cur === c) cur = null; persist(true); renderHome(); say(`Deleted ${str(c.name) || "the character"}.`);
  }
});
$("cchome").addEventListener("change", ev => {
  if (ev.target.id !== "ccImport") return; const f = ev.target.files && ev.target.files[0]; if (!f) return;
  f.text().then(t => {
    const j = JSON.parse(t), c = j && j.crawlCharacter ? j.crawlCharacter : j;
    if (!c || typeof c !== "object" || !("base" in c) || !("prof" in c)) throw new Error("bad");
    const n = fixChar(c); if (chars.some(x => x.id === n.id)) n.id = newId("pc");
    chars.unshift(n); cur = n; persist(true); show(n.done ? "sheet" : "create"); say(`Opened ${str(n.name) || "the character"}.`);
  }).catch(() => say("That file isn't a Crawl character."));
});
async function saveFile(c) {
  const name = (slugOf(c.name) || "character") + ".crawl.json", text = JSON.stringify({ crawlCharacter: c }, null, 1);
  try {
    if (APP && APP.saveFile) { const r = await APP.saveFile(name, new TextEncoder().encode(text).buffer); if (r) say(`Saved ${r}.`); return }
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500);
    say(`Saved ${name}. Open it here any time with Open a character file.`);
  } catch (e) { say("Saving the file didn't work. Try again.") }
}
$("sheetFile").addEventListener("click", () => saveFile(cur));
$("ccHome").addEventListener("click", () => show("home"));
$("sheetHome").addEventListener("click", () => show("home"));

/* ---------------------------------------------------------------- views */
function show(v, quiet) {
  if ((v === "create" || v === "sheet") && !cur) v = "home";
  if (v === "admin" && !ADMIN) v = "home";
  if (view === "admin" && v !== "admin" && adminDirty()) { say("Save or discard your rule changes first."); return }
  view = v; hideTip();
  $("cchome").hidden = v !== "home"; $("ccgame").hidden = $("ccfoot").hidden = v !== "create"; $("ccsheet").hidden = v !== "sheet"; $("ccadmin").hidden = v !== "admin";
  $("ccAdminBtn").hidden = !ADMIN || v === "admin";
  document.body.classList.toggle("cc-sheet", v === "sheet");
  if (v === "home") renderHome(); else if (v === "create") renderCreate(); else if (v === "sheet") renderSheet(); else renderAdmin();
  try { const u = new URL(location.href); u.searchParams.delete("c"); if (cur && v !== "home" && v !== "admin") u.searchParams.set("c", cur.id); history.replaceState(null, "", u) } catch (e) { }
  if (!quiet) window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------- admin: rules (classes and backgrounds have their own pages) */
const adminDirty = () => JSON.stringify(cleanCreator()) !== RULES_ORIG;
const RULE_FIELDS = [["wealth", "Standard starting wealth", "Used when a class doesn't set its own Starting Currency, e.g. 25 (G)"], ["rank", "Starting rank for a proficient skill", "e.g. 1"], ["spellRank", "Highest spell rank at character creation", "e.g. 1"],
  ["passive", "Passive skill base", "Passive DC = this + the skill's bonus, e.g. 10"], ["langs", "Languages to suggest", "Comma separated. Languages written on races are added automatically."]];
function fieldHTML(d, [k, label, help], id) {
  const ph = /^e\.g\./.test(help) ? help : "", h = ph ? "" : help;
  return `<label for="${id}${k}">${label}${h ? ` <small>${esc(h)}</small>` : ""}<input type="text" id="${id}${k}" data-k="${k}" value="${esc(d[k] ?? "")}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
}
function renderAdmin() {
  $("ccAdminList").innerHTML = `<div class="gform rform rules" data-rules="1">${RULE_FIELDS.map(f => fieldHTML(CR.rules, f, "rule-")).join("")}</div>`;
  markAdmin();
}
function markAdmin() {
  const d = adminDirty(); $("savebar").hidden = !d;
  if (d) { $("saveMsg").textContent = "You have unsaved Character Creator rule changes."; $("saveBtn").disabled = false; $("discardBtn").disabled = false }
}
$("ccAdminList").addEventListener("input", ev => { const f = ev.target.closest("[data-rules]"); if (f && ev.target.dataset.k) { CR.rules[ev.target.dataset.k] = ev.target.value; markAdmin() } });
$("ccAdminBtn").addEventListener("click", () => show("admin"));
$("ccAdminDone").addEventListener("click", () => { if (adminDirty()) { say("Save or discard your changes first."); return } show("home") });
$("saveBtn").addEventListener("click", async () => {
  if (!ADMIN || !GH_KEY) { $("saveMsg").textContent = "Sign in as admin to save."; return }
  $("saveBtn").disabled = true; $("discardBtn").disabled = true; $("saveMsg").textContent = "Saving to the site…";
  try {
    const data = cleanCreator();
    await putFile("crawl-creator.json", JSON.stringify(data, null, 1) + "\n", "Update the Character Creator rules from the admin page");
    RULES_ORIG = JSON.stringify(data);
    $("saveMsg").textContent = "Saved. Everyone sees the changes in about a minute.";
    setTimeout(() => { if (!adminDirty()) $("savebar").hidden = true }, 4000);
  } catch (x) { $("saveMsg").textContent = saveError(x && x.code, "Character Creator rules"); $("saveBtn").disabled = false; $("discardBtn").disabled = false }
});
$("discardBtn").addEventListener("click", () => { CR.rules = normRules(JSON.parse(RULES_ORIG)); $("savebar").hidden = true; say(""); renderAdmin() });
window.addEventListener("beforeunload", ev => { persist(true); if (view === "admin" && adminDirty()) { ev.preventDefault(); ev.returnValue = "" } });

AdminHooks.canSignOut = () => { if (view === "admin" && adminDirty()) { say("Save or discard your changes before signing out."); return false } return true };
AdminHooks.signedIn = quiet => { $("ccAdminBtn").hidden = view === "admin"; if (!quiet) say("Signed in as admin. Edit classes on the Classes page, backgrounds on the Backgrounds page, and the creator's rules with Edit rules."); refreshFromGitHub() };
AdminHooks.signedOut = () => { CR.rules = normRules(JSON.parse(RULES_ORIG)); $("savebar").hidden = true; show(view === "admin" ? "home" : view, true); say("Signed out.") };
async function refreshFromGitHub() {
  try {
    const r = await gh(`/contents/crawl-creator.json?ref=${REPO.branch || "main"}`, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (r.ok && !adminDirty()) { const n = normRules(await r.json()); if (n) { CR.rules = n; RULES_ORIG = JSON.stringify(cleanCreator()); show(view, true) } }
  } catch (x) { }
}

/* ---------------------------------------------------------------- start */
function start() {
  let id = ""; try { id = new URLSearchParams(location.search).get("c") || "" } catch (e) { }
  const c = id && chars.find(x => x.id === id);
  if (c) { cur = c; show(c.done ? "sheet" : "create", true) } else show("home", true);
}
if (STATIC) {
  $("adminBtn").hidden = false; showAdminBtn();
  const get = f => fetch(f, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
  Promise.all([get("crawl-creator.json"), get("crawl-races.json"), get("crawl-spells.json"), get("crawl-items.json"), get("crawl-classes.json"), get("crawl-backgrounds.json")]).then(([cj, rj, sj, ij, kj, bj]) => {
    if (ij && Array.isArray(ij.items)) { ITEMS = ij.items; GEAR_ITEMS = ij.items }
    if (cj && !adminDirty()) { const n = normRules(cj); if (n) { CR.rules = n; RULES_ORIG = JSON.stringify(cleanCreator()) } }
    if (rj) RACE_LIST = normRaces(rj);
    if (Array.isArray(sj)) SPELL_LIST = sj;
    if (kj && Array.isArray(kj.classes)) CR.classes = normClasses(kj);
    if (bj && Array.isArray(bj.backgrounds)) CR.backgrounds = normBgs(bj);
  }).finally(() => { show(view, true); restoreAdmin() });
}
start();
