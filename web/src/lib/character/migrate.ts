/* Give a Character Creator character its play layers (dev/planning/character-data.md). No DOM code here.
   Additive: every field the Creator wrote stays where it is, and state, logBase, log and overrides are added next to them.
   Safe to run on every load: a character that already has them only gets missing parts filled in. */
import { toCopper } from "../content/adapt";
import { newState } from "./apply";
import type { Character, InvItem, PlayCharacter, PlayState } from "./types";

const num = (v: unknown): number | null => { const n = parseInt(String(v ?? ""), 10); return Number.isFinite(n) ? n : null };

/** A fresh play state for a character that has never been played: full HP, an empty pool, and the Creator's inventory and purse. */
export function startingState(c: Character): PlayState {
  const snap = c.snap || {}, sheet = c.sheet || {};
  const maxHp = num(c.overrides?.maxHp) ?? num(sheet.hpmax) ?? num(snap.hp) ?? 0;
  const inv: InvItem[] = (Array.isArray(c.inv) ? c.inv : []).map(x => ({ n: String(x.n || ""), qty: Math.max(1, num(x.qty) ?? 1), ...(x.iid ? { iid: String(x.iid) } : {}), ...(x.slot ? { slot: String(x.slot) } : {}) }));
  // Creator inventory entries reference catalog items by iid and may have no name of their own; the snap has names
  (snap.inv || []).forEach((s, i) => { if (inv[i] && !inv[i].n) inv[i].n = String(s.n || "") });
  return newState({ hp: maxHp, inv, money: toCopper(snap.wealth) ?? 0 });
}

export function migrate(c: Character): PlayCharacter {
  const fresh = !c.state;
  const state: PlayState = fresh ? startingState(c) : { ...newState(), ...c.state, pool: { ...newState().pool, ...c.state!.pool } };
  const logBase: PlayState = c.logBase ? { ...newState(), ...c.logBase } : state;
  return { ...c, v: 2, state, logBase, log: Array.isArray(c.log) ? c.log : [], overrides: c.overrides && typeof c.overrides === "object" ? c.overrides : {} };
}
