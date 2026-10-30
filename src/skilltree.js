/* ---------------------------------------------------------------- Tree mode (an experiment)
   With the "Tree mode" switch in the header on, the Character Creator's Class step becomes a Path of Exile style skill tree.
   The tree is built from the site's data every time, so new classes, features and feats appear on their own:
     - classes sit around a ring, in name order; each class starts at its
       start node and its features run outward by level; a choice feature (Fighting Style) fans out into its options, and
       the Combat and Weapon Actions a feature teaches hang off it; subclasses (archetypes) branch off the start node;
     - feats sit on an outer ring, grouped by category, with each feat line running outward.
   The admin can move, rename, re-describe, restyle, hide, link and unlink any node and add new ones. Only those changes
   are saved, in crawl-tree.json = {v, nodes: {id: {x, y, n, d, kind, hide}}, extra: [node], links: [[a, b]], unlinks: [[a, b]]}.
   The view is top-down: drag to pan, wheel or +/- to zoom, Alt-drag or right-drag (or the Turn slider) to turn. */
const treeOn = () => document.documentElement.getAttribute("data-tree") === "on";
function normTree(j) { j = j && typeof j === "object" ? j : {}; return { v: 1, nodes: j.nodes && typeof j.nodes === "object" && !Array.isArray(j.nodes) ? j.nodes : {}, extra: arr(j.extra).filter(n => n && n.id), links: arr(j.links).filter(l => Array.isArray(l) && l.length === 2), unlinks: arr(j.unlinks).filter(l => Array.isArray(l) && l.length === 2) } }
let TREE_SAVED = normTree(typeof TREE !== "undefined" ? TREE : null), TREE_ORIG = JSON.stringify(TREE_SAVED);
let FEAT_LIST = arr(typeof FEATS !== "undefined" && FEATS ? FEATS.feats : []);
const treeDirty = () => JSON.stringify(TREE_SAVED) !== TREE_ORIG;
const KINDS = [["start", "Class start"], ["keystone", "Keystone"], ["notable", "Notable"], ["minor", "Minor"], ["option", "Option"], ["action", "Action"], ["feat", "Feat"]];
const FEAT_CAT_ORDER2 = ["Aggro", "Control", "Roleplay", "Fortitude", "Weapon Mastery", "Spellcraft"];

/* feats whose prerequisite names another feat follow it (a name that's also a background doesn't count when the
   prerequisite is about backgrounds) */
function treeFeatParents(f, all) {
  const pre = String(f.pre || ""), bgs = new Set(arr(typeof BACKGROUNDS !== "undefined" && BACKGROUNDS ? BACKGROUNDS.backgrounds : []).map(b => lcs(b.n)));
  return all.filter(g => g !== f && g.n && new RegExp("(^|[^a-z])" + g.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z]|$)", "i").test(pre) && !(bgs.has(lcs(g.n)) && /background/i.test(pre)));
}

/* ---------------------------------------------------------------- the tree built from the data */
function baseTree() {
  const nodes = [], links = [], ids = new Set();
  const add = n => { let id = n.id, i = 2; while (ids.has(id)) id = n.id + "-" + i++; n.id = id; ids.add(id); nodes.push(n); return n };
  const link = (a, b) => links.push([a, b]);
  const actions = (normGlossary(GLOSSARY) || []).filter(e => e.sec === "Combat Actions" || e.sec === "Weapon Actions");
  const classes = CR.classes.slice().sort(byName);
  const N = Math.max(1, classes.length), R0 = 520, STEP = 170;
  let outer = R0;
  classes.forEach((k, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / N, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
    const P = (r, side) => ({ x: Math.round(ux * r + px * (side || 0)), y: Math.round(uy * r + py * (side || 0)) });
    const start = add({ id: "cls:" + k.id, kind: "start", n: k.n, d: k.desc, ref: { t: "class", cls: k.id }, cls: k.id, ...P(R0) });
    let prev = start.id, r = R0, side = 1;
    /* subclasses (archetypes) branch off the start node to the side */
    k.subs.forEach((s, j) => {
      const sn = add({ id: `sub:${k.id}:${slugOf(s.n)}`, kind: "keystone", n: s.n, d: s.desc, ref: { t: "sub", cls: k.id, sub: s.id }, cls: k.id, ...P(R0 + 60, (j % 2 ? -1 : 1) * (150 + 60 * Math.floor(j / 2))) });
      link(start.id, sn.id);
      let sp = sn.id; s.feats.slice().sort((x, y) => (x.lv || 1) - (y.lv || 1)).forEach((f, q) => { const fn = add({ id: `sf:${k.id}:${slugOf(s.n)}:${slugOf(f.n)}`, kind: "minor", n: f.n, d: f.d, lv: f.lv || 1, ref: { t: "subfeat", cls: k.id, sub: s.id, n: f.n }, cls: k.id, x: sn.x + Math.round(ux * 120 * (q + 1)), y: sn.y + Math.round(uy * 120 * (q + 1)) }); link(sp, fn.id); sp = fn.id });
    });
    k.feats.slice().sort((x, y) => (x.lv || 1) - (y.lv || 1)).forEach(f => {
      r += STEP;
      const fn = add({ id: `f:${k.id}:${slugOf(f.n)}`, kind: f.opts ? "notable" : "minor", n: f.n, d: f.d, lv: f.lv || 1, ref: { t: "feat", cls: k.id, n: f.n }, cls: k.id, ...P(r) });
      link(prev, fn.id); prev = fn.id;
      /* a choice feature fans out into its options, on alternating sides */
      if (f.opts) {
        const m = f.opts.length, span = Math.min(Math.PI * 0.75, 0.22 * m), base = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        f.opts.forEach((o, q) => {
          const t = base + (m > 1 ? (q / (m - 1) - 0.5) * span : 0), rad = 150 + (q % 2) * 70;
          const dx = ux * Math.cos(t) * 0 + (Math.cos(a + t) * rad), dy = Math.sin(a + t) * rad;
          const on = add({ id: `o:${k.id}:${slugOf(f.n)}:${slugOf(o.n)}`, kind: "option", n: o.n, d: o.d, lv: f.lv || 1, ref: { t: "opt", cls: k.id, f: f.n, o: o.n }, cls: k.id, x: Math.round(fn.x + dx), y: Math.round(fn.y + dy) });
          link(fn.id, on.id);
        });
        side = -side; r += 60;
      }
      /* the Combat and Weapon Actions this feature teaches */
      const acts = actions.filter(e => lcs(plainText(e.req || "")).split(/\s*(?:,|\bor\b)\s*/).includes(lcs(f.n)));
      acts.forEach((e, q) => {
        const t = (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (acts.length > 1 ? (q / (acts.length - 1) - 0.5) * 1.1 : 0), rad = 130 + (q % 2) * 50;
        const an = add({ id: `a:${k.id}:${slugOf(e.n)}`, kind: "action", n: e.n, d: [e.lead, ...e.fx].join("\n\n"), ap: e.ap, sec: e.sec, lv: f.lv || 1, ref: { t: "action", cls: k.id, f: f.n }, cls: k.id, x: Math.round(fn.x + Math.cos(a + t) * rad), y: Math.round(fn.y + Math.sin(a + t) * rad) });
        link(fn.id, an.id);
      });
    });
    outer = Math.max(outer, r);
  });
  /* feats: an outer ring, a sector per category, each feat line running outward */
  const feats = FEAT_LIST.filter(f => f && f.n), RF = outer + 420;
  const par = new Map(feats.map(f => [f, treeFeatParents(f, feats)]));
  const depth = f => { const p = par.get(f) || []; return p.length ? 1 + Math.max(...p.map(depth)) : 0 };
  const roots = feats.filter(f => !(par.get(f) || []).length);
  const cats = [...new Set(feats.map(f => f.cat || "Other"))].sort((a, b) => ((FEAT_CAT_ORDER2.indexOf(a) + 99) % 99) - ((FEAT_CAT_ORDER2.indexOf(b) + 99) % 99) || a.localeCompare(b));
  const slots = cats.flatMap(c => [...roots.filter(f => (f.cat || "Other") === c).sort(byName), null]);
  const angOf = new Map();
  slots.forEach((f, i) => { if (f) angOf.set(f, -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / slots.length) });
  cats.forEach(c => { const l = slots.map((f, i) => f && (f.cat || "Other") === c ? i : -1).filter(i => i >= 0); if (!l.length) return; const a = -Math.PI / 2 + ((l[0] + l[l.length - 1]) / 2 + 0.5) * 2 * Math.PI / slots.length;
    add({ id: "fcat:" + slugOf(c), kind: "label", n: c + " feats", x: Math.round(Math.cos(a) * (RF - 150)), y: Math.round(Math.sin(a) * (RF - 150)) }) });
  const placed = new Map();
  const place = (f, a, d) => {
    if (placed.has(f)) return;
    const r = RF + d * 160, n = add({ id: "feat:" + (f.id || slugOf(f.n)), kind: "feat", n: f.n, d: f.desc, pre: f.pre, cat: f.cat, ref: { t: "featx", id: f.id }, x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) });
    placed.set(f, n);
    const kids = feats.filter(g => (par.get(g) || []).includes(f)).sort(byName);
    kids.forEach((g, i) => place(g, a + (kids.length > 1 ? (i / (kids.length - 1) - 0.5) * 0.12 : 0), d + 1));
  };
  roots.forEach(f => place(f, angOf.get(f) || 0, 0));
  feats.forEach(f => { if (!placed.has(f)) place(f, 0, depth(f)) });
  feats.forEach(f => (par.get(f) || []).forEach(g => { if (placed.has(g) && placed.has(f)) link(placed.get(g).id, placed.get(f).id) }));
  return { nodes, links };
}
/* the base tree with the admin's changes on top */
const sameLink = (l, a, b) => (l[0] === a && l[1] === b) || (l[0] === b && l[1] === a);
function fullTree() {
  const t = baseTree(), S = TREE_SAVED;
  const nodes = [...t.nodes, ...S.extra.map(n => ({ kind: "minor", d: "", ...n, custom: true }))].map(n => { const o = S.nodes[n.id]; return o ? { ...n, ...o, edited: true } : n });
  const byId = new Map(nodes.map(n => [n.id, n]));
  const links = [...t.links, ...S.links].filter((l, i, all) => byId.has(l[0]) && byId.has(l[1]) && !S.unlinks.some(u => sameLink(u, l[0], l[1])) && all.findIndex(m => sameLink(m, l[0], l[1])) === i);
  return { nodes: nodes.filter(n => !n.hide || treeEdit), links: links.filter(l => treeEdit || (!byId.get(l[0]).hide && !byId.get(l[1]).hide)), byId };
}

/* ---------------------------------------------------------------- what the character has on the tree */
function treeState(c, T) {
  const k = clsOf(c), st = new Map(); /* id -> "have" | "open" | "locked" | "" */
  T.nodes.forEach(n => {
    const r = n.ref || {}; let s = "";
    if (r.t === "class") s = c.cls === r.cls ? "have" : c.cls ? "" : "open";
    else if (k && r.cls === k.id) {
      if (r.t === "feat" || r.t === "action") s = (n.lv || 1) <= LEVEL ? "have" : "locked";
      else if (r.t === "opt") { const f = k.feats.find(x => x.n === r.f); if (!f || (f.lv || 1) > LEVEL) s = "locked"; else { const got = foptChosen(c, "class", f); s = got.includes(r.o) ? "have" : got.length < picksAt(f, LEVEL) ? "open" : "" } }
      else if (r.t === "sub") s = c.subcls === r.sub ? "have" : c.subcls ? "" : "open";
      else if (r.t === "subfeat") s = c.subcls === r.sub && (n.lv || 1) <= LEVEL ? "have" : "locked";
    } else if (r.t === "featx") s = "locked";
    st.set(n.id, s);
  });
  return st;
}
function treeNodeInfo(c, n, st) {
  const r = n.ref || {}, k = r.cls && CR.classes.find(x => x.id === r.cls);
  const kind = (KINDS.find(x => x[0] === n.kind) || ["", n.kind === "label" ? "Label" : "Node"])[1];
  const s = st.get(n.id), status = s === "have" ? "Yours" : s === "open" ? (r.t === "class" ? "Click to take this class" : r.t === "opt" ? "Click to choose this option" : "Click to take it") : s === "locked" ? (r.t === "featx" ? "Feats come from 2nd level" : `Unlocks at level ${n.lv || 1}`) : "";
  const facts = [k && r.t !== "class" ? ["Class", k.n] : null, n.lv && r.t !== "class" ? ["Level", n.lv] : null, n.ap ? ["AP cost", /^\d+$/.test(n.ap) ? n.ap + " AP" : n.ap] : null, n.pre ? ["Prerequisite", n.pre] : null, n.cat ? ["Category", n.cat] : null].filter(Boolean);
  return infoBox(n.n || "Node", kind, `${status ? `<p class="tvstatus ${s}">${esc(status)}</p>` : ""}${facts.length ? `<dl class="gfacts">${facts.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>` : ""}${n.d ? `<div class="clead">${paras(n.d)}</div>` : ""}`);
}

/* ---------------------------------------------------------------- the 3D viewer */
const TV = { px: 0, py: 0, zoom: 0.42, tilt: 0, rot: 0, focus: "" };
let treeEdit = false, treeSel = "", treeLinkFrom = "", treeHover = "", treeIcPick = false;
function treeHTML(c) {
  const T = fullTree(), st = treeState(c, T), W = 1;
  const xs = T.nodes.map(n => n.x), ys = T.nodes.map(n => n.y), ext = Math.max(400, ...xs.map(Math.abs), ...ys.map(Math.abs)) + 200;
  const path = T.links.map(([a, b]) => { const p = T.byId.get(a), q = T.byId.get(b); const on = st.get(a) === "have" && st.get(b) === "have"; return `<path class="${on ? "on" : st.get(b) === "open" || st.get(a) === "open" ? "open" : ""}" d="M${p.x + ext},${p.y + ext} L${q.x + ext},${q.y + ext}"/>` }).join("");
  const node = n => n.kind === "label" ? `<div class="tn tlabel" style="left:${n.x}px;top:${n.y}px" data-node="${esc(n.id)}"><span>${esc(n.n)}</span></div>`
    : `<button type="button" class="tn k-${esc(n.kind)} s-${st.get(n.id) || "none"}${n.id === treeSel ? " sel" : ""}${n.hide ? " hidden-node" : ""}${n.custom ? " custom" : ""}" style="left:${n.x}px;top:${n.y}px" data-node="${esc(n.id)}" aria-label="${esc(n.n)}"><i${n.ic && TREE_ICON.has(n.ic) ? ` class="hasic"` : ""}>${n.ic ? treeIconSVG(n.ic) : ""}</i><span>${esc(n.n)}</span></button>`;
  const ctl = `<div class="tvctl"><button type="button" data-tv="out" aria-label="Zoom out">−</button><button type="button" data-tv="in" aria-label="Zoom in">+</button><button type="button" data-tv="home">${clsOf(c) ? "My class" : "Center"}</button><label>Turn<input type="range" data-tvr="rot" min="-180" max="180" value="${TV.rot}"></label>` +
    (ADMIN ? (treeEdit ? `<span class="tvedit">Editing</span><button type="button" data-tv="addnode">Add a node</button><button type="button" data-tv="save"${treeDirty() ? "" : " disabled"}>Save tree</button><button type="button" data-tv="discard"${treeDirty() ? "" : " disabled"}>Discard</button><button type="button" data-tv="done">Done editing</button>` : `<button type="button" data-tv="edit">Edit tree</button>`) : "") + `</div>`;
  const legend = `<div class="tvlegend"><span class="lg have">Yours</span><span class="lg open">Can take</span><span class="lg locked">Higher level</span></div>`;
  return `<div class="tv${treeEdit ? " editing" : ""}" id="tv" tabindex="0" aria-label="Skill tree. Drag to move, scroll to zoom, Alt-drag to turn."><div class="tvstage"><div class="tvplane" id="tvplane"><svg class="tvlinks" width="${ext * 2}" height="${ext * 2}" style="left:${-ext}px;top:${-ext}px">${path}</svg>${T.nodes.map(node).join("")}</div></div>${ctl}${legend}${treeEdit && treeLinkFrom ? `<p class="tvhint">Click the node to link <b>${esc((T.byId.get(treeLinkFrom) || {}).n || "")}</b> to. Press Esc to stop.</p>` : ""}</div>`;
}
function applyView() {
  const p = $("tvplane"); if (!p) return;
  p.style.setProperty("--tilt", TV.tilt + "deg"); p.style.setProperty("--rot", TV.rot + "deg");
  p.style.transform = `translate(${TV.px}px,${TV.py}px) rotateX(${TV.tilt}deg) rotateZ(${TV.rot}deg) scale3d(${TV.zoom},${TV.zoom},${TV.zoom})`;
  $("tv").classList.toggle("far", TV.zoom < 0.38);
}
function centerOn(id) {
  const T = fullTree(), n = T.byId.get(id); if (!n) { TV.px = 0; TV.py = 0; return }
  /* move the plane so the node sits in the middle (the turn is applied first, so turn the point too) */
  const a = TV.rot * Math.PI / 180, x = n.x * Math.cos(a) - n.y * Math.sin(a), y = n.x * Math.sin(a) + n.y * Math.cos(a);
  TV.px = -x * TV.zoom; TV.py = -y * TV.zoom * Math.cos(TV.tilt * Math.PI / 180);
}
/* the Class step in Tree mode */
function treeStep(c) {
  const k = clsOf(c);
  infoMap.set("tree:intro", infoBox("Skill tree", "Tree mode", `<p>Your class's features run outward from its start node, by level. <b>Click a class's start node</b> to take that class.</p><p>Choice features fan out into their options: click an option to choose it. The Combat and Weapon Actions a feature teaches hang off it. Feats sit on the outer ring, by category; they come from 2nd level.</p><p>Drag to move around, scroll to zoom, and Alt-drag (or the Turn slider) to turn it. Click a node to keep its details here; click it again to let go.</p>`));
  infoDefault = infoMap.get("tree:intro");
  return `<div class="cctreehost">${treeHTML(c)}</div>${k ? schoolPicks(c, k) : ""}`;
}
function treeAfterRender(c) {
  if (!$("tv")) return;
  if (!TV.focus) { TV.focus = "x"; if (clsOf(c)) centerOn("cls:" + clsOf(c).id) }
  applyView();
  if (treeEdit && treeSel) { const T = fullTree(); if (T.byId.get(treeSel)) $("ccinfo").innerHTML = treeEditForm(T.byId.get(treeSel), T) }
  else if (treeHover || treeSel) { const T = fullTree(), n = T.byId.get(treeSel || treeHover); if (n) $("ccinfo").innerHTML = treeNodeInfo(c, n, treeState(c, T)) }
}
/* clicking a node: take the class, choose the option, or (editing) select it */
function treePick(c, id) {
  const T = fullTree(), n = T.byId.get(id); if (!n || n.kind === "label") return;
  if (treeEdit) {
    if (treeLinkFrom && treeLinkFrom !== id) { const a = treeLinkFrom; TREE_SAVED.unlinks = TREE_SAVED.unlinks.filter(u => !sameLink(u, a, id)); if (!T.links.some(l => sameLink(l, a, id))) TREE_SAVED.links.push([a, id]); treeLinkFrom = ""; treeSel = id; renderCreate(); return }
    treeSel = treeSel === id ? "" : id; treeLinkFrom = ""; treeIcPick = false; renderCreate(); return;
  }
  const r = n.ref || {}, st = treeState(c, T).get(id);
  if (r.t === "class") { const was = c.cls === r.cls; if (!was) { TV.zoom = Math.max(TV.zoom, 0.7); TV.focus = "" } c.cls = was ? "" : r.cls; c.subcls = ""; c.spells = []; c.spellUp = {}; c.major = ""; c.minor = ""; c.fopt = {}; c.moneyRoll = null; setLoadout(c, ""); treeSel = was ? "" : id; touch(); renderCreate(); return }
  if (r.t === "sub" && (st === "open" || st === "have")) { c.subcls = st === "have" ? "" : r.sub; treeSel = id; touch(); renderCreate(); return }
  if (r.t === "opt" && (st === "open" || st === "have")) {
    const k = clsOf(c), f = k && k.feats.find(x => x.n === r.f); if (!f) return;
    const key = foptKey("class", f), got = foptChosen(c, "class", f);
    c.fopt[key] = got.includes(r.o) ? got.filter(x => x !== r.o) : [...got, r.o].slice(-picksAt(f, LEVEL));
    treeSel = id; touch(); renderCreate(); return;
  }
  treeSel = treeSel === id ? "" : id; renderCreate();
}

/* ---------------------------------------------------------------- editing the tree (admin) */
const nodeOv = id => (TREE_SAVED.nodes[id] = TREE_SAVED.nodes[id] || {});
function treeEditForm(n, T) {
  const linked = T.links.filter(l => l[0] === n.id || l[1] === n.id).map(l => l[0] === n.id ? l[1] : l[0]).map(id => T.byId.get(id)).filter(Boolean);
  return infoBox(n.n || "Node", n.custom ? "Your node" : n.edited ? "Changed" : "From the data", `<div class="tvform" data-node="${esc(n.id)}">
<label>Name<input type="text" data-te="n" value="${esc(n.n || "")}" autocomplete="off"></label>
<label>Description<textarea data-te="d" rows="6">${esc(n.d || "")}</textarea></label>
<label>Look<select data-te="kind">${KINDS.map(([v, l]) => `<option value="${v}"${v === n.kind ? " selected" : ""}>${l}</option>`).join("")}${n.kind === "label" ? `<option value="label" selected>Label</option>` : ""}</select></label>
<div class="tvic"><b>Icon</b><div class="tvicnow">${n.ic && TREE_ICON.has(n.ic) ? `<span class="tvicsw">${treeIconSVG(n.ic)}</span>${esc(TREE_ICON.get(n.ic)[1])}` : `<small>No icon</small>`}<button type="button" class="btn" data-te-icopen>${treeIcPick ? "Close icons" : n.ic ? "Change icon" : "Choose an icon"}</button>${n.ic ? `<button type="button" class="btn" data-te-ic="">Remove</button>` : ""}</div>${treeIcPick ? `<div class="tvicgrid">${TREE_ICONS.map(x => `<button type="button" data-te-ic="${x[0]}" title="${esc(x[1])} (${esc(x[2])})" aria-label="${esc(x[1])}"${x[0] === n.ic ? ` aria-pressed="true"` : ""}>${treeIconSVG(x[0])}</button>`).join("")}</div>` : ""}</div>
<label class="chk"><input type="checkbox" data-te="hide"${n.hide ? " checked" : ""}> Hide this node</label>
<p class="tvxy">Position ${Math.round(n.x)}, ${Math.round(n.y)}. Drag the node to move it.</p>
<div class="tvlinkl"><b>Linked to</b>${linked.map(m => `<span>${esc(m.n)}<button type="button" data-te-unlink="${esc(m.id)}" aria-label="Unlink ${esc(m.n)}">×</button></span>`).join("") || `<small>Nothing</small>`}</div>
<div class="tvbtns"><button type="button" class="btn" data-te-act="link">Link to another node</button><button type="button" class="btn" data-te-act="branch">Add a node branching from this</button>${n.custom ? `<button type="button" class="btn gdel" data-te-act="delete">Delete node</button>` : n.edited ? `<button type="button" class="btn" data-te-act="reset">Undo my changes to it</button>` : ""}</div>
<p class="ccnote">Nodes from the data change when the class, feature or feat changes. Your changes (position, name, description, look, icon, hiding, links) are kept on top. Click Save tree to keep them.</p></div>`);
}
function treeEditInput(t) {
  const f = t.closest(".tvform"); if (!f) return;
  const id = f.dataset.node, k = t.dataset.te, ex = TREE_SAVED.extra.find(x => x.id === id), tgt = ex || nodeOv(id);
  tgt[k] = t.type === "checkbox" ? t.checked : t.value;
  if (k === "kind" || k === "hide") renderCreate(); else { const b = $("tv"); if (b) { const el = b.querySelector(`[data-node="${CSS.escape(id)}"] span`); if (el && k === "n") el.textContent = t.value } refreshTreeBtns() }
}
function refreshTreeBtns() { document.querySelectorAll('[data-tv="save"],[data-tv="discard"]').forEach(b => { b.disabled = !treeDirty() }) }
function treeEditAct(c, act, id) {
  const T = fullTree(), n = T.byId.get(id);
  if (act === "link") { treeLinkFrom = id; renderCreate(); return }
  if (act === "unlink") { const [a, b] = id; TREE_SAVED.links = TREE_SAVED.links.filter(l => !sameLink(l, a, b)); if (T.links.some(l => sameLink(l, a, b))) TREE_SAVED.unlinks.push([a, b]); renderCreate(); return }
  if (act === "branch" || act === "addnode") {
    const nid = "x-" + Date.now().toString(36), at = n || { x: -TV.px / TV.zoom, y: -TV.py / TV.zoom };
    TREE_SAVED.extra.push({ id: nid, n: "New node", d: "", kind: "minor", x: Math.round(at.x + (n ? 120 : 0)), y: Math.round(at.y + (n ? 60 : 0)) });
    if (n) TREE_SAVED.links.push([n.id, nid]);
    treeSel = nid; renderCreate(); const i = document.querySelector('.tvform [data-te="n"]'); if (i) { i.focus(); i.select() } return;
  }
  if (act === "delete") { TREE_SAVED.extra = TREE_SAVED.extra.filter(x => x.id !== id); TREE_SAVED.links = TREE_SAVED.links.filter(l => l[0] !== id && l[1] !== id); delete TREE_SAVED.nodes[id]; treeSel = ""; renderCreate(); return }
  if (act === "reset") { delete TREE_SAVED.nodes[id]; renderCreate(); return }
}
async function saveTree() {
  if (!ADMIN || !GH_KEY) { say("Sign in as admin to save the tree."); return }
  const data = { v: 1, nodes: TREE_SAVED.nodes, extra: TREE_SAVED.extra, links: TREE_SAVED.links, unlinks: TREE_SAVED.unlinks };
  say("Saving the skill tree…");
  try { await putFile("crawl-tree.json", JSON.stringify(data, null, 1) + "\n", "Update the skill tree from the Character Creator"); TREE_ORIG = JSON.stringify(TREE_SAVED); say("Skill tree saved. Everyone sees it in about a minute."); renderCreate() }
  catch (x) { say(saveError(x && x.code, "skill tree")) }
}

/* ---------------------------------------------------------------- events: pan, zoom, turn, pick, edit */
(() => {
  let drag = null;
  const main = $("ccmain");
  main.addEventListener("pointerdown", ev => {
    const tv = ev.target.closest("#tv"); if (!tv || ev.target.closest(".tvctl,.tvlegend")) return;
    const nodeEl = ev.target.closest(".tn[data-node]");
    drag = { x: ev.clientX, y: ev.clientY, moved: 0, turn: ev.altKey || ev.button === 2, node: treeEdit && nodeEl ? nodeEl.dataset.node : "", pick: nodeEl ? nodeEl.dataset.node : "" };
    tv.setPointerCapture(ev.pointerId);
  });
  main.addEventListener("pointermove", ev => {
    const tv = $("tv"); if (!tv) return;
    if (!drag) { const n = ev.target.closest(".tn[data-node]"); const id = n ? n.dataset.node : ""; if (id !== treeHover && !treeSel && !treeEdit) { treeHover = id; if (id) { const T = fullTree(), nd = T.byId.get(id); if (nd && nd.kind !== "label") $("ccinfo").innerHTML = treeNodeInfo(cur, nd, treeState(cur, T)) } } return }
    const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (drag.node && drag.moved > 3) {
      const T = fullTree(), n = T.byId.get(drag.node), ex = TREE_SAVED.extra.find(x => x.id === drag.node), tgt = ex || nodeOv(drag.node);
      tgt.x = Math.round((tgt.x ?? n.x) + dx / TV.zoom); tgt.y = Math.round((tgt.y ?? n.y) + dy / TV.zoom);
      const el = tv.querySelector(`.tn[data-node="${CSS.escape(drag.node)}"]`); if (el) { el.style.left = tgt.x + "px"; el.style.top = tgt.y + "px" }
      return;
    }
    if (drag.turn) { TV.rot = Math.max(-180, Math.min(180, TV.rot + dx * 0.3)); syncSliders() }
    else { TV.px += dx; TV.py += dy }
    applyView();
  });
  const end = ev => {
    if (!drag) return; const d = drag; drag = null;
    if (d.node && d.moved > 3) { renderCreate(); return }
    if (d.moved <= 4 && d.pick) treePick(cur, d.pick);
  };
  main.addEventListener("pointerup", end);
  main.addEventListener("pointercancel", () => { drag = null });
  main.addEventListener("contextmenu", ev => { if (ev.target.closest("#tv")) ev.preventDefault() });
  main.addEventListener("wheel", ev => {
    const tv = ev.target.closest("#tv"); if (!tv) return; ev.preventDefault();
    const box = tv.getBoundingClientRect(), mx = ev.clientX - box.left - box.width / 2, my = ev.clientY - box.top - box.height / 2;
    const z = Math.max(0.15, Math.min(2.5, TV.zoom * Math.exp(-ev.deltaY * 0.0015))), k = z / TV.zoom;
    TV.px = mx - (mx - TV.px) * k; TV.py = my - (my - TV.py) * k; TV.zoom = z; applyView();
  }, { passive: false });
  const syncSliders = () => { document.querySelectorAll("[data-tvr]").forEach(s => { s.value = TV[s.dataset.tvr] }) };
  main.addEventListener("input", ev => {
    const s = ev.target.closest("[data-tvr]"); if (s) { TV[s.dataset.tvr] = +s.value; applyView(); return }
    if (ev.target.closest(".tvform")) treeEditInput(ev.target);
  });
  main.addEventListener("click", ev => {
    const b = ev.target.closest("[data-tv]"); if (!b) return; const c = cur, a = b.dataset.tv;
    if (a === "in" || a === "out") { TV.zoom = Math.max(0.15, Math.min(2.5, TV.zoom * (a === "in" ? 1.25 : 0.8))); TV.px *= a === "in" ? 1.25 : 0.8; TV.py *= a === "in" ? 1.25 : 0.8; applyView(); return }
    if (a === "home") { TV.zoom = 0.6; TV.tilt = 0; TV.rot = 0; syncSliders(); centerOn(clsOf(c) ? "cls:" + clsOf(c).id : ""); applyView(); return }
    if (a === "edit") { treeEdit = true; TV.tilt = 0; TV.rot = 0; treeSel = ""; renderCreate(); say("Editing the skill tree: drag nodes to move them, click one to change it."); return }
    if (a === "done") { if (treeDirty()) { say("Save or discard your tree changes first."); return } treeEdit = false; treeSel = ""; treeLinkFrom = ""; TV.tilt = 0; renderCreate(); say(""); return }
    if (a === "discard") { TREE_SAVED = normTree(JSON.parse(TREE_ORIG)); treeSel = ""; treeLinkFrom = ""; renderCreate(); say("Tree changes discarded."); return }
    if (a === "save") { saveTree(); return }
    if (a === "addnode") { treeEditAct(c, "addnode", ""); return }
  });
  /* the edit form lives in the info panel */
  $("ccinfo").addEventListener("input", ev => { if (ev.target.closest(".tvform")) treeEditInput(ev.target) });
  $("ccinfo").addEventListener("change", ev => { if (ev.target.closest(".tvform") && ev.target.matches("select,[type=checkbox]")) treeEditInput(ev.target) });
  $("ccinfo").addEventListener("click", ev => {
    const f = ev.target.closest(".tvform"); if (!f) return;
    if (ev.target.closest("[data-te-icopen]")) { treeIcPick = !treeIcPick; renderCreate(); return }
    const ic = ev.target.closest("[data-te-ic]"); if (ic) { const id = f.dataset.node, ex = TREE_SAVED.extra.find(x => x.id === id), tgt = ex || nodeOv(id); if (ic.dataset.teIc) tgt.ic = ic.dataset.teIc; else delete tgt.ic; treeIcPick = false; renderCreate(); return }
    const u = ev.target.closest("[data-te-unlink]"); if (u) { treeEditAct(cur, "unlink", [f.dataset.node, u.dataset.teUnlink]); return }
    const b = ev.target.closest("[data-te-act]"); if (b) treeEditAct(cur, b.dataset.teAct, f.dataset.node);
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && treeLinkFrom) { treeLinkFrom = ""; renderCreate() } });
  window.addEventListener("crawl-tree-mode", () => { if (view === "create") { treeSel = ""; treeHover = ""; renderCreate() } });
  window.addEventListener("beforeunload", ev => { if (treeDirty()) { ev.preventDefault(); ev.returnValue = "" } });
})();
