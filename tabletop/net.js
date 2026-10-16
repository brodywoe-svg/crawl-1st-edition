/* Crawl Tabletop: the game's shared state.
   Both backends expose the same small API over a tree of data under games/<gameId>/:
     on(path, cb) -> unsubscribe     cb(value) now and whenever anything at or under path changes
     get(path) -> Promise<value>
     set(path, value), update(path, {k: v}), push(path, value) -> key, remove(path)
     presence(info)                  marks this player online (and offline when they leave)
   LocalNet:    this computer only. Every open tab of the same game stays in sync (BroadcastChannel), and the
                game is kept in IndexedDB so it's still there tomorrow. No accounts or setup.
   FirebaseNet: online play through a free Firebase Realtime Database (see tabletop/SETUP.md).
                Players sign in anonymously; anyone with the game link can join. */

const rid = (n = 8) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map(x => "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]).join("") };
export const newId = p => (p ? p + "-" : "") + Date.now().toString(36) + rid(4);
const split = p => String(p || "").split("/").filter(Boolean);
const clone = v => v == null ? null : JSON.parse(JSON.stringify(v));
/* paths overlap when one is inside the other */
const overlaps = (a, b) => { const x = split(a), y = split(b), n = Math.min(x.length, y.length); for (let i = 0; i < n; i++) if (x[i] !== y[i]) return false; return true };

/* ---------------------------------------------------------------- IndexedDB, for big things like map images */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("crawl-tabletop", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function kvGet(k) { try { const db = await idb(); return await new Promise(res => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null) }) } catch (e) { return null } }
export async function kvSet(k, v) { try { const db = await idb(); await new Promise(res => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = res; t.onerror = res }) } catch (e) { } }

/* ---------------------------------------------------------------- this computer */
export class LocalNet {
  constructor() {
    this.kind = "local"; this.subs = new Set(); this.tree = {};
    try { this.uid = localStorage.getItem("tt-uid") || ("u" + rid(10)); localStorage.setItem("tt-uid", this.uid) } catch (e) { this.uid = "u" + rid(10) }
  }
  async init() { return this.uid }
  async join(gameId) {
    if (this.gameId === gameId && this.bc) return;
    if (this.key) { clearTimeout(this.saveT); await kvSet(this.key, this.tree) }
    this.gameId = gameId; this.key = "game:" + gameId;
    this.tree = (await kvGet(this.key)) || {};
    if (this.bc) this.bc.close();
    this.bc = new BroadcastChannel("crawl-tabletop-" + gameId);
    this.bc.onmessage = ev => { const m = ev.data; if (m && m.op === "set") { this._apply(m.path, m.value); this._fire(m.path) } };
  }
  async exists(gameId) { return (this.gameId === gameId && !!this.tree.meta) || !!(await kvGet("game:" + gameId)) }
  _node(path, make) {
    let n = this.tree; const parts = split(path);
    for (let i = 0; i < parts.length - 1; i++) { if (n[parts[i]] == null || typeof n[parts[i]] !== "object") { if (!make) return undefined; n[parts[i]] = {} } n = n[parts[i]] }
    return [n, parts[parts.length - 1]];
  }
  _get(path) { if (!split(path).length) return this.tree; const r = this._node(path); return r ? r[0][r[1]] : undefined }
  _apply(path, value) {
    if (!split(path).length) { this.tree = value || {}; return }
    const [n, k] = this._node(path, true);
    if (value == null) delete n[k]; else n[k] = clone(value);
  }
  _fire(path) { this.subs.forEach(s => { if (overlaps(s.path, path)) s.cb(clone(this._get(s.path)) ?? null) }) }
  _save() { clearTimeout(this.saveT); this.saveT = setTimeout(() => kvSet(this.key, this.tree), 300) }
  on(path, cb) { const s = { path, cb }; this.subs.add(s); setTimeout(() => this.subs.has(s) && cb(clone(this._get(path)) ?? null)); return () => this.subs.delete(s) }
  async get(path) { return clone(this._get(path)) ?? null }
  async set(path, value) { this._apply(path, value); this._save(); this._fire(path); this.bc && this.bc.postMessage({ op: "set", path, value: clone(value) }) }
  async update(path, obj) { for (const k in obj) await this.set(path + "/" + k, obj[k]) }
  async push(path, value) { const k = newId(); await this.set(path + "/" + k, value); return k }
  async remove(path) { return this.set(path, null) }
  presence() { }
  leave() { if (this.bc) this.bc.close(); this.subs.clear() }
}

/* ---------------------------------------------------------------- online, through Firebase */
const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export class FirebaseNet {
  constructor(config) { this.kind = "online"; this.config = config }
  async init() {
    const [{ initializeApp }, dbm, authm] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-database.js"), import(FB + "firebase-auth.js")]);
    this.m = dbm;
    const app = initializeApp(this.config, "crawl-tabletop");
    this.db = dbm.getDatabase(app);
    const auth = authm.getAuth(app);
    const cred = await authm.signInAnonymously(auth);
    this.uid = cred.user.uid;
    return this.uid;
  }
  ref(path) { return this.m.ref(this.db, "games/" + this.gameId + (split(path).length ? "/" + split(path).join("/") : "")) }
  async join(gameId) { this.gameId = gameId }
  async exists(gameId) { const s = await this.m.get(this.m.ref(this.db, "games/" + gameId + "/meta")); return s.exists() }
  on(path, cb, opts) {
    let q = this.ref(path);
    if (opts && opts.last) q = this.m.query(q, this.m.limitToLast(opts.last));
    return this.m.onValue(q, s => cb(s.val()));
  }
  async get(path) { const s = await this.m.get(this.ref(path)); return s.val() }
  set(path, value) { return this.m.set(this.ref(path), value ?? null) }
  update(path, obj) { return this.m.update(this.ref(path), obj) }
  async push(path, value) { const r = this.m.push(this.ref(path)); await this.m.set(r, value); return r.key }
  remove(path) { return this.m.remove(this.ref(path)) }
  presence(info) {
    const me = this.ref("players/" + this.uid), on = this.ref("players/" + this.uid + "/online");
    this.m.update(me, { ...info, online: true, seen: this.m.serverTimestamp() });
    this.m.onDisconnect(on).set(false);
  }
  leave() { }
}
