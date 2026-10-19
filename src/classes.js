/* Classes page (crawl-classes.json), Backgrounds page (crawl-backgrounds.json) and Feats page (crawl-feats.json); see src/crawldata.js for the data.
   The Character Creator reads both files, so whatever is added here can be picked there.
   Signed in as admin: Add, Edit, Delete; classes also get subclasses, a class chart, features by level and loadouts.
   Runs after the shared admin code, src/editkit.js and src/crawldata.js. */
const PAGE = window.GL_PAGE;                       // "classes", "backgrounds" or "feats"
const IS_CLS = PAGE === "classes", IS_FEAT = PAGE === "feats";
const FILE = IS_CLS ? "crawl-classes.json" : IS_FEAT ? "crawl-feats.json" : "crawl-backgrounds.json";
const WHAT = IS_CLS ? "class" : IS_FEAT ? "feat" : "background";
const WHATS = IS_CLS ? "classes" : IS_FEAT ? "feats" : "backgrounds";
let list = IS_CLS ? normClasses(CLASSES) : IS_FEAT ? normFeats(FEATS) : normBgs(BACKGROUNDS), original = "", dirty = false;
const editing = new Set(), drafts = new Map();
const clean = () => IS_CLS ? cleanClasses(list) : IS_FEAT ? cleanFeats(list) : cleanBgs(list);
function load(j) {
  const a = IS_CLS ? (j && Array.isArray(j.classes) ? normClasses(j) : null) : IS_FEAT ? (j && Array.isArray(j.feats) ? normFeats(j) : null) : (j && Array.isArray(j.backgrounds) ? normBgs(j) : null);
  if (!a) return false; list = a; original = JSON.stringify(clean()); return true;
}
original = JSON.stringify(clean());
const findPart = id => { for (const p of list) { if (p._id === id) return { part: p, top: p }; const s = (p.subs || []).find(x => x._id === id); if (s) return { part: s, top: p } } return null };
const say = m => { $("gmsg").textContent = m || "" };

/* ---------------------------------------------------------------- view */
const query = () => lcs($("cq").value.trim()).replace(/\s+/g, " ");
const textOf = p => plainText([p.n, p.desc, p.cat, p.pre, p.skills, p.weapons, p.armor, p.trades, ...arr(p.choices).map(choiceText), p.prof, p.saves, p.langs, p.hd, p.hp, p.source, p.money, p.wealth, ...(p.feats || []).map(f => f.n + " " + f.d),
  ...(p.extra || []).map(x => x.k + " " + x.v), ...arr(p.loadouts).map(l => l.n + " " + gearLine(l.gear)), gearLine(p.gear || []), ...arr(p.subs).map(s => s.n)].join(" ")).toLowerCase();
const gearHTML = g => g.length ? `<ul class="gearl">${g.map(x => `<li>${x.qty > 1 ? `<b>${x.qty}×</b> ` : ""}${x.iid ? `<a class="ilink" href="items.html#${encodeURIComponent(x.iid)}">${esc(x.n)}</a>` : esc(x.n)}</li>`).join("")}</ul>` : `<p class="muted">No gear listed.</p>`;
const factsHTML = rows => { rows = rows.filter(r => r[1]); return rows.length ? `<dl class="gfacts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${richInline(v)}</dd>`).join("")}</dl>` : "" };
/* a choice feature's options, e.g. the Fighting Styles */
const optsHTML = f => f.opts ? `<div class="fopts"><p class="fchoose">${esc(choiceLine(f))}</p>${f.opts.map(o => `<div class="fopt"><b>${esc(o.n)}</b>${o.d ? paras(o.d) : ""}</div>`).join("")}</div>` : "";
const featHTML = fs => fs.length ? `<div class="rfeats">${fs.map(f => featBlock(f.n, f.d, richInline, f.lv ? ` <span class="lvtag">Level ${f.lv}</span>` : "") + optsHTML(f)).join("")}</div>` : "";
const featId = (p, i) => `feat-${p.id}-${i}`;
/* the general Feat feature: every class gains a feat at every Nth level (Character Creator rules) */
const featRuleText = () => { const lv = featLevels(20); return lv.length ? `At ${ordinal(lv[0])} level, and again at ${lv.slice(1, 4).map(ordinal).join(", ")}${lv.length > 4 ? " and so on" : ""}, you gain a feat of your choice from the [link=feats.html]Feats[/link] page, as long as you meet its prerequisite.` : "" };
function chartHTML(k) {
  const maxLv = Math.max(0, ...k.chart.map(r => r.lv || 0)), fLv = k.chart.length ? featLevels(Math.max(maxLv, 1)) : [];
  const lvls = [...new Set([...k.chart.map(r => r.lv).filter(Boolean), ...k.feats.map(f => f.lv || 1)])].sort((a, b) => a - b);
  const byLv = new Map(k.chart.map(r => [r.lv, r])), ruleId = `feat-${k.id}-rule`;
  const lvls2 = [...new Set([...lvls, ...k.feats.flatMap(f => f.more || [])])].sort((a, b) => a - b);
  const rows = lvls2.map(lv => { const r = byLv.get(lv) || {}, fs = k.feats.map((f, i) => [f, i]).filter(([f]) => (f.lv || 1) === lv || (f.more || []).includes(lv));
    const cells = fs.map(([f, i]) => `<button type="button" class="flink" data-feat="${featId(k, i)}">${esc(f.n)}${(f.lv || 1) !== lv ? " (another option)" : ""}</button>`);
    if (fLv.includes(lv)) cells.push(`<button type="button" class="flink" data-feat="${ruleId}">Feat</button>`);
    return `<tr><th scope="row">${lv}</th><td>${esc(r.pool || "–")}</td><td>${esc(r.die || "–")}</td><td>${cells.join(", ") || "–"}</td></tr>` }).join("");
  const ruleBox = fLv.length ? `<div class="clsf" id="${ruleId}"><h4><span class="pdn">Feat</span><span class="lvtag">Levels ${fLv.slice(0, 3).join(", ")}…</span></h4>${paras(featRuleText())}</div>` : "";
  return `<div class="clsgrid"><div class="clschart"><table><thead><tr><th>Level</th><th>Max Pool</th><th>Action Die</th><th>Features</th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="muted">No levels yet.</td></tr>`}</tbody></table></div>
<div class="clsfeats" aria-label="${esc(k.n)} features"><div class="cfh">Class features</div><div class="cfin" tabindex="0">${k.feats.map((f, i) => [f, i]).sort((a, b) => (a[0].lv || 1) - (b[0].lv || 1)).map(([f, i]) => `<div class="clsf" id="${featId(k, i)}"><h4><span class="pdn">${esc(f.n)}</span><span class="lvtag">Level ${f.lv || 1}</span></h4>${paras(f.d)}${optsHTML(f)}</div>`).join("")}${ruleBox}${k.feats.length || ruleBox ? "" : `<p class="muted">No features yet.</p>`}</div></div></div>`;
}
function classBody(k) {
  return (k.desc ? `<div class="clead">${paras(k.desc)}</div>` : "") + chartHTML(k) +
    factsHTML([["Hit die", k.hd], ["Hit points at 1st level", k.hp], ["Saving Throws", k.saves], ["Starting Skill Proficiencies", k.skills], ["Skill Points", k.skillPts], ["Other Proficiencies", k.prof], ...k.choices.map(ch => ["Proficiency choice", choiceText(ch)]),
      ["Languages", k.langs], ["Magic source", k.source], ["Spellcasting ability", k.cast && AB[k.cast]], ["Spells at character creation", k.spells], ["Prepared spells", k.prepared], ...spellRankFacts(k), ...k.extra.map(x => [x.k || "Detail", x.v])]) +
    `<div class="clsload"><h3>Equipment Loadout</h3><div class="loadgrid">${k.loadouts.map(l => `<div class="loadc"><b>${esc(l.n)}</b>${gearHTML(l.gear)}</div>`).join("")}<div class="loadc money"><b>Or buy your own</b><p>Starting Currency: <b>${esc(moneyText(k))}</b></p></div></div></div>`;
}
const moneyText = k => [k.money, k.moneyRoll && "roll " + k.moneyRoll].filter(Boolean).join(" + ") || "the standard amount";
function spellRankFacts(k) {
  if (!k.source) return [];
  const sch = (k.majorLv || k.minorLv) ? [k.majorLv && `Major chosen at level ${k.majorLv}`, k.minorLv && `Minor chosen at level ${k.minorLv}`].filter(Boolean).join(", ") : "";
  const ranks = [`Spells start at Rank +${+k.startRank || 0}`, sch && `Major and Minor spells start at Rank +${k.schoolStart === "" ? 1 : +k.schoolStart || 0}`, sch && `raising an Opposing School spell costs ${+k.oppCost || 2} skill points per Rank`].filter(Boolean).join("; ");
  return [["Schools", sch], ["Spell Ranks", ranks]];
}
function bgBody(b) {
  return (b.desc ? `<div class="clead">${paras(b.desc)}</div>` : "") +
    factsHTML([["Skill Proficiencies", b.skills], ["Weapon Proficiencies", b.weapons], ["Armor Proficiencies", b.armor], ["Trade Skill Proficiencies", b.trades], ["Other Proficiencies", b.prof], ["Language Proficiencies", b.langs],
      ...b.choices.map(ch => ["Proficiency choice", choiceText(ch)]), ["Starting wealth", b.wealth], ...b.extra.map(x => [x.k || "Detail", x.v])]) +
    (b.gear.length ? `<div class="clsload"><h3>Starting equipment</h3>${gearHTML(b.gear)}</div>` : "") + featHTML(b.feats);
}
function featBody(f) {
  return factsHTML([["Prerequisite", f.pre], ...f.extra.map(x => [x.k || "Detail", x.v])]) + (f.desc ? `<div class="clead">${paras(f.desc)}</div>` : `<p class="muted">No description yet.</p>`);
}
function subHTML(s, k) {
  if (editing.has(s._id)) return `<div class="subr">${form(s, "sub", k)}</div>`;
  return `<div class="subr" id="${esc(s.id)}"><div class="subh"><b>${esc(s.n)}</b>${ADMIN ? `<button type="button" class="gedit" data-act="edit" data-id="${s._id}">Edit</button>` : ""}</div>${s.desc ? `<div class="clead">${paras(s.desc)}</div>` : ""}${featHTML(s.feats.slice().sort((a, b) => (a.lv || 1) - (b.lv || 1)))}${s.desc || s.feats.length ? "" : `<p class="muted">No details yet.</p>`}</div>`;
}
function cardHTML(p, q) {
  if (editing.has(p._id)) return `<section class="cond" id="${esc(p.id)}"><div class="chead"><span>${p._new ? "New " + WHAT : "Editing " + esc(p.n)}</span></div><div class="cbody">${form(p, IS_CLS ? "class" : IS_FEAT ? "feat" : "bg")}</div></section>`;
  const tag = IS_CLS && p.source ? `<span class="ctag">${esc(p.source)} magic</span>` : IS_FEAT && p.cat ? `<span class="ctag">${esc(p.cat)}</span>` : "";
  const subs = !IS_CLS ? [] : q && !textOf({ ...p, subs: [] }).includes(q) ? p.subs.filter(s => editing.has(s._id) || textOf(s).includes(q)) : p.subs;
  return `<section class="cond" id="${esc(p.id)}"><h2 class="chead"><span>${esc(p.n)}</span><span class="chr">${tag}${ADMIN ? `<button type="button" class="gedit" data-act="edit" data-id="${p._id}">Edit</button>` : ""}</span></h2>
<div class="cbody">${IS_CLS ? classBody(p) : IS_FEAT ? featBody(p) : bgBody(p)}
${IS_CLS && (subs.length || ADMIN) ? `<div class="subs"><h3>Subclasses</h3>${subs.map(s => subHTML(s, p)).join("") || `<p class="muted">No subclasses yet.</p>`}${ADMIN ? `<button type="button" class="btn addsub" data-act="addsub" data-id="${p._id}">Add a subclass to ${esc(p.n)}</button>` : ""}</div>` : ""}</div></section>`;
}

/* ---------------------------------------------------------------- forms */
const ITEM_LIST = () => `<datalist id="itemNames">${GEAR_ITEMS.slice().sort(byName).map(i => `<option value="${esc(i.n)}">`).join("")}</datalist>`;
const optRow = o => `<div class="forow"><input type="text" class="fon" value="${esc(o.n)}" placeholder="Option name, e.g. Archery" aria-label="Option name" autocomplete="off"><textarea class="fod" rows="2" placeholder="What the option does" aria-label="Option description">${esc(o.d)}</textarea><button type="button" class="btn xdel">Remove</button></div>`;
const optEditor = f => `<details class="foptbox"${f.opts && f.opts.length ? " open" : ""}><summary>Options to choose from${f.opts && f.opts.length ? ` (${f.opts.length})` : ""} <small>Make this a choice feature, like Fighting Style</small></summary>
<div class="foptctl"><label>Player chooses <input type="number" class="fpick" min="1" max="10" value="${f.pick || 1}" aria-label="How many options to choose"></label><label>Another choice at levels <input type="text" class="fmore" value="${esc((f.more || []).join(", "))}" placeholder="e.g. 5, 10" aria-label="Levels with another choice" autocomplete="off"></label></div>
<div class="folist">${arr(f.opts).map(optRow).join("")}</div><button type="button" class="btn" data-act="foadd">Add an option</button></details>`;
const featRow = f => `<div class="prow frow"><input type="text" class="pn" value="${esc(f.n)}" placeholder="Feature name" aria-label="Feature name" autocomplete="off"><input type="number" class="pl" min="1" max="30" value="${esc(f.lv || "")}" placeholder="Lv" aria-label="Level gained" title="Level gained"><textarea class="pd" rows="2" placeholder="What the feature does" aria-label="Feature description">${esc(f.d)}</textarea><button type="button" class="btn xdel">Remove</button>${optEditor(f)}</div>`;
const bgFeatRow = f => `<div class="prow"><input type="text" class="pn" value="${esc(f.n)}" placeholder="Feature name" aria-label="Feature name" autocomplete="off"><textarea class="pd" rows="2" placeholder="What the feature does" aria-label="Feature description">${esc(f.d)}</textarea><button type="button" class="btn xdel">Remove</button></div>`;
const extraRow = x => `<div class="xrow"><input type="text" class="xk" value="${esc(x.k)}" placeholder="Label" aria-label="Detail label" autocomplete="off"><input type="text" class="xv" value="${esc(x.v)}" placeholder="Value" aria-label="Detail value" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
const chartRowHTML = r => `<div class="chrow"><input type="number" class="cl" min="1" max="30" value="${esc(r.lv || "")}" placeholder="Lv" aria-label="Level"><input type="text" class="cp" value="${esc(r.pool)}" placeholder="Max Pool" aria-label="Max Pool" autocomplete="off"><input type="text" class="cd" value="${esc(r.die)}" placeholder="Action Die, e.g. 1d6" aria-label="Action Die" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
const kindSelect = cat => `<select class="chk" aria-label="What to choose">${CHOICE_KINDS.map(([v, one, many]) => `<option value="${v}"${v === cat ? " selected" : ""}>${many}</option>`).join("")}</select>`;
const choiceOptsHTML = (cat, opts) => cat === "lang" ? `<input type="text" class="chtext" value="${esc(opts.join(", "))}" placeholder="Languages, comma separated, e.g. Dwarvish, Elvish, Gnomish" aria-label="Languages to choose from" autocomplete="off">`
  : choiceOptions(cat).map(o => `<label class="chopt"><input type="checkbox" value="${esc(o)}"${opts.includes(o) ? " checked" : ""}><span>${esc(o)}</span></label>`).join("");
const choiceRowHTML = ch => `<div class="choicerow"><div class="chtop"><span>Choose</span><input type="number" class="chn" min="1" max="20" value="${ch.n || 1}" aria-label="How many"><span class="chk-wrap">${kindSelect(ch.cat)}</span><span>from:</span><button type="button" class="btn xdel">Remove</button></div><div class="chopts">${choiceOptsHTML(ch.cat, ch.opts || [])}</div></div>`;
const choicesEditor = d => `<div class="glab">Proficiency choices <small>Let the player pick from a group you set, e.g. choose 1 skill from Athletics, Thievery, Lore or Occult.</small></div><div class="chlist2">${arr(d.choices).map(choiceRowHTML).join("")}</div><button type="button" class="btn" data-act="chadd">Add a choice</button>`;
const schoolRowHTML = r => `<div class="schrow"><input type="text" class="ss" list="schoolNames" value="${esc(r.s)}" placeholder="School, e.g. Abjuration" aria-label="School" autocomplete="off"><input type="text" class="so" list="schoolNames" value="${esc(r.opp)}" placeholder="Its Opposing School" aria-label="Opposing School" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
const gearRowHTML = g => `<div class="grow"><input type="text" class="gn" list="itemNames" value="${esc(g.n)}" placeholder="Item, e.g. Leather Jerkin" aria-label="Item" autocomplete="off"><input type="number" class="gq" min="1" max="999" value="${g.qty || 1}" aria-label="How many"><button type="button" class="btn xdel">Remove</button></div>`;
const loadoutHTML = l => `<div class="lrow"><div class="lhead"><input type="text" class="ln" value="${esc(l.n)}" placeholder="Loadout name, e.g. Loadout A" aria-label="Loadout name" autocomplete="off"><button type="button" class="btn xdel">Remove loadout</button></div><div class="glist">${l.gear.map(gearRowHTML).join("")}</div><button type="button" class="btn" data-act="gadd">Add gear</button></div>`;
function form(p, kind, parent) {
  const d = drafts.get(p._id) || p, id = k => `f${k}-${p._id}`;
  const fld = (k, label, help, inner) => `<label for="${id(k)}">${label}${help ? ` <small>${help}</small>` : ""}${inner}</label>`;
  const inp = (k, ph) => `<input type="text" id="${id(k)}" data-k="${k}" value="${esc(d[k])}" placeholder="${esc(ph)}" autocomplete="off">`;
  const sel = (k, opts) => `<select id="${id(k)}" data-k="${k}">${opts.map(([v, l]) => `<option value="${v}"${v === d[k] ? " selected" : ""}>${l}</option>`).join("")}</select>`;
  const area = k => `<textarea id="${id(k)}" data-k="${k}" rows="3">${esc(d[k])}</textarea>`;
  const top = `<div class="gbtns gtop">${kind === "sub" ? `<b>${p._new ? `New subclass of ${esc(parent.n)}` : "Editing " + esc(p.n)}</b>` : ""}<span class="sp"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn solid" data-act="done">Done</button></div>`;
  const bottom = `<p class="gerr" role="alert"></p><div class="gbtns"><button type="button" class="btn gdel" data-act="del">${p._new ? "Remove" : "Delete " + (kind === "sub" ? "subclass" : WHAT)}</button><span class="sp"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn solid" data-act="done">Done</button></div>`;
  const feats = (rows, label) => `<div class="glab">${label} <small>The name shows in red. Give each feature the level it's gained at; it appears on that row of the chart.</small></div><div class="plist">${rows.map(featRow).join("")}</div><button type="button" class="btn" data-act="fadd">Add a feature</button>`;
  const extras = `<div class="glab">More details <small>Anything else, each with its own label.</small></div><div class="xlist">${d.extra.map(extraRow).join("")}</div><button type="button" class="btn" data-act="xadd">Add a detail</button>`;
  let body = "";
  if (kind === "sub") body = fld("n", "Subclass name", "", inp("n", "e.g. School of Evocation")) + fld("desc", "Description", "Leave a blank line between paragraphs.", area("desc")) + feats(d.feats, "Subclass features") + extras;
  else if (kind === "class") body = fld("n", "Class name", "", inp("n", "e.g. Wizard")) + fld("role", "Class descriptor", "Shown under the class name in the Character Creator.", inp("role", "e.g. Arcane Spellcaster or Martial Combatant")) + fld("desc", "Description", "Leave a blank line between paragraphs.", area("desc")) +
    `<div class="fgrid">${fld("hd", "Hit die", "", inp("hd", "e.g. 1d8"))}${fld("hp", "Hit points at 1st level", "", inp("hp", "e.g. 8 + Constitution modifier"))}
${fld("source", "Magic source", "", sel("source", [["", "None"], ...SOURCES.map(s => [s, s])]))}${fld("cast", "Spellcasting ability", "", sel("cast", [["", "None"], ...ABIL]))}
${fld("spells", "Spells at character creation", "Empty = no limit", inp("spells", "e.g. 4"))}${fld("skillPts", "Skill Points", "Spent on skill ranks in the creator", inp("skillPts", "e.g. 4"))}</div>` +
    fld("saves", "Saving Throws", "", inp("saves", "e.g. Intelligence, Wisdom")) +
    fld("skills", "Starting Skill Proficiencies", "Name skills, or write “Two skills of your choice” or “Either Arcane or Lore”.", inp("skills", "e.g. Arcane, Two skills of your choice")) +
    fld("prof", "Other Proficiencies", "Weapon types, armor and trade skills, e.g. simple Blades, Light Armor, Either Alchemy or Scribing.", inp("prof", "e.g. simple Blades, Light Armor")) +
    fld("langs", "Languages", "", inp("langs", "e.g. One additional Language of your choice")) + choicesEditor(d) +
    `<div class="glab">Class chart <small>One row per level: its Max Pool and Action Die. Features are added to the right level automatically, and so is a Feat at every ${featEvery() ? ordinal(featEvery()) : "Nth"} level (set in the Character Creator's rules).</small></div><div class="chlist"><div class="chrow chh"><span>Level</span><span>Max Pool</span><span>Action Die</span><span></span></div>${d.chart.map(chartRowHTML).join("")}</div>
<div class="gbtns"><button type="button" class="btn" data-act="cadd">Add a level</button><button type="button" class="btn" data-act="cfill">Fill in levels 1 to 20</button></div>` +
    feats(d.feats, "Class features") +
    `<div class="glab">Equipment Loadouts <small>Each loadout is a set of gear a player can take. Item names from the Items page link to them.</small></div><div class="llist">${d.loadouts.map(loadoutHTML).join("")}</div><button type="button" class="btn" data-act="ladd">Add a loadout</button>` +
    `<div class="fgrid">${fld("money", "Starting Currency", "What a player gets instead of a loadout, to buy their own gear. Empty = the creator's standard amount.", inp("money", "e.g. 25 (G)"))}${fld("moneyRoll", "Roll for Starting Currency", "Rolled when the player reaches Equipment in the Character Creator and added to the Starting Currency.", inp("moneyRoll", "e.g. 4d8 (G) or 2d4 x 10 (S)"))}</div>` +
    `<div class="glab">Spellcasting details <small>Used by the Character Creator and the character sheet. Formulas can use STR, DEX, CON, INT, WIS, CHA (their modifiers), level, +, −, *, /, floor(), ceil(), max() and min().</small></div>
<div class="fgrid">${fld("prepared", "Prepared spells", "Formula", inp("prepared", "e.g. max(1, INT + floor(level / 2))"))}
${fld("startRank", "Spells start at Rank", "", inp("startRank", "e.g. 0"))}${fld("schoolStart", "Major and Minor spells start at Rank", "", inp("schoolStart", "e.g. 1"))}
${fld("majorLv", "Major school chosen at level", "Empty = no Major", inp("majorLv", "e.g. 1"))}${fld("minorLv", "Minor school chosen at level", "Empty = no Minor", inp("minorLv", "e.g. 3"))}
${fld("oppCost", "Skill points per Rank for an Opposing School spell", "", inp("oppCost", "e.g. 2"))}</div>
<div class="glab">Schools and their Opposing Schools <small>The schools a player can pick as their Major or Minor.</small></div><datalist id="schoolNames">${SCHOOLS.map(s => `<option value="${esc(s)}">`).join("")}</datalist><div class="schlist">${d.schools.map(schoolRowHTML).join("")}</div>
<div class="gbtns"><button type="button" class="btn" data-act="sadd">Add a school</button><button type="button" class="btn" data-act="sfill">Add the schools from the spell list</button></div>` + extras;
  else if (kind === "feat") body = fld("n", "Feat name", "", inp("n", "e.g. Shield Master")) +
    `<div class="fgrid">${fld("cat", "Category", "Optional, e.g. Combat, Magic, Skill, General", `<input type="text" id="${id("cat")}" data-k="cat" value="${esc(d.cat)}" placeholder="e.g. Combat" list="featCats" autocomplete="off">`)}${fld("pre", "Prerequisite", "Optional", inp("pre", "e.g. Strength 13 or higher, 4th level"))}</div>` +
    `<datalist id="featCats">${[...new Set(["General", "Combat", "Magic", "Skill", ...list.map(x => x.cat).filter(Boolean)])].map(c => `<option value="${esc(c)}">`).join("")}</datalist>` +
    fld("desc", "What the feat does", "Leave a blank line between paragraphs.", `<textarea id="${id("desc")}" data-k="desc" rows="6">${esc(d.desc)}</textarea>`) + extras;
  else body = fld("n", "Background name", "", inp("n", "e.g. Ferryman")) + fld("desc", "Description", "Leave a blank line between paragraphs.", area("desc")) +
    `<div class="glab">Starting proficiencies <small>Name what the background gives. Write "Either Lore or Occult" for a pick of one, or "Two skills of your choice" for free picks. Use Proficiency choices below to let the player pick from a group you set.</small></div>
<div class="fgrid">${fld("skills", "Skill Proficiencies", "", inp("skills", "e.g. Persuasion, Appraisal"))}${fld("weapons", "Weapon Proficiencies", "", inp("weapons", "e.g. Simple and Martial Swords"))}
${fld("armor", "Armor Proficiencies", "", inp("armor", "e.g. Light Armor"))}${fld("trades", "Trade Skill Proficiencies", "", inp("trades", "e.g. Cooking"))}</div>
${fld("langs", "Language Proficiencies", "", inp("langs", "e.g. One additional Language of your choice"))}${d.prof ? fld("prof", "Other Proficiencies", "", inp("prof", "")) : ""}` + choicesEditor(d) +
    `<div class="glab">Starting equipment <small>Item names from the Items page link to them.</small></div><div class="glist">${d.gear.map(gearRowHTML).join("")}</div><button type="button" class="btn" data-act="gadd">Add gear</button>` +
    fld("wealth", "Starting wealth", "Added to the player's purse in the creator.", inp("wealth", "e.g. 10 (G)")) +
    `<div class="glab">Features</div><div class="plist">${d.feats.map(bgFeatRow).join("")}</div><button type="button" class="btn" data-act="fadd">Add a feature</button>` + extras;
  return `<div class="gediting gform rform cform" data-id="${p._id}" data-kind="${kind}">${top}${body}${bottom}</div>`;
}
const own = (f, sel) => [...f.querySelectorAll(sel)].filter(el => el.closest(".rform") === f);
function readForm(f) {
  const d = {}; own(f, "[data-k]").forEach(el => { d[el.dataset.k] = el.value });
  d.feats = own(f, ".prow").map(r => ({ n: r.querySelector(".pn").value, d: r.querySelector(".pd").value, lv: r.querySelector(".pl") ? r.querySelector(".pl").value : "",
    ...(r.querySelector(".foptbox") ? { opts: [...r.querySelectorAll(".forow")].map(o => ({ n: o.querySelector(".fon").value, d: o.querySelector(".fod").value })), pick: r.querySelector(".fpick").value, more: r.querySelector(".fmore").value } : {}) }));
  d.extra = own(f, ".xrow").map(r => ({ k: r.querySelector(".xk").value, v: r.querySelector(".xv").value }));
  d.chart = own(f, ".chrow:not(.chh)").map(r => ({ lv: r.querySelector(".cl").value, pool: r.querySelector(".cp").value, die: r.querySelector(".cd").value }));
  d.loadouts = own(f, ".lrow").map(l => ({ n: l.querySelector(".ln").value, gear: [...l.querySelectorAll(".grow")].map(g => ({ n: g.querySelector(".gn").value, qty: g.querySelector(".gq").value })) }));
  d.choices = own(f, ".choicerow").map(r => { const cat = r.querySelector(".chk").value; return { n: r.querySelector(".chn").value, cat, opts: cat === "lang" ? (r.querySelector(".chtext") ? r.querySelector(".chtext").value.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : []) : [...r.querySelectorAll(".chopt input:checked")].map(i => i.value) } });
  d.schools = own(f, ".schrow").map(r => ({ s: r.querySelector(".ss").value, opp: r.querySelector(".so").value }));
  d.gear = own(f, ".glist").filter(g => !g.closest(".lrow")).flatMap(g => [...g.querySelectorAll(".grow")].map(r => ({ n: r.querySelector(".gn").value, qty: r.querySelector(".gq").value })));
  return d;
}
function saveDrafts() { document.querySelectorAll(".cform").forEach(f => { const d = readForm(f); drafts.set(+f.dataset.id, { ...findPart(+f.dataset.id).part, ...d, chart: d.chart.map(r => ({ lv: featLv(r.lv), pool: r.pool, die: r.die })), feats: featsOf(d.feats.map(x => ({ ...x, lv: featLv(x.lv) }))), gear: gearOf(d.gear), loadouts: d.loadouts.map(l => ({ n: l.n, gear: gearOf(l.gear) })) }) }) }

/* ---------------------------------------------------------------- page */
function render() {
  saveDrafts();
  if (window.crawlNavList) window.crawlNavList(PAGE, list);
  const q = query();
  let shown = list.filter(p => !p._new || editing.has(p._id));
  if (q) shown = shown.filter(p => editing.has(p._id) || textOf(p).includes(q) || arr(p.subs).some(s => editing.has(s._id)));
  shown.sort((a, b) => (a._new ? -1 : b._new ? 1 : 0) || byName(a, b));
  const n = list.filter(p => !p._new).length;
  $("ccount").textContent = `${n} ${n === 1 ? WHAT : WHATS}`;
  $("clist").innerHTML = ITEM_LIST() + (shown.length ? `<div class="rlist2">${shown.map(p => cardHTML(p, q)).join("")}</div>` : "");
  sideShow(editing.size > 0);
  $("cempty").hidden = shown.length > 0;
  $("cempty").textContent = n ? "Nothing matches. Try a different word, or clear the search." : `No ${WHATS} yet.` + (ADMIN ? ` Click Add ${WHAT} to create the first one.` : "");
  $("gAdd").hidden = !ADMIN;
}
function markDirty() {
  dirty = JSON.stringify(clean()) !== original;
  $("savebar").hidden = !dirty;
  if (dirty) { $("saveMsg").textContent = `You have unsaved ${WHAT} changes.`; $("saveBtn").disabled = false; $("discardBtn").disabled = false }
}
function closeForm(id) {
  const hit = findPart(id); editing.delete(id); drafts.delete(id); if (!hit || !hit.part._new) return;
  if (hit.part === hit.top) list = list.filter(p => p !== hit.top); else hit.top.subs = hit.top.subs.filter(s => s !== hit.part);
}
function focusForm(id, sel = '[data-k="n"]') { const f = document.querySelector(`.cform[data-id="${id}"]`); if (f) { f.scrollIntoView({ block: "center" }); const el = f.querySelector(sel); if (el) el.focus() } }

$("clist").addEventListener("click", ev => {
  const fl = ev.target.closest(".flink");
  if (fl) { const el = document.getElementById(fl.dataset.feat); if (el) { const box = el.closest(".cfin"); box.scrollTo({ top: el.offsetTop - box.offsetTop - 6, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash") } return }
  const b = ev.target.closest("button"); if (!b) return;
  const f = b.closest(".rform"), act = b.dataset.act;
  if (b.classList.contains("xdel")) { b.closest(".lrow>.lhead") ? b.closest(".lrow").remove() : b.closest(".forow,.prow,.xrow,.chrow,.grow,.schrow,.choicerow").remove(); return }
  const addTo = (box, html, sel) => { box.insertAdjacentHTML("beforeend", html); const el = box.lastElementChild.querySelector(sel); if (el) el.focus() };
  if (f && act === "fadd") { addTo(own(f, ".plist")[0], f.dataset.kind === "bg" ? bgFeatRow({ n: "", d: "" }) : featRow({ n: "", d: "" }), ".pn"); return }
  if (f && act === "foadd") { const box = b.closest(".foptbox").querySelector(".folist"); addTo(box, optRow({ n: "", d: "" }), ".fon"); return }
  if (f && act === "xadd") { addTo(own(f, ".xlist")[0], extraRow({ k: "", v: "" }), ".xk"); return }
  if (f && act === "cadd") { const rows = own(f, ".chrow:not(.chh)"), last = rows.length ? parseInt(rows[rows.length - 1].querySelector(".cl").value, 10) || rows.length : 0; addTo(own(f, ".chlist")[0], chartRowHTML({ lv: last + 1, pool: "", die: "" }), ".cp"); return }
  if (f && act === "cfill") { const box = own(f, ".chlist")[0], have = new Set(own(f, ".chrow:not(.chh)").map(r => parseInt(r.querySelector(".cl").value, 10))); for (let lv = 1; lv <= 20; lv++) if (!have.has(lv)) box.insertAdjacentHTML("beforeend", chartRowHTML({ lv, pool: "", die: "" })); [...box.querySelectorAll(".chrow:not(.chh)")].sort((x, y) => (parseInt(x.querySelector(".cl").value, 10) || 99) - (parseInt(y.querySelector(".cl").value, 10) || 99)).forEach(r => box.appendChild(r)); return }
  if (f && act === "chadd") { addTo(own(f, ".chlist2")[0], choiceRowHTML({ n: 1, cat: "skill", opts: [] }), ".chn"); return }
  if (f && act === "sadd") { addTo(own(f, ".schlist")[0], schoolRowHTML({ s: "", opp: "" }), ".ss"); return }
  if (f && act === "sfill") { const box = own(f, ".schlist")[0], have = new Set(own(f, ".schrow").map(r => lcs(r.querySelector(".ss").value.trim()))); SCHOOLS.filter(s => !have.has(lcs(s))).forEach(s => box.insertAdjacentHTML("beforeend", schoolRowHTML({ s, opp: "" }))); return }
  if (f && act === "ladd") { const box = own(f, ".llist")[0]; addTo(box, loadoutHTML({ n: `Loadout ${String.fromCharCode(65 + box.children.length)}`, gear: [] }), ".ln"); return }
  if (f && act === "gadd") { const box = b.closest(".lrow") ? b.closest(".lrow").querySelector(".glist") : own(f, ".glist").find(g => !g.closest(".lrow")); addTo(box, gearRowHTML({ n: "", qty: 1 }), ".gn"); return }
  if (act === "edit") { const id = +b.dataset.id; editing.add(id); render(); focusForm(id); return }
  if (act === "addsub") {
    const hit = findPart(+b.dataset.id); if (!hit) return;
    const s = { id: newId("sub"), n: "", desc: "", feats: [], extra: [], _id: ++uid, _new: true }; hit.top.subs.push(s); editing.add(s._id); render(); focusForm(s._id); return;
  }
  if (!f) return;
  const id = +f.dataset.id, hit = findPart(id); if (!hit) return;
  const p = hit.part, isTop = p === hit.top, err = m => { f.querySelector(".gerr").textContent = m };
  if (act === "cancel") { closeForm(id); render(); return }
  if (act === "del") {
    if (!p._new && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = isTop && p.subs && p.subs.length ? `Its ${p.subs.length} subclass${p.subs.length === 1 ? "" : "es"} go too. Click again to delete` : "Click again to delete"; return }
    const wasNew = p._new; closeForm(id);
    if (!wasNew) { if (isTop) list = list.filter(x => x !== p); else hit.top.subs = hit.top.subs.filter(s => s !== p) }
    render(); markDirty(); if (!wasNew) say(`Deleted ${p.n}. Click Save changes to keep it deleted.`); return;
  }
  if (act === "done") {
    const d = readForm(f), name = str(d.n).replace(/\s+/g, " ");
    if (!name) { err(`Give the ${isTop ? WHAT : "subclass"} a name.`); return }
    const sibs = isTop ? list : hit.top.subs;
    if (sibs.some(x => x !== p && !x._new && lcs(x.n) === lcs(name))) { err(`There's already one called ${name}.`); return }
    const lvs = d.chart.map(r => featLv(r.lv)).filter(Boolean);
    if (new Set(lvs).size !== lvs.length) { err("Two chart rows have the same level."); return }
    const kind = f.dataset.kind;
    const keep = kind === "sub" ? normClass({ subs: [{ ...p, ...d, n: name }] }).subs[0] : kind === "class" ? normClass({ ...p, ...d, n: name, subs: p.subs }) : kind === "feat" ? normFeat({ ...p, ...d, n: name }) : normBg({ ...p, ...d, n: name });
    if (kind === "class") keep.subs = p.subs;
    Object.keys(keep).forEach(k => { if (k !== "_id") p[k] = keep[k] });
    delete p._new; editing.delete(id); drafts.delete(id); render(); markDirty();
  }
});
$("clist").addEventListener("change", ev => {
  const s = ev.target.closest(".chk"); if (!s) return;
  const row = s.closest(".choicerow"); row.querySelector(".chopts").innerHTML = choiceOptsHTML(s.value, []);
});
$("gAdd").addEventListener("click", () => {
  const p = IS_CLS ? normClass({ n: "" }) : IS_FEAT ? normFeat({ n: "" }) : normBg({ n: "" }); p._new = true;
  list.push(p); editing.add(p._id); $("cq").value = ""; render(); focusForm(p._id);
});
$("cq").addEventListener("input", render);
$("saveBtn").addEventListener("click", async () => {
  if (editing.size) { $("saveMsg").textContent = "Click Done (or Cancel) on what you're editing first."; return }
  if (!ADMIN || !GH_KEY) { $("saveMsg").textContent = "Sign in as admin to save."; return }
  $("saveBtn").disabled = true; $("discardBtn").disabled = true; $("saveMsg").textContent = "Saving to the site…";
  try {
    const data = clean();
    await putFile(FILE, JSON.stringify(data, null, 1) + "\n", `Update ${WHATS} from the admin page`);
    original = JSON.stringify(data); dirty = false;
    $("saveMsg").textContent = IS_FEAT ? "Saved. Everyone sees the changes in about a minute." : "Saved. Everyone sees the changes, in the Character Creator too, in about a minute.";
    setTimeout(() => { if (!dirty) $("savebar").hidden = true }, 4000);
  } catch (x) { $("saveMsg").textContent = saveError(x && x.code, WHATS); $("saveBtn").disabled = false; $("discardBtn").disabled = false }
});
$("discardBtn").addEventListener("click", () => { load(JSON.parse(original)); editing.clear(); drafts.clear(); dirty = false; $("savebar").hidden = true; say(""); render() });
window.addEventListener("beforeunload", ev => { if (dirty || editing.size) { ev.preventDefault(); ev.returnValue = "" } });
function showHash() { const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) el.scrollIntoView({ block: "start" }) }
window.addEventListener("hashchange", showHash);
async function refreshFromGitHub() {
  try {
    const r = await gh(`/contents/${FILE}?ref=${REPO.branch || "main"}`, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (r.ok && !dirty && !editing.size && load(await r.json())) render();
  } catch (x) { }
}
AdminHooks.canSignOut = () => { if (dirty || editing.size) { say("Save or discard your changes before signing out."); return false } return true };
AdminHooks.signedIn = quiet => { render(); if (!quiet) say(`Signed in as admin. Click Add ${WHAT} or Edit on any ${WHAT}.`); refreshFromGitHub() };
AdminHooks.signedOut = () => { editing.clear(); drafts.clear(); list = list.filter(p => !p._new); list.forEach(p => { if (p.subs) p.subs = p.subs.filter(s => !s._new) }); render(); say("Signed out.") };

if (STATIC) {
  $("adminBtn").hidden = false; showAdminBtn();
  Promise.all([fetch(FILE, { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null), fetch("crawl-items.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null)])
    .then(([j, ij]) => { if (ij && Array.isArray(ij.items)) GEAR_ITEMS = ij.items; if (j && !dirty) load(j) })
    .finally(() => { render(); showHash(); restoreAdmin() });
}
if (IS_FEAT && $("lintro")) { const lv = featLevels(20); $("lintro").textContent = "The feats of Crawl 1st Edition: special talents that set a character apart. " + (lv.length ? `Every class gains a feat at ${ordinal(lv[0])} level and every ${featEvery()} levels after (${lv.slice(1, 4).map(ordinal).join(", ")} and so on).` : "") }
render(); showHash();
