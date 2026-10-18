/* Crawl Tabletop: game materials from the Crawl 1st Edition website.
   The tabletop keeps a downloaded copy (IndexedDB) so it works offline. check() asks the website for the latest
   files and reports what changed; download() replaces the copy. */
import { kvGet, kvSet } from "./net.js";

export const SITE = "https://brodywoe-svg.github.io/crawl-1st-edition/";
export const FILES = [
  ["races", "crawl-races.json", "Races"], ["classes", "crawl-classes.json", "Classes"], ["backgrounds", "crawl-backgrounds.json", "Backgrounds"],
  ["spells", "crawl-spells.json", "Spells"], ["items", "crawl-items.json", "Items and recipes"], ["feats", "crawl-feats.json", "Feats"], ["glossary", "crawl-glossary.json", "Glossary"], ["rules", "crawl-creator.json", "Creator rules"]
];
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0).toString(36) };
/* names inside each file, to describe what changed */
function names(key, j) {
  if (!j) return [];
  if (key === "spells") return Array.isArray(j) ? j.map(s => s.n) : [];
  if (key === "items") return [...(j.items || []).map(i => i.n), ...(j.recipes || []).map(r => "Recipe: " + r.n)];
  if (key === "glossary") return (j.entries || []).map(e => e.n);
  if (key === "races") return (j.races || []).flatMap(r => [r.n, ...(r.subs || []).map(s => s.n)]);
  if (key === "classes") return (j.classes || []).flatMap(r => [r.n, ...(r.subs || []).map(s => s.n)]);
  if (key === "backgrounds") return (j.backgrounds || []).map(b => b.n);
  if (key === "feats") return (j.feats || []).map(f => f.n);
  return [];
}
/* the site's files: next to the tabletop when it's served from the site, otherwise from the public site */
async function fetchFile(file) {
  for (const base of [new URL("../", location.href).href, SITE]) {
    try { const r = await fetch(base + file, { cache: "no-cache" }); if (r.ok) { const t = await r.text(); JSON.parse(t); return t } } catch (e) { }
  }
  return null;
}
export async function loadLocal() {
  const out = {}, meta = (await kvGet("content:meta")) || {};
  for (const [key] of FILES) { const t = await kvGet("content:" + key); try { out[key] = t ? JSON.parse(t) : null } catch (e) { out[key] = null } }
  return { data: out, meta };
}
/* -> { reachable, changes:[{key, label, added:[], removed:[], changed:bool}], fresh:{key: text} } */
export async function check() {
  const meta = (await kvGet("content:meta")) || {}, fresh = {}, changes = [];
  let reachable = false;
  for (const [key, file, label] of FILES) {
    const t = await fetchFile(file); if (t == null) continue; reachable = true; fresh[key] = t;
    if (meta[key] && meta[key].hash === hash(t)) continue;
    const old = await kvGet("content:" + key); let oldNames = [];
    try { oldNames = old ? names(key, JSON.parse(old)) : [] } catch (e) { }
    const nu = names(key, JSON.parse(t)), a = new Set(oldNames), b = new Set(nu);
    changes.push({ key, label, added: nu.filter(n => !a.has(n)), removed: oldNames.filter(n => !b.has(n)), changed: true, first: !old });
  }
  return { reachable, changes, fresh };
}
export async function download(fresh, keys) {
  const meta = (await kvGet("content:meta")) || {};
  for (const key of keys) { if (fresh[key] == null) continue; await kvSet("content:" + key, fresh[key]); meta[key] = { hash: hash(fresh[key]), at: Date.now() } }
  await kvSet("content:meta", meta);
  return loadLocal();
}
