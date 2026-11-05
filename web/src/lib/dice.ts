/* Dice rolling, shared by the play sheet and the dice roller (and, later, the tabletop). No DOM code here.
   Ported from tabletop/dice.js, same syntax: roll("4d6kh3 + 2").
   Supports NdM, d%, keep highest/lowest (kh3, kl1, k = kh), drop lowest/highest (dl1, dh1, d = dl), exploding (!),
   + - * / between terms (left to right, / rounds down), and plain numbers. Up to 100 dice per term, d1000 at most. */

export interface Die { v: number; drop?: boolean; extra?: boolean }    // extra: an exploded re-roll
export type Part =
  | { op: "+" | "-" | "*" | "/"; dice: string; sides: number; rolls: Die[]; sum: number }
  | { op: "+" | "-" | "*" | "/"; num: number };
export interface Roll { expr: string; total: number; parts: Part[] }
/** Returns a whole number from 1 to n. Tests pass their own, so rolls are repeatable. */
export type Rng = (n: number) => number;

export const cryptoRng: Rng = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return (a[0] % n) + 1 };

const TERM = /^\s*(?:(\d*)d(\d+|%)((?:kh|kl|dh|dl|k|d)\d*)?(!)?|(\d+(?:\.\d+)?))\s*/i;
type Op = "+" | "-" | "*" | "/";

export function roll(expr: string, rng: Rng = cryptoRng): Roll {
  const src = String(expr || "").trim();
  if (!src) throw new Error("Nothing to roll");
  let rest = src.replace(/\s+/g, " "), total = 0, op: Op = "+", first = true;
  const parts: Part[] = [];
  while (rest.length) {
    if (!first) {
      const m = rest.match(/^\s*([+\-*/])\s*/);
      if (!m) break;
      op = m[1] as Op; rest = rest.slice(m[0].length);
    }
    const t = rest.match(TERM);
    if (!t || !t[0].trim()) throw new Error(`I can't read "${rest.trim()}"`);
    rest = rest.slice(t[0].length); first = false;
    let val: number, part: Part;
    if (t[5] != null) { val = +t[5]; part = { op, num: val } }
    else {
      const n = Math.min(100, t[1] === "" ? 1 : +t[1]), sides = t[2] === "%" ? 100 : +t[2];
      if (!n || !sides || sides > 1000) throw new Error("That dice size isn't supported");
      const rolls: Die[] = [];
      for (let i = 0; i < n; i++) {
        let v = rng(sides); rolls.push({ v });
        if (t[4] && sides > 1) { let guard = 0; while (v === sides && guard++ < 20) { v = rng(sides); rolls.push({ v, extra: true }) } }
      }
      if (t[3]) {
        const m = t[3].toLowerCase().match(/^(kh|kl|dh|dl|k|d)(\d*)$/)!, kind = m[1] === "k" ? "kh" : m[1] === "d" ? "dl" : m[1], cnt = m[2] === "" ? 1 : +m[2];
        const order = rolls.map((r, i) => [r.v, i] as const).sort((a, b) => a[0] - b[0]);
        let drop: (readonly [number, number])[] = [];
        if (kind === "kh") drop = order.slice(0, Math.max(0, rolls.length - cnt));
        if (kind === "kl") drop = order.slice(cnt);
        if (kind === "dl") drop = order.slice(0, cnt);
        if (kind === "dh") drop = order.slice(Math.max(0, rolls.length - cnt));
        drop.forEach(([, i]) => { rolls[i].drop = true });
      }
      val = rolls.filter(r => !r.drop).reduce((s, r) => s + r.v, 0);
      part = { op, dice: `${n}d${t[2]}${t[3] || ""}${t[4] || ""}`, sides, rolls, sum: val };
    }
    if (!parts.length) part.op = "+";
    parts.push(part);
    total = op === "+" ? total + val : op === "-" ? total - val : op === "*" ? total * val : Math.floor(total / val);
  }
  if (rest.trim()) throw new Error(`I can't read "${rest.trim()}"`);
  return { expr: src, total, parts };
}

/** The dice inside a line of text, such as "2d12 Acid damage" → "2d12". */
export function diceIn(text: string): string {
  const m = String(text || "").match(/\b\d*d(?:\d+|%)(?:\s*[+-]\s*\d+(?!d))?/i);
  return m ? m[0].replace(/\s+/g, "") : "";
}

/** One line for a log or chat: "4d6kh3 + 2 → [6, 5, (1), 4] + 2 = 17". Dropped dice are in brackets. */
export function describe(r: Roll): string {
  const bits = r.parts.map((p, i) => {
    const s = "num" in p ? String(p.num) : `[${p.rolls.map(d => (d.drop ? `(${d.v})` : String(d.v))).join(", ")}]`;
    return i ? `${p.op} ${s}` : s;
  });
  return `${r.expr} → ${bits.join(" ")} = ${r.total}`;
}
