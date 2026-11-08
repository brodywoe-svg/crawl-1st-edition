/* The state system (dev/planning/character-data.md): every change in play is an event, and apply() works out the next state.
   Pure functions, no DOM: the same code can later check events on a server or a shared tabletop.
   The Action Pool rules come from the glossary (Action Pool; Action Points, Magic Points, and Exhaustion Points; Exploration;
   Phases of Combat). Brody is to check them; anything we had to interpret is marked "Interpretation". */
import type { Event, Limits, LogEntry, Pool, PlayState, Warning } from "./types";
import { LOG_CAP } from "./types";

export const EXPLORE_AP = 3; // "During Exploration, every creature has a steady 3 Action Points"

export function newState(over: Partial<PlayState> = {}): PlayState {
  return { mode: "explore", hp: 0, tempHp: 0, pool: { ap: 0, mp: 0, ep: 0 }, conds: [], inv: [], money: 0, xp: 0, conc: "", notes: "", turn: 0, ...over };
}

const total = (p: Pool) => p.ap + p.mp + p.ep;
const nat = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));

/** Add points to the pool. EP always goes in (it "can't be lost to overflow"); if AP and MP don't all fit, the player's
    `keep` choice says how many of each new point to keep, otherwise new AP is kept before new MP.
    Interpretation: if new EP itself overfills the pool, AP and then MP already in it are pushed out. */
function addPoints(pool: Pool, gain: Partial<Pool>, max: number | null, keep: Partial<Pool> | undefined, warnings: Warning[]): Pool {
  const g = { ap: nat(gain.ap), mp: nat(gain.mp), ep: nat(gain.ep) };
  const p = { ...pool, ep: pool.ep + g.ep };
  if (max == null) { if (g.ap || g.mp || g.ep) warnings.push({ w: "noMaxPool" }); return { ap: p.ap + g.ap, mp: p.mp + g.mp, ep: p.ep } }
  const lost: Partial<Pool> = {};
  if (p.ep > max) p.ep = max;
  // EP pushing out points already in the pool
  let over = total(p) - max;
  if (over > 0) { const a = Math.min(p.ap, over); p.ap -= a; over -= a; const m = Math.min(p.mp, over); p.mp -= m; if (a) lost.ap = a; if (m) lost.mp = m }
  // the new AP and MP: what fits
  const room = max - total(p);
  let ap = g.ap, mp = g.mp;
  if (ap + mp > room) {
    if (keep) { ap = Math.min(nat(keep.ap), g.ap); mp = Math.min(nat(keep.mp), g.mp); if (ap + mp > room) { mp = Math.max(0, room - ap); ap = Math.min(ap, room) } }
    else { ap = Math.min(g.ap, room); mp = Math.min(g.mp, room - ap) }
    if (g.ap - ap) lost.ap = (lost.ap || 0) + g.ap - ap;
    if (g.mp - mp) lost.mp = (lost.mp || 0) + g.mp - mp;
  }
  if (lost.ap || lost.mp) warnings.push({ w: "overflow", lost });
  return { ap: p.ap + ap, mp: p.mp + mp, ep: p.ep };
}

/** How many of a gain wouldn't fit, so the sheet can ask the player what to keep before sending the event. */
export function overflowOf(state: PlayState, gain: Partial<Pool>, max: number | null): number {
  if (max == null) return 0;
  return Math.max(0, Math.min(state.pool.ep + nat(gain.ep), max) + state.pool.ap + state.pool.mp + nat(gain.ap) + nat(gain.mp) - max);
}

export function apply(state: PlayState, e: Event, lim: Limits): { state: PlayState; warnings: Warning[] } {
  const s: PlayState = { ...state, pool: { ...state.pool }, conds: [...state.conds], inv: state.inv.map(i => ({ ...i })) };
  const warnings: Warning[] = [];
  const max = lim.maxPool;
  const unchanged = (w: Warning) => ({ state, warnings: [w] });

  switch (e.t) {
    case "combatStart": // "At the start of Combat all creatures' Action Pools empty, except for Exhaustion Points"
      s.mode = "combat"; s.pool = { ap: 0, mp: 0, ep: s.pool.ep }; s.turn = 0; break;
    case "combatEnd": // "all Action Pools empty except for EP, and everyone returns to Exploration"
      s.mode = "explore"; s.pool = { ap: 0, mp: 0, ep: s.pool.ep }; s.turn = 0; break;
    case "turnStart": { // roll the Action Die and gain points; "Any AP you haven't spent by the start of your next turn is lost"
      if (s.mode !== "combat") return unchanged({ w: "notInCombat" });
      s.pool.ap = 0; s.turn += 1;
      s.pool = addPoints(s.pool, { ap: nat(e.roll) + nat(e.bonus?.ap), mp: nat(e.bonus?.mp) }, max, e.keep, warnings);
      break;
    }
    case "gain":
      s.pool = addPoints(s.pool, { ap: e.ap, mp: e.mp, ep: e.ep }, max, e.keep, warnings); break;
    case "spend": {
      const ap = nat(e.ap), mp = nat(e.mp);
      if (s.mode === "explore") {
        // Exploration: a steady 3 AP that returns after each action, so nothing is used up. MP isn't generated in Exploration.
        if (ap > EXPLORE_AP) return unchanged({ w: "exploreLimit" });
        if (mp > s.pool.mp) return unchanged({ w: "notEnough", need: { mp: mp - s.pool.mp } });
        s.pool.mp -= mp; break;
      }
      if (e.for === "spell" && ap) return unchanged({ w: "wrongPoints", msg: "AP can't be spent on spells during combat." });
      if (e.for === "action" && mp) return unchanged({ w: "wrongPoints", msg: "MP can't be spent on actions." });
      if (ap > s.pool.ap || mp > s.pool.mp) return unchanged({ w: "notEnough", need: { ...(ap > s.pool.ap ? { ap: ap - s.pool.ap } : {}), ...(mp > s.pool.mp ? { mp: mp - s.pool.mp } : {}) } });
      s.pool.ap -= ap; s.pool.mp -= mp; break;
    }
    case "rest": // "1 EP for every 2 hours of rest"
      s.pool.ep = Math.max(0, s.pool.ep - Math.floor(nat(e.hours) / 2)); break;
    case "damage": { // temporary HP goes first
      let n = nat(e.n); const t = Math.min(s.tempHp, n); s.tempHp -= t; n -= t;
      s.hp = Math.max(0, s.hp - n); if (s.hp === 0 && state.hp > 0) warnings.push({ w: "down" }); break;
    }
    case "heal":
      s.hp = lim.maxHp == null ? s.hp + nat(e.n) : Math.min(lim.maxHp, s.hp + nat(e.n)); break;
    case "tempHp": // Interpretation (as in the SRD): temporary HP doesn't stack; keep the higher
      s.tempHp = Math.max(s.tempHp, nat(e.n)); break;
    case "cond":
      if (e.add && !s.conds.includes(e.add)) s.conds.push(e.add);
      if (e.remove) s.conds = s.conds.filter(c => c !== e.remove);
      break;
    case "item": {
      const i = s.inv.findIndex(x => (e.iid ? x.iid === e.iid : x.n === e.n));
      if (e.op === "add") { if (i >= 0) s.inv[i].qty += Math.max(1, nat(e.qty ?? 1)); else s.inv.push({ n: e.n, qty: Math.max(1, nat(e.qty ?? 1)), ...(e.iid ? { iid: e.iid } : {}) }) }
      else if (i >= 0 && e.op === "remove") s.inv.splice(i, 1);
      else if (i >= 0 && e.op === "qty") { s.inv[i].qty = nat(e.qty); if (!s.inv[i].qty) s.inv.splice(i, 1) }
      break;
    }
    case "money": s.money = Math.max(0, s.money + Math.round(Number(e.delta) || 0)); break;
    case "xp": s.xp = Math.max(0, s.xp + Math.round(Number(e.delta) || 0)); break;
    case "conc": s.conc = String(e.spell || ""); break;
    case "notes": s.notes = String(e.text || ""); break;
    case "roll": break; // recorded in the log only
    case "set": {
      const v = Math.round(Number(e.value) || 0);
      if (e.field === "ap" || e.field === "mp" || e.field === "ep") s.pool[e.field] = Math.max(0, v);
      else s[e.field] = Math.max(0, v);
      break;
    }
  }
  // "If your Action Pool is ever completely filled with Exhaustion Points, you die."
  if (max != null && max > 0 && s.pool.ep >= max && state.pool.ep < max) warnings.push({ w: "death" });
  return { state: s, warnings };
}

/** Apply an event and record it. Returns the new state, logBase and log (the log keeps the newest LOG_CAP; older events fold into logBase). */
export function record(cur: { state: PlayState; logBase: PlayState; log: LogEntry[] }, e: Event, lim: Limits, by?: string, at = Date.now()) {
  const r = apply(cur.state, e, lim);
  if (r.state === cur.state) return { ...cur, warnings: r.warnings }; // refused: nothing changed, nothing logged
  let log = [...cur.log, { e, at, ...(by ? { by } : {}) }], logBase = cur.logBase;
  while (log.length > LOG_CAP) { logBase = apply(logBase, log[0].e, lim).state; log = log.slice(1) }
  return { state: r.state, logBase, log, warnings: r.warnings };
}

/** Rebuild state from logBase by applying the log in order. */
export function replay(base: PlayState, log: LogEntry[], lim: Limits): PlayState {
  return log.reduce((s, l) => apply(s, l.e, lim).state, base);
}

/** Undo the last event: replay everything before it. */
export function undo(cur: { state: PlayState; logBase: PlayState; log: LogEntry[] }, lim: Limits) {
  if (!cur.log.length) return cur;
  const log = cur.log.slice(0, -1);
  return { state: replay(cur.logBase, log, lim), logBase: cur.logBase, log };
}
