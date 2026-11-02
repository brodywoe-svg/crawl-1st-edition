/* The admin UI shared by every page (ported from the /*@ADMIN@*\/ block in src/page.html):
   the sign-in and setup modal, the account modal (name, password, other admins), the Admin Options menu
   and the "Last edited by" panel. The GitHub and crypto side is in lib/github.ts. */
import "../styles/admin.css";
import { $, esc } from "./dom";
import { ADMIN_MODAL } from "./admin-modal.html";
import { toggleTree } from "./theme";
import {
  session, saveSession, clearSession, storedSession, lockKey, unlockKey, adminUsers, fetchAdminUsers,
  getRepoText, putFile, editLogListeners, EDIT_LOG, EDIT_PAGES, type AdminUser, type EditLog, type GhError,
} from "../lib/github";

/** Pages can react to signing in and out, or block signing out (e.g. with unsaved edits). */
export const adminHooks = { canSignOut: () => true, signedIn: (_quiet: boolean) => {}, signedOut: () => {} };

/** Which content files each page edits, for the "This page" filter of the edit history. */
const HIST_FILES: Record<string, string[]> = {
  "spells.html": ["crawl-spells.json"], "items.html": ["crawl-items.json"], "crafting.html": ["crawl-items.json"],
  "glossary.html": ["crawl-glossary.json"], "conditions.html": ["crawl-glossary.json"], "classes.html": ["crawl-classes.json"],
  "races.html": ["crawl-races.json"], "feats.html": ["crawl-feats.json"], "backgrounds.html": ["crawl-backgrounds.json"],
  "creator.html": ["crawl-creator.json", "crawl-tree.json"],
};
const HIST_SS = "crawl-hist";
const histOn = () => { try { return sessionStorage.getItem(HIST_SS) === "1" } catch { return false } };

let edits: EditLog | null = null, histFilter = "page", histWho = "";
let adminMode: "login" | "setup" = "login";
let acctUsers: AdminUser[] | null = null, acctSure = "";

// ---------------------------------------------------------------- signed-in state
function showAdminBtn(): void {
  document.documentElement.classList.toggle("is-admin", session.admin);
  $("adminBtn").classList.toggle("on", session.admin);
  $("adminLabel").textContent = session.admin ? `Admin · ${session.name || "Signed in"}` : "Admin";
  $("aoptWrap").hidden = !session.admin;
  aoptSync(); histShow();
}
function becomeAdmin(key: string, quiet: boolean, name: string): void {
  saveSession(key, name); closeAdmin(); showAdminBtn(); adminHooks.signedIn(quiet);
}
function signOut(): void {
  if (!adminHooks.canSignOut()) return;
  clearSession(); closeAcct(); showAdminBtn(); adminHooks.signedOut();
}

// ---------------------------------------------------------------- sign-in / setup modal
function setAdminMode(m: "login" | "setup"): void {
  adminMode = m;
  $("loginPane").hidden = m !== "login"; $("setupPane").hidden = m !== "setup";
  $("adminTitle").textContent = m === "login" ? "Admin sign-in" : "Set up admin access";
  $("adminGo").textContent = m === "login" ? "Unlock" : "Save and unlock";
  $("adminSwitch").textContent = m === "login" ? "First time? Set up admin access" : "Back to sign-in";
  $("adminErr").textContent = "";
}
const focusFirst = () => (adminMode === "login" ? $("adminPass") : $("setupKey")).focus();
async function openAdmin(): Promise<void> {
  $<HTMLFormElement>("adminForm").reset();
  setAdminMode((await fetchAdminUsers()) ? "login" : "setup");
  $("adminModal").hidden = false; focusFirst();
}
function closeAdmin(): void { $("adminModal").hidden = true; $<HTMLFormElement>("adminForm").reset(); $("adminErr").textContent = "" }
const val = (id: string) => $<HTMLInputElement>(id).value || "";

async function submitAdmin(e: SubmitEvent): Promise<void> {
  e.preventDefault();
  const err = (m: string) => { $("adminErr").textContent = m };
  const go = $<HTMLButtonElement>("adminGo");
  if (!window.crypto || !crypto.subtle) { err("This browser can't do the secure unlock. Open the site over https in a current browser."); return }
  if (adminMode === "login") {
    const pass = val("adminPass"); if (!pass) { err("Type your admin password."); return }
    go.disabled = true; err("Checking…");
    try {
      const users = await fetchAdminUsers(); if (!users) { setAdminMode("setup"); err("Admin access isn't set up yet."); return }
      let key: string | null = null, who = "";
      for (const u of users) { try { key = await unlockKey(u.box, pass); who = u.name; break } catch { /* not this admin's password */ } }
      if (!key) { err("That password isn't right."); return }
      becomeAdmin(key, false, who);
    } finally { go.disabled = false }
  } else {
    const key = val("setupKey").trim(), nm = val("setupName").trim(), p1 = val("setupPass"), p2 = val("setupPass2");
    if (!key) { err("Paste your GitHub access key."); return }
    if (!nm) { err("Type your name. It shows next to the things you edit."); return }
    if (p1.length < 12) { err("Use at least 12 characters for the password."); return }
    if (p1 !== p2) { err("The two passwords don't match."); return }
    go.disabled = true; err("Locking the key and saving…");
    try {
      const box = await lockKey(key, p1);
      await putFile("admin.json", JSON.stringify({ v: 2, users: [{ name: nm, box }] }, null, 1) + "\n", "Set up admin access", key);
      becomeAdmin(key, false, nm);
    } catch (x) {
      const c = (x as GhError)?.code;
      err(c === "bad_key" ? "GitHub didn't accept that key. Check you copied all of it."
        : c === "no_access" ? "That key can't change this repo. Give it access to this repository with Contents set to Read and write."
        : "Couldn't reach GitHub. Try again in a moment.");
    } finally { go.disabled = false }
  }
}

// ---------------------------------------------------------------- account modal (signed in)
const ACCT_MODAL = `<div class="modal" id="acctModal" hidden><div class="mbox acctbox" role="dialog" aria-modal="true" aria-labelledby="acctTitle">
<div class="mhead"><h2 id="acctTitle">Admin</h2></div><div class="mbody" id="acctBody"></div>
<div class="mfoot"><button type="button" class="mlink" id="acctOut">Sign out</button><span class="mbtns"><button type="button" class="btn" id="acctClose">Close</button></span></div></div></div>`;

async function loadAcct(): Promise<void> {
  try { const t = await getRepoText("admin.json"); acctUsers = adminUsers(t ? JSON.parse(t) : null) || [] } catch { acctUsers = null }
}
function acctHTML(): string {
  const me = session.name, us = acctUsers;
  return `<p class="mnote">Signed in as <b>${esc(me || "an admin")}</b>. Your name is shown next to everything you edit.</p>
<h3 class="acth">Your name</h3><div class="actrow"><input type="text" id="acName" value="${esc(me)}" maxlength="40" autocomplete="off"><button type="button" class="btn" data-acct="name">Change name</button></div>
<h3 class="acth">Change your password</h3>
<label class="mlabel" for="acP1">New password</label><input type="password" id="acP1" autocomplete="new-password">
<label class="mlabel" for="acP2">Type it again</label><input type="password" id="acP2" autocomplete="new-password">
<div class="actrow"><button type="button" class="btn solid" data-acct="pass">Change my password</button></div>
<h3 class="acth">Admins</h3>${us == null ? `<p class="mnote">Couldn't load the admin list. Check your connection and reopen this.</p>` : `<ul class="actlist">${us.map(u => `<li><b>${esc(u.name)}</b>${u.name === me ? ` <small>(you)</small>` : `<button type="button" class="btn${acctSure === u.name ? " gdel" : ""}" data-acct="remove" data-who="${esc(u.name)}">${acctSure === u.name ? "Click again to remove" : "Remove"}</button>`}</li>`).join("")}</ul>`}
<h3 class="acth">Add an admin</h3><p class="mnote">Choose their name and a starting password, then tell them the password in person. They can change it after signing in.</p>
<label class="mlabel" for="acNN">Their name</label><input type="text" id="acNN" maxlength="40" autocomplete="off">
<label class="mlabel" for="acNP1">Their password</label><input type="password" id="acNP1" autocomplete="new-password">
<label class="mlabel" for="acNP2">Type it again</label><input type="password" id="acNP2" autocomplete="new-password">
<div class="actrow"><button type="button" class="btn solid" data-acct="add">Add admin</button></div>
<p class="merr" id="acctErr" role="alert"></p>`;
}
async function openAcct(): Promise<void> {
  acctSure = ""; $("acctTitle").textContent = "Admin"; $("acctBody").innerHTML = `<p class="mnote">Loading…</p>`; $("acctModal").hidden = false;
  await loadAcct(); $("acctBody").innerHTML = acctHTML();
}
function closeAcct(): void { const m = document.getElementById("acctModal"); if (m) m.hidden = true }
async function saveUsers(users: AdminUser[], msg: string, done: string): Promise<void> {
  const err = (m: string) => { const e = document.getElementById("acctErr"); if (e) e.textContent = m };
  err("Saving…");
  try { await putFile("admin.json", JSON.stringify({ v: 2, users }, null, 1) + "\n", msg); acctUsers = users; acctSure = ""; $("acctBody").innerHTML = acctHTML(); err(done) }
  catch (x) {
    const c = (x as GhError)?.code;
    err(c === "bad_key" ? "GitHub no longer accepts the access key." : c === "conflict" ? "The admin list changed while you were editing. Close this and open it again." : "Saving failed. Check your connection and try again.");
  }
}
async function acctClick(e: MouseEvent): Promise<void> {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-acct]"); if (!b || !acctUsers) return;
  const a = b.dataset.acct, err = (m: string) => { $("acctErr").textContent = m };
  const users = acctUsers.map(u => ({ ...u })), meI = users.findIndex(u => u.name === session.name);
  if (a === "name") {
    const n = val("acName").trim(); if (!n) { err("Type a name."); return } if (n === session.name) return;
    if (users.some(u => u.name.toLowerCase() === n.toLowerCase())) { err("Another admin already has that name."); return }
    const old = session.name; if (meI >= 0) users[meI].name = n; saveSession(session.key!, n); showAdminBtn();
    await saveUsers(users, `Rename admin ${old} to ${n}`, "Name changed."); return;
  }
  if (a === "pass") {
    const p1 = val("acP1"), p2 = val("acP2");
    if (p1.length < 12) { err("Use at least 12 characters for the password."); return } if (p1 !== p2) { err("The two passwords don't match."); return }
    err("Locking your key with the new password…"); const box = await lockKey(session.key!, p1);
    if (meI >= 0) users[meI].box = box; else users.push({ name: session.name || "Admin", box });
    await saveUsers(users, `Change the admin password for ${session.name}`, "Password changed. Use the new one next time you sign in."); return;
  }
  if (a === "add") {
    const n = val("acNN").trim(), p1 = val("acNP1"), p2 = val("acNP2");
    if (!n) { err("Type their name."); return } if (users.some(u => u.name.toLowerCase() === n.toLowerCase())) { err("There's already an admin with that name."); return }
    if (p1.length < 12) { err("Use at least 12 characters for their password."); return } if (p1 !== p2) { err("The two passwords don't match."); return }
    err("Locking a copy of the key with their password…"); const box = await lockKey(session.key!, p1); users.push({ name: n, box });
    await saveUsers(users, `Add admin ${n}`, `${n} can now sign in with that password.`); return;
  }
  if (a === "remove") {
    const w = b.dataset.who!; if (acctSure !== w) { acctSure = w; $("acctBody").innerHTML = acctHTML(); return }
    await saveUsers(users.filter(u => u.name !== w), `Remove admin ${w}`, `${w} can no longer sign in.`);
  }
}

// ---------------------------------------------------------------- Admin Options menu and edit history
const AOPT = `<div class="aopt" id="aoptWrap" hidden><button type="button" class="aoptbtn" id="aoptBtn" aria-haspopup="true" aria-expanded="false">Admin Options<span class="aoptcar" aria-hidden="true"></span></button>
<div class="aoptmenu" id="aoptMenu" role="menu" hidden>
<button type="button" role="menuitem" data-aopt="acct"><b>Admins and sign-in</b><small>Add or remove admins, change your name or password</small></button>
<button type="button" role="menuitemcheckbox" data-aopt="tree" aria-checked="false"><span class="tsw" aria-hidden="true"></span><b>Tree mode</b></button>
<button type="button" role="menuitemcheckbox" data-aopt="hist" id="histBtn" aria-checked="false"><span class="tsw" aria-hidden="true"></span><b>Last edited by</b></button>
<button type="button" role="menuitem" data-aopt="out" class="aoptout"><b>Sign out</b></button></div></div>`;
const HIST_PANEL = `<aside class="histpanel" id="histPanel" hidden aria-label="Edit history"><div class="hph"><b>Last edited by</b><button type="button" class="hpx" id="histX" aria-label="Close edit history">×</button></div>
<div class="hpf"><button type="button" data-hf="page" aria-pressed="true">This page</button><button type="button" data-hf="all" aria-pressed="false">Everything</button><select id="histWho" aria-label="Who"><option value="">Everyone</option></select></div><div class="hpl" id="histList"></div></aside>`;

function aoptSync(): void {
  const m = document.getElementById("aoptMenu"); if (!m) return;
  m.querySelector('[data-aopt="tree"]')?.setAttribute("aria-checked", String(document.documentElement.getAttribute("data-tree") === "on"));
  m.querySelector('[data-aopt="hist"]')?.setAttribute("aria-checked", String(session.admin && histOn()));
}
async function histLoad(): Promise<void> {
  try { const t = await getRepoText(EDIT_LOG); edits = t ? JSON.parse(t) : { v: 1, edits: {} } } catch { /* keep what we had */ }
  histRender();
}
function histShow(): void {
  const b = document.getElementById("histBtn"), p = document.getElementById("histPanel"); if (!b || !p) return;
  const on = session.admin && histOn(); b.setAttribute("aria-checked", String(on)); p.hidden = !on; aoptSync();
  if (on) { if (!edits) histLoad(); else histRender() }
}
function histRender(): void {
  const l = document.getElementById("histList"); if (!l) return;
  if (!edits) { l.innerHTML = `<p class="hpe">Loading…</p>`; return }
  const pg = location.pathname.split("/").pop() || "index.html", files = HIST_FILES[pg];
  const all = Object.values(edits.edits || {}).sort((a, b) => b.at.localeCompare(a.at));
  const who = [...new Set(all.map(x => x.by))].sort(), sel = $<HTMLSelectElement>("histWho");
  sel.innerHTML = `<option value="">Everyone</option>` + who.map(w => `<option${w === histWho ? " selected" : ""}>${esc(w)}</option>`).join("");
  const rows = all.filter(x => (histFilter === "all" || !files || files.includes(x.f)) && (!histWho || x.by === histWho)).slice(0, 150);
  const CATS: Record<string, string> = { presets: "Preset", recipes: "Recipe", opts: "Option", subs: "Subclass", nodes: "Tree node", extra: "Tree node", entries: "Entry", items: "Item", classes: "Class", races: "Race", backgrounds: "Background" };
  const cat = (x: { c: string; f: string }) => (x.c === "feats" ? (x.f === "crawl-feats.json" ? "Feat" : "Feature") : CATS[x.c] || "");
  const when = (t: string) => { const d = new Date(t); return isNaN(+d) ? "" : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) };
  l.innerHTML = rows.length
    ? rows.map(x => `<div class="hpi ${x.how}"><b>${esc(x.n)}</b><small>${esc([EDIT_PAGES[x.f] || x.f, cat(x)].filter(Boolean).join(" · "))} · ${x.how}</small><span><span class="who">${esc(x.by)}</span> · ${when(x.at)}</span></div>`).join("")
    : `<p class="hpe">${files && histFilter === "page" ? "Nothing on this page has been edited since edit history started." : "No edits recorded yet."} Edits are recorded from now on, each time someone saves.</p>`;
}

function wireOptions(): void {
  const menu = $("aoptMenu"), btn = $("aoptBtn"), openM = (o: boolean) => { menu.hidden = !o; btn.setAttribute("aria-expanded", String(o)) };
  window.addEventListener("crawl-tree-mode", aoptSync);
  btn.addEventListener("click", e => { e.stopPropagation(); openM(menu.hidden !== false) });
  document.addEventListener("click", e => { if (e.isTrusted && !(e.target as HTMLElement).closest("#aoptWrap")) openM(false) });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !menu.hidden) { openM(false); btn.focus() } });
  menu.addEventListener("click", e => {
    const it = (e.target as HTMLElement).closest<HTMLElement>("[data-aopt]"); if (!it) return;
    const a = it.dataset.aopt;
    if (a === "acct") { openM(false); openAcct(); return }
    if (a === "out") { openM(false); signOut(); return }
    if (a === "hist") { const on = !histOn(); try { sessionStorage.setItem(HIST_SS, on ? "1" : "0") } catch { /* private mode */ } histShow(); aoptSync(); return }
    if (a === "tree") { toggleTree(); openM(true); aoptSync() }
  });
  $("histX").addEventListener("click", () => { try { sessionStorage.setItem(HIST_SS, "0") } catch { /* private mode */ } histShow(); aoptSync() });
  $("histPanel").addEventListener("click", e => {
    const f = (e.target as HTMLElement).closest<HTMLElement>("[data-hf]"); if (!f) return;
    histFilter = f.dataset.hf!; document.querySelectorAll("#histPanel [data-hf]").forEach(x => x.setAttribute("aria-pressed", String(x === f))); histRender();
  });
  $<HTMLSelectElement>("histWho").addEventListener("change", e => { histWho = (e.target as HTMLSelectElement).value; histRender() });
}

// ---------------------------------------------------------------- setup
/** Add the admin modals, menu and panel to the page, wire them up, and restore a sign-in from earlier in this tab.
    Needs the #adminBtn from the nav controls. */
export function initAdmin(): void {
  const ab = $("adminBtn");
  ab.insertAdjacentHTML("afterend", AOPT);
  document.body.insertAdjacentHTML("beforeend", ADMIN_MODAL + ACCT_MODAL + HIST_PANEL);
  ab.hidden = false;
  ab.addEventListener("click", () => { if (session.admin) openAcct(); else openAdmin() });
  $("adminSwitch").addEventListener("click", () => { setAdminMode(adminMode === "login" ? "setup" : "login"); focusFirst() });
  $("adminCancel").addEventListener("click", closeAdmin);
  $("adminModal").addEventListener("click", e => { if (e.target === $("adminModal")) closeAdmin() });
  $<HTMLFormElement>("adminForm").addEventListener("submit", submitAdmin);
  $("acctClose").addEventListener("click", closeAcct);
  $("acctOut").addEventListener("click", () => { closeAcct(); signOut() });
  $("acctModal").addEventListener("click", e => { if (e.target === $("acctModal")) closeAcct() });
  $("acctBody").addEventListener("click", acctClick);
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!$("adminModal").hidden) closeAdmin();
    if (!$("acctModal").hidden) closeAcct();
  });
  wireOptions();
  editLogListeners.add(log => { edits = log; histRender() });
  const s = storedSession();
  if (s) becomeAdmin(s.key, true, s.name); else showAdminBtn();
}
