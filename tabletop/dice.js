/* Crawl Tabletop dice.
   roll("4d6kh3 + 2") -> { expr, total, parts:[{dice:"4d6", rolls:[{v, drop}], sum} | {num}], text }
   Supports NdM, d%, keep highest/lowest (kh3, kl1), drop lowest/highest (dl1, dh1), exploding (!),
   + - * between terms, and plain numbers. Up to 100 dice per term. */
const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n + 1 };
const TERM = /^\s*(?:(\d*)d(\d+|%)((?:kh|kl|dh|dl|k|d)\d*)?(!)?|(\d+(?:\.\d+)?))\s*/i;

export function roll(expr) {
  const src = String(expr || "").trim();
  if (!src) throw new Error("Nothing to roll");
  let rest = src.replace(/\s+/g, " "), total = 0, op = "+", parts = [], first = true;
  while (rest.length) {
    if (!first) {
      const m = rest.match(/^\s*([+\-*/])\s*/);
      if (!m) break;
      op = m[1]; rest = rest.slice(m[0].length);
    }
    const t = rest.match(TERM);
    if (!t) throw new Error(`I can't read "${rest}"`);
    rest = rest.slice(t[0].length); first = false;
    let val, part;
    if (t[5] != null) { val = +t[5]; part = { num: val } }
    else {
      const n = Math.min(100, t[1] === "" ? 1 : +t[1]), sides = t[2] === "%" ? 100 : +t[2];
      if (!n || !sides || sides > 1000) throw new Error("That dice size isn't supported");
      let rolls = [];
      for (let i = 0; i < n; i++) {
        let v = rnd(sides); rolls.push({ v });
        if (t[4] && sides > 1) { let guard = 0; while (v === sides && guard++ < 20) { v = rnd(sides); rolls.push({ v, extra: true }) } }
      }
      if (t[3]) {
        const m = t[3].toLowerCase().match(/^(kh|kl|dh|dl|k|d)(\d*)$/), kind = m[1] === "k" ? "kh" : m[1] === "d" ? "dl" : m[1], cnt = m[2] === "" ? 1 : +m[2];
        const order = rolls.map((r, i) => [r.v, i]).sort((a, b) => a[0] - b[0]);
        let drop = [];
        if (kind === "kh") drop = order.slice(0, Math.max(0, rolls.length - cnt));
        if (kind === "kl") drop = order.slice(cnt);
        if (kind === "dl") drop = order.slice(0, cnt);
        if (kind === "dh") drop = order.slice(Math.max(0, rolls.length - cnt));
        drop.forEach(([, i]) => { rolls[i].drop = true });
      }
      val = rolls.filter(r => !r.drop).reduce((s, r) => s + r.v, 0);
      part = { dice: `${n}d${t[2]}${t[3] || ""}${t[4] || ""}`, sides, rolls, sum: val };
    }
    part.op = parts.length ? op : "+";
    parts.push(part);
    total = op === "+" ? total + val : op === "-" ? total - val : op === "*" ? total * val : Math.floor(total / val);
  }
  if (rest.trim()) throw new Error(`I can't read "${rest.trim()}"`);
  return { expr: src, total, parts };
}

/* the dice inside a line of text such as "2d12 Acid damage" */
export function diceIn(text) { const m = String(text || "").match(/\b\d*d(?:\d+|%)(?:\s*[+-]\s*\d+(?!d))?/i); return m ? m[0].replace(/\s+/g, "") : "" }
