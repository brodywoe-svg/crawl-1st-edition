import { describe as group, expect, it } from "vitest";
import { roll, diceIn, describe, type Rng } from "./dice";

/** An RNG that returns these numbers in turn (then repeats the last). */
const seq = (...vals: number[]): Rng => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)] };

group("roll", () => {
  it("stays in range over many real rolls", () => {
    for (const [expr, lo, hi] of [["d4", 1, 4], ["2d6", 2, 12], ["d20+3", 4, 23], ["d%", 1, 100], ["4d6kh3", 3, 18]] as const) {
      for (let i = 0; i < 500; i++) { const t = roll(expr).total; expect(t).toBeGreaterThanOrEqual(lo); expect(t).toBeLessThanOrEqual(hi) }
    }
  });
  it("adds dice and numbers", () => {
    expect(roll("2d6 + 3", seq(4, 5)).total).toBe(12);
    expect(roll("1d8 - 2", seq(1)).total).toBe(-1);
    expect(roll("5", seq()).total).toBe(5);
  });
  it("works left to right with * and /, rounding down", () => {
    expect(roll("2d4 * 2", seq(3, 4)).total).toBe(14);
    expect(roll("d20 / 2", seq(7)).total).toBe(3);
  });
  it("keeps and drops", () => {
    expect(roll("4d6kh3", seq(1, 6, 3, 5)).total).toBe(14);
    expect(roll("2d20kl1", seq(17, 4)).total).toBe(4);
    expect(roll("2d20k", seq(17, 4)).total).toBe(17); // k = keep highest 1
    expect(roll("4d6dl1", seq(2, 2, 6, 6)).total).toBe(14);
    expect(roll("3d6dh1", seq(6, 1, 2)).total).toBe(3);
    const r = roll("4d6kh3", seq(1, 6, 3, 5)).parts[0];
    expect("rolls" in r && r.rolls.filter(d => d.drop).map(d => d.v)).toEqual([1]);
  });
  it("explodes on the highest face", () => {
    const r = roll("1d6!", seq(6, 6, 2));
    expect(r.total).toBe(14);
    expect("rolls" in r.parts[0] && r.parts[0].rolls.length).toBe(3);
  });
  it("treats d% as d100", () => {
    const r = roll("d%", seq(100));
    expect(r.total).toBe(100);
    expect("sides" in r.parts[0] && r.parts[0].sides).toBe(100);
  });
  it("refuses what it can't read", () => {
    expect(() => roll("")).toThrow();
    expect(() => roll("2d6 + banana")).toThrow();
    expect(() => roll("d0")).toThrow();
    expect(() => roll("d5000")).toThrow();
    expect(() => roll("hello")).toThrow();
  });
  it("caps a term at 100 dice", () => {
    const r = roll("500d1");
    expect(r.total).toBe(100);
  });
});

group("helpers", () => {
  it("finds dice in text", () => {
    expect(diceIn("2d12 Acid damage")).toBe("2d12");
    expect(diceIn("deals 1d6 + 2 fire")).toBe("1d6+2");
    expect(diceIn("no dice here")).toBe("");
  });
  it("describes a roll", () => {
    expect(describe(roll("4d6kh3 + 2", seq(6, 5, 1, 4)))).toBe("4d6kh3 + 2 → [6, 5, (1), 4] + 2 = 17");
  });
});
