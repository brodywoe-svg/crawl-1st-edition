import { describe, expect, it } from "vitest";
import { apply, newState, overflowOf, record, replay, undo } from "./apply";
import { LOG_CAP, type Event, type Limits, type PlayState } from "./types";

const lim: Limits = { maxHp: 20, maxPool: 6 };
const run = (s: PlayState, ...es: Event[]) => es.reduce((x, e) => apply(x, e, lim).state, s);
const combat = (over: Partial<PlayState> = {}) => newState({ hp: 20, mode: "combat", ...over });

describe("combat phases", () => {
  it("combat start and end empty the pool except EP", () => {
    const s = newState({ pool: { ap: 3, mp: 2, ep: 1 } });
    const c = apply(s, { t: "combatStart" }, lim).state;
    expect(c.mode).toBe("combat"); expect(c.pool).toEqual({ ap: 0, mp: 0, ep: 1 });
    const x = apply({ ...c, pool: { ap: 2, mp: 1, ep: 2 } }, { t: "combatEnd" }, lim).state;
    expect(x.mode).toBe("explore"); expect(x.pool).toEqual({ ap: 0, mp: 0, ep: 2 });
  });
  it("a turn replaces leftover AP with the new roll (AP doesn't carry over)", () => {
    const s = run(combat(), { t: "turnStart", roll: 3 }, { t: "turnStart", roll: 2 });
    expect(s.pool.ap).toBe(2); expect(s.turn).toBe(2);
  });
  it("a turn keeps MP and EP, and adds bonuses", () => {
    const big: Limits = { maxHp: 20, maxPool: 10 };
    const s = apply(combat({ pool: { ap: 1, mp: 2, ep: 1 } }), { t: "turnStart", roll: 2, bonus: { ap: 1, mp: 1 } }, big).state;
    expect(s.pool).toEqual({ ap: 3, mp: 3, ep: 1 });
  });
  it("can't start a turn in Exploration", () => {
    const r = apply(newState(), { t: "turnStart", roll: 4 }, lim);
    expect(r.warnings).toEqual([{ w: "notInCombat" }]); expect(r.state).toEqual(newState());
  });
});

describe("overflow", () => {
  it("keeps new AP before new MP by default, and reports what was lost", () => {
    const r = apply(combat({ pool: { ap: 0, mp: 0, ep: 2 } }), { t: "gain", ap: 3, mp: 3 }, lim);
    expect(r.state.pool).toEqual({ ap: 3, mp: 1, ep: 2 });
    expect(r.warnings).toEqual([{ w: "overflow", lost: { mp: 2 } }]);
  });
  it("follows the player's choice of what to keep", () => {
    const r = apply(combat({ pool: { ap: 0, mp: 0, ep: 2 } }), { t: "gain", ap: 3, mp: 3, keep: { ap: 1, mp: 3 } }, lim);
    expect(r.state.pool).toEqual({ ap: 1, mp: 3, ep: 2 });
  });
  it("overflowOf says how much won't fit", () => {
    expect(overflowOf(combat({ pool: { ap: 1, mp: 0, ep: 2 } }), { ap: 4 }, 6)).toBe(1);
    expect(overflowOf(combat(), { ap: 4 }, 6)).toBe(0);
    expect(overflowOf(combat(), { ap: 40 }, null)).toBe(0);
  });
  it("EP is never lost: it pushes out AP, then MP", () => {
    const r = apply(combat({ pool: { ap: 2, mp: 2, ep: 2 } }), { t: "gain", ep: 1 }, lim);
    expect(r.state.pool).toEqual({ ap: 1, mp: 2, ep: 3 });
    expect(r.warnings).toContainEqual({ w: "overflow", lost: { ap: 1 } });
  });
  it("a pool full of EP is death", () => {
    const r = apply(combat({ pool: { ap: 0, mp: 0, ep: 5 } }), { t: "gain", ep: 2 }, lim);
    expect(r.state.pool.ep).toBe(6);
    expect(r.warnings).toContainEqual({ w: "death" });
  });
  it("without a Max Pool, points are added and flagged", () => {
    const r = apply(combat(), { t: "gain", ap: 9 }, { maxHp: 20, maxPool: null });
    expect(r.state.pool.ap).toBe(9); expect(r.warnings).toEqual([{ w: "noMaxPool" }]);
  });
});

describe("spending", () => {
  it("spends AP and MP in combat", () => {
    expect(run(combat({ pool: { ap: 3, mp: 2, ep: 0 } }), { t: "spend", ap: 2 }, { t: "spend", mp: 1, for: "spell" }).pool).toEqual({ ap: 1, mp: 1, ep: 0 });
  });
  it("refuses to spend points that aren't there, and changes nothing", () => {
    const s = combat({ pool: { ap: 1, mp: 0, ep: 0 } }), r = apply(s, { t: "spend", ap: 3 }, lim);
    expect(r.state).toBe(s); expect(r.warnings).toEqual([{ w: "notEnough", need: { ap: 2 } }]);
  });
  it("AP can't pay for spells in combat, MP can't pay for actions", () => {
    const s = combat({ pool: { ap: 3, mp: 3, ep: 0 } });
    expect(apply(s, { t: "spend", ap: 1, for: "spell" }, lim).warnings[0].w).toBe("wrongPoints");
    expect(apply(s, { t: "spend", mp: 1, for: "action" }, lim).warnings[0].w).toBe("wrongPoints");
  });
  it("Exploration: up to 3 AP per action, and it comes back", () => {
    const s = newState();
    expect(apply(s, { t: "spend", ap: 3 }, lim).state.pool.ap).toBe(0);
    expect(apply(s, { t: "spend", ap: 4 }, lim).warnings).toEqual([{ w: "exploreLimit" }]);
  });
});

describe("HP, rest and the rest", () => {
  it("temp HP absorbs damage first; HP stops at 0 and warns once", () => {
    const s = newState({ hp: 10, tempHp: 4 }), r = apply(s, { t: "damage", n: 6 }, lim);
    expect(r.state.tempHp).toBe(0); expect(r.state.hp).toBe(8);
    const d = apply(r.state, { t: "damage", n: 50 }, lim);
    expect(d.state.hp).toBe(0); expect(d.warnings).toEqual([{ w: "down" }]);
    expect(apply(d.state, { t: "damage", n: 5 }, lim).warnings).toEqual([]);
  });
  it("healing stops at max HP; temp HP keeps the higher", () => {
    expect(apply(newState({ hp: 15 }), { t: "heal", n: 10 }, lim).state.hp).toBe(20);
    expect(run(newState(), { t: "tempHp", n: 5 }, { t: "tempHp", n: 3 }).tempHp).toBe(5);
  });
  it("rest removes 1 EP per 2 hours", () => {
    expect(apply(newState({ pool: { ap: 0, mp: 0, ep: 4 } }), { t: "rest", hours: 5 }, lim).state.pool.ep).toBe(2);
    expect(apply(newState({ pool: { ap: 0, mp: 0, ep: 1 } }), { t: "rest", hours: 8 }, lim).state.pool.ep).toBe(0);
  });
  it("conditions, items, money, xp, notes, concentration, set", () => {
    const s = run(newState({ inv: [{ n: "Torch", qty: 2 }] }),
      { t: "cond", add: "cond-prone" }, { t: "cond", add: "cond-prone" }, { t: "cond", add: "cond-blinded" }, { t: "cond", remove: "cond-prone" },
      { t: "item", op: "add", n: "Torch" }, { t: "item", op: "add", n: "Rope", qty: 1 }, { t: "item", op: "qty", n: "Rope", qty: 0 },
      { t: "money", delta: 250 }, { t: "money", delta: -1000 }, { t: "xp", delta: 30 }, { t: "notes", text: "hi" }, { t: "conc", spell: "Bless" },
      { t: "set", field: "ep", value: 2, why: "fix" });
    expect(s.conds).toEqual(["cond-blinded"]);
    expect(s.inv).toEqual([{ n: "Torch", qty: 3 }]);
    expect(s.money).toBe(0); expect(s.xp).toBe(30); expect(s.notes).toBe("hi"); expect(s.conc).toBe("Bless"); expect(s.pool.ep).toBe(2);
  });
  it("never changes the state it was given", () => {
    const s = combat({ pool: { ap: 2, mp: 1, ep: 0 }, conds: ["cond-prone"], inv: [{ n: "Torch", qty: 1 }] }), copy = JSON.parse(JSON.stringify(s));
    run(s, { t: "spend", ap: 1 }, { t: "cond", add: "cond-blinded" }, { t: "item", op: "add", n: "Torch" }, { t: "combatEnd" });
    expect(s).toEqual(copy);
  });
});

describe("the log", () => {
  const events: Event[] = [{ t: "combatStart" }, { t: "turnStart", roll: 4 }, { t: "spend", ap: 2 }, { t: "damage", n: 7 }, { t: "gain", ep: 1 }, { t: "roll", expr: "d20", total: 12, text: "d20 → 12" }];
  const start = () => { const s = newState({ hp: 20 }); return { state: s, logBase: s, log: [] as any[] } };

  it("records events; refused ones aren't logged", () => {
    let cur: any = start();
    for (const e of events) cur = record(cur, e, lim, "me", 1);
    expect(cur.log.length).toBe(events.length);
    const refused = record(cur, { t: "spend", ap: 99 }, lim);
    expect(refused.log.length).toBe(events.length); expect(refused.warnings[0].w).toBe("notEnough");
  });
  it("replaying the log gives the same state, and undo equals replaying all but the last", () => {
    let cur: any = start();
    for (const e of events) cur = record(cur, e, lim);
    expect(replay(cur.logBase, cur.log, lim)).toEqual(cur.state);
    const u = undo(cur, lim);
    expect(u.log.length).toBe(events.length - 1);
    expect(u.state).toEqual(run(newState({ hp: 20 }), ...events.slice(0, -1)));
    expect(undo(undo(u, lim), lim).state.hp).toBe(20); // back past the damage
  });
  it("keeps the newest events and folds older ones into base", () => {
    let cur: any = start();
    for (let i = 0; i < LOG_CAP + 25; i++) cur = record(cur, { t: "xp", delta: 1 }, lim);
    expect(cur.log.length).toBe(LOG_CAP);
    expect(cur.logBase.xp).toBe(25);
    expect(replay(cur.logBase, cur.log, lim).xp).toBe(LOG_CAP + 25);
  });
});
