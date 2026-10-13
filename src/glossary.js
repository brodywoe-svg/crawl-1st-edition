/* Glossary and Conditions pages: draw the entries from crawl-glossary.json, search them,
   and (signed in as admin on the website) edit, add and delete entries, then save to GitHub.
   Runs after the shared admin code from src/page.html, so ADMIN, GH_KEY, AdminHooks,
   putFile, gh, REPO, showAdminBtn and restoreAdmin are already defined. */
const PAGE = window.GL_PAGE || "glossary";
const FIRST = "Conditions";
let entries = [], uid = 0, original = "", dirty = false;
const editing = new Set(), drafts = new Map();

function load(j) {
  const a = normGlossary(j); if (!a) return false;
  entries = a.map(e => ({ ...e, _id: ++uid })); original = JSON.stringify(clean());
  return true;
}
const byName = (a, b) => a.n.toLowerCase().localeCompare(b.n.toLowerCase());
function clean() {
  return { v: 1, entries: entries.filter(e => !e._new).map(({ _id, _new, ...e }) => e).sort(byName) };
}
function sections() {
  return [...new Set(entries.filter(e => !e._new || editing.has(e._id)).map(e => e.sec))]
    .sort((a, b) => a === FIRST ? -1 : b === FIRST ? 1 : a.localeCompare(b));
}
function visible() {
  let list = entries.filter(e => !e._new || editing.has(e._id));
  if (PAGE === "conditions") list = list.filter(e => e.sec === FIRST || editing.has(e._id));
  const q = $("cq").value.trim().toLowerCase();
  if (q) list = list.filter(e => editing.has(e._id) ||
    plainText([e.n, e.lead, ...e.fx, ...e.notes.map(n => n.t), ...e.aka.map(x => x.w + " " + x.ref)].join(" ")).toLowerCase().includes(q));
  return list.sort((a, b) => (a._new ? -1 : 0) - (b._new ? -1 : 0) || byName(a, b));
}

const noteText = e => e.notes.map(n => `${n.l}: ${n.t}`).join("\n");
function bodyHTML(e) {
  const notes = e.notes.map(n => `<p class="cnote"><b>${esc(n.l)}:</b> ${richInline(n.t)}</p>`).join("");
  const words = e.aka.filter(x => x.ref);
  return (e.lead ? `<div class="clead">${paras(e.lead)}</div>` : "") +
    (e.fx.length ? `<ul class="cul">${e.fx.map(x => `<li>${richInline(x)}</li>`).join("")}</ul>` : "") + notes +
    (words.length ? `<div class="crefs">${words.map(x => `<div class="cref"><b>${esc(x.w)}</b>${paras(x.ref)}</div>`).join("")}</div>` : "") +
    (!e.lead && !e.fx.length && !notes && !words.length ? `<p class="clead">No description yet.</p>` : "");
}
function card(e, tag) {
  if (editing.has(e._id)) return form(e);
  return `<section class="cond" data-id="${e._id}"><h2 class="chead"><span>${esc(e.n)}</span><span class="chr">` +
    (tag ? `<span class="ctag">${esc(singular(e.sec))}</span>` : "") +
    (ADMIN ? `<button type="button" class="gedit" aria-label="Edit ${esc(e.n)}">Edit</button>` : "") +
    `</span></h2><div class="cbody">${bodyHTML(e)}</div></section>`;
}
const SWATCHES = [["Crawl red", "#8e171c"], ["Blue", "#1f5fbf"], ["Green", "#2e7d32"], ["Purple", "#6a1b9a"], ["Gold", "#b7791f"]];
function wordRow(x) {
  return `<div class="gword"><input type="text" class="gw" value="${esc(x.w)}" placeholder="Word, e.g. Target Area" aria-label="Underlined word" autocomplete="off">` +
    `<textarea class="gref" rows="2" placeholder="What the popup shows for this word. Leave empty to show the whole entry." aria-label="Popup text for this word">${esc(x.ref)}</textarea>` +
    `<button type="button" class="btn gwdel">Remove</button></div>`;
}
function form(e) {
  const d = drafts.get(e._id) || { n: e.n, sec: e.sec, lead: e.lead, fx: e.fx.join("\n"), notes: noteText(e), aka: e.aka };
  const id = k => `g${k}-${e._id}`;
  return `<section class="cond gediting" data-id="${e._id}"><div class="chead"><span>${e._new ? "New entry" : "Editing " + esc(e.n)}</span></div>
<div class="cbody gform">
<label for="${id("n")}">Name<input type="text" id="${id("n")}" data-k="n" value="${esc(d.n)}" autocomplete="off"></label>
<label for="${id("sec")}">Section <small>Entries in "Conditions" also show on the Conditions page.</small><input type="text" id="${id("sec")}" data-k="sec" list="gsecs" value="${esc(d.sec)}" autocomplete="off"></label>
<div class="gcolor" role="toolbar" aria-label="Text color"><span class="gcl">Text color</span>${SWATCHES.map(([n, c]) => `<button type="button" class="gsw" data-c="${c}" style="--c:${c}" title="${n}" aria-label="Color selected text ${n}"></button>`).join("")}<input type="color" class="gpick" value="#8e171c" aria-label="Pick any color" title="Pick any color"><button type="button" class="btn gapply">Color selected text</button><button type="button" class="btn gclear">Remove color</button><small class="ghelp">Select text in any box below, then pick a color.</small></div>
<label for="${id("lead")}">Description <small>Leave a blank line between paragraphs.</small><textarea id="${id("lead")}" data-k="lead" rows="6">${esc(d.lead)}</textarea></label>
<label for="${id("fx")}">Effects <small>One per line. Each line becomes a bullet point.</small><textarea id="${id("fx")}" data-k="fx" rows="4">${esc(d.fx)}</textarea></label>
<label for="${id("notes")}">Notes <small>One per line. Start a line with "Designer's note:" to label it as one.</small><textarea id="${id("notes")}" data-k="notes" rows="2">${esc(d.notes)}</textarea></label>
<div class="gwords"><span class="glab">Underlined words in spells <small>The name is always underlined and shows the whole entry. Add other words here, each with its own popup text if you like.</small></span><div class="gwlist">${d.aka.map(wordRow).join("")}</div><button type="button" class="btn gwadd">Add a word</button></div>
<div class="gprev"><span class="glab">Preview</span><div class="gprevbody"></div></div>
<p class="gerr" role="alert"></p>
<div class="gbtns"><button type="button" class="btn gdel">${e._new ? "Remove" : "Delete entry"}</button><span class="sp"></span><button type="button" class="btn gcancel">Cancel</button><button type="button" class="btn solid gdone">Done</button></div>
</div></section>`;
}
function readForm(f) {
  const d = {}; f.querySelectorAll("[data-k]").forEach(el => { d[el.dataset.k] = el.value });
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
  saveDrafts();
  const list = visible(), noun = PAGE === "conditions" ? ["condition", "conditions"] : ["entry", "entries"];
  const n = list.filter(e => !e._new).length;
  $("ccount").textContent = `${n} ${n === 1 ? noun[0] : noun[1]}`;
  let h;
  if (PAGE === "conditions") h = `<div class="clist">${list.map(e => card(e, false)).join("")}</div>`;
  else h = sections().map(sec => {
    const items = list.filter(e => e.sec === sec); if (!items.length) return "";
    return `<section class="gsec"><div class="ghead"><h2>${esc(sec)}</h2>${sec === FIRST ? `<a class="glink" href="conditions.html">Open the Conditions page</a>` : ""}</div><div class="clist">${items.map(e => card(e, true)).join("")}</div></section>`;
  }).join("");
  $("clist").innerHTML = h;
  document.querySelectorAll(".gediting").forEach(preview);
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
    render(); markDirty(); if (!wasNew) say(`Deleted ${e.n}. Click Save changes to keep it deleted.`);
  } else if (b.classList.contains("gdone")) {
    const f = b.closest(".gediting"), d = readForm(f), err = m => { f.querySelector(".gerr").textContent = m };
    const name = d.n.trim().replace(/\s+/g, " ");
    if (!name) { err("Give the entry a name."); return }
    if (entries.some(x => x !== e && !x._new && x.n.toLowerCase() === name.toLowerCase())) { err(`There's already an entry called ${name}.`); return }
    const p = fromDraft(d), seen = new Set();
    for (const x of p.aka) { const k = x.w.toLowerCase(); if (seen.has(k)) { err(`"${x.w}" is listed twice under Underlined words.`); return } seen.add(k) }
    e.n = name; e.sec = d.sec.trim().replace(/\s+/g, " ") || FIRST;
    e.lead = p.lead; e.fx = p.fx; e.notes = p.notes; e.aka = p.aka;
    delete e._new; editing.delete(e._id); drafts.delete(e._id);
    render(); markDirty();
    say(PAGE === "conditions" && e.sec !== FIRST ? `${e.n} is in the ${e.sec} section, so it now shows on the Glossary page instead.` : "");
  }
});
let lastBox = null;
$("clist").addEventListener("focusin", ev => { if (ev.target.matches(".gediting textarea, .gediting input[type=text]")) lastBox = ev.target });
$("clist").addEventListener("input", ev => { const f = ev.target.closest(".gediting"); if (f) preview(f) });
$("clist").addEventListener("change", ev => { if (ev.target.matches(".gpick")) { const f = ev.target.closest(".gediting"); if (lastBox && f.contains(lastBox) && lastBox.selectionStart !== lastBox.selectionEnd) colorSel(f, ev.target.value) } });
$("clist").addEventListener("mousedown", ev => { if (ev.target.closest(".gsw,.gapply,.gclear")) ev.preventDefault() });
function colorSel(f, c) {
  const t = lastBox && f.contains(lastBox) ? lastBox : null, err = m => { f.querySelector(".gerr").textContent = m };
  if (!t || t.selectionStart === t.selectionEnd) { err("Select some text in one of the boxes first, then pick a color."); return }
  err("");
  const a = t.selectionStart, b = t.selectionEnd, v = t.value;
  let mid = v.slice(a, b).replace(/\[\/?color[^\]]*\]/gi, "");
  if (c) mid = `[color=${c}]${mid}[/color]`;
  t.focus(); t.setSelectionRange(a, b);
  if (!document.execCommand || !document.execCommand("insertText", false, mid)) t.setRangeText(mid, a, b, "select");
  t.setSelectionRange(a, a + mid.length); preview(f);
}
$("clist").addEventListener("click", ev => {
  const f = ev.target.closest(".gediting"); if (!f) return;
  const sw = ev.target.closest(".gsw"); if (sw) { f.querySelector(".gpick").value = sw.dataset.c; colorSel(f, sw.dataset.c); return }
  if (ev.target.closest(".gapply")) { colorSel(f, f.querySelector(".gpick").value); return }
  if (ev.target.closest(".gclear")) { colorSel(f, ""); return }
  if (ev.target.closest(".gwadd")) { f.querySelector(".gwlist").insertAdjacentHTML("beforeend", wordRow({ w: "", ref: "" })); f.querySelector(".gword:last-child .gw").focus(); return }
  const del = ev.target.closest(".gwdel"); if (del) { del.closest(".gword").remove(); preview(f) }
}, true);
$("gAdd").addEventListener("click", () => {
  const e = { n: "", sec: PAGE === "conditions" ? FIRST : (sections()[0] || FIRST), lead: "", fx: [], notes: [], aka: [], _id: ++uid, _new: true };
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
    $("saveMsg").textContent = c === "bad_key" ? "GitHub no longer accepts your access key. It may have expired; set up admin access again." : c === "no_access" ? "Your access key can't change this repo anymore." : c === "conflict" ? "The glossary changed on GitHub while you were editing. Reload the page and make your changes again." : "Saving failed. Check your connection and try again.";
    $("saveBtn").disabled = false; $("discardBtn").disabled = false;
  }
});
$("discardBtn").addEventListener("click", () => {
  load(JSON.parse(original)); editing.clear(); drafts.clear(); dirty = false; $("savebar").hidden = true; say(""); render();
});
window.addEventListener("beforeunload", ev => { if (dirty || editing.size) { ev.preventDefault(); ev.returnValue = "" } });

async function refreshFromGitHub() {
  try {
    const r = await gh(`/contents/crawl-glossary.json?ref=${REPO.branch || "main"}`, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (r.ok && !dirty && !editing.size && load(await r.json())) render();
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
  fetch("crawl-glossary.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && !dirty) load(j) }).catch(() => { })
    .finally(() => { render(); restoreAdmin() });
}
render();
