/* Items and Crafting pages. Both read and write crawl-items.json:
     {v:2, items:[item], recipes:[recipe]}
     item   = {id, n, nc, cat, sub, slot, badge, rarity, magic, value, weight, actions, props, pdefs:[{n,d}], desc, extra:[{k,v}]}
              nc: name color (#hex or ""); magic: true if the item is magical
              actions: weapon actions; props: the properties line; pdefs: Properties Defined (name shown in red, then what it does)
              badge: the flask badge, meaning it still needs playtesting
              cat: Weapon | Ammunition | Armor | Consumable | Crafting Material | Magic Item
              sub: weapon type, armor type, or a group name; slot: armor slot
     recipe = {id, n, tier, badge, kind, prof, pre, ing:[{item,qty}], matNote, applies, ws, time, dc, tc,
               qty:{l,v}, makes:[{item,qty}], props, grants, feat, quote, extra:[{k,v}]}
   Recipes point at items by id, so renaming an item keeps its recipes linked.
   Runs after the shared admin code and src/editkit.js. */
const KIND = window.GL_PAGE === "crafting" ? "recipes" : "items";
const CATS = [
  ["Weapon", "Weapons", ["Axes", "Blades", "Bows", "Crossbows", "Cudgels", "Firearms", "Polearms", "Swords", "Special", "Miscellaneous"]],
  ["Ammunition", "Ammunition", ["Arrows", "Bolts", "Shot", "Other"]],
  ["Armor", "Armor", ["Clothing", "Light", "Medium", "Heavy", "Accessories"]],
  ["Consumable", "Consumables", ["Food", "Potions", "Alchemical", "Scrolls and Documents", "Tools"]],
  ["Crafting Material", "Crafting Materials", ["Blacksmithing", "Woodworking", "Cloth and Leather", "Alchemy and Herbs", "Cooking Ingredients", "Scribing Supplies", "Other"]],
  ["Magic Item", "Magic Items", ["Weapons", "Armor", "Accessories", "Wondrous Items", "Other"]],
];
/* items.html?c=weapons shows one category, like a page of its own (the Items menu links here) */
const CAT_SLUGS = { weapons: "Weapon", ammunition: "Ammunition", armor: "Armor", consumables: "Consumable", materials: "Crafting Material", "magic-items": "Magic Item" };
const catSlug = c => Object.keys(CAT_SLUGS).find(k => CAT_SLUGS[k] === c) || "";
const SLOTS = ["Head", "Neck", "Shoulders", "Torso", "Waist", "Arms", "Hands", "Legs", "Feet", "Rings", "Other"];
const PROFS = ["Blacksmithing", "Tailoring", "Woodworking", "Cooking", "Alchemy", "Leatherworking", "Scribing", "Tinkering", "Goldsmithing", "Enchanting"];
const TIERS = ["Basic", "Advanced", "Mastery"];
const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "(Varies)"];
const HEX = /^#[0-9a-f]{3,8}$/i;
const KINDS = ["", "Craftable Modifier", "Enchantment Modifier"];
let items = [], recipes = [], original = "", dirty = false, uid = 0;
const editing = new Set(), drafts = new Map(), open = new Set();

const str = x => String(x ?? "").trim();
const list = x => Array.isArray(x) ? x : [];
const newId = p => p + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const extras = x => list(x).map(r => ({ k: str(r && r.k), v: str(r && r.v) })).filter(r => r.k || r.v);
const qtys = x => list(x).map(r => ({ item: str(r && r.item), qty: Math.max(1, Math.round(+(r && r.qty) || 1)) })).filter(r => r.item);
const catOf = c => CATS.find(x => x[0] === c);
/* old "Name - what it does" paragraphs become Properties Defined rows */
function pdefsFrom(t) {
  return String(t || "").split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => {
    const m = x.match(/^(.{1,60}?)\s+-\s+([\s\S]+)$/);
    return m ? { n: m[1].replace(/\[\/?color[^\]]*\]/gi, "").trim(), d: m[2].trim() } : { n: "", d: x };
  });
}
function normItem(i) {
  const cat = catOf(str(i.cat)) ? str(i.cat) : (/weapon/i.test(i.type) ? "Weapon" : /armor|shield/i.test(i.type) ? "Armor" : /potion|food/i.test(i.type) ? "Consumable" : "Crafting Material");
  return {
    id: str(i.id) || newId("i"), n: str(i.n), nc: HEX.test(str(i.nc)) ? str(i.nc) : "", cat, sub: str(i.sub), slot: str(i.slot), badge: !!i.badge, rarity: str(i.rarity), magic: !!i.magic, value: str(i.value ?? i.cost), weight: str(i.weight), actions: str(i.actions),
    props: str(i.props && !Array.isArray(i.props) ? i.props : ""), pdefs: Array.isArray(i.pdefs) ? i.pdefs.map(x => ({ n: str(x && x.n), d: str(x && x.d) })).filter(x => x.n || x.d) : pdefsFrom(str(i.feat || (Array.isArray(i.props) ? i.props.join("\n") : ""))), desc: str(i.desc), extra: extras(i.extra)
  };
}
function normRecipe(r) {
  return {
    id: str(r.id) || newId("r"), n: str(r.n), tier: TIERS.includes(r.tier) ? r.tier : "Basic", badge: !!r.badge, kind: KINDS.includes(r.kind) ? r.kind : "",
    prof: str(r.prof), pre: str(r.pre), ing: qtys(r.ing), matNote: str(r.matNote), applies: str(r.applies), ws: str(r.ws ?? r.tools), time: str(r.time),
    dc: str(r.dc), tc: str(r.tc), qty: { l: str(r.qty && r.qty.l), v: str(r.qty && r.qty.v) }, makes: qtys(r.makes), props: str(r.props), grants: str(r.grants),
    feat: str(r.feat ?? r.desc), quote: str(r.quote), extra: extras(r.extra)
  };
}
function load(j) {
  if (!j || typeof j !== "object") return false;
  items = list(j.items).filter(i => i && str(i.n)).map(i => ({ ...normItem(i), _id: ++uid }));
  recipes = list(j.recipes).filter(r => r && (str(r.n) || list(r.makes).length)).map(r => ({ ...normRecipe(r), _id: ++uid }));
  original = JSON.stringify(clean()); return true;
}
const strip = o => { const { _id, _new, _score, ...x } = o; return x };
const lc = s => s.toLowerCase();
const byName = (a, b) => lc(a.n).localeCompare(lc(b.n));
function clean() {
  return { v: 2, items: items.filter(x => !x._new).map(strip).sort(byName), recipes: recipes.filter(x => !x._new).map(strip).sort((a, b) => lc(recipeName(a)).localeCompare(lc(recipeName(b)))) };
}
const itemById = id => items.find(i => i.id === id);
const itemByName = n => items.find(i => !i._new && lc(i.n) === lc(str(n)));
const itemName = id => (itemById(id) || { n: "(missing item)" }).n;
const recipeName = r => r.n || (r.makes[0] ? itemName(r.makes[0].item) : "Untitled recipe");
const rows = () => KIND === "items" ? items : recipes;
const nameOf = x => KIND === "items" ? x.n : recipeName(x);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

/* ---------------------------------------------------------------- search */
const query = () => lc($("cq").value.trim()).replace(/\s+/g, " ");
function score(x, q) {
  const name = lc(nameOf(x)), wordStart = t => new RegExp("(^|\\W)" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(t);
  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (wordStart(name)) return 75;
  if (name.includes(q)) return 65;
  const linked = (KIND === "items" ? [x.cat, x.sub, x.slot, x.rarity, x.magic ? "magic" : ""] : [x.prof, x.kind, ...[...x.makes, ...x.ing].map(r => itemName(r.item))]).map(lc);
  if (linked.includes(q)) return 60;
  if (linked.some(t => t.includes(q))) return 50;
  const text = lc(plainText(KIND === "items" ? [x.value, x.weight, x.actions, x.props, ...x.pdefs.map(p => p.n + " " + p.d), x.desc, ...x.extra.map(r => r.k + " " + r.v)].join(" ")
    : [x.pre, x.matNote, x.applies, x.ws, x.time, x.props, x.grants, x.feat, x.quote, ...x.extra.map(r => r.k + " " + r.v)].join(" ")));
  if (!text.includes(q)) return 0;
  return wordStart(text) ? 20 : 10;
}
function visible() {
  let l = rows().filter(x => !x._new || editing.has(x._id));
  const f = $("cfilter").value;
  if (f) l = l.filter(x => (KIND === "items" ? x.cat : x.prof) === f || editing.has(x._id));
  const q = query();
  if (q) { l.forEach(x => { x._score = score(x, q) }); return l.filter(x => x._score > 0 || editing.has(x._id)).sort((a, b) => b._score - a._score || lc(nameOf(a)).localeCompare(lc(nameOf(b)))) }
  return l;
}

/* ---------------------------------------------------------------- shared bits */
/* "4 Iron Bars", "2 Pinches of Chalk": plural item names for quantities over 1 */
const NO_PLURAL = new Set(["silver wire", "lead shot"]);
function pluralWord(w) {
  if (/(s|x|ch|sh)$/i.test(w)) return w + "es";
  if (/[^aeiou]y$/i.test(w)) return w.slice(0, -1) + "ies";
  return w + "s";
}
function pluralName(n) {
  if (NO_PLURAL.has(lc(n))) return n;
  const m = n.match(/^(\S+)( of .*)$/); if (m) return pluralWord(m[1]) + m[2];
  const parts = n.split(" "); parts[parts.length - 1] = pluralWord(parts[parts.length - 1]); return parts.join(" ");
}
const qtyName = (n, qty) => qty > 1 ? `${qty} ${pluralName(n)}` : n;
const itemLink = (id, qty) => {
  const i = itemById(id);
  if (!i && String(id).startsWith("?")) return `<span class="ilink gone">${esc(qtyName(id.slice(1), qty))} <small>(new item)</small></span>`;
  return i ? `<a class="ilink" href="${KIND === "items" ? "" : "items.html"}#${esc(i.id)}">${esc(qtyName(i.n, qty))}</a>` : `<span class="ilink gone">(missing item)</span>`;
};
const recipeLink = r => `<a class="ilink" href="${KIND === "recipes" ? "" : "crafting.html"}#${esc(r.id)}">${esc(recipeName(r))}</a>`;
const line = (label, v, cls = "") => v ? `<p class="rl${cls}"><b>${label}:</b> ${richInline(v)}</p>` : "";
const FLASK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.6 3.2 4-1.1-.6 4.1 3.8 1.8-2.6 3.2 2.6 3.2-3.8 1.8.6 4.1-4-1.1L12 23l-2.6-3.2-4 1.1.6-4.1-3.8-1.8L4.8 12 2.2 8.8 6 7l-.6-4.1 4 1.1z" fill="#f29a2e"/><path d="M10.3 6.5h3.4v.9h-.6v2.9l2.9 5.2c.4.7-.1 1.5-.9 1.5H8.9c-.8 0-1.3-.8-.9-1.5l2.9-5.2V7.4h-.6z" fill="#fff"/></svg>`;
const PLAYTEST = `<span class="flask" title="Needs playtesting" role="img" aria-label="Needs playtesting">${FLASK}</span>`;
const tierBadge = t => `<span class="rtier" title="${esc(t)} recipe">${esc((t || "B")[0])}</span>`;

/* ---------------------------------------------------------------- recipes (cards) */
/* the price to buy every material, from each item's Value ("15 (G)", "3 (S)", "5 (C)"); 10 C = 1 S, 10 S = 1 G */
function toCopper(v) {
  let total = 0, found = false;
  String(v || "").replace(/(\d+(?:\.\d+)?)\s*\(?\s*([GSC])\s*\)?/gi, (m, n, u) => { found = true; total += +n * { G: 100, S: 10, C: 1 }[u.toUpperCase()] });
  return found ? total : null;
}
function money(c) {
  c = Math.round(c); const g = Math.floor(c / 100), s = Math.floor(c % 100 / 10), k = c % 10;
  return [g && `${g} (G)`, s && `${s} (S)`, k && `${k} (C)`].filter(Boolean).join(" ") || "0 (C)";
}
function materialPrice(r) {
  let total = 0; const missing = [];
  r.ing.forEach(m => { const i = itemById(m.item), c = i ? toCopper(i.value) : null; if (c === null) missing.push(i ? i.n : "an unknown item"); else total += c * m.qty });
  return { total, missing };
}
function moneyLine(r) {
  if (!r.ing.length) return "";
  const { total, missing } = materialPrice(r);
  const extra = [missing.length ? `${missing.join(", ")} not priced` : "", r.matNote ? "plus any other materials listed" : ""].filter(Boolean).join("; ");
  return `<p class="rl"><b>Monetary Cost:</b> ${money(total)}${extra ? ` <span class="muted">(${esc(extra)})</span>` : ""}</p>`;
}
/* a recipe's yield properties are the item's own properties, so editing the item updates the recipe */
function yieldProps(r) { const i = r.makes[0] && itemById(r.makes[0].item); return (i && i.props) || r.props }
function recipeBody(r) {
  const yp = yieldProps(r);
  const yieldLine = r.makes.length ? `<p class="rl"><b>Yield:</b> ${r.makes.map(m => itemLink(m.item, m.qty)).join(", ")}${yp ? ` (${propsHTML(yp, r.makes[0] && itemById(r.makes[0].item))})` : ""}</p>` : "";
  return (r.kind ? `<p class="rkind">${esc(r.kind)}</p>` : "") +
    (r.pre ? `<p class="rl pre"><b>Prerequisites:</b> ${richInline(r.pre)}</p>` : "") +
    `<p class="rl"><b>Material Cost:</b> ${r.ing.length ? r.ing.map(m => itemLink(m.item, m.qty)).join(", ") : "none listed"}${r.matNote ? ", " + richInline(r.matNote) : ""}</p>` +
    moneyLine(r) +
    line("Applies To", r.applies) + line("Workstations Required", r.ws) + line("Crafting Time", r.time) +
    (r.dc || r.tc ? `<p class="rl"><b>Crafting DC:</b> ${esc(r.dc || "—")} | <b>TC:</b> ${esc(r.tc || "—")}</p>` : "") +
    (r.qty.v ? line(esc(r.qty.l || "Servings"), r.qty.v) : "") + yieldLine + line("Grants", r.grants) +
    r.extra.map(x => line(esc(x.k || "Detail"), x.v)).join("") +
    (r.feat ? `<div class="rfeat">${paras(r.feat)}</div>` : "") +
    (r.quote ? `<div class="rquote">${paras(r.quote)}</div>` : "");
}
/* the item box shown beside a recipe: the yielded item's own details, linked to the Items page */
function yieldBox(r) {
  return r.makes.map(m => { const i = itemById(m.item); if (!i) return "";
    const facts = [["Category", (catOf(i.cat) || ["", i.cat])[1] + (i.sub ? " · " + i.sub : "") + (i.slot ? " · " + i.slot : "")], ["Rarity", i.rarity], ["Value", i.value], ["Weight", i.weight], ["Magic", i.magic ? "Yes" : ""]].filter(f => f[1]);
    return `<div class="ybox"><p class="yname"><a class="ilink" href="items.html#${esc(i.id)}">${nameHTML(i)}</a>${i.badge ? PLAYTEST : ""}</p>` +
      `<dl class="yfacts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` +
      (i.props ? `<p class="rl"><b>Properties:</b> ${propsHTML(i.props, i)}</p>` : "") +
      (i.actions ? `<div class="rfeat">${actionsHTML(i.actions)}</div>` : "") +
      `</div>` }).join("");
}
function recipeRow(r, showProf) {
  const isOpen = open.has(r.id) || editing.has(r._id), y = r.makes[0];
  const yieldTxt = y ? qtyName(itemName(y.item), y.qty) : r.kind ? r.kind.replace(" Modifier", " modifier") : "—";
  return `<tbody class="irow${isOpen ? " open" : ""}" id="${esc(r.id)}" data-id="${r._id}">
<tr class="ihead"><td><div class="icell"><button type="button" class="itoggle" aria-expanded="${isOpen}"><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>${tierBadge(r.tier)}<span class="iname">${esc(recipeName(r))}</span>${r.badge ? PLAYTEST : ""}${showProf && r.prof ? `<span class="ctag2">${esc(r.prof)}</span>` : ""}</button>${ADMIN && !editing.has(r._id) ? `<button type="button" class="gedit iedit" aria-label="Edit ${esc(recipeName(r))}">Edit</button>` : ""}</div></td><td>${esc(yieldTxt)}</td><td>${esc(r.dc || "—")}</td><td>${esc(r.tc || "—")}</td><td>${esc(r.time || "—")}</td></tr>
${isOpen ? `<tr class="idet"><td colspan="5">${editing.has(r._id) ? recipeForm(r) : `<div class="rdet"><div class="rmain">${recipeBody(r)}</div>${r.makes.length ? `<aside class="rside"><h3>Yields</h3>${yieldBox(r)}</aside>` : ""}</div>${ADMIN ? `<div class="dbtns"><button type="button" class="btn gedit">Edit ${esc(recipeName(r))}</button></div>` : ""}`}</td></tr>` : ""}</tbody>`;
}
const RHEAD = `<thead><tr><th>Recipe</th><th>Yield</th><th>DC</th><th>TC</th><th>Time</th></tr></thead>`;
function recipeCard(r) {
  if (editing.has(r._id)) return recipeForm(r);
  return `<section class="cond rcard" id="${esc(r.id)}" data-id="${r._id}"><h2 class="chead"><span class="rname">${tierBadge(r.tier)}<span>${esc(recipeName(r))}</span></span><span class="chr">` +
    (r.badge ? PLAYTEST : "") +
    (ADMIN ? `<button type="button" class="gedit" aria-label="Edit ${esc(recipeName(r))}">Edit</button>` : "") +
    `</span></h2><div class="cbody">${recipeBody(r)}</div></section>`;
}

/* ---------------------------------------------------------------- items (chart) */
const isWeapon = i => i.cat === "Weapon";
function itemDetail(i) {
  const made = recipes.filter(r => !r._new && r.makes.some(m => m.item === i.id));
  const used = recipes.filter(r => !r._new && r.ing.some(m => m.item === i.id));
  const none = `<p class="muted">None listed yet.</p>`;
  const sec = (title, body) => `<div class="dsec"><h3>${title}</h3>${body}</div>`;
  const recipeBlock = made.map(r => `<div class="drec"><p class="rl"><b>${recipeLink(r)}</b> <span class="muted">${esc(r.tier)} ${esc(r.prof)}</span></p>` +
      (r.pre ? `<p class="rl pre"><b>Prerequisites:</b> ${richInline(r.pre)}</p>` : "") +
      `<p class="rl"><b>Material Cost:</b> ${r.ing.map(m => itemLink(m.item, m.qty)).join(", ") || "none listed"}${r.matNote ? ", " + richInline(r.matNote) : ""}</p>` +
      line("Workstations Required", r.ws) + line("Crafting Time", r.time) +
      (r.dc || r.tc ? `<p class="rl"><b>Crafting DC:</b> ${esc(r.dc || "—")} | <b>TC:</b> ${esc(r.tc || "—")}</p>` : "") + `</div>`).join("");
  /* crafting materials show only a description and their recipe */
  const mat = i.cat === "Crafting Material";
  return (mat ? "" : sec("Properties", i.props ? `<p class="rl">${propsHTML(i.props, i)}</p>` : none)) +
    sec("Description", (i.desc ? paras(i.desc) : `<p class="muted">No description yet.</p>`) + i.extra.map(r => line(esc(r.k || "Detail"), r.v)).join("")) +
    (!mat && i.pdefs.length ? sec("Properties Defined", `<div class="rfeat">${i.pdefs.map(p => `<p>${p.n ? `<span class="pdn">${esc(p.n)}</span> - ` : ""}${richInline(p.d)}</p>`).join("")}</div>`) : "") +
    (!mat && (isWeapon(i) || i.actions) ? sec("Weapon actions", i.actions ? `<div class="rfeat">${actionsHTML(i.actions)}</div>` : none) : "") +
    (made.length ? sec("Crafting recipe", recipeBlock) : ADMIN && !i._new ? sec("Crafting recipe", `<p class="muted">No crafting recipe yet. <a class="ilink" href="crafting.html?make=${encodeURIComponent(i.id)}">Create one on the Crafting page</a></p>`) : "") +
    (used.length ? `<p class="rl dused"><b>Ingredient in:</b> ${used.map(recipeLink).join(", ")}</p>` : "") +
    (ADMIN && !i._new ? `<div class="dbtns"><button type="button" class="btn gedit">Edit ${esc(i.n)}</button></div>` : "");
}
const nameHTML = i => `<span class="iname${i.nc ? " tc" : ""}"${i.nc ? ` style="--c:${i.nc}"` : ""}>${esc(i.n || "New item")}</span>`;
function itemRow(i, showCat) {
  const isOpen = open.has(i.id) || editing.has(i._id);
  const tag = showCat ? `<span class="ctag2">${esc(i.sub || catOf(i.cat)[1])}</span>` : i.slot && i.cat === "Armor" ? `<span class="ctag2">${esc(i.slot)}</span>` : "";
  return `<tbody class="irow${isOpen ? " open" : ""}" id="${esc(i.id)}" data-id="${i._id}">
<tr class="ihead"><td><div class="icell"><button type="button" class="itoggle" aria-expanded="${isOpen}"><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>${nameHTML(i)}${i.badge ? PLAYTEST : ""}${tag}</button>${ADMIN && !editing.has(i._id) ? `<button type="button" class="gedit iedit" aria-label="Edit ${esc(i.n)}">Edit</button>` : ""}</div></td><td>${esc(i.rarity || "—")}</td><td class="imagic"><input type="checkbox" class="magicbox" aria-label="${esc(i.n)} is magic"${i.magic ? " checked" : ""}${ADMIN && !editing.has(i._id) ? "" : " disabled"}></td><td>${esc(i.value || "—")}</td><td>${esc(i.weight || "—")}</td></tr>
${isOpen ? `<tr class="idet"><td colspan="5">${editing.has(i._id) ? itemForm(i) : itemDetail(i)}</td></tr>` : ""}</tbody>`;
}
function itemsChart(l) {
  const head = `<thead><tr><th>Item</th><th>Rarity</th><th><span class="hl">Magic?</span><span class="hs" aria-hidden="true">Magic</span></th><th>Value</th><th><span class="hl">Weight</span><span class="hs" aria-hidden="true">Wt.</span></th></tr></thead>`;
  if (query()) return `<div class="ghead gres"><h2>Best matches first</h2></div><table class="ichart">${head}${l.map(i => itemRow(i, true)).join("")}</table>`;
  let h = "";
  for (const [cat, label, subs] of CATS) {
    const inCat = l.filter(i => i.cat === cat); if (!inCat.length) continue;
    const groups = [...subs, ...[...new Set(inCat.map(i => i.sub))].filter(s => s && !subs.includes(s)).sort()];
    let body = "";
    for (const sub of groups) {
      const g = inCat.filter(i => i.sub === sub);
      if (!g.length) continue;
      g.sort((a, b) => cat === "Armor" ? (SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot)) || byName(a, b) : byName(a, b));
      body += `<tbody class="isub"><tr><th colspan="5">${esc(sub || "Other")}${cat === "Armor" && sub !== "Accessories" && sub !== "Clothing" ? " Armor" : ""}</th></tr></tbody>` + g.map(i => itemRow(i, false)).join("");
    }
    const loose = inCat.filter(i => !i.sub);
    if (loose.length) body += `<tbody class="isub"><tr><th colspan="5">Other</th></tr></tbody>` + loose.sort(byName).map(i => itemRow(i, false)).join("");
    h += `<section class="icat"><h2 class="icath">${esc(label)} <span>${plural(inCat.length, "item", "items")}</span></h2><table class="ichart">${head}${body}</table></section>`;
  }
  return h;
}

/* ---------------------------------------------------------------- forms */
const extraRow = r => `<div class="xrow"><input type="text" class="xk" value="${esc(r.k)}" placeholder="Label" aria-label="Detail label" autocomplete="off"><input type="text" class="xv" value="${esc(r.v)}" placeholder="Value" aria-label="Detail value" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
const qtyRow = (r, cls) => `<div class="qrow ${cls}"><input type="number" class="qn" min="1" value="${r.qty || 1}" aria-label="Quantity"><input type="text" class="qi" list="itemNames" value="${esc(r.name ?? (r.item ? itemName(r.item) : ""))}" placeholder="Item name" aria-label="Item" autocomplete="off"><button type="button" class="btn xdel">Remove</button></div>`;
const fld = (id, label, help, inner) => `<label for="${id}">${label}${help ? ` <small>${help}</small>` : ""}${inner}</label>`;
const inp = (id, k, v, extra = "") => `<input type="text" id="${id}" data-k="${k}" value="${esc(v)}" autocomplete="off"${extra}>`;
const area = (id, k, v, r) => `<textarea id="${id}" data-k="${k}" rows="${r}">${esc(v)}</textarea>`;
const sel = (id, k, v, opts) => `<select id="${id}" data-k="${k}">${opts.map(([val, lab]) => `<option value="${esc(val)}"${val === v ? " selected" : ""}>${esc(lab)}</option>`).join("")}</select>`;
const formEnd = (x, what) => `
<div class="glab">More details <small>Any other details, each with its own label.</small></div>
<div class="xlist">${(drafts.get(x._id) || x).extra.map(extraRow).join("")}</div>
<button type="button" class="btn xadd">Add a detail</button>
${KIND === "recipes" ? `<div class="gprev"><span class="glab">Preview</span><div class="gprevbody"></div></div>` : ""}
<p class="gerr" role="alert"></p>
<div class="gbtns"><button type="button" class="btn gdel">${x._new ? "Remove" : "Delete " + what}</button><span class="sp"></span><button type="button" class="btn gcancel">Cancel</button><button type="button" class="btn solid gdone">Done</button></div>`;
const NAME_COLORS = [["", "No color"], ["#8e171c", "Crawl red"], ["#1f5fbf", "Blue"], ["#2e7d32", "Green"], ["#6a1b9a", "Purple"], ["#b7791f", "Gold"], ["#c2410c", "Orange"], ["#0f766e", "Teal"], ["#be185d", "Pink"], ["#7c4a1e", "Brown"], ["#475569", "Slate"]];
function nameColorPicker(nc) {
  return `<div class="ncolor" role="radiogroup" aria-label="Name color"><span class="glab">Name color</span>` +
    NAME_COLORS.map(([c, n]) => `<button type="button" class="ncsw${c === nc ? " on" : ""}" data-nc="${c}" style="--c:${c || "transparent"}" title="${n}" aria-label="${n}" aria-pressed="${c === nc}">${c ? "" : "✕"}</button>`).join("") +
    `<input type="color" class="ncpick" value="${nc || "#8e171c"}" aria-label="Pick any name color" title="Pick any color"><input type="hidden" data-k="nc" value="${esc(nc)}"></div>`;
}
const pdefRow = x => `<div class="prow"><input type="text" class="pn" value="${esc(x.n)}" placeholder="Property name, e.g. Serrated" aria-label="Property name" autocomplete="off"><textarea class="pd" rows="2" placeholder="What the property does" aria-label="What the property does">${esc(x.d)}</textarea><button type="button" class="btn xdel">Remove</button></div>`;
const topBtns = `<div class="gbtns gtop"><span class="sp"></span><button type="button" class="btn gcancel">Cancel</button><button type="button" class="btn solid gdone">Done</button></div>`;
function itemForm(i) {
  const id = k => `c${k}-${i._id}`, d = drafts.get(i._id) || i;
  const subs = (catOf(d.cat) || CATS[3])[2];
  return `<div class="gediting gform iform" data-id="${i._id}">
${topBtns}
${fld(id("n"), "Name", "", inp(id("n"), "n", d.n))}
${nameColorPicker(d.nc || "")}
<label class="chk"><input type="checkbox" data-k="magic"${d.magic ? " checked" : ""}> Magic item</label>
<label class="chk"><input type="checkbox" data-k="badge"${d.badge ? " checked" : ""}> ${FLASK} Needs playtesting</label>
<div class="grid3">
${fld(id("cat"), "Category", "", sel(id("cat"), "cat", d.cat, CATS.map(c => [c[0], c[1]])))}
${fld(id("sub"), d.cat === "Weapon" ? "Weapon type" : d.cat === "Armor" ? "Armor type" : "Group", "", inp(id("sub"), "sub", d.sub, ` list="subs-${i._id}"`) + `<datalist id="subs-${i._id}">${subs.map(s => `<option value="${esc(s)}">`).join("")}</datalist>`)}
${d.cat === "Armor" ? fld(id("slot"), "Slot", "", sel(id("slot"), "slot", d.slot, [["", "None"], ...SLOTS.map(s => [s, s])])) : ""}
${fld(id("rarity"), "Rarity", "", sel(id("rarity"), "rarity", d.rarity || "", [["", "None"], ...RARITIES.map(r => [r, r]), ...(d.rarity && !RARITIES.includes(d.rarity) ? [[d.rarity, d.rarity]] : [])]))}
${fld(id("value"), "Value", "", inp(id("value"), "value", d.value, ' placeholder="e.g. 15 gp"'))}
${fld(id("weight"), "Weight", "", inp(id("weight"), "weight", d.weight, ' placeholder="e.g. 3 lb"'))}
</div>
${d.cat === "Crafting Material" ? "" : fld(id("props"), "Properties", "The properties line, e.g. 1d8 slashing, Versatile 1d10, Serrated. Recipes that make this item show it too.", inp(id("props"), "props", d.props))}
${fld(id("desc"), "Description", "Leave a blank line between paragraphs.", area(id("desc"), "desc", d.desc, 3))}
${d.cat === "Crafting Material" ? "" : `<div class="glab">Properties Defined <small>The property's name shows in red, followed by what it does.</small></div><div class="plist">${(d.pdefs || []).map(pdefRow).join("")}</div><button type="button" class="btn padd">Add another property</button>`}
${d.cat === "Crafting Material" ? "" : fld(id("actions"), "Weapon actions", d.cat === "Weapon" ? "Leave a blank line between paragraphs." : "Leave empty if the item has none.", area(id("actions"), "actions", d.actions, 3))}
${formEnd(i, "item")}</div>`;
}
const isCooking = p => /^cook/i.test(String(p || "").trim());
function recipeForm(r) {
  const id = k => `c${k}-${r._id}`, d = drafts.get(r._id) || { ...r, makes: r.makes.map(m => ({ qty: m.qty, name: itemName(m.item) })), ing: r.ing.map(m => ({ qty: m.qty, name: itemName(m.item) })) };
  return `<div class="gediting gform iform" data-id="${r._id}">
${topBtns}
${fld(id("n"), "Recipe name", "", inp(id("n"), "n", d.n))}
<label class="chk"><input type="checkbox" data-k="badge"${d.badge ? " checked" : ""}> ${FLASK} Needs playtesting</label>
<div class="grid3">
${fld(id("prof"), "Profession", "", inp(id("prof"), "prof", d.prof, ' list="profs"'))}
${fld(id("tier"), "Tier badge", "", sel(id("tier"), "tier", d.tier, TIERS.map(t => [t, t])))}
${fld(id("kind"), "Kind", "", sel(id("kind"), "kind", d.kind, KINDS.map(k => [k, k || "Makes an item"])))}
</div>
${fld(id("pre"), "Prerequisites", "", inp(id("pre"), "pre", d.pre, ' placeholder="e.g. +1 Blacksmithing"'))}
<div class="glab">Material Cost <small>Pick items from the list, or type a new name to create that item.</small></div>
<div class="qlist qing">${d.ing.map(x => qtyRow(x, "ing")).join("")}</div>
<button type="button" class="btn qadd" data-q="ing">Add material</button>
${fld(id("applies"), "Applies To", "For modifiers.", inp(id("applies"), "applies", d.applies))}
<div class="grid3">
${fld(id("ws"), "Workstations Required", "", inp(id("ws"), "ws", d.ws))}
${fld(id("time"), "Crafting Time", "", inp(id("time"), "time", d.time))}
${fld(id("dc"), "Crafting DC", "", inp(id("dc"), "dc", d.dc))}
${fld(id("tc"), "TC", "", inp(id("tc"), "tc", d.tc))}
${isCooking(d.prof) ? fld(id("qv"), "Servings", "", inp(id("qv"), "qv", d.qv ?? d.qty.v, ' placeholder="e.g. 4 (+1 on TC)"')) : fld(id("qv"), "Batch", "How many it makes, if more than one.", inp(id("qv"), "qv", d.qv ?? d.qty.v, ' placeholder="e.g. 2 (+1 on TC)"'))}
</div>
<div class="glab">Yield <small>What it makes. Modifiers can leave this empty and use Grants.</small></div>
<div class="qlist qmakes">${d.makes.map(x => qtyRow(x, "makes")).join("")}</div>
<button type="button" class="btn qadd" data-q="makes">Add yield</button>
${fld(id("props"), "Yield properties", "Only used when the item has no properties of its own. Edit the item on the Items page to change its properties.", inp(id("props"), "props", d.props))}
${fld(id("grants"), "Grants", "For modifiers.", inp(id("grants"), "grants", d.grants))}
${fld(id("feat"), "Features and rules", "Leave a blank line between paragraphs.", area(id("feat"), "feat", d.feat, 4))}
${fld(id("quote"), "Quote", "", area(id("quote"), "quote", d.quote, 2))}
${formEnd(r, "recipe")}</div>`;
}
function readForm(f) {
  const d = {}; f.querySelectorAll("[data-k]").forEach(el => { d[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value });
  d.extra = [...f.querySelectorAll(".xrow")].map(r => ({ k: r.querySelector(".xk").value, v: r.querySelector(".xv").value }));
  const q = c => [...f.querySelectorAll(".qrow." + c)].map(r => ({ qty: +r.querySelector(".qn").value || 1, name: r.querySelector(".qi").value }));
  if (KIND === "recipes") { d.makes = q("makes"); d.ing = q("ing") }
  else if (f.querySelector(".plist")) d.pdefs = [...f.querySelectorAll(".prow")].map(r => ({ n: r.querySelector(".pn").value, d: r.querySelector(".pd").value }));
  return d;
}
function fromDraft(d, x) {
  if (KIND === "items") return { ...x, n: str(d.n).replace(/\s+/g, " "), nc: HEX.test(str(d.nc)) ? str(d.nc) : "", cat: d.cat, sub: str(d.sub), badge: !!d.badge, rarity: str(d.rarity), magic: !!d.magic, slot: d.cat === "Armor" ? str(d.slot) : "", value: str(d.value), weight: str(d.weight), actions: str(d.actions ?? x.actions), props: str(d.props ?? x.props), pdefs: d.pdefs ? d.pdefs.map(p => ({ n: str(p.n), d: str(p.d) })).filter(p => p.n || p.d) : x.pdefs, desc: str(d.desc), extra: extras(d.extra) };
  const link = l => l.filter(r => str(r.name)).map(r => { const i = itemByName(r.name); return { item: i ? i.id : "?" + str(r.name).replace(/\s+/g, " "), qty: Math.max(1, Math.round(r.qty)) } });
  return {
    ...x, n: str(d.n).replace(/\s+/g, " "), prof: str(d.prof), tier: d.tier, kind: d.kind, badge: !!d.badge, pre: str(d.pre), matNote: str(d.matNote ?? x.matNote), applies: str(d.applies),
    ws: str(d.ws), time: str(d.time), dc: str(d.dc), tc: str(d.tc), qty: { l: str(d.qv) ? (isCooking(d.prof) ? "Servings" : "Batch") : "", v: str(d.qv) }, props: str(d.props), grants: str(d.grants),
    feat: str(d.feat), quote: str(d.quote), extra: extras(d.extra), makes: link(d.makes), ing: link(d.ing)
  };
}
function preview(f) {
  const x = rows().find(r => r._id === +f.dataset.id), b = f.querySelector(".gprevbody"); if (!x || !b) return;
  const p = fromDraft(readForm(f), x);
  b.innerHTML = KIND === "items" ? `<p class="pvname">${nameHTML(p)}${p.magic ? ' <span class="ctag2">Magic</span>' : ""}${p.rarity ? ` <span class="ctag2">${esc(p.rarity)}</span>` : ""}</p>` + itemDetail({ ...p, _new: true }).replace(/<div class="dbtns">[\s\S]*$/, "") : recipeBody(p);
}
function saveDrafts() {
  document.querySelectorAll(".gediting").forEach(f => {
    const d = readForm(f); if (KIND === "recipes" && "ql" in d) { /* keep select values */ }
    drafts.set(+f.dataset.id, d);
  });
}

/* ---------------------------------------------------------------- page */
let firstFill = true;
const profSlug = p => p.toLowerCase().replace(/[^a-z0-9]+/g, "-");
function catHeading() {
  if (KIND !== "items") {
    const p = $("cfilter").value, h = document.querySelector(".intro h1");
    h.textContent = p || "Crafting"; document.title = "Crawl " + (p || "Crafting");
    if (window.crawlNavMark) window.crawlNavMark();
    return;
  }
  const c = catOf($("cfilter").value), h = document.querySelector(".intro h1");
  h.textContent = c ? c[1] : "Items"; document.title = "Crawl " + (c ? c[1] : "Items");
  if (window.crawlNavMark) window.crawlNavMark();
}
function fillFilter() {
  const s = $("cfilter");
  let cur = s.value;
  if (firstFill && KIND === "items") { cur = CAT_SLUGS[new URLSearchParams(location.search).get("c")] || ""; firstFill = false }
  if (firstFill && KIND === "recipes") { const q = new URLSearchParams(location.search).get("p"); cur = (q && [...PROFS, ...recipes.map(r => r.prof)].find(p => profSlug(p) === q)) || ""; firstFill = false }
  const opts = KIND === "items" ? CATS.map(c => [c[0], c[1]]) : [...new Set([...PROFS.filter(p => recipes.some(r => r.prof === p)), ...recipes.map(r => r.prof).filter(Boolean).sort()])].map(p => [p, p]);
  s.innerHTML = `<option value="">${KIND === "items" ? "All categories" : "All professions"}</option>` + opts.map(([v, l]) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`).join("");
}
function render() {
  saveDrafts(); fillFilter(); catHeading();
  const l = visible(), n = l.filter(x => !x._new).length;
  $("ccount").textContent = KIND === "items" ? plural(n, "item", "items") : plural(n, "recipe", "recipes");
  let h = "";
  if (KIND === "items") h = itemsChart(l);
  else if (query()) h = l.length ? `<div class="ghead gres"><h2>Best matches first</h2></div><table class="ichart rchart">${RHEAD}${l.map(r => recipeRow(r, true)).join("")}</table>` : "";
  else {
    const profs = [...PROFS, ...[...new Set(l.map(r => r.prof))].filter(p => !PROFS.includes(p)).sort()];
    for (const p of profs) {
      const g = l.filter(r => (r.prof || "") === p).sort((a, b) => (a._new ? -1 : b._new ? 1 : 0) || lc(recipeName(a)).localeCompare(lc(recipeName(b))));
      if (g.length) h += `<section class="icat"><h2 class="icath">${esc(p || "Other")} <span>${plural(g.length, "recipe", "recipes")}</span></h2><table class="ichart rchart">${RHEAD}${g.map(r => recipeRow(r, false)).join("")}</table></section>`;
    }
  }
  $("clist").innerHTML = h;
  document.querySelectorAll(".gediting").forEach(preview);
  sideShow(editing.size > 0);
  const total = rows().filter(x => !x._new).length;
  $("cempty").hidden = l.length > 0;
  const fc = KIND === "items" && catOf($("cfilter").value), inCat = fc ? items.filter(i => !i._new && i.cat === fc[0]).length : total;
  $("cempty").textContent = !inCat && !query() && fc ? `No ${lc(fc[1])} yet.${ADMIN ? " Click Add item to create the first one." : ""}` : total ? "Nothing matches. Try a different word, or clear the search." : (KIND === "items" ? "No items yet." : "No recipes yet.") + (ADMIN ? ` Click ${KIND === "items" ? "Add item" : "Add recipe"} to create the first one.` : "");
  $("itemNames").innerHTML = items.filter(i => !i._new).sort(byName).map(i => `<option value="${esc(i.n)}">`).join("");
  $("profs").innerHTML = [...new Set([...PROFS, ...recipes.map(r => r.prof).filter(Boolean)])].map(p => `<option value="${esc(p)}">`).join("");
  $("gAdd").hidden = !ADMIN;
}
const say = m => { $("gmsg").textContent = m };
function markDirty() {
  dirty = JSON.stringify(clean()) !== original;
  $("savebar").hidden = !dirty;
  if (dirty) { $("saveMsg").textContent = KIND === "items" ? "You have unsaved item changes." : "You have unsaved recipe changes."; $("saveBtn").disabled = false; $("discardBtn").disabled = false }
}
const rowOf = el => { const c = el.closest("[data-id]"); return c ? rows().find(x => x._id === +c.dataset.id) : null };
function closeForm(x) { editing.delete(x._id); drafts.delete(x._id); if (x._new) { if (KIND === "items") items = items.filter(y => y !== x); else recipes = recipes.filter(y => y !== x) } }

$("clist").addEventListener("input", ev => { const f = ev.target.closest(".gediting"); if (f) preview(f) });
function setNameColor(f, c) {
  f.querySelector('[data-k="nc"]').value = c;
  f.querySelectorAll(".ncsw").forEach(b => { const on = b.dataset.nc === c; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on) });
  if (c) f.querySelector(".ncpick").value = c;
  preview(f);
}
/* the Text color sidebar colors the whole name when the Name box is selected */
window.colorNameHook = (t, c) => { if (KIND !== "items" || t.dataset.k !== "n") return false; const f = t.closest(".gediting"); if (f) setNameColor(f, c); return true };
$("clist").addEventListener("change", ev => {
  if (ev.target.classList.contains("magicbox")) {
    const x = rowOf(ev.target); if (x && ADMIN) { x.magic = ev.target.checked; markDirty(); say(`${x.n} ${x.magic ? "is now" : "is no longer"} marked as magic. Click Save changes to keep it.`) }
    return;
  }
  if (ev.target.classList.contains("ncpick")) { setNameColor(ev.target.closest(".gediting"), ev.target.value); return }
  const f = ev.target.closest(".gediting");
  if (f && (ev.target.dataset.k === "cat" || ev.target.dataset.k === "prof")) { render(); return }
  if (f) preview(f);
});
$("clist").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  const f = b.closest(".gediting");
  if (f && b.classList.contains("xadd")) { f.querySelector(".xlist").insertAdjacentHTML("beforeend", extraRow({ k: "", v: "" })); f.querySelector(".xrow:last-child .xk").focus(); return }
  if (f && b.classList.contains("qadd")) { const c = b.dataset.q; f.querySelector(c === "makes" ? ".qmakes" : ".qing").insertAdjacentHTML("beforeend", qtyRow({ qty: 1, name: "" }, c)); f.querySelector(`.qrow.${c}:last-child .qi`).focus(); return }
  if (f && b.classList.contains("xdel")) { b.closest(".xrow,.qrow,.prow").remove(); preview(f); return }
  if (f && b.classList.contains("padd")) { f.querySelector(".plist").insertAdjacentHTML("beforeend", pdefRow({ n: "", d: "" })); f.querySelector(".prow:last-child .pn").focus(); return }
  if (f && b.classList.contains("ncsw")) { setNameColor(f, b.dataset.nc); return }
  const x = rowOf(b); if (!x) return;
  if (b.classList.contains("itoggle")) {
    if (editing.has(x._id)) return;
    if (open.has(x.id)) open.delete(x.id); else open.add(x.id);
    render(); const t = document.querySelector(`.irow[data-id="${x._id}"] .itoggle`); if (t) t.focus(); return;
  }
  if (b.classList.contains("gedit")) {
    editing.add(x._id); open.add(x.id); render();
    const el = document.querySelector(`.gediting[data-id="${x._id}"] [data-k="n"]`); if (el) el.focus();
  } else if (b.classList.contains("gcancel")) { closeForm(x); render() }
  else if (b.classList.contains("gdel")) {
    if (!x._new && !b.dataset.sure) {
      const uses = KIND === "items" ? recipes.filter(r => [...r.makes, ...r.ing].some(m => m.item === x.id)).length : 0;
      b.dataset.sure = "1"; b.textContent = uses ? `Used in ${plural(uses, "recipe", "recipes")}. Click again to delete` : "Click again to delete"; return;
    }
    const wasNew = x._new, name = nameOf(x); closeForm(x); open.delete(x.id);
    if (!wasNew) {
      if (KIND === "items") { items = items.filter(y => y !== x); recipes.forEach(r => { r.makes = r.makes.filter(m => m.item !== x.id); r.ing = r.ing.filter(m => m.item !== x.id) }) }
      else recipes = recipes.filter(y => y !== x);
    }
    render(); markDirty(); if (!wasNew) say(`Deleted ${name}. Click Save changes to keep it deleted.`);
  } else if (b.classList.contains("gdone")) {
    const f2 = b.closest(".gediting"), d = readForm(f2), err = m => { f2.querySelector(".gerr").textContent = m };
    const name = str(d.n).replace(/\s+/g, " ");
    if (KIND === "items") {
      if (!name) { err("Give the item a name."); return }
      if (items.some(y => y !== x && !y._new && lc(y.n) === lc(name))) { err(`There's already an item called ${name}.`); return }
      Object.assign(x, fromDraft(d, x));
    } else {
      const named = l => l.filter(r => str(r.name));
      if (!name && !named(d.makes).length) { err("Give the recipe a name, or pick what it makes."); return }
      const created = [];
      for (const r of [...named(d.makes), ...named(d.ing)]) if (!itemByName(r.name) && !created.some(c => lc(c.n) === lc(str(r.name)))) {
        created.push({ id: newId("i"), n: str(r.name).replace(/\s+/g, " "), nc: "", cat: "Crafting Material", sub: "Other", slot: "", badge: false, rarity: "", magic: false, value: "", weight: "", actions: "", pdefs: [], props: "", feat: "", desc: "", extra: [], _id: ++uid });
      }
      items.push(...created);
      Object.assign(x, fromDraft(d, x));
      say(created.length ? `Also created ${created.length === 1 ? "a new item" : "new items"}: ${created.map(c => c.n).join(", ")}. They're under Crafting Materials on the Items page; move them to the right category there.` : "");
    }
    delete x._new; editing.delete(x._id); drafts.delete(x._id);
    render(); markDirty();
  }
});
$("gAdd").addEventListener("click", () => {
  const f = $("cfilter").value;
  const x = KIND === "items"
    ? { id: newId("i"), n: "", nc: "", cat: f || "Weapon", sub: "", slot: "", badge: false, rarity: "", magic: f === "Magic Item", value: "", weight: "", actions: "", pdefs: [], props: "", feat: "", desc: "", extra: [], _id: ++uid, _new: true }
    : { id: newId("r"), n: "", tier: "Basic", badge: false, kind: "", prof: f || "", pre: "", ing: [], matNote: "", applies: "", ws: "", time: "", dc: "", tc: "", qty: { l: "", v: "" }, makes: [], props: "", grants: "", feat: "", quote: "", extra: [], _id: ++uid, _new: true };
  rows().push(x); editing.add(x._id); open.add(x.id); $("cq").value = ""; render();
  const el = document.querySelector(`.gediting[data-id="${x._id}"]`);
  if (el) { el.scrollIntoView({ block: "center" }); el.querySelector('[data-k="n"]').focus() }
});
$("cq").addEventListener("input", render);
$("cfilter").addEventListener("change", () => {
  if (KIND === "items") { const sl = catSlug($("cfilter").value); history.replaceState(null, "", "items.html" + (sl ? "?c=" + sl : "") + location.hash) }
  else { const v = $("cfilter").value; history.replaceState(null, "", "crafting.html" + (v ? "?p=" + profSlug(v) : "") + location.hash) }
  render();
});

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

/* open the item or recipe named in the address (#i-… or #r-…) */
/* open the item or recipe named in the address (#i-… or #r-…) and bring it into view.
   Open rows are remembered by id, so reloading the data never closes them. */
function showHash(ev) {
  const id = decodeURIComponent(location.hash.slice(1)); if (!id) return;
  const x = rows().find(r => r.id === id); if (!x) return;
  if ((query() || $("cfilter").value) && !visible().includes(x)) {
    $("cq").value = ""; $("cfilter").value = "";
    if (location.search) history.replaceState(null, "", (KIND === "items" ? "items.html" : "crafting.html") + location.hash);
  }
  open.add(x.id); render();
  const go = () => { const el = document.getElementById(id); if (!el) return;
    el.scrollIntoView({ block: "start", behavior: ev && ev.type === "hashchange" ? "smooth" : "auto" });
    el.classList.remove("flash"); void el.getBoundingClientRect(); el.classList.add("flash") };
  requestAnimationFrame(go);
}
/* after the newest data loads, keep the opened row where the reader is looking */
function keepHashInView() { const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (el) el.scrollIntoView({ block: "start" }) }
window.addEventListener("hashchange", showHash);

async function refreshFromGitHub() {
  try {
    const r = await gh(`/contents/crawl-items.json?ref=${REPO.branch || "main"}`, { headers: { "Accept": "application/vnd.github.raw+json" } });
    if (r.ok && !dirty && !editing.size && load(await r.json())) render();
  } catch (x) { }
}
AdminHooks.canSignOut = () => { if (dirty || editing.size) { say("Save or discard your changes before signing out."); return false } return true };
AdminHooks.signedIn = quiet => { render(); setTimeout(startRecipeFor); if (!quiet) say(KIND === "items" ? "Signed in as admin. Open any item to edit it, or click Add item." : "Signed in as admin. Click Edit on any recipe, or Add recipe."); refreshFromGitHub() };
AdminHooks.signedOut = () => { editing.clear(); drafts.clear(); items = items.filter(x => !x._new); recipes = recipes.filter(x => !x._new); render(); say("Signed out.") };

load(CATALOG);
/* ---------------------------------------------------------------- glossary tooltips on item Properties (every Properties entry)
   and in Weapon actions text (Weapon, Combat and General Actions) */
let PROP_TIPS = { map: new Map(), re: null }, ACT_TIPS = { map: new Map(), re: null };
function setTips(j) {
  const a = normGlossary(j) || [];
  PROP_TIPS = glMapOf(a.filter(e => e.sec === "Properties").map(e => ({ ...e, tip: true })));
  ACT_TIPS = glMapOf(a.filter(e => ACTION_SECS.includes(e.sec)).map(e => ({ ...e, tip: true })));
}
setTips(GLOSSARY);
const ARMOR_WORDS = ["clothing", "light", "medium", "heavy"];
function tipMark(html, tips, gm, skip) {
  if (!tips.re) return html;
  return html.split(/(<[^>]+>)/).map(s => s.startsWith("<") ? s : s.replace(tips.re, m => skip && skip(m) ? m : `<span class="gl" tabindex="0" data-gm="${gm}" data-g="${esc(m.toLowerCase())}">${m}</span>`)).join("");
}
/* on armor, Light/Medium/Heavy are the armor's weight class, not the weapon property */
function propsHTML(t, item) { return tipMark(richInline(t), PROP_TIPS, "p", item && item.cat === "Armor" ? m => ARMOR_WORDS.includes(m.toLowerCase()) : null) }
const actionsHTML = t => blocks(t, x => tipMark(richInline(x), ACT_TIPS, "a"));
const gtip = document.createElement("div"); gtip.className = "gtip"; gtip.id = "gtip"; gtip.setAttribute("role", "tooltip"); gtip.hidden = true; document.body.appendChild(gtip);
function showTip(el) {
  const hit = (el.dataset.gm === "a" ? ACT_TIPS : PROP_TIPS).map.get(el.dataset.g); if (!hit) return;
  const tp = tipHTML(hit); gtip.innerHTML = tp.html; gtip.classList.toggle("gtipact", tp.act); gtip.hidden = false;
  const r = el.getBoundingClientRect(), w = gtip.offsetWidth, h = gtip.offsetHeight, vw = document.documentElement.clientWidth, vh = window.innerHeight;
  let y = r.bottom + 8; if (y + h > vh - 12 && r.top - h - 8 > 12) y = r.top - h - 8;
  gtip.style.left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12) + "px"; gtip.style.top = Math.max(12, y) + "px";
}
const hideTip = () => { gtip.hidden = true };
const glAt = t => t && t.closest ? t.closest(".gl") : null;
document.addEventListener("pointerover", ev => { if (ev.pointerType === "mouse") { const el = glAt(ev.target); if (el) showTip(el) } });
document.addEventListener("pointerout", ev => { if (ev.pointerType === "mouse") { const el = glAt(ev.target); if (el && !el.contains(ev.relatedTarget)) hideTip() } });
document.addEventListener("focusin", ev => { const el = glAt(ev.target); if (el) showTip(el) });
document.addEventListener("click", ev => { const el = glAt(ev.target); if (el) { ev.preventDefault(); showTip(el) } else hideTip() });
window.addEventListener("scroll", hideTip, { passive: true, capture: true });

if (STATIC) {
  fetch("crawl-glossary.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).then(j => { if (j) { setTips(j); render() } }).catch(() => { });
  $("adminBtn").hidden = false; showAdminBtn();
  fetch("crawl-items.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && !dirty) load(j) }).catch(() => { })
    .finally(() => { render(); keepHashInView(); restoreAdmin() });
}
render(); showHash();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(keepHashInView);
/* crafting.html?make=<item id> (from an item with no recipe): start a new recipe that makes it */
function startRecipeFor() {
  const id = KIND === "recipes" && new URLSearchParams(location.search).get("make"); if (!id || !ADMIN) return;
  const it = itemById(id); history.replaceState(null, "", "crafting.html"); if (!it) return;
  const x = { id: newId("r"), n: it.n, tier: "Basic", badge: false, kind: "", prof: "", pre: "", ing: [], matNote: "", applies: "", ws: "", time: "", dc: "", tc: "", qty: { l: "", v: "" }, makes: [{ item: it.id, qty: 1 }], props: "", grants: "", feat: "", quote: "", extra: [], _id: ++uid, _new: true };
  recipes.push(x); editing.add(x._id); open.add(x.id); render();
  const el = document.querySelector(`.gediting[data-id="${x._id}"]`); if (el) { el.scrollIntoView({ block: "center" }); el.querySelector('[data-k="prof"]').focus() }
  say(`New recipe for ${it.n}. Fill it in, click Done, then Save changes.`);
}
