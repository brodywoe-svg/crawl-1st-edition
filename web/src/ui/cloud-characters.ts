/* Keeps the Character Creator's characters in step with your account (phase 2, dev/planning/supabase-database.md).
   src/creator.js is shared with the old site, so it only calls window.crawlCloud if it exists (it never does there):
     saved(list)   after every save to localStorage
     removed(id)   when a character is deleted
     label         shown next to "My characters"
   and it reloads its list when this fires "crawl-characters-changed" on window.
   localStorage stays the working copy, so the Creator works offline and signed out. */
import { SUPABASE_ON, onAuthChange } from "../lib/auth";
import { fetchCharacters, saveCharacters, deleteCharacter, mergeCharacters, stamp, type Char } from "../lib/characters";

const LS = "crawl-characters";
/** Whose characters are in localStorage now. Another account's are set aside under crawl-characters:<their id>, never uploaded to yours. */
const OWNER = "crawl-characters-owner", aside = (id: string) => "crawl-characters:" + id;

interface CloudHook { label: string; saved(list: Char[]): void; removed(id: string): void }
declare global { interface Window { crawlCloud?: CloudHook } }

const LOCAL = "Saved in this browser", SYNCED = "Saved to your account", FAILED = "Saved in this browser (couldn't reach your account)";
let user: string | null = null;
const sent = new Map<string, number>(); // id -> the stamp the account has
let queue = new Map<string, Char>(), timer = 0;

const read = (k: string): Char[] => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v.filter(c => c && c.id) : [] } catch { return [] } };
const write = (k: string, list: Char[]) => { try { localStorage.setItem(k, JSON.stringify(list)) } catch { /* full or private mode */ } };
const changed = () => window.dispatchEvent(new Event("crawl-characters-changed"));
const hook: CloudHook = { label: LOCAL, saved, removed };

function saved(list: Char[]): void {
  if (!user) return;
  for (const c of list) if (stamp(c) > (sent.get(c.id) ?? -1)) queue.set(c.id, c);
  if (!queue.size) return;
  clearTimeout(timer);
  timer = window.setTimeout(flush, 1500);
}
async function flush(): Promise<void> {
  const uid = user, batch = [...queue.values()]; queue = new Map();
  if (!uid || !batch.length) return;
  try { await saveCharacters(uid, batch); batch.forEach(c => sent.set(c.id, stamp(c))); setLabel(SYNCED) }
  catch { batch.forEach(c => queue.set(c.id, c)); setLabel(FAILED) } // tried again on the next save
}
function removed(id: string): void {
  queue.delete(id); sent.delete(id);
  if (user) deleteCharacter(user, id).catch(() => setLabel(FAILED));
}
function setLabel(l: string): void { if (hook.label !== l) { hook.label = l; changed() } }

/** Signed in: bring this device's characters and the account's together. */
async function connect(uid: string): Promise<void> {
  user = uid; sent.clear(); queue.clear();
  const owner = localStorage.getItem(OWNER);
  let local = read(LS);
  if (owner && owner !== uid) {
    // someone else's characters on this device: set them aside for them, and bring back any of yours set aside earlier
    write(aside(owner), local); local = read(aside(uid)); localStorage.removeItem(aside(uid));
  }
  try {
    const { merged, upload } = mergeCharacters(local, await fetchCharacters());
    write(LS, merged); localStorage.setItem(OWNER, uid);
    merged.forEach(c => sent.set(c.id, stamp(c)));
    upload.forEach(c => sent.delete(c.id));
    if (user !== uid) return; // signed out meanwhile
    hook.label = SYNCED; changed();
    if (upload.length) saved(upload);
  } catch {
    write(LS, local); hook.label = FAILED; changed();
  }
}
function disconnect(): void {
  clearTimeout(timer); user = null; queue.clear(); sent.clear();
  hook.label = LOCAL; changed(); // this device keeps its copies
}

if (SUPABASE_ON) {
  window.crawlCloud = hook;
  onAuthChange((_event, uid) => {
    if (uid && uid !== user) connect(uid);
    else if (!uid && user) disconnect();
  }).catch(() => { /* offline: stays local */ });
}
