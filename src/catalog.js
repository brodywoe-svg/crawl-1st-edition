/* Items and Crafting pages. Both read and write crawl-items.json:
     {v:1, items:[item], recipes:[recipe]}
     item   = {id, n, type, rarity, cost, weight, desc, props:[lines], extra:[{k,v}]}
     recipe = {id, n, makes:[{item:id, qty}], ing:[{item:id, qty}], tools, check, time, cost, desc, extra:[{k,v}]}
   Recipes point at items by id, so renaming an item keeps its recipes linked.
   Runs after the shared admin code and src/editkit.js. */
const KIND = window.GL_PAGE === "crafting" ? "recipes" : "items";
const TYPES = ["Weapon", "Armor", "Shield", "Tool", "Material", "Potion", "Food", "Gear", "Treasure", "Magic Item"];
const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary"];
let items = [], recipes = [], original = "", dirty = false, uid = 0;
const editing = new Set(), drafts = new Map();

const str = x => String(x ?? "").trim();
const list = x => Array.isArray(x) ? x : [];
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const extras = x => list(x).map(r => ({ k: str(r && r.k), v: str(r && r.v) })).filter(r => r.k || r.v);
const qtys = x => list(x).map(r => ({ item: str(r && r.item), qty: Math.max(1, Math.round(+(r && r.qty) || 1)) })).filter(r => r.item);
function normCatalog(j) {
  if (!j || typeof j !== "object") return null;
  return {
    items: list(j.items).filter(i => i && str(i.n)).map(i => ({
      id: str(i.id) || newId("i"), n: str(i.n), type: str(i.type), rarity: str(i.rarity), cost: str(i.cost), weight: str(i.weight),
      desc: str(i.desc), props: list(i.props).map(str).filter(Boolean), extra: extras(i.extra)
    })),
    recipes: list(j.recipes).filter(r => r && (str(r.n) || list(r.makes).length)).map(r => ({
      id: str(r.id) || newId("r"), n: str(r.n), makes: qtys(r.makes), ing: qtys(r.ing), tools: str(r.tools), check: str(r.check),
      time: str(r.time), cost: str(r.cost), desc: str(r.desc), extra: extras(r.extra)
    }))
  };
}
function load(j) {
  const c = normCatalog(j); if (!c) return false;
  items = c.items.map(x => ({ ...x, _id: ++uid })); recipes = c.recipes.map(x => ({ ...x, _id: ++uid }));
  original = JSON.stringify(clean()); return true;
}
const strip = o => { const { _id, _new, _score, ...x } = o; return x };
const byName = (a, b) => a.n.toLowerCase().localeCompare(b.n.toLowerCase());
function clean() {
  return { v: 1, items: items.filter(x => !x._new).map(strip).sort(byName), recipes: recipes.filter(x => !x._new).map(strip).sort((a, b) => recipeName(a).toLowerCase().localeCompare(recipeName(b).toLowerCase())) };
}
const itemById = id => items.find(i => i.id === id);
const itemByName = n => items.find(i => !i._new && i.n.toLowerCase() === str(n).toLowerCase());
const itemName = id => (itemById(id) || { n: "(missing item)" }).n;
const recipeName = r => r.n || (r.makes[0] ? itemName(r.makes[0].item) : "Untitled recipe");
const rows = () => KIND === "items" ? items : recipes;

/* ---------------------------------------------------------------- search */
const query = () => $("cq").value.trim().toLowerCase().replace(/\s+/g, " ");
function score(x, q) {
  const name = (KIND === "items" ? x.n : recipeName(x)).toLowerCase(), wordStart = t => new RegExp("(^|\\W)" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t);
  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (wordStart(name)) return 75;
  if (name.includes(q)) return 65;
  const linked = KIND === "items" ? [x.type, x.rarity] : [...x.makes, ...x.ing].map(r => itemName(r.item));
  if (linked.some(t => t.toLowerCase() === q)) return 60;
  if (linked.some(t => t.toLowerCase().includes(q))) return 50;
  const text = plainText(KIND === "items" ? [x.cost, x.weight, x.desc, ...x.props, ...x.extra.map(r => r.k + " " + r.v)].join(" ")
    : [x.tools, x.check, x.time, x.cost, x.desc, ...x.extra.map(r => r.k + " " + r.v)].join(" ")).toLowerCase();
  if (!text.includes(q)) return 0;
  return wordStart(text) ? 20 : 10;
}
function visible() {
  let l = rows().filter(x => !x._new || editing.has(x._id));
  if (KIND === "items" && $("ctype").value) l = l.filter(x => x.type === $("ctype").value || editing.has(x._id));
  const q = query();
  const nm = x => KIND === "items" ? x.n : recipeName(x);
  if (q) { l.forEach(x => { x._score = score(x, q) }); return l.filter(x => x._score > 0 || editing.has(x._id)).sort((a, b) => b._score - a._score || nm(a).localeCompare(nm(b))) }
  return l.sort((a, b) => (b._new ? 1 : 0) - (a._new ? 1 : 0) || nm(a).toLowerCase().localeCompare(nm(b).toLowerCase()));
}

/* ---------------------------------------------------------------- cards */
const itemLink = (id, qty) => {
  const i = itemById(id), q = qty > 1 ? `${qty} × ` : "";
  if (!i && String(id).startsWith("?")) return `<span class="ilink gone">${q}${esc(id.slice(1))} <small>(new item)</small></span>`;
  const label = q + esc(i ? i.n : "(missing item)");
  return i ? `<a class="ilink" href="${KIND === "items" ? "" : "items.html"}#i-${esc(i.id)}">${label}</a>` : `<span class="ilink gone">${label}</span>`;
};
const recipeLink = r => `<a class="ilink" href="${KIND === "recipes" ? "" : "crafting.html"}#r-${esc(r.id)}">${esc(recipeName(r))}</a>`;
const factLine = (label, v) => v ? `<p class="fact"><b>${label}:</b> ${richInline(v)}</p>` : "";
function itemBody(i) {
  const made = recipes.filter(r => !r._new && r.makes.some(m => m.item === i.id));
  const used = recipes.filter(r => !r._new && r.ing.some(m => m.item === i.id));
  const facts = [["Rarity", i.rarity], ["Cost", i.cost], ["Weight", i.weight]].filter(f => f[1]);
  const h = (facts.length ? `<div class="facts">${facts.map(([k, v]) => `<span class="chip"><b>${k}</b> ${esc(v)}</span>`).join("")}</div>` : "") +
    (i.desc ? `<div class="clead">${paras(i.desc)}</div>` : "") +
    (i.props.length ? `<ul class="cul">${i.props.map(x => `<li>${richInline(x)}</li>`).join("")}</ul>` : "") +
    i.extra.map(r => factLine(esc(r.k || "Detail"), r.v)).join("") +
    (made.length ? `<p class="fact links"><b>Crafted by:</b> ${made.map(recipeLink).join(", ")}</p>` : "") +
    (used.length ? `<p class="fact links"><b>Ingredient in:</b> ${used.map(recipeLink).join(", ")}</p>` : "");
  return h || `<p class="clead">No details yet.</p>`;
}
function recipeBody(r) {
  return (r.makes.length ? `<p class="fact links"><b>Makes:</b> ${r.makes.map(m => itemLink(m.item, m.qty)).join(", ")}</p>` : "") +
    (r.ing.length ? `<div class="fact"><b>Ingredients:</b><ul class="cul ings">${r.ing.map(m => `<li>${itemLink(m.item, m.qty)}</li>`).join("")}</ul></div>` : `<p class="fact"><b>Ingredients:</b> none listed yet.</p>`) +
    factLine("Tools or station", r.tools) + factLine("Check", r.check) + factLine("Time", r.time) + factLine("Cost", r.cost) +
    (r.desc ? `<div class="clead">${paras(r.desc)}</div>` : "") +
    r.extra.map(x => factLine(esc(x.k || "Detail"), x.v)).join("");
}
function card(x) {
  if (editing.has(x._id)) return form(x);
  const anchor = (KIND === "items" ? "i-" : "r-") + x.id, name = KIND === "items" ? x.n : recipeName(x);
  const tag = KIND === "items" ? x.type : "Recipe";
  return `<section class="cond" id="${esc(anchor)}" data-id="${x._id}"><h2 class="chead"><span>${esc(name)}</span><span class="chr">` +
    (tag ? `<span class="ctag">${esc(tag)}</span>` : "") +
    (ADMIN ? `<button type="button" class="gedit" aria-label="Edit ${esc(name)}">Edit</button>` : "") +
    `</span></h2><div class="cbody">${KIND === "items" ? itemBody(x) : recipeBody(x)}</div></section>`;
}

/* ---------------------------------------------------------------- forms */
const extraRow = r => `<div class="xrow"><input type="text" class="xk" value="${esc(r.k)}" placeholder="Label, e.g. Damage" aria-label="Detail label" autocomplete="off"><input type="text" class="xv" value="${esc(r.v)}" placeholder="Value, e.g. 1d8 Slashing" aria-label="Detail value" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
const qtyRow = (r, cls) => `<div class="qrow ${cls}"><input type="number" class="qn" min="1" value="${r.qty || 1}" aria-label="Quantity"><input type="text" class="qi" list="itemNames" value="${esc(r.name ?? (r.item ? itemName(r.item) : ""))}" placeholder="Item name" aria-label="Item" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
function fld(id, label, help, inner) { return `<label for="${id}">${label}${help ? ` <small>${help}</small>` : ""}${inner}</label>` }
const inp = (id, k, v, extra = "") => `<input type="text" id="${id}" data-k="${k}" value="${esc(v)}" autocomplete="off"${extra}>`;
const area = (id, k, v, r) => `<textarea id="${id}" data-k="${k}" rows="${r}">${esc(v)}</textarea>`;
function form(x) {
  const id = k => `c${k}-${x._id}`, isItem = KIND === "items";
  const d = drafts.get(x._id) || (isItem
    ? { n: x.n, type: x.type, rarity: x.rarity, cost: x.cost, weight: x.weight, desc: x.desc, props: x.props.join("\n"), extra: x.extra }
    : { n: x.n, tools: x.tools, check: x.check, time: x.time, cost: x.cost, desc: x.desc, extra: x.extra, makes: x.makes.map(m => ({ qty: m.qty, name: itemName(m.item) })), ing: x.ing.map(m => ({ qty: m.qty, name: itemName(m.item) })) });
  const head = x._new ? (isItem ? "New item" : "New recipe") : "Editing " + esc(isItem ? x.n : recipeName(x));
  const body = isItem ? `
${fld(id("n"), "Name", "", inp(id("n"), "n", d.n))}
<div class="grid3">
${fld(id("type"), "Type", "", inp(id("type"), "type", d.type, ' list="itemTypes" placeholder="e.g. Weapon"'))}
${fld(id("rarity"), "Rarity", "", inp(id("rarity"), "rarity", d.rarity, ' list="itemRarities" placeholder="e.g. Common"'))}
${fld(id("cost"), "Cost", "", inp(id("cost"), "cost", d.cost, ' placeholder="e.g. 15 gp"'))}
${fld(id("weight"), "Weight", "", inp(id("weight"), "weight", d.weight, ' placeholder="e.g. 3 lb"'))}
</div>
${fld(id("desc"), "Description", "Leave a blank line between paragraphs.", area(id("desc"), "desc", d.desc, 4))}
${fld(id("props"), "Properties", "One per line. Each line becomes a bullet point.", area(id("props"), "props", d.props, 3))}`
    : `
${fld(id("n"), "Recipe name", "Leave empty to use the name of the first item it makes.", inp(id("n"), "n", d.n))}
<div class="glab">Makes <small>The item or items this recipe produces. Pick from the list, or type a new name to create that item.</small></div>
<div class="qlist qmakes">${(d.makes.length ? d.makes : [{ qty: 1, name: "" }]).map(r => qtyRow(r, "makes")).join("")}</div>
<button type="button" class="btn qadd" data-q="makes">Add another result</button>
<div class="glab">Ingredients <small>Each ingredient links to its item on the Items page.</small></div>
<div class="qlist qing">${d.ing.map(r => qtyRow(r, "ing")).join("")}</div>
<button type="button" class="btn qadd" data-q="ing">Add ingredient</button>
<div class="grid3">
${fld(id("tools"), "Tools or station", "", inp(id("tools"), "tools", d.tools, ' placeholder="e.g. Alchemist\'s kit"'))}
${fld(id("check"), "Check", "", inp(id("check"), "check", d.check, ' placeholder="e.g. DC 12 Crafting"'))}
${fld(id("time"), "Time", "", inp(id("time"), "time", d.time, ' placeholder="e.g. 1 hour"'))}
${fld(id("cost"), "Cost", "", inp(id("cost"), "cost", d.cost, ' placeholder="e.g. 10 gp"'))}
</div>
${fld(id("desc"), "Instructions or notes", "Leave a blank line between paragraphs.", area(id("desc"), "desc", d.desc, 3))}`;
  return `<section class="cond gediting" data-id="${x._id}"><div class="chead"><span>${head}</span></div>
<div class="cbody gform">${body}
<div class="glab">More details <small>Add any other details you want on the card, each with its own label.</small></div>
<div class="xlist">${d.extra.map(extraRow).join("")}</div>
<button type="button" class="btn xadd">Add a detail</button>
<div class="gprev"><span class="glab">Preview</span><div class="gprevbody"></div></div>
<p class="gerr" role="alert"></p>
<div class="gbtns"><button type="button" class="btn gdel">${x._new ? "Remove" : isItem ? "Delete item" : "Delete recipe"}</button><span class="sp"></span><button type="button" class="btn gcancel">Cancel</button><button type="button" class="btn solid gdone">Done</button></div>
</div></section>`;
}
function readForm(f) {
  const d = {}; f.querySelectorAll("[data-k]").forEach(el => { d[el.dataset.k] = el.value });
  d.extra = [...f.querySelectorAll(".xrow")].map(r => ({ k: r.querySelector(".xk").value, v: r.querySelector(".xv").value }));
  const q = c => [...f.querySelectorAll(".qrow." + c)].map(r => ({ qty: +r.querySelector(".qn").value || 1, name: r.querySelector(".qi").value }));
  if (KIND === "recipes") { d.makes = q("makes"); d.ing = q("ing") }
  return d;
}
function fromDraft(d, x) {
  const base = { ...x, n: str(d.n).replace(/\s+/g, " "), cost: str(d.cost), desc: str(d.desc), extra: extras(d.extra) };
  if (KIND === "items") return { ...base, type: str(d.type), rarity: str(d.rarity), weight: str(d.weight), props: d.props.split("\n").map(s => s.replace(/^\s*[-•*]\s*/, "").trim()).filter(Boolean) };
  const link = l => l.filter(r => str(r.name)).map(r => { const i = itemByName(r.name); return { item: i ? i.id : "?" + str(r.name), qty: Math.max(1, Math.round(r.qty)) } });
  return { ...base, tools: str(d.tools), check: str(d.check), time: str(d.time), makes: link(d.makes), ing: link(d.ing) };
}
function preview(f) {
  const x = rows().find(r => r._id === +f.dataset.id), b = f.querySelector(".gprevbody"); if (!x || !b) return;
  const p = fromDraft(readForm(f), x);
  b.innerHTML = KIND === "items" ? itemBody(p) : recipeBody(p);
}
function saveDrafts() { document.querySelectorAll(".gediting").forEach(f => drafts.set(+f.dataset.id, readForm(f))) }

/* ---------------------------------------------------------------- page */
function render() {
  saveDrafts();
  const l = visible(), n = l.filter(x => !x._new).length, noun = KIND === "items" ? ["item", "items"] : ["recipe", "recipes"];
  $("ccount").textContent = `${n} ${n === 1 ? noun[0] : noun[1]}`;
  $("clist").innerHTML = l.length ? (query() ? `<div class="ghead gres"><h2>Best matches first</h2></div>` : "") + `<div class="clist">${l.map(card).join("")}</div>` : "";
  document.querySelectorAll(".gediting").forEach(preview);
  sideShow(editing.size > 0);
  const total = rows().filter(x => !x._new).length;
  $("cempty").hidden = l.length > 0;
  $("cempty").textContent = total ? "Nothing matches. Try a different word, or clear the search." : (KIND === "items" ? "No items yet." : "No recipes yet.") + (ADMIN ? ` Click ${KIND === "items" ? "Add item" : "Add recipe"} to create the first one.` : "");
  $("itemNames").innerHTML = items.filter(i => !i._new).sort(byName).map(i => `<option value="${esc(i.n)}">`).join("");
  $("itemTypes").innerHTML = [...new Set([...TYPES, ...items.map(i => i.type).filter(Boolean)])].map(t => `<option value="${esc(t)}">`).join("");
  $("itemRarities").innerHTML = RARITIES.map(t => `<option value="${esc(t)}">`).join("");
  if (KIND === "items") {
    const sel = $("ctype"), cur = sel.value, types = [...new Set(items.filter(i => !i._new).map(i => i.type).filter(Boolean))].sort();
    sel.innerHTML = `<option value="">All types</option>` + types.map(t => `<option${t === cur ? " selected" : ""}>${esc(t)}</option>`).join("");
    sel.hidden = !types.length;
  }
  $("gAdd").hidden = !ADMIN;
}
const say = m => { $("gmsg").textContent = m };
function markDirty() {
  dirty = JSON.stringify(clean()) !== original;
  $("savebar").hidden = !dirty;
  if (dirty) { $("saveMsg").textContent = KIND === "items" ? "You have unsaved item changes." : "You have unsaved recipe changes."; $("saveBtn").disabled = false; $("discardBtn").disabled = false }
}
const rowOf = el => { const c = el.closest(".cond"); return c ? rows().find(x => x._id === +c.dataset.id) : null };
function closeForm(x) { editing.delete(x._id); drafts.delete(x._id); if (x._new) { if (KIND === "items") items = items.filter(y => y !== x); else recipes = recipes.filter(y => y !== x) } }

$("clist").addEventListener("input", ev => { const f = ev.target.closest(".gediting"); if (f) preview(f) });
$("clist").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  const f = b.closest(".gediting");
  if (f && b.classList.contains("xadd")) { f.querySelector(".xlist").insertAdjacentHTML("beforeend", extraRow({ k: "", v: "" })); f.querySelector(".xrow:last-child .xk").focus(); return }
  if (f && b.classList.contains("qadd")) { const c = b.dataset.q; f.querySelector(c === "makes" ? ".qmakes" : ".qing").insertAdjacentHTML("beforeend", qtyRow({ qty: 1, name: "" }, c)); f.querySelector(`.qrow.${c}:last-child .qi`).focus(); return }
  if (f && b.classList.contains("xdel")) { b.closest(".xrow,.qrow").remove(); preview(f); return }
  const x = rowOf(b); if (!x) return;
  if (b.classList.contains("gedit")) {
    editing.add(x._id); render();
    const el = document.querySelector(`.gediting[data-id="${x._id}"] [data-k="n"]`); if (el) el.focus();
  } else if (b.classList.contains("gcancel")) { closeForm(x); render() }
  else if (b.classList.contains("gdel")) {
    if (!x._new && !b.dataset.sure) {
      const uses = KIND === "items" ? recipes.filter(r => [...r.makes, ...r.ing].some(m => m.item === x.id)).length : 0;
      b.dataset.sure = "1"; b.textContent = uses ? `Used in ${uses} recipe${uses === 1 ? "" : "s"}. Click again to delete` : "Click again to delete"; return;
    }
    const wasNew = x._new, name = KIND === "items" ? x.n : recipeName(x); closeForm(x);
    if (!wasNew) {
      if (KIND === "items") { items = items.filter(y => y !== x); recipes.forEach(r => { r.makes = r.makes.filter(m => m.item !== x.id); r.ing = r.ing.filter(m => m.item !== x.id) }) }
      else recipes = recipes.filter(y => y !== x);
    }
    render(); markDirty(); if (!wasNew) say(`Deleted ${name}. Click Save changes to keep it deleted.`);
  } else if (b.classList.contains("gdone")) {
    const f2 = b.closest(".gediting"), d = readForm(f2), err = m => { f2.querySelector(".gerr").textContent = m };
    if (KIND === "items") {
      const name = str(d.n).replace(/\s+/g, " ");
      if (!name) { err("Give the item a name."); return }
      if (items.some(y => y !== x && !y._new && y.n.toLowerCase() === name.toLowerCase())) { err(`There's already an item called ${name}.`); return }
      Object.assign(x, fromDraft(d, x)); x.n = name;
    } else {
      const named = l => l.filter(r => str(r.name));
      if (!named(d.makes).length) { err("Pick the item this recipe makes."); return }
      const created = [];
      for (const r of [...named(d.makes), ...named(d.ing)]) if (!itemByName(r.name) && !created.some(c => c.n.toLowerCase() === str(r.name).toLowerCase())) {
        const it = { id: newId("i"), n: str(r.name).replace(/\s+/g, " "), type: "", rarity: "", cost: "", weight: "", desc: "", props: [], extra: [], _id: ++uid };
        created.push(it);
      }
      items.push(...created);
      Object.assign(x, fromDraft(d, x));
      if (created.length) say(`Also created ${created.length === 1 ? "a new item" : "new items"}: ${created.map(c => c.n).join(", ")}. Fill in ${created.length === 1 ? "its" : "their"} details on the Items page.`);
      else say("");
    }
    delete x._new; editing.delete(x._id); drafts.delete(x._id);
    render(); markDirty();
  }
});
$("gAdd").addEventListener("click", () => {
  const x = KIND === "items"
    ? { id: newId("i"), n: "", type: $("ctype").value || "", rarity: "", cost: "", weight: "", desc: "", props: [], extra: [], _id: ++uid, _new: true }
    : { id: newId("r"), n: "", makes: [], ing: [], tools: "", check: "", time: "", cost: "", desc: "", extra: [], _id: ++uid, _new: true };
  rows().push(x); editing.add(x._id); $("cq").value = ""; render();
  const f = document.querySelector(`.gediting[data-id="${x._id}"]`);
  if (f) { f.scrollIntoView({ block: "center" }); (f.querySelector(KIND === "items" ? '[data-k="n"]' : ".qi") || f.querySelector("input")).focus() }
});
$("cq").addEventListener("input", render);
if ($("ctype")) $("ctype").addEventListener("change", render);

$("saveBtn").addEventListener("click", async () => {
  if (editing.size) { $("saveMsg").textContent = "Click Done (or Cancel) on what you're editing first."; return }
  if (!ADMIN || !GH_KEY) { $("saveMsg").textContent = "Sign in as admin to save."; return }
  $("saveBtn").disabled = true; $("discardBtn").disabled = true; $("saveMsg").textContent = "Saving to the site…";
  try {
    const data = clean();
    await putFile("crawl-items.json", JSON.stringify(data, null, 1) + "\n", KIND === "items" ? "Update items from the admin page" : "Update crafting recipes from the admin page");
    original = JSON.stringify(data); dirty = false;
    $("saveMsg").textContent = "Saved. Everyone sees the changes in about a minute.";
    setTimeout(() => { if (!dirty) $("savebar").hidden = true }, 4000);
  } catch (x) {
    $("saveMsg").textContent = saveError(x && x.code, "items and recipes");
    $("saveBtn").disabled = false; $("discardBtn").disabled = false;
  }
});
$("discardBtn").addEventListener("click", () => { load(JSON.parse(original)); editing.clear(); drafts.clear(); dirty = false; $("savebar").hidden = true; say(""); render() });
window.addEventListener("beforeunload", ev => { if (dirty || editing.size) { ev.preventDefault(); ev.returnValue = "" } });

/* open the card named in the address (#i-… or #r-…) */
function showHash() {
  const id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
  let el = document.getElementById(id);
  if (!el && (query() || ($("ctype") && $("ctype").value))) { $("cq").value = ""; if ($("ctype")) $("ctype").value = ""; render(); el = document.getElementById(id) }
  if (!el) return;
  el.scrollIntoView({ block: "start" }); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
}
window.addEventListener("hashchange", showHash);

async function refreshFromGitHub() {
  try {
    const r = await gh(`/contents/crawl-items.json?ref=${REPO.branch || "main"}`, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (r.ok && !dirty && !editing.size && load(await r.json())) render();
  } catch (x) { }
}
AdminHooks.canSignOut = () => { if (dirty || editing.size) { say("Save or discard your changes before signing out."); return false } return true };
AdminHooks.signedIn = quiet => { render(); if (!quiet) say(KIND === "items" ? "Signed in as admin. Click Edit on any item, or Add item." : "Signed in as admin. Click Edit on any recipe, or Add recipe."); refreshFromGitHub() };
AdminHooks.signedOut = () => { editing.clear(); drafts.clear(); items = items.filter(x => !x._new); recipes = recipes.filter(x => !x._new); render(); say("Signed out.") };

load(CATALOG);
if (STATIC) {
  $("adminBtn").hidden = false; showAdminBtn();
  fetch("crawl-items.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && !dirty) load(j) }).catch(() => { })
    .finally(() => { render(); restoreAdmin(); showHash() });
}
render(); showHash();
