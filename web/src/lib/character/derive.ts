/* Derived numbers: worked out every time, never saved (dev/planning/character-data.md). No DOM code here.
   Minimal for the prototypes: the Max Pool and Action Die come from the class chart (typed content), and the rest comes
   from the play sheet's overrides, the Creator's own sheet fields, or the numbers the Creator saved in `snap`.
   The full port of the Creator's maths (profState, skillTotal, hpOf…) comes with the React Creator. */
import type { Content } from "../content/types";
import type { Character, Limits, Snap } from "./types";

export interface Derived extends Limits {
  name: string; level: number; race: string; cls: string; bg: string; portrait: string;
  die: string | null;                 // the Action Die, e.g. "d6"
  ac: number | null; init: number | null; speed: string; hd: string;
  abil: NonNullable<Snap["abil"]>;
  skills: NonNullable<Snap["skills"]>;
  weapons: NonNullable<Snap["weapons"]>;
  spells: NonNullable<Snap["spells"]>;
  feats: NonNullable<Snap["feats"]>;
  /** Where each number came from, for the sheet to show (an override is marked). */
  source: Record<"maxHp" | "maxPool" | "die" | "ac", "override" | "sheet" | "chart" | "creator" | "none">;
}

const num = (v: unknown): number | null => { const n = parseInt(String(v ?? ""), 10); return Number.isFinite(n) ? n : null };
const die = (v: unknown): string | null => { const s = String(v ?? "").trim().toLowerCase(); return /^d\d+$/.test(s) ? s : null };

export function derive(c: Character, content: Content | null): Derived {
  const snap: Snap = c.snap || {}, sheet = c.sheet || {}, over = c.overrides || {};
  const level = num(snap.level) || 1;
  const row = content && c.cls ? content.classes.get(String(c.cls))?.chart.find(r => r.lv === level) : undefined;
  const source = {} as Derived["source"];

  /** The first value found: the play sheet's override, the Creator's sheet field, the class chart, then the Creator's snap. */
  function pick<T>(key: keyof Derived["source"], parse: (v: unknown) => T | null, ...rest: [Derived["source"][typeof key], unknown][]): T | null {
    for (const [src, v] of [["override", over[key]], ...rest] as [Derived["source"][typeof key], unknown][]) {
      const p = parse(v); if (p != null) { source[key] = src; return p }
    }
    source[key] = "none"; return null;
  }
  const maxHp = pick("maxHp", num, ["sheet", sheet.hpmax], ["creator", snap.hp]);
  const maxPool = pick("maxPool", num, ["sheet", sheet.pool], ["chart", row?.pool], ["creator", snap.pool?.max]);
  const d = pick("die", die, ["sheet", sheet.ad], ["chart", row?.die], ["creator", snap.pool?.die]);
  const ac = pick("ac", num, ["creator", snap.ac]);

  return {
    name: String(c.name || snap.name || "Unnamed character"), level, race: snap.race || "", cls: snap.cls || "", bg: snap.bg || "", portrait: snap.portrait || "",
    maxHp, maxPool, die: d, ac, init: num(snap.init), speed: snap.speed || "", hd: snap.hd || "",
    abil: snap.abil || {}, skills: snap.skills || [], weapons: snap.weapons || [], spells: snap.spells || [], feats: snap.feats || [],
    source,
  };
}
