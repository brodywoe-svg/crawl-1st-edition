/* Rolling dice from the play sheet or the dice roller: roll with lib/dice, keep a history for this visit,
   and, when a character is open, record the roll in its log so the session history has it. */
import { create } from "zustand";
import { roll, describe, type Roll } from "../../lib/dice";
import { useCharacter } from "../store/character";

export interface RollEntry { id: number; label: string; roll: Roll; text: string; at: number }

interface Rolls { history: RollEntry[]; last: RollEntry | null; error: string; clear(): void }
export const useRolls = create<Rolls>(set => ({ history: [], last: null, error: "", clear: () => set({ history: [], last: null, error: "" }) }));

let n = 0;
/** Roll an expression. Returns the result, or null (with the error kept in useRolls) if it can't be read. */
export function rollDice(expr: string, label = ""): Roll | null {
  let r: Roll;
  try { r = roll(expr) } catch (e) { useRolls.setState({ error: (e as Error).message }); return null }
  const entry: RollEntry = { id: ++n, label, roll: r, text: describe(r), at: Date.now() };
  useRolls.setState(s => ({ history: [entry, ...s.history].slice(0, 100), last: entry, error: "" }));
  if (useCharacter.getState().char) useCharacter.getState().dispatch({ t: "roll", expr: r.expr, total: r.total, text: entry.text, ...(label ? { label } : {}) });
  return r;
}

/** "+3", "−1", "+0" */
export const sign = (n: number) => (n < 0 ? "−" + Math.abs(n) : "+" + n);
/** A d20 roll with a modifier, as an expression: d20+3, d20-1. */
export const d20 = (mod: number) => (mod ? `d20${mod < 0 ? "-" : "+"}${Math.abs(mod)}` : "d20");
