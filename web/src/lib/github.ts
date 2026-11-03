/* Admin access and saving to GitHub (ported from the /*@ADMIN@*\/ block in src/page.html). No DOM code here.
   admin.json is public and holds one locked copy of a GitHub key per admin: {v:2, users:[{name, box}]}.
   A box is the key encrypted with AES-256-GCM, using a key derived from that admin's password (PBKDF2-SHA256).
   The unlocked key lives in sessionStorage, so a sign-in lasts while the tab is open, across pages.
   With Supabase on (lib/auth.ts) there's no key in the browser: gh() sends each call to the github server function,
   which checks the admin and adds the key itself. Everything built on gh() works the same either way. */
import { REPO } from "../config";
import { githubFunction } from "./auth";

export interface Box { v?: number; cipher?: string; kdf?: string; iterations?: number; salt: string; iv: string; data: string }
export interface AdminUser { name: string; box: Box }
export interface EditRecord { n: string; f: string; c: string; how: "added" | "edited" | "removed"; by: string; at: string }
export interface EditLog { v: number; edits: Record<string, EditRecord> }
export type GhError = { code: "bad_key" | "no_access" | "conflict" | "http"; status?: number };

/** The signed-in admin, if any. Same sessionStorage keys as the old site. via: how saves reach GitHub. */
export const session = { admin: false, key: null as string | null, name: "", via: "key" as "key" | "supabase" };
/** What GH_KEY holds for a Supabase sign-in: there's no real key, but the old scripts check GH_KEY before saving. */
const VIA_SUPABASE = "(supabase)";
const SS_KEY = "crawl-admin-key", SS_NAME = "crawl-admin-name";
/* The same state under the old global names, for the page scripts still shared with the old site (see web/vite/legacy-pages.ts).
   They're live bindings: importers always see the current value, but only this module can change them. */
export let ADMIN = false, GH_KEY: string | null = null, ADMIN_NAME = "";
const sync = () => { ADMIN = session.admin; GH_KEY = session.key; ADMIN_NAME = session.name };

export function saveSession(key: string, name: string): void {
  Object.assign(session, { admin: true, key, name, via: "key" }); sync();
  try { sessionStorage.setItem(SS_KEY, key); sessionStorage.setItem(SS_NAME, name) } catch { /* private mode */ }
}
/** Signed in with Supabase (which keeps its own sign-in). The marker in sessionStorage tells the tabletop, opened in this tab, you're an admin. */
export function saveSupabaseSession(name: string): void {
  Object.assign(session, { admin: true, key: VIA_SUPABASE, name, via: "supabase" }); sync();
  try { sessionStorage.setItem(SS_KEY, VIA_SUPABASE); sessionStorage.setItem(SS_NAME, name) } catch { /* private mode */ }
}
export function clearSession(): void {
  Object.assign(session, { admin: false, key: null, name: "", via: "key" }); sync();
  try { sessionStorage.removeItem(SS_KEY); sessionStorage.removeItem(SS_NAME) } catch { /* private mode */ }
}
export function storedSession(): { key: string; name: string } | null {
  try { const key = sessionStorage.getItem(SS_KEY); return key && key !== VIA_SUPABASE ? { key, name: sessionStorage.getItem(SS_NAME) || "" } : null } catch { return null }
}

// ---------------------------------------------------------------- locking keys with a password
const KDF_ITER = 600000;
const b64 = (u8: Uint8Array): string => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s) };
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function passKey(pass: string, salt: Uint8Array<ArrayBuffer>, iter: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
export async function lockKey(secret: string, pass: string): Promise<Box> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await passKey(pass, salt, KDF_ITER);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(secret)));
  return { v: 1, cipher: "AES-256-GCM", kdf: "PBKDF2-SHA256", iterations: KDF_ITER, salt: b64(salt), iv: b64(iv), data: b64(data) };
}
/** Throws if the password is wrong. */
export async function unlockKey(box: Box, pass: string): Promise<string> {
  const k = await passKey(pass, unb64(box.salt), box.iterations || KDF_ITER);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) }, k, unb64(box.data)));
}

/** The admins in an admin.json. Version 1 was a single box, which was the owner's. */
export function adminUsers(j: any): AdminUser[] | null {
  if (!j) return null;
  if (Array.isArray(j.users)) return j.users.filter((u: any) => u && u.box && u.box.data);
  return j.data && j.salt && j.iv ? [{ name: "Brody", box: j }] : null;
}
/** The deployed admin.json, or null if it's missing or has no admins yet. */
export async function fetchAdminUsers(): Promise<AdminUser[] | null> {
  try {
    const r = await fetch("admin.json?t=" + Date.now(), { cache: "no-store" });
    if (r.ok) { const u = adminUsers(await r.json()); if (u && u.length) return u }
  } catch { /* offline */ }
  return null;
}

// ---------------------------------------------------------------- the GitHub contents API
/** A call to the GitHub API for this repo, with the admin's key, or through the github server function with Supabase. */
export function gh(path: string, opts: RequestInit = {}, key = session.key): Promise<Response> {
  if (session.via === "supabase" && key === VIA_SUPABASE) return viaFunction(path, opts);
  return fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.repo}${path}`, {
    ...opts, cache: "no-store",
    headers: { Accept: "application/vnd.github+json", Authorization: "Bearer " + key, "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers as Record<string, string> || {}) },
  });
}
/** The same call, made by the github server function. It only reads and commits content files (crawl-*.json). */
function viaFunction(path: string, opts: RequestInit): Promise<Response> {
  const m = /^\/contents\/([^?]+)/.exec(path), method = (opts.method || "GET").toUpperCase();
  if (!m) return Promise.resolve(new Response(null, { status: 400 }));
  const file = decodeURIComponent(m[1]), accept = String((opts.headers as Record<string, string> | undefined)?.Accept || "");
  if (method === "GET") return githubFunction({ method, file, raw: accept.includes("raw") });
  const b = JSON.parse(String(opts.body || "{}"));
  return githubFunction({ method, file, message: b.message, content: b.content, sha: b.sha });
}

/** A file's current text on the branch, or null if it doesn't exist. */
export async function getRepoText(path: string): Promise<string | null> {
  const r = await gh(`/contents/${encodeURIComponent(path)}?ref=${REPO.branch}`, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw { code: "http", status: r.status } satisfies GhError;
  return r.text();
}

export const EDIT_LOG = "crawl-edits.json";
export const EDIT_PAGES: Record<string, string> = {
  "crawl-spells.json": "Spells", "crawl-items.json": "Items", "crawl-glossary.json": "Glossary", "crawl-classes.json": "Classes",
  "crawl-races.json": "Races", "crawl-feats.json": "Feats", "crawl-backgrounds.json": "Backgrounds",
  "crawl-creator.json": "Character Creator", "crawl-tree.json": "Skill tree",
};

/** Commit a file to the branch. Content files also get an entry in the edit log. Throws a GhError. */
export async function putFile(path: string, text: string, message: string, key = session.key): Promise<unknown> {
  const cur = await gh(`/contents/${encodeURIComponent(path)}?ref=${REPO.branch}`, {}, key);
  if (cur.status === 401) throw { code: "bad_key" } satisfies GhError;
  let sha: string | undefined, oldText: string | null = null;
  if (cur.ok) {
    const j = await cur.json(); sha = j.sha;
    if (j.content && j.encoding === "base64") { try { oldText = new TextDecoder().decode(unb64(j.content.replace(/\s/g, ""))) } catch { /* too big: fetched below */ } }
  } else if (cur.status !== 404) throw { code: "http", status: cur.status } satisfies GhError;
  if (sha && oldText == null && EDIT_PAGES[path]) { try { oldText = await getRepoText(path) } catch { /* log without a diff */ } }
  if (session.name && path !== "admin.json") message += ` (by ${session.name})`;
  const body: Record<string, string> = { message, branch: REPO.branch, content: b64(new TextEncoder().encode(text)) };
  if (sha) body.sha = sha;
  const r = await gh(`/contents/${encodeURIComponent(path)}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }, key);
  if (r.status === 401) throw { code: "bad_key" } satisfies GhError;
  if (r.status === 403 || r.status === 404) throw { code: "no_access" } satisfies GhError;
  if (r.status === 409) throw { code: "conflict" } satisfies GhError;
  if (!r.ok) throw { code: "http", status: r.status } satisfies GhError;
  const out = await r.json();
  if (EDIT_PAGES[path] && session.name) { try { await recordEdits(path, oldText, text) } catch { /* the save itself worked */ } }
  return out;
}

// ---------------------------------------------------------------- who edited what (crawl-edits.json)
/** Called with the new log after each recorded edit, so an open history panel can refresh. */
export const editLogListeners = new Set<(log: EditLog) => void>();

/** Every keyed thing in a content file (spell, item, class, feature, node...), flattened to path -> {name, category, json}. */
function editItems(text: string): Map<string, { n: string; c: string; j: string }> {
  const out = new Map<string, { n: string; c: string; j: string }>();
  let v: any; try { v = JSON.parse(text) } catch { return out }
  const keyOf = (o: any) => (o && typeof o === "object" && !Array.isArray(o) ? String(o.id || o.n || o.name || "") : "");
  const strip = (o: any): any => Array.isArray(o) ? o.map(x => (keyOf(x) ? "#" + keyOf(x) : strip(x)))
    : o && typeof o === "object" ? Object.fromEntries(Object.keys(o).map(k => [k, strip(o[k])])) : o;
  const isMap = (o: any) => o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length && Object.values(o).every(x => x && typeof x === "object" && !Array.isArray(x));
  const kids = (o: any, pre: string): void => {
    if (!o || typeof o !== "object") return;
    Object.keys(o).forEach(k => {
      const c = o[k];
      if (Array.isArray(c)) arr(c, pre + "." + k, k);
      else if (isMap(c)) Object.keys(c).forEach(id => { const x = c[id]; out.set(pre + "." + k + "/" + id, { n: x.n || id, c: k, j: JSON.stringify(strip(x)) }) });
      else if (c && typeof c === "object") kids(c, pre + "." + k);
    });
  };
  const arr = (a: any[], pre: string, cat: string) => a.forEach(x => {
    const k = keyOf(x);
    if (k) { const key = pre + "/" + k; out.set(key, { n: String(x.n || x.name || k), c: cat, j: JSON.stringify(strip(x)) }); kids(x, key) }
    else if (x && typeof x === "object") kids(x, pre);
  });
  if (Array.isArray(v)) arr(v, "", ""); else kids(v, "");
  return out;
}

async function recordEdits(path: string, oldText: string | null, newText: string): Promise<void> {
  const a = editItems(oldText || "null"), b = editItems(newText), at = new Date().toISOString(), by = session.name;
  const ch: Record<string, EditRecord> = {};
  b.forEach((x, k) => { const o = a.get(k); if (!o || o.j !== x.j) ch[path + k] = { n: x.n, f: path, c: x.c, how: o ? "edited" : "added", by, at } });
  a.forEach((x, k) => { if (!b.has(k)) ch[path + k] = { n: x.n, f: path, c: x.c, how: "removed", by, at } });
  if (!Object.keys(ch).length && oldText !== newText) ch[path] = { n: EDIT_PAGES[path] + " settings", f: path, c: "", how: "edited", by, at };
  if (!Object.keys(ch).length) return;
  for (let i = 0; i < 3; i++) {
    let log: EditLog = { v: 1, edits: {} };
    try { const t = await getRepoText(EDIT_LOG); if (t) log = JSON.parse(t) } catch { /* start a new log */ }
    log.edits = Object.assign(log.edits || {}, ch);
    log.edits = Object.fromEntries(Object.entries(log.edits).sort((x, y) => y[1].at.localeCompare(x[1].at)).slice(0, 3000));
    try { await putFile(EDIT_LOG, JSON.stringify(log, null, 1) + "\n", "Record who edited what"); editLogListeners.forEach(f => f(log)); return }
    catch (e) { if ((e as GhError)?.code !== "conflict") return }
  }
}
