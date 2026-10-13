/* Glossary and Conditions pages: draw the entries from crawl-glossary.json, search them,
   and (signed in as admin on the website) edit, add and delete entries, then save to GitHub.
   Runs after the shared admin code from src/page.html, so ADMIN, GH_KEY, AdminHooks,
   putFile, gh, REPO, showAdminBtn and restoreAdmin are already defined. */
const PAGE = window.GL_PAGE || "glossary";
const FIRST = "Conditions";
let entries = [], uid = 0, original = "", dirty = false;
const editing = new Set(), drafts = new Map();
/* glossary.html?s=combat-rules shows one section on its own page, like the Conditions page */
const SLUG = PAGE === "glossary" ? new URLSearchParams(location.search).get("s") : null;
function only() {
  if (PAGE === "conditions") return FIRST;
  if (!SLUG) return null;
  return [...new Set(entries.map(e => e.sec))].find(x => slugOf(x) === SLUG) || null;
}
const secHref = sec => sec === FIRST ? "conditions.html" : "glossary.html?s=" + encodeURIComponent(slugOf(sec));
let shownOnly;
function pageHeading() {
  const o = only(); if (PAGE !== "glossary" || o === shownOnly) return; shownOnly = o;
  const h = document.querySelector(".intro h1"), p = document.querySelector(".intro p");
  if (o) {
    h.textContent = o; document.title = "Crawl " + o;
    p.innerHTML = `Every entry in the ${esc(o)} section of the glossary. <a href="glossary.html">See the whole Glossary</a>.`;
    $("cq").placeholder = `Search ${o}`; $("cq").setAttribute("aria-label", `Search ${o}`);
  } else if (SLUG) {
    p.innerHTML = `There's no glossary section with that name any more, so here's the whole Glossary.`;
  }
}
function navUpdate() { if (window.crawlNavSections) window.crawlNavSections(sections()) }

function load(j) {
  const a = normGlossary(j); if (!a) return false;
  entries = a.map(e => ({ ...e, _id: ++uid })); original = JSON.stringify(clean());
  return true;
}
const byName = (a, b) => a.n.toLowerCase().localeCompare(b.n.toLowerCase());
function clean() {
  return { v: 1, entries: entries.filter(e => !e._new).map(({ _id, _new, _score, ...e }) => e).sort(byName) };
}
function sections() {
  return [...new Set(entries.filter(e => !e._new || editing.has(e._id)).map(e => e.sec))]
    .sort((a, b) => a === FIRST ? -1 : b === FIRST ? 1 : a.localeCompare(b));
}
function visible() {
  let list = entries.filter(e => !e._new || editing.has(e._id));
  const o = only(); if (o) list = list.filter(e => e.sec === o || editing.has(e._id));
  const q = query();
  if (q) {
    list.forEach(e => { e._score = score(e, q) });
    return list.filter(e => e._score > 0 || editing.has(e._id)).sort((a, b) => b._score - a._score || byName(a, b));
  }
  return list.sort((a, b) => (a._new ? -1 : 0) - (b._new ? -1 : 0) || byName(a, b));
}

const query = () => $("cq").value.trim().toLowerCase().replace(/\s+/g, " ");
/* best matches first: the name, then a tooltip word, then anything in the text */
function score(e, q) {
  const n = e.n.toLowerCase(), words = e.aka.map(x => x.w.toLowerCase()), wordStart = t => new RegExp("(^|\\W)" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t);
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (words.includes(q)) return 85;
  if (words.some(w => w.startsWith(q))) return 80;
  if (wordStart(n)) return 70;
  if (n.includes(q)) return 65;
  if (words.some(w => w.includes(q))) return 60;
  const text = plainText([e.lead, ...e.fx, ...e.notes.map(x => x.t), ...e.aka.map(x => x.ref)].join(" ")).toLowerCase();
  if (!text.includes(q)) return 0;
  return wordStart(text) ? 20 : 10;
}
const noteText = e => e.notes.map(n => `${n.l}: ${n.t}`).join("\n");
/* items and recipes (crawl-items.json), so Properties and Modifiers can list where they're used */
let CAT = (typeof CATALOG !== "undefined" && CATALOG) || { items: [], recipes: [] };
const lcs = x => String(x || "").toLowerCase();
const baseName = n => n.replace(/\s*\((?:DC )?X\)$/i, "").replace(/\s+X$/, "").trim();
const ARMOR_TYPES = ["clothing", "light", "medium", "heavy"];
function propItems(e) {
  const b = lcs(baseName(e.n));
  return (CAT.items || []).filter(i => String(i.props || "").split(",").map(x => lcs(x.trim())).some(x =>
    (x === b || x.startsWith(b + " ") || x.startsWith(b + " (")) && !(i.cat === "Armor" && ARMOR_TYPES.includes(x)))).sort((x, y) => x.n.localeCompare(y.n));
}
function modRecipes(e) {
  const b = lcs(baseName(e.n));
  return (CAT.recipes || []).filter(r => r.kind && (lcs(r.grants).includes(b) || lcs(r.n).startsWith(b)));
}
const itemNameById = id => ((CAT.items || []).find(i => i.id === id) || { n: "(missing item)" }).n;
const isFact = x => /^[A-Z][\w'’]*(?: [\w'’]+){0,2}:\s/.test(x);
function factsHTML(rows) { return rows.length ? `<dl class="gfacts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join("")}</dl>` : "" }
function bodyHTML(e) {
  const notes = e.notes.map(n => `<p class="cnote"><b>${esc(n.l)}:</b> ${richInline(n.t)}</p>`).join("");
  const words = e.aka.filter(x => x.ref);
  const bullets = e.fx.filter(x => !isFact(x)), facts = e.fx.filter(isFact).map(x => { const i = x.indexOf(":"); return [x.slice(0, i), richInline(x.slice(i + 1).trim())] });
  if (e.sec === "Properties") {
    const used = propItems(e);
    if (used.length) facts.push(["Found on", used.map(i => `<a class="ilink" href="items.html#${esc(i.id)}">${esc(i.n)}</a>`).join(", ")]);
  }
  let mod = "";
  if (e.sec === "Modifiers") mod = modRecipes(e).map(r => `<div class="gmod">` + factsHTML([
    ["Type", esc(r.kind)], ["Applies to", richInline(r.applies || "—")], ["Grants", richInline(r.grants || "—")],
    ["Recipe", `<a class="ilink" href="crafting.html#${esc(r.id)}">${esc(r.n)}</a> <span class="muted">${esc(r.tier)} ${esc(r.prof)}</span>`],
    ["Prerequisites", richInline(r.pre || "—")],
    ["Materials", (r.ing || []).map(m => `<a class="ilink" href="items.html#${esc(m.item)}">${m.qty > 1 ? m.qty + " × " : ""}${esc(itemNameById(m.item))}</a>`).join(", ") || "—"],
    ["Crafting", [r.dc && r.dc !== "—" ? "DC " + r.dc : "", r.tc && r.tc !== "—" ? "TC " + r.tc : "", r.time, r.ws].filter(Boolean).map(esc).join(" · ")]
  ]) + `</div>`).join("");
  return (e.lead ? `<div class="clead">${paras(e.lead)}</div>` : "") +
    (bullets.length ? `<ul class="cul">${bullets.map(x => `<li>${richInline(x)}</li>`).join("")}</ul>` : "") + factsHTML(facts) + mod + notes +
    (words.length ? `<div class="crefs">${words.map(x => `<div class="cref"><b>${esc(x.w)}</b>${paras(x.ref)}</div>`).join("")}</div>` : "") +
    (!e.lead && !e.fx.length && !notes && !words.length && !mod ? `<p class="clead">No description yet.</p>` : "");
}
function card(e, tag) {
  if (editing.has(e._id)) return form(e);
  return `<section class="cond" data-id="${e._id}"><h2 class="chead"><span>${esc(e.n)}</span><span class="chr">` +
    (tag ? `<span class="ctag">${esc(singular(e.sec))}</span>` : "") +
    (ADMIN ? `<button type="button" class="gedit" aria-label="Edit ${esc(e.n)}">Edit</button>` : "") +
    `</span></h2><div class="cbody">${bodyHTML(e)}</div></section>`;
}
function wordRow(x) {
  return `<div class="gword"><input type="text" class="gw" value="${esc(x.w)}" placeholder="Tooltip word, e.g. Target Area" aria-label="Tooltip word" autocomplete="off">` +
    `<textarea class="gref" rows="2" placeholder="What the tooltip shows for this word. Leave empty to show the whole entry." aria-label="Tooltip text for this word">${esc(x.ref)}</textarea>` +
    `<button type="button" class="btn gwdel">Remove</button></div>`;
}
function form(e) {
  const d = drafts.get(e._id) || { n: e.n, sec: e.sec, lead: e.lead, fx: e.fx.join("\n"), notes: noteText(e), aka: e.aka, tip: e.tip };
  const id = k => `g${k}-${e._id}`;
  return `<section class="cond gediting" data-id="${e._id}"><div class="chead"><span>${e._new ? "New entry" : "Editing " + esc(e.n)}</span></div>
<div class="cbody gform">
<label for="${id("n")}">Name<input type="text" id="${id("n")}" data-k="n" value="${esc(d.n)}" autocomplete="off"></label>
<label class="chk"><input type="checkbox" data-k="tip"${d.tip !== false ? " checked" : ""}> Show as a tooltip in spells</label>
<label for="${id("sec")}">Section <small>Each section gets its own page and a link in the Glossary menu. Type a new name to start a new section.</small><input type="text" id="${id("sec")}" data-k="sec" list="gsecs" value="${esc(d.sec)}" autocomplete="off"></label>
<label for="${id("lead")}">Description <small>Leave a blank line between paragraphs.</small><textarea id="${id("lead")}" data-k="lead" rows="6">${esc(d.lead)}</textarea></label>
<label for="${id("fx")}">Effects <small>One per line. Each line becomes a bullet point.</small><textarea id="${id("fx")}" data-k="fx" rows="4">${esc(d.fx)}</textarea></label>
<label for="${id("notes")}">Notes <small>One per line. Start a line with "Designer's note:" to label it as one.</small><textarea id="${id("notes")}" data-k="notes" rows="2">${esc(d.notes)}</textarea></label>
<div class="gwords"><span class="glab">Tooltip words <small>The entry's name is always a tooltip word and shows the whole entry. Create more here, each with its own tooltip text if you like.</small></span><div class="gwlist">${d.aka.map(wordRow).join("")}</div><button type="button" class="btn gwadd">Create tooltip word</button></div>
<div class="gprev"><span class="glab">Preview</span><div class="gprevbody"></div></div>
<p class="gerr" role="alert"></p>
<div class="gbtns"><button type="button" class="btn gdel">${e._new ? "Remove" : "Delete entry"}</button><span class="sp"></span><button type="button" class="btn gcancel">Cancel</button><button type="button" class="btn solid gdone">Done</button></div>
</div></section>`;
}
function readForm(f) {
  const d = {}; f.querySelectorAll("[data-k]").forEach(el => { d[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value });
  d.aka = [...f.querySelectorAll(".gword")].map(r => ({ w: r.querySelector(".gw").value, ref: r.querySelector(".gref").value }));
  return d;
}
function parseNotes(t) {
  return t.split("\n").map(x => x.trim()).filter(Boolean).map(x => {
    const m = x.match(/^(designer'?s note|design note|note)\s*:\s*(.*)$/i);
    return m ? { l: /design/i.test(m[1]) ? "Designer's note" : "Note", t: m[2].trim() } : { l: "Note", t: x };
  }).filter(n => n.t);
}
function fromDraft(d) {
  return {
    lead: d.lead.trim(), fx: d.fx.split("\n").map(x => x.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean),
    notes: parseNotes(d.notes), aka: d.aka.map(x => ({ w: x.w.trim().replace(/\s+/g, " "), ref: x.ref.trim() })).filter(x => x.w)
  };
}
function preview(f) { const b = f.querySelector(".gprevbody"); if (b) b.innerHTML = bodyHTML(fromDraft(readForm(f))) }
function saveDrafts() { document.querySelectorAll(".gediting").forEach(f => drafts.set(+f.dataset.id, readForm(f))) }

function render() {
  saveDrafts(); pageHeading();
  const o = only(), list = visible(), noun = PAGE === "conditions" ? ["condition", "conditions"] : ["entry", "entries"];
  const n = list.filter(e => !e._new).length;
  $("ccount").textContent = `${n} ${n === 1 ? noun[0] : noun[1]}`;
  let h;
  if (query()) h = list.length ? `<div class="ghead gres"><h2>Best matches first</h2></div><div class="clist">${list.map(e => card(e, !o)).join("")}</div>` : "";
  else if (o) h = `<div class="clist">${list.map(e => card(e, false)).join("")}</div>`;
  else h = sections().map(sec => {
    const items = list.filter(e => e.sec === sec); if (!items.length) return "";
    return `<section class="gsec"><div class="ghead"><h2>${esc(sec)}</h2><a class="glink" href="${secHref(sec)}">Open the ${esc(sec)} page</a></div><div class="clist">${items.map(e => card(e, true)).join("")}</div></section>`;
  }).join("");
  $("clist").innerHTML = h;
  document.querySelectorAll(".gediting").forEach(preview);
  sideShow(editing.size > 0);
  $("cempty").hidden = list.length > 0;
  $("gsecs").innerHTML = sections().map(s => `<option value="${esc(s)}">`).join("");
  $("gAdd").hidden = !ADMIN;
}

const say = m => { $("gmsg").textContent = m };
function markDirty() {
  dirty = JSON.stringify(clean()) !== original;
  $("savebar").hidden = !dirty;
  if (dirty) { $("saveMsg").textContent = "You have unsaved glossary changes."; $("saveBtn").disabled = false; $("discardBtn").disabled = false }
}
const entryOf = el => { const c = el.closest(".cond"); return c ? entries.find(e => e._id === +c.dataset.id) : null };
function closeForm(e) { editing.delete(e._id); drafts.delete(e._id); if (e._new) entries = entries.filter(x => x !== e) }

$("clist").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  const e = entryOf(b); if (!e) return;
  if (b.classList.contains("gedit")) {
    editing.add(e._id); render();
    const f = document.querySelector(`.gediting[data-id="${e._id}"] [data-k="n"]`); if (f) f.focus();
  } else if (b.classList.contains("gcancel")) {
    closeForm(e); render();
  } else if (b.classList.contains("gdel")) {
    if (!e._new && !b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Click again to delete"; return }
    const wasNew = e._new; closeForm(e); if (!wasNew) entries = entries.filter(x => x !== e);
    render(); markDirty(); navUpdate(); if (!wasNew) say(`Deleted ${e.n}. Click Save changes to keep it deleted.`);
  } else if (b.classList.contains("gdone")) {
    const f = b.closest(".gediting"), d = readForm(f), err = m => { f.querySelector(".gerr").textContent = m };
    const name = d.n.trim().replace(/\s+/g, " ");
    if (!name) { err("Give the entry a name."); return }
    if (entries.some(x => x !== e && !x._new && x.n.toLowerCase() === name.toLowerCase())) { err(`There's already an entry called ${name}.`); return }
    const p = fromDraft(d), seen = new Set();
    for (const x of p.aka) { const k = x.w.toLowerCase(); if (seen.has(k)) { err(`"${x.w}" is listed twice under Tooltip words.`); return } seen.add(k) }
    e.n = name; e.sec = d.sec.trim().replace(/\s+/g, " ") || FIRST;
    e.lead = p.lead; e.fx = p.fx; e.notes = p.notes; e.aka = p.aka; e.tip = d.tip !== false;
    delete e._new; editing.delete(e._id); drafts.delete(e._id);
    render(); markDirty();
    const was = only(); navUpdate();
    say(was && e.sec !== was ? `${e.n} is now in the ${e.sec} section, so it shows on that section's page instead.` : "");
  }
});
$("clist").addEventListener("input", ev => { const f = ev.target.closest(".gediting"); if (f) preview(f) });
$("clist").addEventListener("click", ev => {
  const f = ev.target.closest(".gediting"); if (!f) return;
  if (ev.target.closest(".gwadd")) { f.querySelector(".gwlist").insertAdjacentHTML("beforeend", wordRow({ w: "", ref: "" })); f.querySelector(".gword:last-child .gw").focus(); return }
  const del = ev.target.closest(".gwdel"); if (del) { del.closest(".gword").remove(); preview(f) }
}, true);
$("gAdd").addEventListener("click", () => {
  const e = { n: "", sec: only() || (SLUG ? "" : sections()[0]) || FIRST, lead: "", fx: [], notes: [], aka: [], tip: true, _id: ++uid, _new: true };
  entries.push(e); editing.add(e._id); $("cq").value = ""; render();
  const f = document.querySelector(`.gediting[data-id="${e._id}"]`);
  if (f) { f.scrollIntoView({ block: "center" }); f.querySelector('[data-k="n"]').focus() }
});
$("cq").addEventListener("input", render);

$("saveBtn").addEventListener("click", async () => {
  if (editing.size) { $("saveMsg").textContent = "Click Done (or Cancel) on the entries you're editing first."; return }
  if (!ADMIN || !GH_KEY) { $("saveMsg").textContent = "Sign in as admin to save."; return }
  $("saveBtn").disabled = true; $("discardBtn").disabled = true; $("saveMsg").textContent = "Saving to the site…";
  try {
    const data = clean();
    await putFile("crawl-glossary.json", JSON.stringify(data, null, 1) + "\n", "Update glossary from the admin page");
    original = JSON.stringify(data); dirty = false;
    $("saveMsg").textContent = "Saved. Everyone sees the changes in about a minute.";
    setTimeout(() => { if (!dirty) $("savebar").hidden = true }, 4000);
  } catch (x) {
    const c = x && x.code;
    $("saveMsg").textContent = saveError(c, "glossary");
    $("saveBtn").disabled = false; $("discardBtn").disabled = false;
  }
});
$("discardBtn").addEventListener("click", () => {
  load(JSON.parse(original)); editing.clear(); drafts.clear(); dirty = false; $("savebar").hidden = true; say(""); render(); navUpdate();
});
window.addEventListener("beforeunload", ev => { if (dirty || editing.size) { ev.preventDefault(); ev.returnValue = "" } });

async function refreshFromGitHub() {
  try {
    const r = await gh(`/contents/crawl-glossary.json?ref=${REPO.branch || "main"}`, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (r.ok && !dirty && !editing.size && load(await r.json())) { render(); navUpdate() }
  } catch (x) { }
}
AdminHooks.canSignOut = () => {
  if (dirty || editing.size) { say("Save or discard your glossary changes before signing out."); return false }
  return true;
};
AdminHooks.signedIn = quiet => { render(); if (!quiet) say("Signed in as admin. Click Edit on any entry, or Add entry."); refreshFromGitHub() };
AdminHooks.signedOut = () => { editing.clear(); drafts.clear(); entries = entries.filter(e => !e._new); render(); say("Signed out.") };

load(GLOSSARY);
if (STATIC) {
  $("adminBtn").hidden = false; showAdminBtn();
  fetch("crawl-items.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(j => { if (j && Array.isArray(j.items)) { CAT = j; render() } }).catch(() => { });
  fetch("crawl-glossary.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && !dirty) load(j) }).catch(() => { })
    .finally(() => { render(); navUpdate(); restoreAdmin() });
}
render();
