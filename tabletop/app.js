/* Crawl Tabletop: a Roll20-style virtual tabletop for Crawl 1st Edition.
   Game data (games/<id>/...):
     meta      {name, gm, gms:{uid:true}, created, playerPage, fps}
     players   {uid: {name, color, online}}
     pages     {pid: {name, w, h, grid, gridOn, fog, order}}      maps/{pid}: image (data URL)
     tokens    {pid: {tid: {x, y, s, name, img, color, layer, char, hp, hpMax, conds, ctrl, shape, showName}}}
     draw      {pid: {did: {k, pts | x y w h, txt, c, w, layer, by}}}
     fog       {pid: {oid: {m: "r"|"h", x, y, w, h, n}}}
     chars     {cid: {owner, hidden, snap, live: {hp, tmp, ap, mp, ep, conds, notes, inv}}}
     handouts  {hid: {title, body, img, shown}}
     turn      {round, cur, list: [{id, name, init, tok}]}
     chat      {key: {uid, name, color, t, text, roll, to, ts}} */
import { LocalNet, FirebaseNet, newId, kvGet, kvSet } from "./net.js";
import { roll, diceIn } from "./dice.js";
import * as content from "./content.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const arr = x => Array.isArray(x) ? x : x && typeof x === "object" ? Object.values(x) : [];
const str = x => String(x ?? "").trim();
const lcs = x => String(x || "").toLowerCase();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sign = n => (n >= 0 ? "+" : "−") + Math.abs(n);
const initials = n => str(n).split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase() || "?";
/* Crawl text: [color=#hex]…[/color], [link=…]…[/link], blank lines between paragraphs, [table]…[/table] */
function rich(t) { return esc(t).replace(/\[color=(#[0-9a-f]{3,8})\]([\s\S]*?)\[\/color\]/gi, (m, c, x) => `<span class="tc" style="--c:${c}">${x}</span>`).replace(/\[link=[^\]]*\]([\s\S]*?)\[\/link\]/gi, "$1").replace(/\n/g, "<br>") }
function blocks(t) {
  const tabs = []; t = String(t || "").replace(/\[table\]([\s\S]*?)\[\/table\]/gi, (m, x) => { tabs.push(x); return `\n\n\u0001${tabs.length - 1}\u0001\n\n` });
  return t.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^\u0001(\d+)\u0001$/); if (!m) return `<p>${rich(x)}</p>`; const rows = tabs[+m[1]].split("\n").map(r => r.trim()).filter(Boolean).map(r => r.split(r.includes("|") ? "|" : /\t+/).map(c => c.trim())); return `<table class="rtable">${rows.map((r, i) => `<tr>${r.map(c => i ? `<td>${rich(c)}</td>` : `<th>${rich(c)}</th>`).join("")}</tr>`).join("")}</table>` }).join("");
}
const plain = t => String(t || "").replace(/\[\/?(?:color|link|table)[^\]]*\]/gi, "");

/* ---------------------------------------------------------------- state */
let net = null, MAT = { data: {}, meta: {} }, freshMat = null;
const me = { uid: "", name: "", color: "#c0262d" };
const G = { id: "", meta: {}, players: {}, pages: {}, chars: {}, handouts: {}, turn: null, chat: {} };
let pid = "", page = {}, mapImg = "", tokens = {}, drawings = {}, fogOps = {};
let subs = [], pageSubs = [];
let V = { x: 0, y: 0, z: 1 };
let tool = "select", drawKind = "pen", drawColor = "#ff6b6b", fogMode = "reveal", layer = "token";
let selected = new Set();
const isGM = () => !!(G.meta && (G.meta.gm === me.uid || (G.meta.gms || {})[me.uid]));
const GRID = () => +page.grid || 70;
const FPS = () => +G.meta.fps || 5;

function toast(m, ms = 2600) { const t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true }, ms) }
function prefs() { try { return JSON.parse(localStorage.getItem("tt-me") || "{}") } catch (e) { return {} } }
function savePrefs() { try { localStorage.setItem("tt-me", JSON.stringify({ name: me.name, color: me.color })) } catch (e) { } }
function myGames() { try { return JSON.parse(localStorage.getItem("tt-games") || "[]") } catch (e) { return [] } }
function rememberGame(g) { const list = myGames().filter(x => x.id !== g.id); list.unshift({ ...g, last: Date.now() }); try { localStorage.setItem("tt-games", JSON.stringify(list.slice(0, 30))) } catch (e) { } }
function forgetGame(id) { try { localStorage.setItem("tt-games", JSON.stringify(myGames().filter(x => x.id !== id))) } catch (e) { } }
const rid = (n = 8) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("") };

/* ---------------------------------------------------------------- online setup: tabletop/config.json, or pasted in Settings, or carried in an invite link */
const b64e = s => btoa(unescape(encodeURIComponent(s))).replace(/=+$/, "");
const b64d = s => decodeURIComponent(escape(atob(s)));
async function loadConfig() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get("c")) { try { const c = JSON.parse(b64d(h.get("c"))); if (c.apiKey && c.databaseURL) localStorage.setItem("tt-fb", JSON.stringify(c)) } catch (e) { } }
  try { const r = await fetch("config.json", { cache: "no-cache" }); if (r.ok) { const c = await r.json(); if (c && c.apiKey && c.databaseURL) return { cfg: c, from: "site" } } } catch (e) { }
  try { const c = JSON.parse(localStorage.getItem("tt-fb") || "null"); if (c && c.apiKey && c.databaseURL) return { cfg: c, from: "local" } } catch (e) { }
  return null;
}
let CFG = null;
function inviteLink() {
  const u = new URL(location.href); u.search = ""; u.hash = "g=" + G.id + "&i=" + (G.meta.invite || "") + (CFG && CFG.from === "local" ? "&c=" + b64e(JSON.stringify(CFG.cfg)) : "");
  return u.href;
}

/* ---------------------------------------------------------------- boot and lobby */
async function boot() {
  const p = prefs(); me.name = p.name || ""; me.color = p.color || "#c0262d";
  $("meName").value = me.name; $("meColor").value = me.color;
  CFG = await loadConfig();
  net = CFG ? new FirebaseNet(CFG.cfg) : new LocalNet();
  try { me.uid = await net.init() } catch (e) {
    console.error(e); net = new LocalNet(); me.uid = await net.init(); CFG = null;
    toast("Couldn't reach the online service, so this game runs on this computer only.", 5000);
  }
  lobbyMode(); renderMyGames(); lobbyAccess();
  MAT = await content.loadLocal(); materials();
  const h = new URLSearchParams(location.hash.slice(1)), g = h.get("g");
  if (g) { invite = { id: g.replace(/[^a-z0-9]/gi, ""), key: h.get("i") || "" }; lobbyAccess(); if (me.name) joinGame(invite.id, invite.key) }
}
/* ---------------------------------------------------------------- admin lock: only the site admin can make games for now; everyone else needs an invite link */
let invite = null;
function isAdmin() { try { return localStorage.getItem("tt-admin") === "1" || !!sessionStorage.getItem("crawl-admin-key") } catch (e) { return false } }
function lobbyAccess() {
  const adm = isAdmin(), mine = myGames().length > 0;
  $("lobStart").hidden = !adm; $("lobLock").hidden = adm || !!invite; $("lobInvite").hidden = !invite;
  $("lobMode").hidden = !adm;
  $("lobGames").hidden = !adm && !mine; $("lobMat").hidden = !adm; $("admOut").hidden = !adm;
  if (invite) $("invName").textContent = "a game";
}
async function adminSignIn() {
  const pass = $("admPass").value; if (!pass) { $("admPass").focus(); return }
  $("admGo").disabled = true; $("admGo").textContent = "Checking…"; $("lobErr").textContent = "";
  try {
    let box = null;
    for (const u of [new URL("../admin.json", location.href).href, content.SITE + "admin.json"]) { try { const r = await fetch(u, { cache: "no-store" }); if (r.ok) { box = await r.json(); break } } catch (e) { } }
    if (!box || !box.data) throw new Error("Couldn't reach the Crawl website to check the password.");
    const unb = x => Uint8Array.from(atob(x), c => c.charCodeAt(0));
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    const k = await crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: unb(box.salt), iterations: box.iterations || 600000 }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    try { await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb(box.iv) }, k, unb(box.data)) } catch (e) { throw new Error("That password isn't right.") }
    localStorage.setItem("tt-admin", "1"); $("admPass").value = ""; lobbyAccess(); toast("Signed in as admin.");
  } catch (e) { $("lobErr").textContent = e.message }
  $("admGo").disabled = false; $("admGo").textContent = "Sign in";
}
$("admGo").addEventListener("click", adminSignIn);
$("admPass").addEventListener("keydown", ev => { if (ev.key === "Enter") adminSignIn() });
$("admOutA").addEventListener("click", ev => { ev.preventDefault(); try { localStorage.removeItem("tt-admin"); sessionStorage.removeItem("crawl-admin-key") } catch (e) { } lobbyAccess(); toast("Signed out of admin.") });
$("invJoin").addEventListener("click", () => { if (needName() && invite) joinGame(invite.id, invite.key) });
function lobbyMode() {
  $("lobMode").innerHTML = net.kind === "online"
    ? `<span class="chip online">Online</span> Players join from their own devices with your invite link.`
    : `<span class="chip local">This computer</span> Games are saved in this browser, and every tab you open joins the same table. To play online, set up online play (see <a href="https://github.com/brodywoe-svg/crawl-1st-edition/blob/main/tabletop/SETUP.md" target="_blank" rel="noopener">Online play setup</a>), then paste the settings under Settings in a game.`;
}
function renderMyGames() {
  const list = myGames();
  $("myGames").innerHTML = list.length ? list.map(g => `<div class="gamerow"><b>${esc(g.name || g.id)}</b><small>${g.gm ? "GM" : "Player"} · ${esc(g.mode === "online" ? "online" : "this computer")}</small><button type="button" class="btn small" data-open="${esc(g.id)}">Open</button><button type="button" class="btn small" data-forget="${esc(g.id)}" title="Remove from this list">×</button></div>`).join("")
    : `<p class="muted">Games you make or join show here.</p>`;
}
$("myGames").addEventListener("click", ev => {
  const o = ev.target.closest("[data-open]"); if (o) { const g = myGames().find(x => x.id === o.dataset.open); joinGame(o.dataset.open, g && g.key); return }
  const f = ev.target.closest("[data-forget]"); if (f) { forgetGame(f.dataset.forget); renderMyGames() }
});
$("meName").addEventListener("input", () => { me.name = $("meName").value.trim(); savePrefs() });
$("meColor").addEventListener("input", () => { me.color = $("meColor").value; savePrefs() });
function needName() { if (me.name) return true; $("lobErr").textContent = "Put in your name first."; $("meName").focus(); return false }
$("newGame").addEventListener("click", async () => {
  if (!needName()) return;
  if (!isAdmin()) { $("lobErr").textContent = "Only the admin can make games for now."; return }
  const id = rid(10), first = newId("p"), name = $("newName").value.trim() || "New game";
  await net.join(id);
  await net.set("meta", { name, gm: me.uid, created: Date.now(), playerPage: first, fps: 5, invite: rid(12) });
  await net.set("pages/" + first, { name: "Start", w: 25, h: 18, grid: 70, gridOn: true, fog: false, order: 1 });
  await net.push("chat", { t: "sys", text: `${me.name} made the game.`, ts: Date.now() });
  rememberGame({ id, name, gm: true, mode: net.kind });
  joinGame(id);
});
async function joinGame(id, key) {
  if (!me.name) { $("lobErr").textContent = "Put in your name, then click Join."; $("meName").focus(); return }
  try {
    if (!(await net.exists(id))) { $("lobErr").textContent = net.kind === "online" ? "That invite link doesn't lead to a game. Ask your GM for a new one." : "That game isn't on this computer. Games on other devices need online play to be set up."; return }
  } catch (e) { $("lobErr").textContent = "Couldn't reach the game. Check your connection."; return }
  leaveGame(true);
  await net.join(id);
  /* only the GM, players already in the game, or someone holding the current invite link may come in */
  let meta = {}, been = null;
  try { meta = (await net.get("meta")) || {}; been = await net.get("players/" + me.uid) } catch (e) { }
  const gmHere = meta.gm === me.uid || !!(meta.gms || {})[me.uid];
  if (!gmHere && !been && !(key && meta.invite && key === meta.invite)) { forgetGame(id); renderMyGames(); $("lobErr").textContent = "That invite link isn't valid anymore. Ask your GM to send you a new one."; return }
  if (gmHere && !meta.invite) await net.update("meta", { invite: rid(12) });
  invite = null; lobbyAccess();
  G.id = id;
  history.replaceState(null, "", "#g=" + id);
  await net.update("players/" + me.uid, { name: me.name, color: me.color, online: true });
  net.presence({ name: me.name, color: me.color });
  subs.push(net.on("meta", v => { G.meta = v || {}; $("gameName").textContent = G.meta.name || ""; rememberGame({ id, name: G.meta.name, gm: isGM(), mode: net.kind, key: G.meta.invite || key || "" }); renderTools(); renderPages(); choosePage(); renderPlayers(); if (curTab === "settings") renderSettings(); renderJournal() }));
  subs.push(net.on("players", v => { G.players = v || {}; renderPlayers(); if (curTab === "settings") renderSettings(); fillChatAs() }));
  subs.push(net.on("pages", v => { G.pages = v || {}; renderPages(); choosePage(); if (G.pages[pid]) { page = G.pages[pid]; renderPage() } }));
  subs.push(net.on("chars", v => { G.chars = v || {}; renderJournal(); refreshWins(); renderTokens(); fillChatAs() }));
  subs.push(net.on("handouts", v => { G.handouts = v || {}; renderJournal(); refreshWins() }));
  subs.push(net.on("turn", v => { G.turn = v; renderTurn(); renderTokens() }));
  subs.push(net.on("chat", v => { G.chat = v || {}; renderChat() }, { last: 200 }));
  subs.push(net.on("ping", showPing));
  $("lobby").hidden = true; $("game").hidden = false; $("modeChip").className = "chip " + net.kind; $("modeChip").textContent = net.kind === "online" ? "Online" : "This computer";
  renderDiceBar(); showTab("chat");
  if (freshMat && freshMat.changes.length && MAT.meta && Object.keys(MAT.meta).length) updateBanner();
}
function leaveGame(quiet) {
  subs.forEach(u => { try { u() } catch (e) { } }); subs = []; pageSubs.forEach(u => { try { u() } catch (e) { } }); pageSubs = [];
  if (G.id && me.uid && !quiet) net.update("players/" + me.uid, { online: false });
  Object.assign(G, { id: "", meta: {}, players: {}, pages: {}, chars: {}, handouts: {}, turn: null, chat: {} }); pid = ""; page = {};
  $("wins").innerHTML = ""; closeCtx();
}
$("leaveGame").addEventListener("click", () => { leaveGame(); history.replaceState(null, "", location.pathname); $("game").hidden = true; $("lobby").hidden = false; renderMyGames(); lobbyAccess() });
window.addEventListener("beforeunload", () => { if (G.id && me.uid && net.kind === "local") net.update("players/" + me.uid, { online: false }) });

/* ---------------------------------------------------------------- Crawl materials from the website */
async function materials() {
  const has = Object.values(MAT.data).some(Boolean);
  $("matStatus").textContent = has ? `You have the Crawl materials${MAT.meta.races ? ", last downloaded " + new Date(Math.max(...Object.values(MAT.meta).map(m => m.at || 0))).toLocaleString() : ""}. Checking the website for updates…` : "Downloading the Crawl materials from the website…";
  let res; try { res = await content.check() } catch (e) { res = { reachable: false, changes: [] } }
  freshMat = res;
  if (!res.reachable) { $("matStatus").textContent = has ? "Couldn't reach the Crawl website, so you're using the materials you already have." : "Couldn't reach the Crawl website. Connect to the internet and click Check for updates."; return }
  if (!has) { MAT = await content.download(res.fresh, Object.keys(res.fresh)); freshMat.changes = []; $("matStatus").textContent = "Crawl materials downloaded: races, classes, backgrounds, spells, items and the glossary."; $("matChanges").innerHTML = ""; $("matGet").hidden = true; return }
  if (!res.changes.length) { $("matStatus").textContent = "Your Crawl materials are up to date."; $("matChanges").innerHTML = ""; $("matGet").hidden = true; return }
  $("matStatus").textContent = "The Crawl website has updated materials:";
  $("matChanges").innerHTML = changesHTML(res.changes); $("matGet").hidden = false;
  if (G.id) updateBanner();
}
function changesHTML(ch) {
  const list = (a, w) => a.length ? `${w} ${a.slice(0, 6).map(esc).join(", ")}${a.length > 6 ? ` and ${a.length - 6} more` : ""}` : "";
  return ch.map(c => `<p class="chg"><b>${esc(c.label)}</b>: ${[list(c.added, "new:"), list(c.removed, "removed:")].filter(Boolean).join("; ") || "details changed"}</p>`).join("");
}
async function getUpdate() { if (!freshMat) return; MAT = await content.download(freshMat.fresh, Object.keys(freshMat.fresh)); freshMat.changes = []; $("matStatus").textContent = "Updated. You have the latest Crawl materials."; $("matChanges").innerHTML = ""; $("matGet").hidden = true; document.querySelectorAll(".updbar").forEach(x => x.remove()); toast("Crawl materials updated."); if (curTab === "comp") renderComp(); refreshWins() }
$("matGet").addEventListener("click", getUpdate);
$("matCheck").addEventListener("click", materials);
function updateBanner() {
  if (document.querySelector(".updbar")) return;
  const b = document.createElement("div"); b.className = "updbar"; b.setAttribute("role", "status");
  b.innerHTML = `<span>Updated Crawl materials are on the website.</span><button type="button" class="btn small" data-a="see">See what's new</button><button type="button" class="btn small solid" data-a="get">Download</button><button type="button" class="btn small" data-a="later">Later</button>`;
  b.addEventListener("click", ev => { const a = ev.target.closest("[data-a]"); if (!a) return; if (a.dataset.a === "get") getUpdate(); if (a.dataset.a === "see") openWin("upd", "What's new", `<div>${changesHTML(freshMat.changes)}</div><button type="button" class="btn solid" data-act="getupd">Download update</button>`, { w: 420 }); b.remove() });
  document.body.appendChild(b);
}

/* ---------------------------------------------------------------- pages (Roll20's page toolbar) */
const pagesSorted = () => Object.entries(G.pages).sort((a, b) => (a[1].order || 0) - (b[1].order || 0));
function choosePage() {
  const want = isGM() ? (G.pages[pid] ? pid : G.meta.playerPage) : G.meta.playerPage;
  const ok = want && G.pages[want] ? want : (pagesSorted()[0] || [])[0];
  if (ok && ok !== pid) viewPage(ok);
}
function renderPages() {
  if (!isGM()) { const p = G.pages[G.meta.playerPage]; $("pages").innerHTML = p ? `<span class="pg on">${esc(p.name)}</span>` : ""; return }
  $("pages").innerHTML = pagesSorted().map(([id, p]) => `<span class="pg${id === pid ? " on" : ""}" data-pg="${esc(id)}" title="Open this page">${esc(p.name || "Page")}${G.meta.playerPage === id ? `<span class="pl" title="Players are here">Players</span>` : ""}<button type="button" data-pgset="${esc(id)}" title="Page settings" aria-label="Settings for ${esc(p.name)}">⚙</button></span>`).join("") +
    `<button type="button" class="pgadd" id="pgAdd">+ Page</button>`;
}
$("pages").addEventListener("click", async ev => {
  const s = ev.target.closest("[data-pgset]"); if (s) { ev.stopPropagation(); pageSettings(s.dataset.pgset); return }
  const p = ev.target.closest("[data-pg]"); if (p && isGM()) { viewPage(p.dataset.pg); return }
  if (ev.target.closest("#pgAdd")) { const id = newId("p"); await net.set("pages/" + id, { name: "Page " + (Object.keys(G.pages).length + 1), w: 25, h: 18, grid: 70, gridOn: true, fog: false, order: Date.now() }); viewPage(id); pageSettings(id) }
});
function viewPage(id) {
  if (!G.pages[id]) return;
  pageSubs.forEach(u => u()); pageSubs = [];
  pid = id; page = G.pages[id]; tokens = {}; drawings = {}; fogOps = {}; mapImg = ""; selected.clear();
  pageSubs.push(net.on("maps/" + id, v => { mapImg = v || ""; renderPage() }));
  pageSubs.push(net.on("tokens/" + id, v => { tokens = v || {}; renderTokens() }));
  pageSubs.push(net.on("draw/" + id, v => { drawings = v || {}; renderDrawings() }));
  pageSubs.push(net.on("fog/" + id, v => { fogOps = v || {}; renderFog() }));
  renderPages(); renderPage(); fitView();
}
function pageSettings(id) {
  const p = G.pages[id]; if (!p) return;
  openWin("pg-" + id, "Page settings", `<div class="sect">
<label>Page name<input type="text" data-pk="name" value="${esc(p.name)}"></label>
<div class="row"><label>Width (squares)<input type="number" min="5" max="200" data-pk="w" value="${p.w || 25}"></label><label>Height (squares)<input type="number" min="5" max="200" data-pk="h" value="${p.h || 18}"></label></div>
<label class="row"><input type="checkbox" data-pk="gridOn"${p.gridOn !== false ? " checked" : ""}> Show the grid</label>
<label class="row"><input type="checkbox" data-pk="fog"${p.fog ? " checked" : ""}> Fog of war <small class="muted">(players only see what you reveal)</small></label>
<h3>Map image</h3><p class="muted small">The map is stretched over the page. After choosing a picture, the height is matched to it.</p>
<div class="row"><button type="button" class="btn" data-act="mapup" data-id="${esc(id)}">Choose a map picture</button><button type="button" class="btn" data-act="mapclear" data-id="${esc(id)}">Remove map</button></div>
<h3>Players</h3><button type="button" class="btn${G.meta.playerPage === id ? " solid" : ""}" data-act="bringplayers" data-id="${esc(id)}">${G.meta.playerPage === id ? "Players are on this page" : "Move players to this page"}</button>
<h3>Delete</h3><button type="button" class="btn red" data-act="pgdel" data-id="${esc(id)}">Delete this page</button></div>`, { w: 380, onInput: (el) => { const k = el.dataset.pk; if (!k) return; const v = el.type === "checkbox" ? el.checked : el.type === "number" ? clamp(parseInt(el.value, 10) || 0, 5, 200) : el.value; net.update("pages/" + id, { [k]: v }) } });
}

/* ---------------------------------------------------------------- tools (Roll20's left toolbar) */
const ICON = {
  select: '<path d="M5 3l14 8-6 2-2 6z"/>', pan: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V3.5a1.5 1.5 0 0 1 3 0V11M14 11V5a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7S5 17.5 4 15l-1.5-3a1.5 1.5 0 0 1 2.6-1.5L8 13"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>', draw: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
  fog: '<path d="M3 9h12a3 3 0 1 0-3-3M3 13h16a3 3 0 1 1-3 3M3 17h7"/>', turn: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  token: '<circle cx="12" cy="9" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>', pen: '<path d="M4 20c4-1 6-6 9-9s5-5 7-7"/>', rect: '<rect x="4" y="6" width="16" height="12" rx="1"/>',
  circle: '<circle cx="12" cy="12" r="8"/>', line: '<path d="M5 19L19 5"/>', text: '<path d="M5 6h14M12 6v13"/>', erase: '<path d="M7 20h10M5 15l8-10 6 5-7 9H9z"/>',
  reveal: '<rect x="4" y="5" width="16" height="14" rx="1" stroke-dasharray="3 2"/><path d="M9 12h6"/>', hide: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 9l8 6M16 9l-8 6"/>'
};
const ico = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
function renderTools() {
  const gm = isGM(), t = (k, label, key) => `<button type="button" class="tool${tool === k ? " on" : ""}" data-tool="${k}" title="${label}${key ? ` (${key.toUpperCase()})` : ""}" aria-label="${label}" aria-pressed="${tool === k}">${ico(k === "draw" ? drawKind : k)}${key ? `<span class="tk">${key.toUpperCase()}</span>` : ""}</button>`;
  $("tools").innerHTML = t("select", "Select and move", "s") + t("pan", "Move the map", "h") + t("ruler", "Measure", "r") + t("draw", "Draw", "d") +
    (gm ? t("fog", "Fog of war", "f") : "") + `<span class="toolsep"></span>` +
    `<button type="button" class="tool" data-act="addtoken" title="Add a token" aria-label="Add a token">${ico("token")}</button>` +
    `<button type="button" class="tool" data-act="turns" title="Turn order" aria-label="Turn order">${ico("turn")}</button>` +
    `<input type="color" class="swatch" id="drawColor" value="${drawColor}" title="Drawing color" aria-label="Drawing color">` +
    (gm ? `<span class="toolsep"></span>${[["map", "Map"], ["token", "Tokens"], ["gm", "GM"]].map(([k, l]) => `<button type="button" class="layerbtn${layer === k ? " on" : ""}" data-layer="${k}" title="Work on the ${l} layer" aria-pressed="${layer === k}">${l}</button>`).join("")}` : "");
  $("board").className = "board" + (tool === "pan" ? " pan" : tool === "select" ? "" : " cross");
}
function setTool(k) { tool = k; closeFly(); renderTools() }
function flyout(btn, html) {
  closeFly(); const r = btn.getBoundingClientRect(), f = document.createElement("div");
  f.className = "flyout"; f.id = "flyout"; f.innerHTML = html; f.style.left = r.right + 8 + "px"; f.style.top = r.top + "px"; document.body.appendChild(f);
  return f;
}
function closeFly() { const f = $("flyout"); if (f) f.remove() }
$("tools").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.dataset.layer) { layer = b.dataset.layer; renderTools(); toast({ map: "Map layer: new tokens and drawings sit under everything.", token: "Token layer: what players see.", gm: "GM layer: only you can see it." }[layer]); return }
  if (b.dataset.act === "addtoken") { addTokenAt(null); return }
  if (b.dataset.act === "turns") { openTurns(); return }
  const k = b.dataset.tool; if (!k) return;
  if (k === "draw") {
    setTool("draw");
    flyout(b, ["pen", "line", "rect", "circle", "text", "erase"].map(x => `<button type="button" data-draw="${x}" class="${drawKind === x ? "on" : ""}">${ico(x)}${{ pen: "Freehand", line: "Line", rect: "Rectangle", circle: "Circle", text: "Text", erase: "Erase drawings" }[x]}</button>`).join(""))
      .addEventListener("click", e => { const d = e.target.closest("[data-draw]"); if (d) { drawKind = d.dataset.draw; closeFly(); renderTools() } });
    return;
  }
  if (k === "fog") {
    setTool("fog");
    flyout(b, `<button type="button" data-fog="reveal" class="${fogMode === "reveal" ? "on" : ""}">${ico("reveal")}Reveal an area</button><button type="button" data-fog="hide" class="${fogMode === "hide" ? "on" : ""}">${ico("hide")}Hide an area</button><button type="button" data-fog="all">${ico("reveal")}Reveal everything</button><button type="button" data-fog="cover">${ico("hide")}Cover everything</button>`)
      .addEventListener("click", async e => {
        const d = e.target.closest("[data-fog]"); if (!d) return; const m = d.dataset.fog; closeFly();
        if (m === "reveal" || m === "hide") { fogMode = m; if (!page.fog) await net.update("pages/" + pid, { fog: true }); toast(m === "reveal" ? "Drag over the map to reveal it." : "Drag over the map to hide it."); return }
        await net.remove("fog/" + pid);
        if (m === "all") { await net.update("pages/" + pid, { fog: false }); toast("Fog removed from this page.") } else { await net.update("pages/" + pid, { fog: true }); toast("The whole page is covered. Use Reveal to show areas.") }
      });
    return;
  }
  setTool(k);
});
$("tools").addEventListener("input", ev => { if (ev.target.id === "drawColor") drawColor = ev.target.value });
document.addEventListener("pointerdown", ev => { if (!ev.target.closest("#flyout,#tools")) closeFly(); if (!ev.target.closest("#ctx")) closeCtx() });

/* ---------------------------------------------------------------- view: pan and zoom */
function applyView() { $("world").style.transform = `translate(${V.x}px,${V.y}px) scale(${V.z})` }
function fitView() {
  const b = $("board").getBoundingClientRect(), W = (page.w || 25) * GRID(), H = (page.h || 18) * GRID();
  V.z = clamp(Math.min((b.width - 40) / W, (b.height - 40) / H), 0.1, 2); V.x = (b.width - W * V.z) / 2; V.y = (b.height - H * V.z) / 2; applyView();
}
function zoomAt(f, cx, cy) { const b = $("board").getBoundingClientRect(); cx ??= b.width / 2; cy ??= b.height / 2; const nz = clamp(V.z * f, 0.08, 4); V.x = cx - (cx - V.x) * nz / V.z; V.y = cy - (cy - V.y) * nz / V.z; V.z = nz; applyView() }
const toWorld = ev => { const b = $("board").getBoundingClientRect(); return { x: (ev.clientX - b.left - V.x) / V.z, y: (ev.clientY - b.top - V.y) / V.z } };
$("board").addEventListener("wheel", ev => { ev.preventDefault(); const b = $("board").getBoundingClientRect(); zoomAt(Math.exp(-ev.deltaY * 0.0015), ev.clientX - b.left, ev.clientY - b.top) }, { passive: false });
document.querySelector(".zoomctl").addEventListener("click", ev => { const b = ev.target.closest("[data-zoom]"); if (!b) return; const z = +b.dataset.zoom; if (z) zoomAt(z > 0 ? 1.25 : 0.8); else fitView() });
window.addEventListener("resize", () => { if (G.id) applyView() });

/* ---------------------------------------------------------------- drawing the page */
function renderPage() {
  if (!pid) return;
  const g = GRID(), W = (page.w || 25) * g, H = (page.h || 18) * g;
  $("mapLayer").innerHTML = `<div class="pagebg" style="width:${W}px;height:${H}px"></div>${mapImg ? `<img class="mapimg" src="${esc(mapImg)}" alt="" style="width:${W}px;height:${H}px">` : ""}<div id="mapToks"></div>`;
  const gr = $("grid"); gr.style.width = W + "px"; gr.style.height = H + "px";
  gr.style.backgroundImage = page.gridOn === false ? "none" : "linear-gradient(to right, rgba(255,255,255,.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.22) 1px, transparent 1px)";
  gr.style.backgroundSize = `${g}px ${g}px`;
  ["drawLayer", "overLayer"].forEach(i => { $(i).setAttribute("width", W); $(i).setAttribute("height", H) });
  const f = $("fog"); if (f.width !== W || f.height !== H) { f.width = W; f.height = H }
  renderTokens(); renderDrawings(); renderFog();
}
function canSeeTok(t) { return t.layer !== "gm" || isGM() }
function controls(t) { if (isGM()) return true; if (t.ctrl === "all") return true; if (t.ctrl && t.ctrl[me.uid]) return true; const ch = t.char && G.chars[t.char]; return !!(ch && ch.owner === me.uid) }
function tokHP(t) { const ch = t.char && G.chars[t.char]; if (ch) { const live = ch.live || {}, max = (ch.snap && ch.snap.hp) || live.hpMax || 0; return { hp: live.hp ?? max, max } } return { hp: t.hp, max: t.hpMax } }
function tokConds(t) { const ch = t.char && G.chars[t.char]; return ch ? arr((ch.live || {}).conds) : arr(t.conds) }
function renderTokens() {
  if (!pid) return;
  const g = GRID(), curTok = G.turn && G.turn.list && G.turn.list[G.turn.cur] ? G.turn.list[G.turn.cur].tok : "";
  const html = l => Object.entries(tokens).filter(([, t]) => (t.layer || "token") === l && canSeeTok(t)).sort((a, b) => (a[1].zi || 0) - (b[1].zi || 0)).map(([id, t]) => {
    const s = (t.s || 1) * g, ch = t.char && G.chars[t.char], img = t.img || (ch && ch.snap && ch.snap.portrait) || "", { hp, max } = tokHP(t), conds = tokConds(t);
    const name = t.name || (ch && ch.snap && ch.snap.name) || "";
    return `<div class="tok${t.shape === "square" ? " square" : ""}${selected.has(id) ? " sel" : ""}${t.layer === "gm" ? " gm" : ""}${l === "map" ? " mapl" : ""}${curTok === id ? " turn" : ""}" data-tok="${esc(id)}" style="left:${t.x}px;top:${t.y}px;width:${s}px;height:${s}px;--s:${s}px;--c:${esc(t.color || "#c0262d")}" title="${esc(name)}">
<div class="face">${img ? `<img src="${esc(img)}" alt="">` : `<span>${esc(initials(name))}</span>`}</div>
${max ? `<div class="bar" title="${hp} / ${max} HP"><i style="width:${clamp(hp / max * 100, 0, 100)}%"></i></div>` : ""}
${conds.length ? `<div class="conds">${conds.slice(0, 4).map(c => `<b title="${esc(c)}">${esc(c.slice(0, 3))}</b>`).join("")}${conds.length > 4 ? `<b>+${conds.length - 4}</b>` : ""}</div>` : ""}
${name && t.showName !== false ? `<div class="nm">${esc(name)}</div>` : ""}</div>`;
  }).join("");
  const mt = $("mapToks"); if (mt) mt.innerHTML = html("map");
  $("tokLayer").innerHTML = html("token") + html("gm");
}
function renderDrawings() {
  if (!pid) return;
  const out = Object.entries(drawings).filter(([, d]) => d.layer !== "gm" || isGM()).map(([id, d]) => drawSVG(d, id)).join("");
  $("drawLayer").innerHTML = out;
}
function drawSVG(d, id) {
  const a = `stroke="${esc(d.c || "#fff")}" stroke-width="${d.w || 4}" fill="none" stroke-linecap="round" stroke-linejoin="round"${id ? ` data-draw="${esc(id)}" class="hit"` : ""}${d.layer === "gm" ? ' opacity=".5"' : ""}`;
  if (d.k === "pen" || d.k === "line") return `<polyline points="${arr(d.pts).map(p => p.join(",")).join(" ")}" ${a}/>`;
  if (d.k === "rect") return `<rect x="${Math.min(d.x, d.x + d.w2)}" y="${Math.min(d.y, d.y + d.h2)}" width="${Math.abs(d.w2)}" height="${Math.abs(d.h2)}" ${a}/>`;
  if (d.k === "circle") return `<ellipse cx="${d.x + d.w2 / 2}" cy="${d.y + d.h2 / 2}" rx="${Math.abs(d.w2 / 2)}" ry="${Math.abs(d.h2 / 2)}" ${a}/>`;
  if (d.k === "text") return `<text x="${d.x}" y="${d.y}" fill="${esc(d.c)}" font-size="${d.size || 28}" font-weight="800" font-family="Montserrat, sans-serif" paint-order="stroke" stroke="#000" stroke-width="3"${id ? ` data-draw="${esc(id)}" style="pointer-events:all"` : ""}>${esc(d.txt)}</text>`;
  return "";
}
function renderFog() {
  if (!pid) return;
  const c = $("fog"), x = c.getContext("2d"); x.clearRect(0, 0, c.width, c.height);
  if (!page.fog) return;
  x.globalCompositeOperation = "source-over"; x.fillStyle = isGM() ? "rgba(0,0,0,.5)" : "#000"; x.fillRect(0, 0, c.width, c.height);
  Object.values(fogOps).sort((a, b) => (a.n || 0) - (b.n || 0)).forEach(o => {
    x.globalCompositeOperation = o.m === "r" ? "destination-out" : "source-over";
    x.fillStyle = o.m === "r" ? "#000" : (isGM() ? "rgba(0,0,0,.5)" : "#000");
    if (o.m === "h" && isGM()) { x.globalCompositeOperation = "destination-out"; x.fillRect(o.x, o.y, o.w, o.h); x.globalCompositeOperation = "source-over" }
    x.fillRect(o.x, o.y, o.w, o.h);
  });
  x.globalCompositeOperation = "source-over";
}

/* ---------------------------------------------------------------- pointer: move tokens, pan, measure, draw, fog */
let drag = null, spaceDown = false;
const snap = v => Math.round(v / GRID()) * GRID();
window.addEventListener("keydown", ev => {
  if (ev.target.closest("input,textarea,select")) return;
  if (ev.code === "Space") { spaceDown = true; $("board").classList.add("pan") }
  const k = ev.key.toLowerCase(), map = { s: "select", h: "pan", r: "ruler", d: "draw", f: "fog" };
  if (!ev.ctrlKey && !ev.metaKey && !ev.altKey && map[k] && G.id && (k !== "f" || isGM())) { setTool(map[k]); return }
  if ((ev.key === "Delete" || ev.key === "Backspace") && selected.size) { selected.forEach(id => { const t = tokens[id]; if (t && controls(t)) net.remove(`tokens/${pid}/${id}`) }); selected.clear(); return }
  if (ev.key.startsWith("Arrow") && selected.size) {
    ev.preventDefault(); const g = ev.shiftKey ? GRID() / 2 : GRID(), dx = ev.key === "ArrowLeft" ? -g : ev.key === "ArrowRight" ? g : 0, dy = ev.key === "ArrowUp" ? -g : ev.key === "ArrowDown" ? g : 0;
    selected.forEach(id => { const t = tokens[id]; if (t && controls(t)) net.update(`tokens/${pid}/${id}`, { x: t.x + dx, y: t.y + dy }) });
  }
});
window.addEventListener("keyup", ev => { if (ev.code === "Space") { spaceDown = false; renderTools() } });
$("board").addEventListener("contextmenu", ev => { ev.preventDefault(); const t = ev.target.closest("[data-tok]"); if (t) tokenMenu(t.dataset.tok, ev.clientX, ev.clientY); else boardMenu(ev) });
$("board").addEventListener("dblclick", ev => { const t = ev.target.closest("[data-tok]"); if (!t) return; const tk = tokens[t.dataset.tok]; if (tk && tk.char && G.chars[tk.char]) openSheet(tk.char); else if (tk && controls(tk)) tokenEdit(t.dataset.tok) });
$("board").addEventListener("pointerdown", ev => {
  if (ev.button === 2) return;
  const b = $("board"), w = toWorld(ev);
  if (ev.button === 1 || spaceDown || tool === "pan") { drag = { kind: "pan", sx: ev.clientX, sy: ev.clientY, vx: V.x, vy: V.y }; b.classList.add("panning"); b.setPointerCapture(ev.pointerId); return }
  if (tool === "select") {
    const el = ev.target.closest("[data-tok]");
    if (!el || el.classList.contains("mapl") && layer !== "map") { if (!ev.shiftKey) { selected.clear(); renderTokens() } drag = { kind: "pan", sx: ev.clientX, sy: ev.clientY, vx: V.x, vy: V.y }; b.setPointerCapture(ev.pointerId); return }
    const id = el.dataset.tok, t = tokens[id]; if (!t) return;
    if (!ev.shiftKey && !selected.has(id)) selected.clear(); selected.add(id); renderTokens();
    if (!controls(t)) return;
    drag = { kind: "tok", id, ox: w.x - t.x, oy: w.y - t.y, x: t.x, y: t.y, moved: false }; b.setPointerCapture(ev.pointerId); return;
  }
  if (tool === "ruler") { drag = { kind: "ruler", a: w, b: w }; b.setPointerCapture(ev.pointerId); return }
  if (tool === "draw") {
    if (drawKind === "erase") { const d = ev.target.closest("[data-draw]"); if (d) { const dr = drawings[d.dataset.draw]; if (dr && (isGM() || dr.by === me.uid)) net.remove(`draw/${pid}/${d.dataset.draw}`) } return }
    if (drawKind === "text") { textAt(w); return }
    drag = { kind: "draw", d: { k: drawKind, c: drawColor, w: 4, layer: isGM() ? layer : "token", by: me.uid, pts: [[Math.round(w.x), Math.round(w.y)]], x: w.x, y: w.y, w2: 0, h2: 0 } }; b.setPointerCapture(ev.pointerId); return;
  }
  if (tool === "fog" && isGM()) { drag = { kind: "fog", a: w, b: w }; b.setPointerCapture(ev.pointerId) }
});
$("board").addEventListener("pointermove", ev => {
  if (!drag) return; const w = toWorld(ev);
  if (drag.kind === "pan") { V.x = drag.vx + ev.clientX - drag.sx; V.y = drag.vy + ev.clientY - drag.sy; applyView(); return }
  if (drag.kind === "tok") {
    const el = document.querySelector(`[data-tok="${CSS.escape(drag.id)}"]`); if (!el) return;
    drag.x = w.x - drag.ox; drag.y = w.y - drag.oy; drag.moved = true; el.classList.add("dragging"); el.style.left = drag.x + "px"; el.style.top = drag.y + "px";
    const t = tokens[drag.id], s = (t.s || 1) * GRID(), from = { x: t.x + s / 2, y: t.y + s / 2 }, to = { x: drag.x + s / 2, y: drag.y + s / 2 };
    $("overLayer").innerHTML = rulerSVG(from, to); return;
  }
  if (drag.kind === "ruler") { drag.b = w; $("overLayer").innerHTML = rulerSVG(drag.a, w); return }
  if (drag.kind === "draw") {
    const d = drag.d;
    if (d.k === "pen") { const l = d.pts[d.pts.length - 1]; if (Math.hypot(w.x - l[0], w.y - l[1]) > 3 / V.z) d.pts.push([Math.round(w.x), Math.round(w.y)]) }
    else if (d.k === "line") d.pts = [d.pts[0], [Math.round(w.x), Math.round(w.y)]];
    else { d.w2 = w.x - d.x; d.h2 = w.y - d.y }
    $("overLayer").innerHTML = drawSVG(d); return;
  }
  if (drag.kind === "fog") { drag.b = w; const r = rectOf(drag.a, w); $("overLayer").innerHTML = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fogMode === "reveal" ? "rgba(255,255,255,.18)" : "rgba(0,0,0,.6)"}" stroke="#fff" stroke-dasharray="8 6" stroke-width="${2 / V.z}"/>` }
});
const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
async function endDrag(ev) {
  if (!drag) return; const d = drag; drag = null; $("board").classList.remove("panning"); $("overLayer").innerHTML = "";
  if (d.kind === "tok" && d.moved) { const nx = ev && ev.altKey ? Math.round(d.x) : snap(d.x), ny = ev && ev.altKey ? Math.round(d.y) : snap(d.y); tokens[d.id] = { ...tokens[d.id], x: nx, y: ny }; renderTokens(); await net.update(`tokens/${pid}/${d.id}`, { x: nx, y: ny }) }
  if (d.kind === "draw") { const x = d.d; if (x.k === "pen" && x.pts.length < 2) return; if ((x.k === "rect" || x.k === "circle") && Math.abs(x.w2) < 4 && Math.abs(x.h2) < 4) return; await net.push("draw/" + pid, x) }
  if (d.kind === "fog") { const r = rectOf(d.a, d.b); if (r.w < 4 || r.h < 4) return; await net.push("fog/" + pid, { m: fogMode === "reveal" ? "r" : "h", ...r, n: Date.now() }) }
}
$("board").addEventListener("pointerup", endDrag);
$("board").addEventListener("pointercancel", () => { drag = null; $("overLayer").innerHTML = ""; renderTokens() });
function rulerSVG(a, b) {
  const g = GRID(), sq = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / g, n = Math.round(sq * 10) / 10, sw = 3 / V.z, fs = 15 / V.z;
  return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#ffd166" stroke-width="${sw}" stroke-dasharray="${10 / V.z} ${6 / V.z}"/><circle cx="${a.x}" cy="${a.y}" r="${5 / V.z}" fill="#ffd166"/><text class="rulerlbl" x="${b.x + 10 / V.z}" y="${b.y - 10 / V.z}" style="font-size:${fs}px;stroke-width:${4 / V.z}px">${n} sq · ${Math.round(n * FPS())} ft</text>`;
}
function textAt(w) {
  const html = `<div class="sect"><label>Text<input type="text" id="txtIn" maxlength="120" autocomplete="off"></label><label>Size<input type="number" id="txtSize" value="28" min="10" max="200"></label><button type="button" class="btn solid" id="txtOk">Add text</button></div>`;
  const win = openWin("txt", "Add text", html, { w: 300 });
  win.querySelector("#txtIn").focus();
  const go = () => { const v = win.querySelector("#txtIn").value.trim(); if (v) net.push("draw/" + pid, { k: "text", txt: v, x: Math.round(w.x), y: Math.round(w.y), c: drawColor, size: +win.querySelector("#txtSize").value || 28, layer: isGM() ? layer : "token", by: me.uid }); closeWin("txt") };
  win.querySelector("#txtOk").onclick = go; win.querySelector("#txtIn").onkeydown = e => { if (e.key === "Enter") go() };
}

/* ---------------------------------------------------------------- tokens: add, edit, menus */
async function addTokenAt(w, extra) {
  if (!pid) return;
  const b = $("board").getBoundingClientRect(), g = GRID();
  w = w || { x: (b.width / 2 - V.x) / V.z, y: (b.height / 2 - V.y) / V.z };
  const id = newId("t"), t = { x: snap(w.x - g / 2), y: snap(w.y - g / 2), s: 1, name: "", color: me.color, layer: isGM() ? layer : "token", ctrl: isGM() ? "" : { [me.uid]: true }, showName: true, zi: Date.now(), ...extra };
  await net.set(`tokens/${pid}/${id}`, t);
  if (!extra) tokenEdit(id);
  return id;
}
function tokenEdit(id) {
  const t = tokens[id]; if (!t) return;
  const chars = Object.entries(G.chars).filter(([, c]) => isGM() || c.owner === me.uid);
  openWin("tok-" + id, "Token", `<div class="sect">
<label>Name<input type="text" data-tk="name" value="${esc(t.name || "")}" autocomplete="off"></label>
<div class="row"><label>Size (squares)<input type="number" min="1" max="10" data-tk="s" value="${t.s || 1}"></label><label>Ring color<input type="color" data-tk="color" value="${esc(t.color || "#c0262d")}"></label></div>
<label>Shape<select data-tk="shape"><option value="circle"${t.shape !== "square" ? " selected" : ""}>Circle</option><option value="square"${t.shape === "square" ? " selected" : ""}>Square</option></select></label>
<label>Character<select data-tk="char"><option value="">None</option>${chars.map(([cid, c]) => `<option value="${esc(cid)}"${t.char === cid ? " selected" : ""}>${esc(c.snap && c.snap.name)}</option>`).join("")}</select></label>
${t.char ? "" : `<div class="row"><label>HP<input type="number" data-tk="hp" value="${t.hp ?? ""}"></label><label>Max HP<input type="number" data-tk="hpMax" value="${t.hpMax ?? ""}"></label></div>`}
<label class="row"><input type="checkbox" data-tk="showName"${t.showName !== false ? " checked" : ""}> Show the name</label>
${isGM() ? `<label>Who can move it<select data-tk="ctrl"><option value="">Only the GM</option><option value="all"${t.ctrl === "all" ? " selected" : ""}>Everyone</option>${Object.entries(G.players).filter(([u]) => u !== me.uid).map(([u, p]) => `<option value="${esc(u)}"${t.ctrl && t.ctrl[u] ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>` : ""}
<div class="row"><button type="button" class="btn" data-act="tokimg" data-id="${esc(id)}">Choose a picture</button>${t.img ? `<button type="button" class="btn" data-act="tokimgx" data-id="${esc(id)}">Remove picture</button>` : ""}</div>
<button type="button" class="btn red" data-act="tokdel" data-id="${esc(id)}">Delete token</button></div>`, {
    w: 340, onInput: el => {
      const k = el.dataset.tk; if (!k) return; let v = el.type === "checkbox" ? el.checked : el.value;
      if (k === "s") v = clamp(parseInt(v, 10) || 1, 1, 10); if (k === "hp" || k === "hpMax") v = v === "" ? null : parseInt(v, 10);
      if (k === "ctrl") v = v === "" ? "" : v === "all" ? "all" : { [v]: true };
      net.update(`tokens/${pid}/${id}`, { [k]: v });
    }
  });
}
function condNames() { const g = MAT.data.glossary; const list = g && Array.isArray(g.entries) ? g.entries.filter(e => (e.sec || "Conditions") === "Conditions").map(e => e.n) : []; return (list.length ? list : ["Bleeding", "Blinded", "Charmed", "Dazed", "Deafened", "Drenched", "Enflamed", "Frightened", "Grappled", "Incapacitated", "Invisible", "Muted", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Sickened", "Stunned", "Unconscious"]).sort() }
function tokenMenu(id, x, y) {
  const t = tokens[id]; if (!t) return; if (!selected.has(id)) { selected.clear(); selected.add(id); renderTokens() }
  const can = controls(t), { hp, max } = tokHP(t), conds = tokConds(t);
  const items = [];
  if (t.char && G.chars[t.char]) items.push(`<button type="button" data-m="sheet">Open character sheet</button>`);
  if (can) {
    items.push(`<span class="lbl">Hit points ${max ? `${hp} / ${max}` : ""}</span><div class="row"><input type="number" id="ctxHp" placeholder="± amount" aria-label="Change hit points by"><button type="button" class="btn small" data-m="dmg">Damage</button><button type="button" class="btn small" data-m="heal">Heal</button></div>`);
    items.push(`<span class="lbl">Conditions</span><div class="condgrid">${condNames().map(c => `<button type="button" data-cond="${esc(c)}" aria-pressed="${conds.includes(c)}">${esc(c)}</button>`).join("")}</div><hr>`);
    items.push(`<button type="button" data-m="edit">Edit token…</button>`);
  }
  items.push(`<button type="button" data-m="turn">Add to turn order</button>`);
  if (can) items.push(`<button type="button" data-m="init">Roll initiative</button>`);
  if (isGM()) { items.push(`<span class="lbl">Layer</span><div class="row">${[["map", "Map"], ["token", "Tokens"], ["gm", "GM"]].map(([k, l]) => `<button type="button" class="btn small${(t.layer || "token") === k ? " solid" : ""}" data-layerto="${k}">${l}</button>`).join("")}</div>`); items.push(`<button type="button" data-m="front">Bring to front</button><button type="button" data-m="back">Send to back</button>`) }
  if (can) items.push(`<hr><button type="button" data-m="del">Delete token</button>`);
  showCtx(items.join(""), x, y, async ev => {
    const b = ev.target.closest("button"); if (!b) return;
    if (b.dataset.cond) { const has = conds.includes(b.dataset.cond), nu = has ? conds.filter(c => c !== b.dataset.cond) : [...conds, b.dataset.cond]; if (t.char && G.chars[t.char]) await net.set(`chars/${t.char}/live/conds`, nu); else await net.set(`tokens/${pid}/${id}/conds`, nu); b.setAttribute("aria-pressed", !has); conds.splice(0, conds.length, ...nu); return }
    if (b.dataset.layerto) { await net.update(`tokens/${pid}/${id}`, { layer: b.dataset.layerto }); closeCtx(); return }
    const m = b.dataset.m; if (!m) return;
    if (m === "dmg" || m === "heal") { const n = parseInt($("ctxHp").value, 10); if (!n) { $("ctxHp").focus(); return } changeHP(id, m === "dmg" ? -Math.abs(n) : Math.abs(n)); closeCtx(); return }
    closeCtx();
    if (m === "sheet") openSheet(t.char);
    if (m === "edit") tokenEdit(id);
    if (m === "turn") addTurn(id);
    if (m === "init") rollInit(id);
    if (m === "front") net.update(`tokens/${pid}/${id}`, { zi: Date.now() });
    if (m === "back") net.update(`tokens/${pid}/${id}`, { zi: -Date.now() });
    if (m === "del") net.remove(`tokens/${pid}/${id}`);
  });
}
async function changeHP(id, delta) {
  const t = tokens[id]; if (!t) return; const { hp, max } = tokHP(t), nu = Math.max(0, (hp || 0) + delta);
  if (t.char && G.chars[t.char]) await net.set(`chars/${t.char}/live/hp`, nu); else await net.update(`tokens/${pid}/${id}`, { hp: nu });
  if (t.char && G.chars[t.char] && !G.chars[t.char].hidden) sys(`${G.chars[t.char].snap.name} ${delta < 0 ? "takes " + -delta + " damage" : "heals " + delta} (${nu} / ${max} HP).`);
}
function boardMenu(ev) {
  const w = toWorld(ev);
  showCtx(`<button type="button" data-m="tok">Add a token here</button>${isGM() ? `<button type="button" data-m="ping">Ping this spot</button>` : `<button type="button" data-m="ping">Ping this spot</button>`}`, ev.clientX, ev.clientY, e => {
    const b = e.target.closest("[data-m]"); if (!b) return; closeCtx();
    if (b.dataset.m === "tok") addTokenAt(w);
    if (b.dataset.m === "ping") ping(w);
  });
}
function ping(w) { net.set("ping", { x: w.x, y: w.y, pid, c: me.color, at: Date.now() }) }
function showPing(p) {
  if (!p || p.pid !== pid || Date.now() - p.at > 5000) return;
  const g = GRID(); $("overLayer").insertAdjacentHTML("beforeend", `<circle class="pingc" cx="${p.x}" cy="${p.y}" r="${g / 3}" fill="none" stroke="${esc(p.c)}" stroke-width="${4 / V.z}"><animate attributeName="r" from="${g / 4}" to="${g * 1.4}" dur="1s" repeatCount="3"/><animate attributeName="opacity" from="1" to="0" dur="1s" repeatCount="3"/></circle>`);
  setTimeout(() => document.querySelectorAll(".pingc").forEach(x => x.remove()), 3200);
}
function showCtx(html, x, y, onClick) {
  const c = $("ctx"); c.innerHTML = html; c.hidden = false; c.onclick = onClick;
  const r = c.getBoundingClientRect(); c.style.left = clamp(x, 8, innerWidth - r.width - 8) + "px"; c.style.top = clamp(y, 8, innerHeight - r.height - 8) + "px";
}
function closeCtx() { $("ctx").hidden = true; $("ctx").onclick = null }

/* drops onto the map: characters from the Journal, pictures from the computer */
$("board").addEventListener("dragover", ev => ev.preventDefault());
$("board").addEventListener("drop", async ev => {
  ev.preventDefault(); const w = toWorld(ev), cid = ev.dataTransfer.getData("text/crawl-char");
  if (cid && G.chars[cid]) { const c = G.chars[cid]; await addTokenAt(w, { char: cid, name: c.snap.name, ctrl: isGM() ? (c.owner && c.owner !== me.uid ? { [c.owner]: true } : "") : { [me.uid]: true }, layer: isGM() ? layer : "token" }); return }
  const f = ev.dataTransfer.files && ev.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) { const url = await shrink(f, 256, 0.85); await addTokenAt(w, { img: url, name: f.name.replace(/\.[^.]+$/, "") }) }
});
/* pictures are shrunk before they're shared */
function shrink(file, max, q) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); res({ url: cv.toDataURL("image/jpeg", q), w: img.width, h: img.height }.url); shrink.last = { w: img.width, h: img.height } };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error("bad image")) };
    img.src = u;
  });
}
let fileFor = null;
function pickImage(cb) { fileFor = cb; $("fileIn").value = ""; $("fileIn").click() }
$("fileIn").addEventListener("change", async () => { const f = $("fileIn").files[0]; if (f && fileFor) { try { await fileFor(f) } catch (e) { toast("That picture couldn't be opened.") } } fileFor = null });

/* ---------------------------------------------------------------- floating windows (sheets, handouts, compendium entries, turn order) */
const WINS = {}; let winN = 0;
function openWin(id, title, html, opts = {}) {
  let w = WINS[id];
  if (!w) {
    const el = document.createElement("div"); el.className = "win"; el.dataset.win = id; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", title);
    el.innerHTML = `<div class="winh"><b></b><button type="button" data-x title="Close" aria-label="Close">×</button></div><div class="winb"></div>`;
    const n = winN++ % 8, wd = Math.min(opts.w || 420, innerWidth - 20);
    el.style.width = wd + "px"; el.style.left = clamp(innerWidth / 2 - wd / 2 - 120 + n * 28, 10, innerWidth - wd - 10) + "px"; el.style.top = clamp(70 + n * 28, 10, innerHeight - 200) + "px";
    if (opts.h) el.style.height = Math.min(opts.h, innerHeight - 40) + "px";
    $("wins").appendChild(el);
    w = WINS[id] = { el, opts };
    el.querySelector("[data-x]").onclick = () => closeWin(id);
    el.addEventListener("pointerdown", () => front(id));
    const hd = el.querySelector(".winh");
    hd.addEventListener("pointerdown", ev => {
      if (ev.target.closest("button")) return; const r = el.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top; hd.setPointerCapture(ev.pointerId);
      const mv = e => { el.style.left = clamp(e.clientX - dx, -r.width + 80, innerWidth - 80) + "px"; el.style.top = clamp(e.clientY - dy, 0, innerHeight - 40) + "px" };
      const up = () => { hd.removeEventListener("pointermove", mv); hd.removeEventListener("pointerup", up) };
      hd.addEventListener("pointermove", mv); hd.addEventListener("pointerup", up);
    });
    const body = el.querySelector(".winb");
    body.addEventListener("input", ev => { if (ev.target.type !== "number" && w.opts.onInput) w.opts.onInput(ev.target, ev) });
    body.addEventListener("change", ev => { if (ev.target.type === "number" && w.opts.onInput) w.opts.onInput(ev.target, ev) });
  }
  w.opts = opts;
  w.el.querySelector(".winh b").textContent = title; w.el.setAttribute("aria-label", title);
  w.el.querySelector(".winb").innerHTML = opts.render ? opts.render() : html;
  front(id);
  return w.el;
}
let zTop = 20;
function front(id) { const w = WINS[id]; if (!w || w.el.style.zIndex == zTop) return; Object.values(WINS).forEach(x => x.el.classList.remove("front")); w.el.classList.add("front"); w.el.style.zIndex = ++zTop }
function closeWin(id) { const w = WINS[id]; if (w) { w.el.remove(); delete WINS[id] } }
/* windows with a render() redraw when the game changes, but never while someone is typing in them */
function refreshWins() {
  for (const [id, w] of Object.entries(WINS)) {
    if (!w.opts.render) continue;
    const a = document.activeElement; if (a && w.el.contains(a) && a.matches("input,textarea,select")) continue;
    const b = w.el.querySelector(".winb"), st = b.scrollTop, html = w.opts.render();
    if (html == null) { closeWin(id); continue }
    b.innerHTML = html; b.scrollTop = st;
    if (w.opts.title) w.el.querySelector(".winh b").textContent = w.opts.title();
  }
}

/* buttons anywhere that act on the game */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-act]"); if (!b) return; const a = b.dataset.act, id = b.dataset.id;
  const sure = () => { if (b.dataset.sure) return true; b.dataset.sure = "1"; b.textContent = "Click again to confirm"; setTimeout(() => { delete b.dataset.sure }, 4000); return false };
  if (a === "getupd") { getUpdate(); closeWin("upd") }
  if (a === "mapup") pickImage(async f => { const url = await shrink(f, 2400, 0.82), d = shrink.last, p = G.pages[id]; await net.set("maps/" + id, url); if (d && d.w) await net.update("pages/" + id, { h: clamp(Math.round((p.w || 25) * d.h / d.w), 5, 200) }); toast("Map added."); if (id === pid) fitView() });
  if (a === "mapclear") net.remove("maps/" + id);
  if (a === "bringplayers") { await net.update("meta", { playerPage: id }); pageSettings(id); toast("Players moved to " + (G.pages[id] || {}).name + ".") }
  if (a === "pgdel") {
    if (Object.keys(G.pages).length < 2) { toast("A game needs at least one page."); return }
    if (!sure()) return;
    closeWin("pg-" + id); const other = pagesSorted().find(([k]) => k !== id)[0];
    if (G.meta.playerPage === id) await net.update("meta", { playerPage: other });
    if (pid === id) viewPage(other);
    for (const p of ["pages/", "maps/", "tokens/", "draw/", "fog/"]) await net.remove(p + id);
  }
  if (a === "tokimg") pickImage(async f => { await net.update(`tokens/${pid}/${id}`, { img: await shrink(f, 256, 0.85) }); tokenEdit(id) });
  if (a === "tokimgx") { await net.update(`tokens/${pid}/${id}`, { img: null }); tokenEdit(id) }
  if (a === "tokdel") { await net.remove(`tokens/${pid}/${id}`); closeWin("tok-" + id) }
});

/* ---------------------------------------------------------------- dice and chat */
let curTab = "chat"; const localMsgs = [];
function speaker() {
  const v = $("chatAs").value, ch = v && G.chars[v];
  return ch ? { name: ch.snap.name, color: me.color, cid: v } : { name: me.name, color: me.color, cid: "" };
}
function fillChatAs() {
  const sel = $("chatAs"), v = sel.value, mine = Object.entries(G.chars).filter(([, c]) => isGM() || c.owner === me.uid);
  sel.innerHTML = `<option value="">${esc(me.name)}</option>` + mine.map(([id, c]) => `<option value="${esc(id)}">${esc(c.snap && c.snap.name)}</option>`).join("");
  sel.value = mine.some(([id]) => id === v) ? v : "";
}
function post(msg) { return net.push("chat", { uid: me.uid, ts: Date.now(), ...msg }) }
function sys(text) { return post({ t: "sys", text }) }
function doRoll(expr, label, opt = {}) {
  let r; try { r = roll(expr) } catch (e) { localNote(e.message + ". Try something like 1d20+3 or 4d6kh3."); return null }
  const sp = opt.as ? { name: (G.chars[opt.as] && G.chars[opt.as].snap.name) || me.name, color: me.color } : speaker();
  post({ t: "roll", name: sp.name, color: sp.color, roll: { expr: r.expr, total: r.total, parts: r.parts, label: label || "" }, ...(opt.to ? { to: opt.to } : {}) });
  return r;
}
function localNote(html) { localMsgs.push({ t: "sys", html, ts: Date.now(), local: true }); renderChat() }
function dieHTML(p) {
  if (p.num != null) return `<span>${p.op === "+" ? "" : p.op} ${p.num}</span>`;
  return `${p.op && p.op !== "+" ? p.op : ""} (${arr(p.rolls).map(x => `<span class="d${x.drop ? " x" : ""}${!x.drop && x.v === p.sides ? " max" : ""}${!x.drop && x.v === 1 ? " min" : ""}">${x.v}</span>`).join("")})`;
}
function rollHTML(r) {
  const parts = arr(r.parts), d20 = parts.filter(p => p.sides === 20), kept = d20.length === 1 ? arr(d20[0].rolls).filter(x => !x.drop) : [];
  const cls = kept.length === 1 ? (kept[0].v === 20 ? " crit" : kept[0].v === 1 ? " fumble" : "") : "";
  return `<div class="rollc">${r.label ? `<div class="rl">${esc(r.label)}</div>` : ""}<div class="rr"><span class="tot${cls}" title="${esc(r.expr)}">${r.total}</span><span class="det">${esc(r.expr)} = ${parts.map((p, i) => (i && p.op === "+" ? "+ " : "") + dieHTML(p)).join(" ")}</span></div></div>`;
}
const canSee = m => !m.to || m.uid === me.uid || m.to[me.uid] || (m.to.gm && isGM());
function msgHTML(m) {
  if (m.t === "sys") return `<div class="msg sys">${m.html || esc(m.text)}</div>`;
  const c = `style="--c:${esc(m.color || "#666")}"`, who = `<div class="who">${esc(m.name)}${m.to ? `<small>${m.uid === me.uid ? "whisper to " + esc(m.toName || "GM") : "whispers to you"}</small>` : ""}</div>`;
  if (m.t === "emote") return `<div class="msg emote" ${c}><span class="who">${esc(m.name)}</span> ${esc(m.text)}</div>`;
  if (m.t === "desc") return `<div class="msg emote" style="--c:transparent"><p>${rich(m.text)}</p></div>`;
  if (m.t === "roll") return `<div class="msg${m.to ? " whisper" : ""}" ${c}>${who}${rollHTML(m.roll || {})}</div>`;
  if (m.t === "card") return `<div class="msg" ${c}>${who}<div class="cardmsg"><div class="ch"><span>${esc(m.title)}</span><small>${esc(m.sub || "")}</small></div><div class="cb">${blocks(m.text || "")}</div></div></div>`;
  const text = esc(m.text || "").replace(/\u0002(\d+)\u0002/g, (x, i) => { const r = arr(m.inl)[+i]; return r ? `<span class="inl" title="${esc(r.expr)}: ${esc(r.det)}">${r.total}</span>` : "" }).replace(/\n/g, "<br>");
  return `<div class="msg${m.to ? " whisper" : ""}" ${c}>${who}<p>${text}</p></div>`;
}
function renderChat() {
  const log = $("chatlog"), stick = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
  const all = [...Object.values(G.chat || {}).filter(m => m && canSee(m)), ...localMsgs].sort((a, b) => (a.ts || 0) - (b.ts || 0)).slice(-250);
  log.innerHTML = all.map(msgHTML).join("");
  if (stick) log.scrollTop = log.scrollHeight;
  const last = Object.values(G.chat || {}).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
  if (last && last.ts > (renderChat.seen || 0) && curTab !== "chat" && last.uid !== me.uid) $("side").querySelector('[data-tab="chat"]').classList.add("new");
  renderChat.seen = last ? last.ts : 0;
}
/* "/r 1d20+3 Stealth" -> the longest start that is a roll, and the rest as the label */
function splitRoll(s) { const w = s.trim().split(/\s+/); for (let i = w.length; i > 0; i--) { const e = w.slice(0, i).join(""); try { roll(e); return [e, w.slice(i).join(" ")] } catch (x) { } } return [s.trim(), ""] }
function findPlayer(name) { const n = lcs(name); return Object.entries(G.players).find(([, p]) => lcs(p.name) === n) || Object.entries(G.players).find(([, p]) => lcs(p.name).startsWith(n)) }
function sendChat() {
  const box = $("chatText"), raw = box.value.trim(); if (!raw) return; box.value = "";
  const sp = speaker(), m = raw.match(/^\/(\w+)\s*([\s\S]*)$/);
  if (m) {
    const cmd = m[1].toLowerCase(), rest = m[2];
    if (cmd === "r" || cmd === "roll" || cmd === "gr" || cmd === "gmroll") { const [e, l] = splitRoll(rest); doRoll(e, l, cmd.startsWith("g") ? { to: { gm: true } } : {}); return }
    if (cmd === "w" || cmd === "whisper") {
      const mm = rest.match(/^"([^"]+)"\s*([\s\S]*)$/) || rest.match(/^(\S+)\s*([\s\S]*)$/); if (!mm || !mm[2]) { localNote("Whisper like this: /w Sam meet me by the door, or /w gm …"); return }
      if (lcs(mm[1]) === "gm") { post({ t: "msg", name: sp.name, color: sp.color, text: mm[2], to: { gm: true }, toName: "GM" }); return }
      const p = findPlayer(mm[1]); if (!p) { localNote(`There's no player called "${esc(mm[1])}".`); return }
      post({ t: "msg", name: sp.name, color: sp.color, text: mm[2], to: { [p[0]]: true }, toName: p[1].name }); return;
    }
    if (cmd === "em" || cmd === "me") { post({ t: "emote", name: sp.name, color: sp.color, text: rest }); return }
    if (cmd === "desc") { if (!isGM()) { localNote("Only the GM can use /desc."); return } post({ t: "desc", text: rest }); return }
    if (cmd === "help") { localNote(`<b>Chat commands</b><br>/r 1d20+3 Stealth: roll for everyone<br>/gr 2d6: roll only you and the GM see<br>/w Name message: whisper (/w gm … for the GM)<br>/em waves: an action<br>/desc …: the GM narrates<br>[[1d6+2]] inside any message rolls inline<br>Dice: 4d6kh3 keeps the highest 3, 2d20kl1 the lowest, 1d6! explodes, d% is 1d100.`); return }
    localNote(`I don't know /${esc(cmd)}. Type /help for the commands.`); return;
  }
  const inl = []; const text = raw.replace(/\[\[([^\]]+)\]\]/g, (x, e) => { try { const r = roll(e); inl.push({ expr: r.expr, total: r.total, det: r.parts.map(p => p.num != null ? p.num : "(" + arr(p.rolls).filter(z => !z.drop).map(z => z.v).join(",") + ")").join(" ") }); return `\u0002${inl.length - 1}\u0002` } catch (er) { return x } });
  post({ t: "msg", name: sp.name, color: sp.color, text, ...(inl.length ? { inl } : {}) });
}
$("chatSend").addEventListener("click", sendChat);
$("chatText").addEventListener("keydown", ev => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); sendChat() } });
function renderDiceBar() { $("dicebar").innerHTML = [4, 6, 8, 10, 12, 20, 100].map(n => `<button type="button" data-die="${n}" title="Roll 1d${n} (Shift: only the GM sees)">d${n}</button>`).join("") }
$("dicebar").addEventListener("click", ev => { const b = ev.target.closest("[data-die]"); if (b) doRoll("1d" + b.dataset.die, "", ev.shiftKey ? { to: { gm: true } } : {}) });

/* ---------------------------------------------------------------- side tabs */
function showTab(t) {
  curTab = t;
  document.querySelectorAll("#side [data-tab]").forEach(b => { b.setAttribute("aria-selected", b.dataset.tab === t); if (b.dataset.tab === t) b.classList.remove("new") });
  ["chat", "journal", "comp", "settings"].forEach(k => { $("pane-" + k).hidden = k !== t });
  if (t === "journal") renderJournal(); if (t === "comp") renderComp(); if (t === "settings") renderSettings();
  if (t === "chat") { const l = $("chatlog"); l.scrollTop = l.scrollHeight }
}
document.querySelector("#side .tabs").addEventListener("click", ev => { const b = ev.target.closest("[data-tab]"); if (b) showTab(b.dataset.tab) });

/* ---------------------------------------------------------------- players */
const isGMuid = u => G.meta.gm === u || !!(G.meta.gms || {})[u];
function renderPlayers() {
  $("playersbar").innerHTML = Object.entries(G.players).sort((a, b) => isGMuid(b[0]) - isGMuid(a[0])).map(([u, p]) => `<span class="pav${p.online === false ? " off" : ""}" style="--c:${esc(p.color)}" title="${esc(p.name)}${p.online === false ? " (away)" : ""}"><i>${esc(initials(p.name))}</i>${esc(p.name)}${isGMuid(u) ? `<span class="gm">GM</span>` : ""}</span>`).join("");
}

/* ---------------------------------------------------------------- characters */
const ABL = [["str", "STR"], ["dex", "DEX"], ["con", "CON"], ["int", "INT"], ["wis", "WIS"], ["cha", "CHA"]];
const sheetTab = {};
const charVisible = c => isGM() || !c.hidden || c.owner === me.uid;
const canEdit = c => isGM() || c.owner === me.uid;
function creatorChars() { try { return arr(JSON.parse(localStorage.getItem("crawl-characters") || "[]")).filter(c => c && c.snap) } catch (e) { return [] } }
async function addChar(snap, srcId) {
  const id = newId("c"); await net.set("chars/" + id, { owner: me.uid, hidden: false, src: srcId || "", snap, live: { hp: snap.hp ?? 0, pool: parseInt(snap.pool && snap.pool.max, 10) || 0, conds: [] } });
  sys(`${me.name} added ${snap.name} to the game.`); openSheet(id); return id;
}
function addCharMenu() {
  const local = creatorChars();
  openWin("addchar", "Add a character", `<div class="sect">
<h3>From the Character Creator</h3>${local.length ? local.map(c => `<div class="jitem" data-addlocal="${esc(c.id)}">${c.snap.portrait ? `<img class="av" src="${esc(c.snap.portrait)}" alt="">` : `<span class="av">${esc(initials(c.snap.name))}</span>`}<div><b>${esc(c.snap.name)}</b><small>${esc([c.snap.race, c.snap.cls].filter(Boolean).join(" · "))}</small></div></div>`).join("") : `<p class="muted small">No characters in this browser yet. Make one in the <a href="../creator.html" target="_blank">Character Creator</a>, then come back.</p>`}
<h3>From a file</h3><p class="muted small">A character saved from the Creator (.crawl.json).</p><button type="button" class="btn" id="charFile">Choose a character file</button>
${isGM() ? `<h3>For the GM</h3><button type="button" class="btn" id="newNpc">New NPC or monster</button>` : ""}</div>`, { w: 400 });
}
document.addEventListener("click", async ev => {
  const l = ev.target.closest("[data-addlocal]"); if (l) { const c = creatorChars().find(x => x.id === l.dataset.addlocal); if (c) { closeWin("addchar"); await addChar(c.snap, c.id) } return }
  if (ev.target.closest("#charFile")) { $("charIn").value = ""; $("charIn").click(); return }
  if (ev.target.closest("#newNpc")) {
    closeWin("addchar");
    const snap = { v: 1, npc: true, name: "New NPC", level: "", race: "", cls: "", bg: "", hp: 10, ac: 10, init: 0, speed: "30 ft", pool: { max: "", die: "" }, abil: Object.fromEntries(ABL.map(([k]) => [k, { score: 10, mod: 0, save: 0 }])), skills: [], spells: [], weapons: [], inv: [], feats: [], langs: [], profs: {} };
    const id = newId("c"); await net.set("chars/" + id, { owner: me.uid, hidden: true, npc: true, snap, live: { hp: 10, conds: [] } }); sheetTab[id] = "set"; openSheet(id);
  }
});
$("charIn").addEventListener("change", async () => {
  const f = $("charIn").files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), c = j.crawlCharacter || j;
    if (!c.snap) { toast("That file is from an older Character Creator. Open it in the Creator, then save it again.", 5000); return }
    closeWin("addchar"); await addChar(c.snap, c.id);
  } catch (e) { toast("That isn't a Crawl character file.") }
});
function openSheet(cid) {
  const ch = G.chars[cid]; if (!ch || !charVisible(ch)) return;
  openWin("sh-" + cid, ch.snap.name, "", { w: 560, h: 640, render: () => G.chars[cid] && charVisible(G.chars[cid]) ? sheetHTML(cid) : null, title: () => (G.chars[cid] || {}).snap?.name || "", onInput: (el) => sheetInput(cid, el) });
  WINS["sh-" + cid].el.dataset.cid = cid;
}
const numOr = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d };
function sheetHTML(cid) {
  const ch = G.chars[cid], s = ch.snap || {}, L = ch.live || {}, ed = canEdit(ch), tab = sheetTab[cid] || "main", conds = arr(L.conds), dis = ed ? "" : " disabled";
  const rb = (expr, label, txt, cls = "rb") => `<button type="button" class="${cls}" data-roll="${esc(expr)}" data-label="${esc(label)}" title="Roll ${esc(expr)}">${txt}</button>`;
  const tabs = [["main", "Main"], ["act", "Actions"], ...(arr(s.spells).length ? [["spells", "Spells"]] : []), ["feat", "Features"], ["gear", "Gear"], ["notes", "Notes"], ...(ed ? [["set", "Settings"]] : [])];
  let body = "";
  if (tab === "main") {
    const pool = numOr(s.pool && s.pool.max, 0);
    body = `<div class="vitals">
<div class="vit"><span>Hit points</span><input type="number" data-live="hp" value="${L.hp ?? s.hp ?? 0}"${dis} aria-label="Current hit points"><span class="of">of ${s.hp ?? "?"}</span></div>
<div class="vit"><span>Temp HP</span><input type="number" data-live="tmp" value="${L.tmp ?? 0}"${dis} aria-label="Temporary hit points"></div>
<div class="vit"><span>Armor class</span><b>${s.ac ?? "—"}</b></div>
<div class="vit"><span>Initiative</span>${rb(`1d20${s.init >= 0 ? "+" : ""}${s.init || 0}`, "Initiative", sign(s.init || 0))}</div>
<div class="vit"><span>Speed</span><b>${esc(s.speed || "—")}</b></div>
${pool ? `<div class="vit"><span>Action pool</span><input type="number" data-live="pool" value="${L.pool ?? pool}"${dis} aria-label="Points in the action pool"><span class="of">of ${pool}</span></div>` : ""}
${s.pool && s.pool.die ? `<div class="vit"><span>Action die</span>${rb(String(s.pool.die).replace(/^d/i, "1d"), "Action Die", esc(s.pool.die))}</div>` : ""}
${s.hd ? `<div class="vit"><span>Hit dice</span><b>${esc(s.hd)}</b></div>` : ""}</div>
<div class="abl">${ABL.map(([k, ab]) => { const a = (s.abil || {})[k] || {}; return `<div class="ab"><span>${ab}</span><b>${sign(a.mod || 0)}</b><small class="muted">${a.score ?? ""}</small><br>${rb(`1d20${a.mod >= 0 ? "+" : ""}${a.mod || 0}`, `${a.n || ab} check`, "Check", "")}<br>${rb(`1d20${(a.save ?? a.mod ?? 0) >= 0 ? "+" : ""}${a.save ?? a.mod ?? 0}`, `${a.n || ab} save`, `Save ${sign(a.save ?? a.mod ?? 0)}${a.saveProf ? " ★" : ""}`, "")}</div>` }).join("")}</div>
${arr(s.skills).length ? `<div class="sect"><h3>Skills</h3><div class="sklist">${arr(s.skills).map(k => `<div class="sk"><i class="st${k.prof ? " on" : ""}" title="${k.prof ? "Proficient" : "Not proficient"}"></i><span>${esc(k.n)} <small class="muted">${esc(String(k.ab || "").toUpperCase())}</small></span>${rb(`1d20${k.total >= 0 ? "+" : ""}${k.total || 0}`, k.n, sign(k.total || 0))}</div>`).join("")}</div></div>` : ""}
${s.passive && Object.keys(s.passive).length ? `<p class="small muted">Passive: ${Object.entries(s.passive).map(([k, v]) => `${esc(k)} ${v}`).join(" · ")}</p>` : ""}
<div class="sect"><h3>Conditions</h3><div class="condgrid">${condNames().map(c => `<button type="button" data-scond="${esc(c)}" aria-pressed="${conds.includes(c)}"${dis}>${esc(c)}</button>`).join("")}</div></div>`;
  }
  if (tab === "act") {
    const best = Math.max(((s.abil || {}).str || {}).mod || 0, ((s.abil || {}).dex || {}).mod || 0), strm = ((s.abil || {}).str || {}).mod || 0;
    body = `<div class="sect"><h3>Weapons</h3>${arr(s.weapons).length ? arr(s.weapons).map(w => { const fin = /finesse|ranged|thrown|ammunition/i.test(w.props + " " + w.sub), m = fin ? best : strm, dmg = diceIn(w.props) || (arr(w.acts).length ? "" : diceIn(w.actions)), extra = arr(w.acts).length ? "" : w.actions; return `<div class="atk"><b>${esc(w.n)}</b><span class="btns">${rb(`1d20${m >= 0 ? "+" : ""}${m}`, w.n + " attack", "Attack")}${dmg ? rb(dmg, w.n + " damage", "Damage") : ""}</span>${extra || w.props ? `<small>${esc(plain([extra, w.props].filter(Boolean).join(" · ")))}</small>` : ""}</div>` +
      /* weapon actions: name in red, AP cost, and a roll for their damage */
      arr(w.acts).map(a => { const ad = diceIn(a.dmg); return `<div class="atk wact"><b class="wan">${esc(a.n || "Weapon action")}</b><span class="btns">${ad ? rb(ad, `${w.n}: ${a.n}`, "Damage") : ""}</span><small>${esc([a.at, a.ap && a.ap + " AP", [a.dmg, a.type].filter(Boolean).join(" "), a.d].filter(Boolean).join(" · "))}</small></div>` }).join("") }).join("") : `<p class="muted small">No weapons in hand.</p>`}
${s.pool && s.pool.die ? `<h3>Action Die</h3><div>${rb(String(s.pool.die).replace(/^d/i, "1d"), "Action Die", "Roll the Action Die " + esc(s.pool.die))}</div>` : ""}
<h3>Rolls</h3><div class="row gap">${rb("1d20", "d20", "d20")}${rb("2d20kh1", "With advantage", "Advantage")}${rb("2d20kl1", "With disadvantage", "Disadvantage")}</div></div>`;
  }
  if (tab === "spells") {
    const c = s.cast;
    body = `${c ? `<p class="small">Casting ability <b>${esc(c.ab)}</b> ${sign(c.mod || 0)}${c.prepared != null && c.prepared !== "" ? ` · Prepared spells <b>${esc(c.prepared)}</b>` : ""}${c.major ? ` · Major <b>${esc(c.major)}</b>` : ""}${c.minor ? ` · Minor <b>${esc(c.minor)}</b>` : ""}${c.opp ? ` · <span class="pdn">Opposing ${esc(c.opp)}</span>` : ""}</p>` : ""}
${arr(s.spells).map((sp, i) => { const dmg = diceIn(sp.dmg); return `<div class="atk"><b>${esc(sp.n)} <small class="muted">Rank +${sp.rank ?? 1}${sp.school ? " · " + esc(sp.school) : ""}${sp.conc ? " · Concentration" : ""}</small></b><span class="btns">${sp.atk != null ? rb(`1d20+${sp.atk}`, sp.n + " attack", "Attack") : ""}${dmg ? rb(dmg, sp.n + " damage", "Damage") : ""}<button type="button" class="rb" data-cast="${i}" title="Share the spell in chat">Cast</button></span><small>${esc([sp.cost && "Cost " + sp.cost, sp.time, sp.range, sp.dc != null && "DC " + sp.dc].filter(Boolean).join(" · "))}</small></div>` }).join("")}`;
  }
  if (tab === "feat") body = arr(s.feats).length ? arr(s.feats).map(f => `<div class="feat"><h3 class="small">${esc(f.n)} <small class="muted">${esc(f.src || "")}</small></h3>${blocks(f.d)}</div>`).join("") : `<p class="muted">No features.</p>`;
  if (tab === "gear") body = `<div class="sect">${s.wealth ? `<p><b>Money</b> ${esc(s.wealth)}</p>` : ""}<h3>Inventory</h3>${arr(s.inv).length ? `<table class="rtable"><tr><th>Item</th><th>Qty</th><th>Weight</th></tr>${arr(s.inv).map(x => `<tr><td>${esc(x.n)}${x.slot ? ` <small class="muted">(${esc(x.slot)})</small>` : ""}</td><td>${x.qty || 1}</td><td>${esc(x.weight || "")}</td></tr>`).join("")}</table>` : `<p class="muted small">Nothing carried.</p>`}
${s.profs ? `<h3>Proficiencies</h3><dl class="facts">${[["Weapons", s.profs.weapons], ["Armor", s.profs.armor], ["Trades", s.profs.trades]].filter(([, v]) => arr(v).length).map(([k, v]) => `<dt>${k}</dt><dd>${esc(arr(v).join(", "))}</dd>`).join("")}${arr(s.langs).length ? `<dt>Languages</dt><dd>${esc(arr(s.langs).join(", "))}</dd>` : ""}</dl>` : ""}
<h3>Extra gear and notes</h3><textarea data-live="inv" rows="4"${dis} placeholder="Loot, ammunition, anything picked up during play">${esc(L.inv || "")}</textarea></div>`;
  if (tab === "notes") body = `<div class="sect"><textarea data-live="notes" rows="12"${dis} placeholder="Session notes">${esc(L.notes || "")}</textarea>${s.details ? `<dl class="facts">${[["Gender", s.details.gender], ["Age", s.details.age], ["Height", s.details.height], ["Weight", s.details.weight]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>${s.details.looks ? `<h3>Appearance</h3><p>${rich(s.details.looks)}</p>` : ""}${s.details.story ? `<h3>Story</h3>${blocks(s.details.story)}` : ""}` : ""}</div>`;
  if (tab === "set") {
    const fromCreator = ch.src && creatorChars().find(c => c.id === ch.src);
    body = `<div class="sect">
${ch.npc ? `<h3>NPC stats</h3><label>Name<input type="text" data-snap="name" value="${esc(s.name)}"></label><div class="row"><label>Max HP<input type="number" data-snap="hp" value="${s.hp ?? 0}"></label><label>AC<input type="number" data-snap="ac" value="${s.ac ?? 10}"></label><label>Initiative<input type="number" data-snap="init" value="${s.init ?? 0}"></label></div><label>Speed<input type="text" data-snap="speed" value="${esc(s.speed || "")}"></label>
<div class="row">${ABL.map(([k, ab]) => `<label>${ab}<input type="number" data-abil="${k}" value="${((s.abil || {})[k] || {}).score ?? 10}"></label>`).join("")}</div>
<label>Attacks and abilities<textarea data-snap="featsText" rows="4" placeholder="Bite: +4, 1d8+2 Piercing">${esc(s.featsText || "")}</textarea></label>
<label>Picture<button type="button" class="btn" data-sheetact="portrait">Choose a picture</button></label>` : ""}
${isGM() ? `<label>Who plays this character<select data-own><option value="">The GM</option>${Object.entries(G.players).filter(([u]) => !isGMuid(u)).map(([u, p]) => `<option value="${esc(u)}"${ch.owner === u ? " selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>
<label class="row"><input type="checkbox" data-hide${ch.hidden ? " checked" : ""}> Hidden from players</label>` : ""}
${fromCreator ? `<button type="button" class="btn" data-sheetact="resync">Update from the Character Creator</button><p class="muted small">Brings in level-ups and changes made in the Creator. Current HP, conditions and notes stay.</p>` : ""}
${ch.npc ? "" : `<p class="muted small">Stats come from the Character Creator. To change them, edit the character there and click Update.</p>`}
<button type="button" class="btn" data-sheetact="token">Put a token on the map</button>
<button type="button" class="btn red" data-sheetact="del">Remove this character from the game</button></div>`;
  }
  const img = s.portrait;
  return `<div class="sh"><div class="shtop" style="--c:${esc((G.players[ch.owner] || {}).color || "#c0262d")}">${img ? `<img src="${esc(img)}" alt="">` : `<span class="av">${esc(initials(s.name))}</span>`}<div><b>${esc(s.name)}</b><small>${esc([s.level && "Level " + s.level, s.race, s.cls, s.bg].filter(Boolean).join(" · ") || (ch.npc ? "NPC" : ""))}</small></div></div>
<div class="shtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" data-shtab="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>${body}${ch.npc && tab === "main" && s.featsText ? `<div class="sect"><h3>Attacks and abilities</h3>${blocks(s.featsText)}</div>` : ""}</div>`;
}
const liveT = {};
function sheetInput(cid, el) {
  const ch = G.chars[cid]; if (!ch || !canEdit(ch)) return;
  if (el.dataset.live) { const k = el.dataset.live, v = el.type === "number" ? numOr(el.value) : el.value; clearTimeout(liveT[cid + k]); liveT[cid + k] = setTimeout(() => net.set(`chars/${cid}/live/${k}`, v), el.type === "number" ? 0 : 400); return }
  if (el.dataset.snap) { const k = el.dataset.snap, v = el.type === "number" ? numOr(el.value) : el.value; clearTimeout(liveT[cid + k]); liveT[cid + k] = setTimeout(() => { net.set(`chars/${cid}/snap/${k}`, v); if (k === "hp" && (ch.live || {}).hp == null) net.set(`chars/${cid}/live/hp`, v) }, 300); return }
  if (el.dataset.abil) { const sc = numOr(el.value, 10), m = Math.floor((sc - 10) / 2); net.set(`chars/${cid}/snap/abil/${el.dataset.abil}`, { score: sc, mod: m, save: m }); return }
  if (el.matches("[data-own]")) { net.update("chars/" + cid, { owner: el.value || G.meta.gm }); return }
  if (el.matches("[data-hide]")) net.update("chars/" + cid, { hidden: el.checked });
}
$("wins").addEventListener("click", async ev => {
  const win = ev.target.closest(".win"), cid = win && win.dataset.cid, ch = cid && G.chars[cid];
  const r = ev.target.closest("[data-roll]");
  if (r) { doRoll(r.dataset.roll, r.dataset.label, cid ? { as: cid, ...(ev.shiftKey ? { to: { gm: true } } : {}) } : {}); return }
  if (!ch) return;
  const t = ev.target.closest("[data-shtab]"); if (t) { sheetTab[cid] = t.dataset.shtab; refreshWins(); return }
  const c = ev.target.closest("[data-scond]"); if (c && canEdit(ch)) { const cur = arr((ch.live || {}).conds), n = c.dataset.scond; await net.set(`chars/${cid}/live/conds`, cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n]); return }
  const sp = ev.target.closest("[data-cast]"); if (sp) { const s = arr(ch.snap.spells)[+sp.dataset.cast]; if (s) post({ t: "card", name: ch.snap.name, color: me.color, title: s.n, sub: `Rank +${s.rank ?? 1}${s.school ? " · " + s.school : ""}`, text: [[s.cost && "Cost: " + s.cost, s.time && "Casting time: " + s.time, s.range && "Range: " + s.range, s.dc != null && "Save DC: " + s.dc, s.dmg && "Damage: " + s.dmg].filter(Boolean).join("\n"), plain(s.desc)].filter(Boolean).join("\n\n") }); return }
  const a = ev.target.closest("[data-sheetact]"); if (!a || !canEdit(ch)) return;
  const act = a.dataset.sheetact;
  if (act === "resync") { const c2 = creatorChars().find(x => x.id === ch.src); if (c2) { await net.set(`chars/${cid}/snap`, c2.snap); toast(c2.snap.name + " updated from the Creator.") } }
  if (act === "token") { await addTokenAt(null, { char: cid, name: ch.snap.name, ctrl: ch.owner && !isGMuid(ch.owner) ? { [ch.owner]: true } : "", layer: "token" }); toast("Token added in the middle of the map.") }
  if (act === "portrait") pickImage(async f => net.set(`chars/${cid}/snap/portrait`, await shrink(f, 256, 0.85)));
  if (act === "del") { if (!a.dataset.sure) { a.dataset.sure = 1; a.textContent = "Click again to remove"; return } closeWin("sh-" + cid); await net.remove("chars/" + cid) }
});

/* ---------------------------------------------------------------- turn order */
function turnObj() { const t = G.turn || {}; return { round: t.round || 1, cur: t.cur || 0, list: arr(t.list) } }
async function addTurn(tokId, init) {
  const t = turnObj(), tk = tokens[tokId]; if (!tk) return;
  const name = tk.name || (tk.char && G.chars[tk.char] && G.chars[tk.char].snap.name) || "Token";
  const i = t.list.findIndex(x => x.tok === tokId);
  if (i >= 0) { if (init != null) t.list[i].init = init } else t.list.push({ id: newId("e"), tok: tokId, pid, name, init: init ?? 0, hide: tk.layer === "gm" });
  if (init != null) t.list.sort((a, b) => (b.init || 0) - (a.init || 0));
  await net.set("turn", t); openTurns();
}
async function rollInit(tokId) {
  const tk = tokens[tokId]; if (!tk) return; const ch = tk.char && G.chars[tk.char], b = ch ? numOr(ch.snap.init) : 0;
  const r = doRoll(`1d20${b >= 0 ? "+" : ""}${b}`, (tk.name || (ch && ch.snap.name) || "Token") + " initiative", { as: ch ? tk.char : "", ...(tk.layer === "gm" ? { to: { gm: true } } : {}) });
  if (r) await addTurn(tokId, r.total);
}
function turnsHTML() {
  const t = turnObj(), gm = isGM(), list = t.list.map((e, i) => [e, i]).filter(([e]) => gm || !e.hide);
  return `<div class="row"><b>Round ${t.round}</b><span class="sp"></span>${gm ? `<button type="button" class="btn small" data-turn="prev">◀ Back</button><button type="button" class="btn small solid" data-turn="next">Next turn ▶</button>` : ""}</div>
<div class="turns">${list.length ? list.map(([e, i]) => `<div class="turn${i === t.cur ? " on" : ""}"><b>${esc(e.name)}${e.hide ? ` <small class="muted">(hidden)</small>` : ""}</b>${gm ? `<input type="number" data-init="${i}" value="${e.init ?? 0}" aria-label="Initiative for ${esc(e.name)}"><button type="button" data-tdel="${i}" title="Remove" aria-label="Remove ${esc(e.name)}">×</button>` : `<span>${e.init ?? 0}</span>`}</div>`).join("") : `<p class="muted small">Right-click a token and choose Roll initiative or Add to turn order.</p>`}</div>
${gm ? `<div class="row gap"><button type="button" class="btn small" data-turn="sort">Sort by initiative</button><button type="button" class="btn small" data-turn="clear">Clear</button></div>` : ""}`;
}
function openTurns() { openWin("turns", "Turn order", "", { w: 300, render: turnsHTML, onInput: async el => { if (el.dataset.init == null || !isGM()) return; const t = turnObj(); t.list[+el.dataset.init].init = numOr(el.value); await net.set("turn", t) } }) }
function renderTurn() { if (WINS.turns) refreshWins() }
$("wins").addEventListener("click", async ev => {
  const b = ev.target.closest("[data-turn],[data-tdel]"); if (!b || !isGM()) return; const t = turnObj();
  if (b.dataset.tdel != null) { t.list.splice(+b.dataset.tdel, 1); if (t.cur >= t.list.length) t.cur = 0 }
  const a = b.dataset.turn;
  if (a === "next" && t.list.length) { t.cur++; if (t.cur >= t.list.length) { t.cur = 0; t.round++; sys(`Round ${t.round} begins.`) } const e = t.list[t.cur]; if (!e.hide) sys(`${e.name}'s turn.`) }
  if (a === "prev" && t.list.length) { t.cur--; if (t.cur < 0) { t.cur = t.list.length - 1; t.round = Math.max(1, t.round - 1) } }
  if (a === "sort") { const curId = (t.list[t.cur] || {}).id; t.list.sort((x, y) => (y.init || 0) - (x.init || 0)); t.cur = Math.max(0, t.list.findIndex(e => e.id === curId)) }
  if (a === "clear") { t.list = []; t.cur = 0; t.round = 1 }
  await net.set("turn", t);
});

/* ---------------------------------------------------------------- journal: characters and handouts */
function renderJournal() {
  if (curTab !== "journal" || !G.id) return;
  const chars = Object.entries(G.chars).filter(([, c]) => charVisible(c)), hs = Object.entries(G.handouts).filter(([, h]) => isGM() || h.shown);
  $("pane-journal").innerHTML = `<div class="sect"><h3>Characters <button type="button" class="btn small" id="jAddChar">+ Add</button></h3>
${chars.length ? chars.map(([id, c]) => `<div class="jitem" draggable="true" data-jchar="${esc(id)}" title="Click to open. Drag onto the map to make a token.">${c.snap.portrait ? `<img class="av" src="${esc(c.snap.portrait)}" alt="" style="--c:${esc((G.players[c.owner] || {}).color || "#666")}">` : `<span class="av" style="--c:${esc((G.players[c.owner] || {}).color || "#666")}">${esc(initials(c.snap.name))}</span>`}<div><b>${esc(c.snap.name)}</b><small>${esc(c.npc ? "NPC" : [c.snap.race, c.snap.cls].filter(Boolean).join(" · "))}${c.hidden ? " · hidden" : ""} · ${esc((G.players[c.owner] || {}).name || "GM")}</small></div></div>`).join("") : `<p class="muted small">No characters yet. Click + Add to bring one in from the Character Creator.</p>`}
<p class="muted small">Drag a character onto the map to give them a token.</p>
<h3>Handouts ${isGM() ? `<button type="button" class="btn small" id="jAddHo">+ Add</button>` : ""}</h3>
${hs.length ? hs.map(([id, h]) => `<div class="jitem" data-jho="${esc(id)}">${h.img ? `<img class="av" src="${esc(h.img)}" alt="">` : `<span class="av">📜</span>`}<div><b>${esc(h.title || "Handout")}</b>${isGM() ? `<small>${h.shown ? "Players can see it" : "Only you"}</small>` : ""}</div></div>`).join("") : `<p class="muted small">${isGM() ? "Handouts are notes, letters and pictures you can show the players." : "The GM hasn't shared any handouts yet."}</p>`}</div>`;
}
$("pane-journal").addEventListener("click", async ev => {
  if (ev.target.closest("#jAddChar")) { addCharMenu(); return }
  if (ev.target.closest("#jAddHo")) { const id = newId("h"); await net.set("handouts/" + id, { title: "New handout", body: "", shown: false }); openHandout(id); return }
  const c = ev.target.closest("[data-jchar]"); if (c) { openSheet(c.dataset.jchar); return }
  const h = ev.target.closest("[data-jho]"); if (h) openHandout(h.dataset.jho);
});
$("pane-journal").addEventListener("dragstart", ev => { const c = ev.target.closest("[data-jchar]"); if (c) ev.dataTransfer.setData("text/crawl-char", c.dataset.jchar) });
function openHandout(id) {
  openWin("ho-" + id, "Handout", "", {
    w: 460, title: () => (G.handouts[id] || {}).title || "Handout",
    render: () => {
      const h = G.handouts[id]; if (!h || !(isGM() || h.shown)) return null;
      const view = `${h.img ? `<img src="${esc(h.img)}" alt="" style="max-width:100%;border-radius:10px">` : ""}${blocks(h.body)}`;
      if (!isGM()) return `<div class="sect"><h3>${esc(h.title)}</h3>${view}</div>`;
      return `<div class="sect"><label>Title<input type="text" data-ho="title" value="${esc(h.title)}"></label><label>Text<textarea data-ho="body" rows="8">${esc(h.body || "")}</textarea></label>
<label class="row"><input type="checkbox" data-ho="shown"${h.shown ? " checked" : ""}> Players can see this handout</label>
<div class="row gap"><button type="button" class="btn" data-hoact="img">${h.img ? "Change picture" : "Add a picture"}</button>${h.img ? `<button type="button" class="btn" data-hoact="noimg">Remove picture</button>` : ""}<button type="button" class="btn" data-hoact="chat">Show in chat</button><button type="button" class="btn red" data-hoact="del">Delete</button></div>
${h.img ? `<img src="${esc(h.img)}" alt="" style="max-width:100%;border-radius:10px">` : ""}</div>`;
    },
    onInput: el => { const k = el.dataset.ho; if (!k) return; const v = el.type === "checkbox" ? el.checked : el.value; clearTimeout(liveT["ho" + id + k]); liveT["ho" + id + k] = setTimeout(() => net.update("handouts/" + id, { [k]: v }), el.type === "checkbox" ? 0 : 400) }
  });
  WINS["ho-" + id].el.dataset.ho = id;
}
$("wins").addEventListener("click", async ev => {
  const b = ev.target.closest("[data-hoact]"); if (!b || !isGM()) return; const id = b.closest(".win").dataset.ho, h = G.handouts[id]; if (!h) return;
  const a = b.dataset.hoact;
  if (a === "img") pickImage(async f => net.update("handouts/" + id, { img: await shrink(f, 1400, 0.82) }));
  if (a === "noimg") net.update("handouts/" + id, { img: null });
  if (a === "chat") { if (!h.shown) await net.update("handouts/" + id, { shown: true }); post({ t: "card", name: me.name, color: me.color, title: h.title, sub: "Handout", text: h.body || "" }) }
  if (a === "del") { if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = "Click again to delete"; return } closeWin("ho-" + id); net.remove("handouts/" + id) }
});

/* ---------------------------------------------------------------- compendium: the Crawl materials */
let compCat = "all", compQ = "";
const CATS = [["all", "All"], ["spells", "Spells"], ["items", "Items"], ["recipes", "Recipes"], ["races", "Races"], ["classes", "Classes"], ["backgrounds", "Backgrounds"], ["feats", "Feats"], ["rules", "Rules"]];
function compEntries() {
  const d = MAT.data || {}, out = [];
  arr(d.spells).forEach((s, i) => out.push({ cat: "spells", n: s.n, sub: `Level ${s.lv} spell`, i }));
  arr(d.items && d.items.items).forEach((s, i) => out.push({ cat: "items", n: s.n, sub: s.cat || "Item", i }));
  arr(d.items && d.items.recipes).forEach((s, i) => out.push({ cat: "recipes", n: s.n, sub: "Recipe", i }));
  arr(d.races && d.races.races).forEach((s, i) => out.push({ cat: "races", n: s.n, sub: "Race", i }));
  arr(d.classes && d.classes.classes).forEach((s, i) => out.push({ cat: "classes", n: s.n, sub: "Class", i }));
  arr(d.backgrounds && d.backgrounds.backgrounds).forEach((s, i) => out.push({ cat: "backgrounds", n: s.n, sub: "Background", i }));
  arr(d.feats && d.feats.feats).forEach((s, i) => out.push({ cat: "feats", n: s.n, sub: s.cat ? s.cat + " feat" : "Feat", i }));
  arr(d.glossary && d.glossary.entries).forEach((s, i) => out.push({ cat: "rules", n: s.n, sub: s.sec || "Rule", i }));
  return out;
}
function renderComp() {
  const p = $("pane-comp");
  if (!Object.values(MAT.data || {}).some(Boolean)) { p.innerHTML = `<div class="sect"><p class="muted">The Crawl materials haven't been downloaded yet.</p><button type="button" class="btn solid" id="compGet">Download from the Crawl website</button></div>`; return }
  if (!p.querySelector("#compQ")) {
    p.innerHTML = `<div class="sect"><input type="search" id="compQ" placeholder="Search spells, items, races, rules…" aria-label="Search the compendium"><div class="cats" id="compCats"></div><div class="cresults" id="compRes"></div></div>`;
  }
  $("compCats").innerHTML = CATS.map(([k, l]) => `<button type="button" data-cat="${k}" aria-pressed="${compCat === k}">${l}</button>`).join("");
  const q = lcs(compQ), all = compEntries().filter(e => (compCat === "all" || e.cat === compCat) && (!q || lcs(e.n).includes(q))).sort((a, b) => (lcs(a.n).startsWith(q) ? 0 : 1) - (lcs(b.n).startsWith(q) ? 0 : 1) || a.n.localeCompare(b.n));
  $("compRes").innerHTML = all.slice(0, 150).map(e => `<div class="cres" data-ce="${e.cat}:${e.i}" draggable="false"><b>${esc(e.n)}</b><small>${esc(e.sub)}</small></div>`).join("") + (all.length > 150 ? `<p class="muted small">${all.length - 150} more. Search to narrow it down.</p>` : "") + (!all.length ? `<p class="muted small">Nothing found.</p>` : "");
}
$("pane-comp").addEventListener("input", ev => { if (ev.target.id === "compQ") { compQ = ev.target.value; renderComp() } });
$("pane-comp").addEventListener("click", async ev => {
  if (ev.target.closest("#compGet")) { await materials(); renderComp(); return }
  const c = ev.target.closest("[data-cat]"); if (c) { compCat = c.dataset.cat; renderComp(); return }
  const e = ev.target.closest("[data-ce]"); if (e) { const [cat, i] = e.dataset.ce.split(":"); openEntry(cat, +i) }
});
const list = v => Array.isArray(v) ? v.map(x => typeof x === "object" ? (x.n || x.name || JSON.stringify(x)) : x).join(", ") : str(v);
const facts = rows => { const r = rows.filter(([, v]) => str(v) && !/^n\/?a$/i.test(str(v))); return r.length ? `<dl class="facts">${r.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${rich(v)}</dd>`).join("")}</dl>` : "" };
const featsH = fs => arr(fs).map(f => `<div class="feat"><h3 class="small">${esc(f.n)}${f.lv ? ` <small class="muted">Level ${esc(f.lv)}</small>` : ""}</h3>${blocks(f.d)}</div>`).join("");
const extraH = ex => facts(arr(ex).map(x => [x.k, x.v]));
function entryOf(cat, i) {
  const d = MAT.data, itemName = id => (arr(d.items && d.items.items).find(x => x.id === id) || {}).n || id;
  if (cat === "spells") {
    const s = arr(d.spells)[i], f = s.f || {};
    return { title: s.n, sub: `Level ${s.lv} · ${str(f.cat)} ${str(f.type)}`.trim(), html: facts([["Cost", f.cost], ["Casting time", f.time], ["Duration", f.dur], ["Range", f.range], ["Damage", f.dmg], ["Classes", f.cls], ["Requires", f.pre], ["Materials", f.mat], ["Tags", list(s.tags)]]) + blocks(f.desc) + (arr(s.tiers).some(t => t && t[0] && t[0] !== "—") ? `<h3>Spell ranks</h3>` + arr(s.tiers).map((t, k) => t && t[0] && t[0] !== "—" ? `<p><b>Rank +${k + 1}: ${esc(t[0])}.</b> ${rich(t[1])}</p>` : "").join("") : ""), text: [[f.cost && "Cost: " + f.cost, f.time && "Casting time: " + f.time, f.range && "Range: " + f.range, f.dmg && !/^n\/?a$/i.test(f.dmg) && "Damage: " + f.dmg].filter(Boolean).join("\n"), plain(f.desc)].join("\n\n") };
  }
  if (cat === "items") { const s = arr(d.items.items)[i]; return { title: s.n, sub: [s.rarity, s.cat, s.sub].filter(Boolean).join(" · "), html: facts([["Value", s.value], ["Weight", s.weight], ["Proficiency", s.tier], ["AP per attack", s.ap], ["Slot", s.slot], ["Actions", s.actions], ["Properties", s.props]]) + blocks(s.desc) + extraH(s.extra), text: [s.actions, s.props, plain(s.desc)].filter(Boolean).join("\n\n") } }
  if (cat === "recipes") { const s = arr(d.items.recipes)[i]; return { title: s.n, sub: `${s.tier || ""} recipe`.trim(), html: facts([["Trade", s.prof], ["Requires", s.pre], ["Workstation", s.ws], ["Time", s.time], ["DC", s.dc], ["Triumph", s.tc], ["Ingredients", arr(s.ing).map(x => `${x.qty}× ${itemName(x.item)}`).join(", ")], ["Makes", arr(s.makes).map(x => `${x.qty}× ${itemName(x.item)}`).join(", ")], ["Properties", s.props]]) + extraH(s.extra), text: `Ingredients: ${arr(s.ing).map(x => `${x.qty}× ${itemName(x.item)}`).join(", ")}` } }
  if (cat === "races") { const s = arr(d.races.races)[i]; return { title: s.n, sub: "Race", html: blocks(s.desc) + facts([["Ability", s.asi], ["Proficiency", s.prof], ["Languages", s.langs]]) + extraH(s.extra) + featsH(s.feats) + arr(s.subs).map(x => `<h3>${esc(x.n)}</h3>${blocks(x.desc)}${facts([["Ability", x.asi], ["Proficiency", x.prof]])}${featsH(x.feats)}`).join(""), text: plain(s.desc) } }
  if (cat === "classes") { const s = arr(d.classes.classes)[i]; return { title: s.n, sub: "Class", html: blocks(s.desc) + facts([["Hit die", s.hd], ["Hit points", s.hp], ["Saving throws", list(s.saves)], ["Skills", list(s.skills)], ["Skill points", s.skillPts], ["Proficiencies", list(s.prof)], ["Spellcasting", s.cast], ["Starting money", s.money]]) + featsH(s.feats) + arr(s.subs).map(x => `<h3>${esc(x.n)}</h3>${blocks(x.desc)}${featsH(x.feats)}`).join(""), text: plain(s.desc) } }
  if (cat === "backgrounds") { const s = arr(d.backgrounds.backgrounds)[i]; return { title: s.n, sub: "Background", html: blocks(s.desc) + facts([["Skills", list(s.skills)], ["Weapons", list(s.weapons)], ["Armor", list(s.armor)], ["Trades", list(s.trades)], ["Languages", list(s.langs)], ["Gear", list(s.gear)], ["Money", s.wealth]]) + featsH(s.feats), text: plain(s.desc) } }
  if (cat === "feats") { const s = arr(d.feats.feats)[i]; return { title: s.n, sub: s.cat ? s.cat + " feat" : "Feat", html: facts([["Prerequisite", s.pre], ...arr(s.extra).map(x => [x.k, x.v])]) + blocks(s.desc), text: [s.pre && "Prerequisite: " + s.pre, plain(s.desc)].filter(Boolean).join("\n\n") } }
  const s = arr(d.glossary.entries)[i];
  return { title: s.n, sub: s.sec, html: facts([["AP cost", s.ap ? (/^\d+$/.test(s.ap) ? s.ap + " AP" : s.ap) : ""], ["Requirements", s.req]]) + blocks(s.lead) + (arr(s.fx).length ? `<ul>${arr(s.fx).map(x => `<li>${rich(x)}</li>`).join("")}</ul>` : "") + blocks(s.notes) + (s.tip ? `<p class="muted small">${rich(s.tip)}</p>` : ""), text: [plain(s.lead), arr(s.fx).map(x => "• " + plain(x)).join("\n")].filter(Boolean).join("\n\n") };
}
function openEntry(cat, i) {
  let e; try { e = entryOf(cat, i) } catch (x) { console.error(x); toast("That entry couldn't be shown."); return }
  const el = openWin("ce-" + cat + i, e.title, `<p class="muted small">${esc(e.sub)}</p>${e.html}<div class="row gap"><button type="button" class="btn" data-share="${cat}:${i}">Show in chat</button></div>`, { w: 460 });
  el.querySelector("[data-share]").onclick = () => post({ t: "card", name: speaker().name, color: me.color, title: e.title, sub: e.sub, text: e.text });
}

/* ---------------------------------------------------------------- settings */
function renderSettings() {
  if (curTab !== "settings" || !G.id) return;
  const gm = isGM(), a = document.activeElement; if (a && $("pane-settings").contains(a) && a.matches("input,textarea")) return;
  const lastDl = Object.values(MAT.meta || {}).reduce((m, x) => Math.max(m, x.at || 0), 0);
  $("pane-settings").innerHTML = `<div class="sect">
<h3>You</h3><label>Your name<input type="text" id="sName" value="${esc(me.name)}" maxlength="40"></label><label class="row">Your color<input type="color" id="sColor" value="${esc(me.color)}"></label>
${gm ? `<h3>Invite players</h3><p class="muted small">${net.kind === "online" ? "Players can only join through this link. Send it to them; they open it, put in their name and join." : "This game runs on this computer only. To play with people on their own devices, set up online play below."}</p>
<div class="row"><input type="text" id="sInvite" readonly value="${esc(inviteLink())}" aria-label="Invite link"><button type="button" class="btn small" id="sCopy">Copy</button></div>
<button type="button" class="btn small" id="sNewLink">Make a new link</button><p class="muted small">A new link stops the old one from working. Players already in the game stay in.</p>` : ""}
${gm ? `<h3>Game</h3><label>Game name<input type="text" id="sGame" value="${esc(G.meta.name || "")}" maxlength="60"></label><label>Feet per square<input type="number" id="sFps" min="1" max="100" value="${FPS()}"></label>
<h3>Players</h3>${Object.entries(G.players).map(([u, p]) => `<div class="row"><span class="pav" style="--c:${esc(p.color)}"><i>${esc(initials(p.name))}</i>${esc(p.name)}</span><span class="sp"></span>${u === G.meta.gm ? `<small class="muted">Game owner</small>` : `<label class="row small"><input type="checkbox" data-gmtog="${esc(u)}"${isGMuid(u) ? " checked" : ""}> GM</label>`}</div>`).join("")}` : ""}
<h3>Crawl materials</h3><p class="small">${lastDl ? "Downloaded " + new Date(lastDl).toLocaleString() + "." : "Not downloaded yet."}${freshMat && freshMat.changes && freshMat.changes.length ? " <b>Updates are available.</b>" : ""}</p>
${freshMat && freshMat.changes && freshMat.changes.length ? changesHTML(freshMat.changes) + `<button type="button" class="btn solid" data-act="getupd">Download update</button>` : ""}<button type="button" class="btn" id="sMat">Check the Crawl website for updates</button>
<h3>Online play</h3>${CFG ? `<p class="small">Online play is on${CFG.from === "site" ? " for everyone who uses this tabletop" : " in this browser"}.</p>` : `<p class="small muted">Paste your Firebase settings here to play online. <a href="https://github.com/brodywoe-svg/crawl-1st-edition/blob/main/tabletop/SETUP.md" target="_blank" rel="noopener" target="_blank">How to get them</a></p>`}
${CFG && CFG.from === "site" ? "" : `<textarea id="sCfg" rows="5" placeholder='{ "apiKey": "…", "authDomain": "…", "databaseURL": "…", "projectId": "…" }'>${CFG ? esc(JSON.stringify(CFG.cfg, null, 1)) : ""}</textarea><div class="row gap"><button type="button" class="btn solid" id="sCfgSave">Save and reload</button>${CFG ? `<button type="button" class="btn" id="sCfgOff">Turn off online play</button>` : ""}</div><p class="muted small">Games on this computer and online games are kept separately.</p>`}</div>`;
}
function parseCfg(t) {
  const m = String(t).match(/\{[\s\S]*\}/); if (!m) return null;
  try { return JSON.parse(m[0]) } catch (e) { }
  try { return JSON.parse(m[0].replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":').replace(/'/g, '"').replace(/,\s*}/g, "}")) } catch (e) { return null }
}
$("pane-settings").addEventListener("change", async ev => {
  const t = ev.target;
  if (t.id === "sName") { me.name = t.value.trim() || me.name; savePrefs(); await net.update("players/" + me.uid, { name: me.name }); fillChatAs() }
  if (t.id === "sColor") { me.color = t.value; savePrefs(); await net.update("players/" + me.uid, { color: me.color }) }
  if (t.id === "sGame" && isGM()) net.update("meta", { name: t.value.trim() || "Game" });
  if (t.id === "sFps" && isGM()) net.update("meta", { fps: clamp(numOr(t.value, 5), 1, 100) });
  if (t.dataset.gmtog && isGM()) net.set("meta/gms/" + t.dataset.gmtog, t.checked ? true : null);
});
$("pane-settings").addEventListener("click", async ev => {
  if (ev.target.id === "sCopy") { const i = $("sInvite"); i.select(); try { await navigator.clipboard.writeText(i.value); toast("Invite link copied.") } catch (e) { document.execCommand("copy"); toast("Invite link copied.") } }
  if (ev.target.id === "sNewLink" && isGM()) { if (!ev.target.dataset.sure) { ev.target.dataset.sure = 1; ev.target.textContent = "Click again to replace the link"; return } await net.update("meta", { invite: rid(12) }); toast("New invite link made. The old one no longer works.") }
  if (ev.target.id === "sMat") { ev.target.textContent = "Checking…"; await materials(); renderSettings(); toast(freshMat && freshMat.changes.length ? "Updates are available." : freshMat && freshMat.reachable ? "Your Crawl materials are up to date." : "Couldn't reach the Crawl website.") }
  if (ev.target.id === "sCfgSave") { const c = parseCfg($("sCfg").value); if (!c || !c.apiKey || !c.databaseURL) { toast("Those settings need at least an apiKey and a databaseURL.", 4000); return } localStorage.setItem("tt-fb", JSON.stringify(c)); location.hash = ""; location.reload() }
  if (ev.target.id === "sCfgOff") { localStorage.removeItem("tt-fb"); location.hash = ""; location.reload() }
});

boot();
