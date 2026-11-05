import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adapt } from "../content/adapt";
import { record } from "./apply";
import { derive } from "./derive";
import { migrate } from "./migrate";
import type { Character } from "./types";

/** What blankChar() in src/creator.js makes. */
const blankChar = (): Character => ({ id: "pc_blank", v: 1, name: "", race: "", sub: "", cls: "", subcls: "", bg: "", bgCustom: null, loadout: "", major: "", minor: "", fopt: {}, spellUp: {}, moneyRoll: null, method: "roll", base: {} as any, dice: {}, stored: null, rolls: 0, asi: [],
  prof: { skill: {}, save: {}, weapon: {}, armor: {}, trade: {} }, choice: {}, langs: [], spells: [], inv: [], details: {}, rank: {}, sheet: {}, seen: {}, step: 0, done: false, made: 1 });
/** fixChar() in src/creator.js: what the old Creator does to every character it loads, before saving it again. */
const fixChar = (c: any) => { const b: any = blankChar(); c = { ...b, ...c }; c.prof = { ...b.prof, ...(c.prof || {}) }; return c };

/** A finished level 1 Fighter, as the Creator saves it (with its snap). */
const fighter = (): Character => ({
  ...blankChar(), id: "pc_test", name: "Brakka", race: "dwarf", cls: "fighter", bg: "soldier", done: true,
  inv: [{ iid: "i-buckler", qty: 1, slot: "off" }, { n: "Rations", qty: 5 }],
  sheet: { "ac:Natural": "10" },
  snap: { v: 1, name: "Brakka", level: 1, race: "Dwarf", cls: "Fighter", hp: 14, ac: 15, init: 1, pool: { max: "5", die: "d4" },
    inv: [{ n: "Buckler", qty: 1, slot: "off", weight: "2 lbs", value: "3 (G)", iid: "i-buckler" }, { n: "Rations", qty: 5, slot: "", weight: "", value: "", iid: "" }], wealth: "12 (G) 5 (S)" },
});

describe("migrate", () => {
  it("adds the play layers and keeps every Creator field", () => {
    const c = fighter(), m = migrate(c);
    expect(m.v).toBe(2);
    for (const k of Object.keys(c)) if (k !== "v") expect(m[k]).toEqual(c[k]);
    expect(m.state.hp).toBe(14);
    expect(m.state.pool).toEqual({ ap: 0, mp: 0, ep: 0 });
    expect(m.state.inv).toEqual([{ n: "Buckler", qty: 1, iid: "i-buckler", slot: "off" }, { n: "Rations", qty: 5 }]);
    expect(m.state.money).toBe(1250);
    expect(m.log).toEqual([]); expect(m.overrides).toEqual({}); expect(m.logBase).toEqual(m.state);
  });
  it("is safe to run again: it doesn't reset play", () => {
    const m = migrate(fighter()), lim = { maxHp: 14, maxPool: 5 };
    const r = record(m, { t: "damage", n: 4 }, lim);
    const played = { ...m, ...r }, again = migrate(played);
    expect(again.state.hp).toBe(10); expect(again.log.length).toBe(1); expect(migrate(again)).toEqual(again);
  });
  it("survives the old Creator loading and saving it (fixChar keeps unknown fields)", () => {
    const m = migrate(fighter()), lim = { maxHp: 14, maxPool: 5 };
    const played = { ...m, ...record(m, { t: "gain", ep: 2 }, lim) };
    const back = fixChar(JSON.parse(JSON.stringify(played)));
    expect(back.state).toEqual(played.state); expect(back.log).toEqual(played.log); expect(back.logBase).toEqual(played.logBase);
    expect(back.base).toEqual(fighter().base); // the Creator's ability scores, untouched expect(back.v).toBe(2);
  });
  it("handles a blank, never-finished character", () => {
    const m = migrate(blankChar());
    expect(m.state.hp).toBe(0); expect(m.state.inv).toEqual([]); expect(m.state.money).toBe(0);
  });
});

describe("derive", () => {
  const ROOT = join(__dirname, "../../../..");
  const read = (f: string) => JSON.parse(readFileSync(join(ROOT, f), "utf8"));
  const content = adapt({ classes: read("crawl-classes.json"), items: read("crawl-items.json"), glossary: read("crawl-glossary.json") });

  it("takes the Max Pool and Action Die from the class chart for every charted class", () => {
    for (const k of content.classes.values()) {
      const row = k.chart.find(r => r.lv === 1);
      const d = derive({ ...fighter(), cls: k.id, snap: { level: 1 } }, content);
      if (row?.pool != null) { expect(d.maxPool).toBe(row.pool); expect(d.source.maxPool).toBe("chart") }
      if (row?.die != null) { expect(d.die).toBe(row.die); expect(d.source.die).toBe("chart") }
    }
  });
  it("overrides win, then the Creator's sheet fields, then the chart, then the snap", () => {
    const base = { ...fighter(), cls: "nope" };
    expect(derive(base, content).maxPool).toBe(5); expect(derive(base, content).source.maxPool).toBe("creator");
    expect(derive({ ...base, sheet: { pool: "7" } }, content).maxPool).toBe(7);
    expect(derive({ ...base, sheet: { pool: "7" }, overrides: { maxPool: 9 } }, content).maxPool).toBe(9);
    expect(derive({ ...base, overrides: { maxHp: 30 } }, content).maxHp).toBe(30);
  });
  it("copes with no snap and no content", () => {
    const d = derive(blankChar(), null);
    expect(d.maxHp).toBeNull(); expect(d.maxPool).toBeNull(); expect(d.die).toBeNull(); expect(d.name).toBe("Unnamed character");
  });
});
