/* Races page: crawl-races.json = {v:1, races:[race]}
     race    = {id, n, desc, asi, prof, langs, feats:[{n,d}], extra:[{k,v}], subs:[subrace]}
     subrace = {id, n, desc, asi, prof, langs, feats:[{n,d}], extra:[{k,v}]}
   asi: ability score increases; prof: starting proficiencies; langs: languages.
   Signed in as admin: Add race, Edit a race, Add subrace to a race, Edit a subrace.
   Runs after the shared admin code and src/editkit.js. */
let races = [], original = "", dirty = false, uid = 0;
const editing = new Set(), drafts = new Map();

const str = x => String(x ?? "").trim();
const arr = x => Array.isArray(x) ? x : [];
const lcs = x => String(x || "").toLowerCase();
const newId = p => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const feats = x => arr(x).map(f => ({ n: str(f && f.n), d: str(f && f.d) })).filter(f => f.n || f.d);
const extras = x => arr(x).map(r => ({ k: str(r && r.k), v: str(r && r.v) })).filter(r => r.k || r.v);
function normPart(p, pre) {
  return { id: str(p.id) || newId(pre), n: str(p.n), desc: str(p.desc), asi: str(p.asi), prof: str(p.prof), langs: str(p.langs), feats: feats(p.feats), extra: extras(p.extra), _id: ++uid };
}
function load(j) {
  if (!j || !Array.isArray(j.races)) return false;
  races = j.races.filter(r => r && str(r.n)).map(r => ({ ...normPart(r, "race"), subs: arr(r.subs).filter(s => s && str(s.n)).map(s => normPart(s, "sub")) }));
  original = JSON.stringify(clean()); return true;
}
const strip = ({ _id, _new, ...x }) => x;
const byName = (a, b) => lcs(a.n).localeCompare(lcs(b.n));
function clean() {
  return { v: 1, races: races.filter(r => !r._new).map(r => ({ ...strip(r), subs: r.subs.filter(s => !s._new).map(strip).sort(byName) })).sort(byName) };
}
const findPart = id => { for (const r of races) { if (r._id === id) return { part: r, race: r }; const s = r.subs.find(x => x._id === id); if (s) return { part: s, race: r } } return null };

/* ---------------------------------------------------------------- view */
const query = () => lcs($("cq").value.trim()).replace(/\s+/g, " ");
const textOf = p => plainText([p.n, p.desc, p.asi, p.prof, p.langs, ...p.feats.map(f => f.n + " " + f.d), ...p.extra.map(x => x.k + " " + x.v)].join(" ")).toLowerCase();
function bodyHTML(p) {
  const facts = [["Ability Score Increases", p.asi], ["Starting Proficiencies", p.prof], ["Languages", p.langs], ...p.extra.map(x => [x.k || "Detail", x.v])].filter(f => f[1]);
  return (p.desc ? `<div class="clead">${paras(p.desc)}</div>` : "") +
    (facts.length ? `<dl class="gfacts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${richInline(v)}</dd>`).join("")}</dl>` : "") +
    (p.feats.length ? `<div class="rfeats">${p.feats.map(f => featBlock(f.n, f.d)).join("")}</div>` : "");
}
function subHTML(s, r) {
  if (editing.has(s._id)) return partForm(s, "sub", r);
  return `<div class="subr" id="${esc(s.id)}"><div class="subh"><b>${esc(s.n)}</b>${ADMIN ? `<button type="button" class="gedit" data-act="edit" data-id="${s._id}">Edit</button>` : ""}</div>${bodyHTML(s) || `<p class="muted">No details yet.</p>`}</div>`;
}
function raceHTML(r, q) {
  if (editing.has(r._id)) return `<section class="cond" id="${esc(r.id)}"><div class="chead"><span>${r._new ? "New race" : "Editing " + esc(r.n)}</span></div><div class="cbody">${partForm(r, "race")}</div></section>`;
  const subs = q && !textOf(r).includes(q) ? r.subs.filter(s => editing.has(s._id) || textOf(s).includes(q)) : r.subs;
  return `<section class="cond" id="${esc(r.id)}"><h2 class="chead"><span>${esc(r.n)}</span><span class="chr">${ADMIN ? `<button type="button" class="gedit" data-act="edit" data-id="${r._id}">Edit</button>` : ""}</span></h2>
<div class="cbody">${bodyHTML(r) || `<p class="clead">No details yet.</p>`}
${subs.length || ADMIN ? `<div class="subs"><h3>Subraces</h3>${subs.map(s => subHTML(s, r)).join("") || `<p class="muted">No subraces yet.</p>`}${ADMIN ? `<button type="button" class="btn addsub" data-act="addsub" data-id="${r._id}">Add a subrace to ${esc(r.n)}</button>` : ""}</div>` : ""}</div></section>`;
}

/* ---------------------------------------------------------------- forms */
const featRow = f => `<div class="prow"><input type="text" class="pn" value="${esc(f.n)}" placeholder="Feature name, e.g. Darkvision" aria-label="Feature name" autocomplete="off"><textarea class="pd" rows="2" placeholder="Feature description" aria-label="Feature description">${esc(f.d)}</textarea><button type="button" class="btn xdel">Remove</button></div>`;
const extraRow = x => `<div class="xrow"><input type="text" class="xk" value="${esc(x.k)}" placeholder="Label, e.g. Speed" aria-label="Detail label" autocomplete="off"><input type="text" class="xv" value="${esc(x.v)}" placeholder="Value, e.g. 30 ft." aria-label="Detail value" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
function partForm(p, kind, parent) {
  const d = drafts.get(p._id) || p, id = k => `r${k}-${p._id}`, what = kind === "race" ? "race" : "subrace";
  const fld = (k, label, help, inner) => `<label for="${id(k)}">${label}${help ? ` <small>${help}</small>` : ""}${inner}</label>`;
  const inp = (k, ph) => `<input type="text" id="${id(k)}" data-k="${k}" value="${esc(d[k])}" placeholder="${esc(ph)}" autocomplete="off">`;
  return `<div class="gediting gform rform" data-id="${p._id}" data-kind="${kind}">
<div class="gbtns gtop">${kind === "sub" ? `<b>${p._new ? `New subrace of ${esc(parent.n)}` : "Editing " + esc(p.n)}</b>` : ""}<span class="sp"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn solid" data-act="done">Done</button></div>
${fld("n", kind === "race" ? "Race name" : "Subrace name", "", inp("n", kind === "race" ? "e.g. Dwarf" : "e.g. Hill Dwarf"))}
${fld("desc", "Description", "Leave a blank line between paragraphs.", `<textarea id="${id("desc")}" data-k="desc" rows="3">${esc(d.desc)}</textarea>`)}
${fld("asi", "Ability Score Increases", "", inp("asi", "e.g. +2 Constitution, +1 Wisdom"))}
${fld("prof", "Starting Proficiencies", "", inp("prof", "e.g. Smithing, Mining"))}
${fld("langs", "Languages", "", inp("langs", "e.g. Common, Dwarvish"))}
<div class="glab">Features <small>The feature's name shows in red, followed by its description.</small></div>
<div class="plist">${d.feats.map(featRow).join("")}</div>
<button type="button" class="btn" data-act="fadd">Add a feature</button>
<div class="glab">More details <small>Anything else, e.g. Size, Speed or Age, each with its own label.</small></div>
<div class="xlist">${d.extra.map(extraRow).join("")}</div>
<button type="button" class="btn" data-act="xadd">Add a detail</button>
<p class="gerr" role="alert"></p>
<div class="gbtns"><button type="button" class="btn gdel" data-act="del">${p._new ? "Remove" : "Delete " + what}</button><span class="sp"></span><button type="button" class="btn" data-act="cancel">Cancel</button><button type="button" class="btn solid" data-act="done">Done</button></div>
</div>`;
}
function readForm(f) {
  const d = {}; f.querySelectorAll(":scope [data-k]").forEach(el => { if (el.closest(".rform") === f) d[el.dataset.k] = el.value });
  d.feats = [...f.querySelectorAll(".prow")].map(r => ({ n: r.querySelector(".pn").value, d: r.querySelector(".pd").value }));
  d.extra = [...f.querySelectorAll(".xrow")].map(r => ({ k: r.querySelector(".xk").value, v: r.querySelector(".xv").value }));
  return d;
}
function saveDrafts() { document.querySelectorAll(".rform").forEach(f => drafts.set(+f.dataset.id, readForm(f))) }

/* ---------------------------------------------------------------- page */
function render() {
  saveDrafts();
  if (window.crawlNavRaces) window.crawlNavRaces({ races });
  const q = query();
  let list = races.filter(r => !r._new || editing.has(r._id));
  if (q) list = list.filter(r => editing.has(r._id) || textOf(r).includes(q) || r.subs.some(s => editing.has(s._id) || textOf(s).includes(q)));
  list.sort((a, b) => (a._new ? -1 : b._new ? 1 : 0) || byName(a, b));
  const n = list.filter(r => !r._new).length;
  $("ccount").textContent = `${n} ${n === 1 ? "race" : "races"}`;
  $("clist").innerHTML = list.length ? `<div class="rlist2">${list.map(r => raceHTML(r, q)).join("")}</div>` : "";
  sideShow(editing.size > 0);
  const total = races.filter(r => !r._new).length;
  $("cempty").hidden = list.length > 0;
  $("cempty").textContent = total ? "Nothing matches. Try a different word, or clear the search." : "No races yet." + (ADMIN ? " Click Add race to create the first one." : "");
  $("gAdd").hidden = !ADMIN;
}
const say = m => { $("gmsg").textContent = m };
function markDirty() {
  dirty = JSON.stringify(clean()) !== original;
  $("savebar").hidden = !dirty;
  if (dirty) { $("saveMsg").textContent = "You have unsaved race changes."; $("saveBtn").disabled = false; $("discardBtn").disabled = false }
}
function closeForm(id) {
  const hit = findPart(id); editing.delete(id); drafts.delete(id); if (!hit || !hit.part._new) return;
  if (hit.part === hit.race) races = races.filter(r => r !== hit.race); else hit.race.subs = hit.race.subs.filter(s => s !== hit.part);
}
function focusForm(id, sel = '[data-k="n"]') { const f = document.querySelector(`.rform[data-id="${id}"]`); if (f) { f.scrollIntoView({ block: "center" }); const el = f.querySelector(sel); if (el) el.focus() } }

$("clist").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  const f = b.closest(".rform"), act = b.dataset.act;
  if (b.classList.contains("xdel")) { b.closest(".prow,.xrow").remove(); return }
  if (f && act === "fadd") { f.querySelector(".plist").insertAdjacentHTML("beforeend", featRow({ n: "", d: "" })); f.querySelector(".prow:last-child .pn").focus(); return }
  if (f && act === "xadd") { f.querySelector(".xlist").insertAdjacentHTML("beforeend", extraRow({ k: "", v: "" })); f.querySelector(".xrow:last-child .xk").focus(); return }
  if (act === "edit") { const id = +b.dataset.id; editing.add(id); render(); focusForm(id); return }
  if (act === "addsub") {
    const hit = findPart(+b.dataset.id); if (!hit) return;
    const s = { ...normPart({ n: "" }, "sub"), _new: true }; hit.race.subs.push(s); editing.add(s._id); render(); focusForm(s._id); return;
  }
  if (!f) return;
  const id = +f.dataset.id, hit = findPart(id); if (!hit) return;
  const p = hit.part, isRace = p === hit.race, err = m => { f.querySelector(".gerr").textContent = m };
  if (act === "cancel") { closeForm(id); render(); return }
  if (act === "del") {
    if (!p._new && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = isRace && p.subs.length ? `Its ${p.subs.length} subrace${p.subs.length === 1 ? "" : "s"} go too. Click again to delete` : "Click again to delete"; return }
    const wasNew = p._new; closeForm(id);
    if (!wasNew) { if (isRace) races = races.filter(r => r !== p); else hit.race.subs = hit.race.subs.filter(s => s !== p) }
    render(); markDirty(); if (!wasNew) say(`Deleted ${p.n}. Click Save changes to keep it deleted.`); return;
  }
  if (act === "done") {
    const d = readForm(f), name = str(d.n).replace(/\s+/g, " ");
    if (!name) { err(`Give the ${isRace ? "race" : "subrace"} a name.`); return }
    const sibs = isRace ? races : hit.race.subs;
    if (sibs.some(x => x !== p && !x._new && lcs(x.n) === lcs(name))) { err(`There's already ${isRace ? "a race" : "a subrace"} called ${name}${isRace ? "" : " in " + hit.race.n}.`); return }
    Object.assign(p, { n: name, desc: str(d.desc), asi: str(d.asi), prof: str(d.prof), langs: str(d.langs), feats: feats(d.feats), extra: extras(d.extra) });
    delete p._new; editing.delete(id); drafts.delete(id); render(); markDirty();
  }
});
$("gAdd").addEventListener("click", () => {
  const r = { ...normPart({ n: "" }, "race"), subs: [], _new: true };
  races.push(r); editing.add(r._id); $("cq").value = ""; render(); focusForm(r._id);
});
$("cq").addEventListener("input", render);

$("saveBtn").addEventListener("click", async () => {
  if (editing.size) { $("saveMsg").textContent = "Click Done (or Cancel) on what you're editing first."; return }
  if (!ADMIN || !GH_KEY) { $("saveMsg").textContent = "Sign in as admin to save."; return }
  $("saveBtn").disabled = true; $("discardBtn").disabled = true; $("saveMsg").textContent = "Saving to the site…";
  try {
    const data = clean();
    await putFile("crawl-races.json", JSON.stringify(data, null, 1) + "\n", "Update races from the admin page");
    original = JSON.stringify(data); dirty = false;
    $("saveMsg").textContent = "Saved. Everyone sees the changes in about a minute.";
    setTimeout(() => { if (!dirty) $("savebar").hidden = true }, 4000);
  } catch (x) {
    $("saveMsg").textContent = saveError(x && x.code, "races");
    $("saveBtn").disabled = false; $("discardBtn").disabled = false;
  }
});
$("discardBtn").addEventListener("click", () => { load(JSON.parse(original)); editing.clear(); drafts.clear(); dirty = false; $("savebar").hidden = true; say(""); render() });
window.addEventListener("beforeunload", ev => { if (dirty || editing.size) { ev.preventDefault(); ev.returnValue = "" } });

function showHash() { const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) el.scrollIntoView({ block: "start" }) }
window.addEventListener("hashchange", showHash);
async function refreshFromGitHub() {
  try {
    const r = await gh(`/contents/crawl-races.json?ref=${REPO.branch || "main"}`, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (r.ok && !dirty && !editing.size && load(await r.json())) render();
  } catch (x) { }
}
AdminHooks.canSignOut = () => { if (dirty || editing.size) { say("Save or discard your changes before signing out."); return false } return true };
AdminHooks.signedIn = quiet => { render(); if (!quiet) say("Signed in as admin. Click Add race, Edit on any race, or Add a subrace."); refreshFromGitHub() };
AdminHooks.signedOut = () => { editing.clear(); drafts.clear(); races = races.filter(r => !r._new); races.forEach(r => { r.subs = r.subs.filter(s => !s._new) }); render(); say("Signed out.") };

load(RACES);
if (STATIC) {
  $("adminBtn").hidden = false; showAdminBtn();
  fetch("crawl-races.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && !dirty) load(j) }).catch(() => { })
    .finally(() => { render(); showHash(); restoreAdmin() });
}
render(); showHash();
