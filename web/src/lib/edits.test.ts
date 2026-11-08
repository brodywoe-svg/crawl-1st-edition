import { describe, expect, it } from "vitest";
import { changelog, changeText, dayLabel, type EditLog } from "./edits";

const e = (key: string, n: string, how: string, at: string, by = "Brody Woelke") => [key, { n, f: key.slice(0, key.indexOf(".json") + 5), c: "", how, by, at }] as const;
const LOG: EditLog = {
  v: 1,
  edits: Object.fromEntries([
    e("crawl-classes.json.classes/class-monk", "Monk", "edited", "2026-10-31T01:21:00Z"),
    e("crawl-classes.json.classes/class-monk.feats/Resolve", "Resolve", "added", "2026-10-31T01:21:00Z"),
    e("crawl-classes.json.classes/class-monk.feats/Prowess", "Prowess", "removed", "2026-10-31T01:21:00Z"),
    e("crawl-classes.json.classes/class-rogue.feats/Guile", "Guile", "added", "2026-10-31T01:19:00Z"),
    e("crawl-glossary.json.entries/Broken", "Broken", "edited", "2026-10-31T00:48:00Z"),
    e("crawl-glossary.json.entries/Rage", "Rage", "edited", "2026-10-31T00:21:00Z"),
    e("crawl-glossary.json.entries/Use Magical Device", "Use Magical Device", "added", "2026-10-31T01:10:00Z"),
    e("crawl-glossary.json.entries/Charge", "Charge", "edited", "2026-10-30T12:00:00Z", "Maddox"),
    e("crawl-tree.json.nodes/cls:class-ranger", "cls:class-ranger", "edited", "2026-10-31T02:15:00Z"),
    e("crawl-creator.json", "Character Creator settings", "edited", "2026-10-31T02:16:00Z"),
  ]),
};

describe("changelog", () => {
  const c = changelog(LOG);
  it("leaves out the skill tree and Creator settings", () => {
    expect(c.some(x => x.page === "Skill tree" || x.title.includes("cls:"))).toBe(false);
    expect(c.some(x => x.title.includes("Creator"))).toBe(false);
  });
  it("is newest first, one line per class per day", () => {
    expect(c.map(x => x.title)).toEqual(["Monk", "Rogue", "Glossary", "Glossary"]);
  });
  it("gathers a class's changes, and links to the class", () => {
    expect(c[0]).toMatchObject({ page: "Classes", href: "classes.html#class-monk", day: "2026-10-31" });
    expect(changeText(c[0])).toBe("added Resolve · removed Prowess");
  });
  it("names a class from its id when only its features changed", () => {
    expect(c[1]).toMatchObject({ title: "Rogue", href: "classes.html#class-rogue" });
  });
  it("groups glossary entries per day", () => {
    expect(changeText(c[2])).toBe("added Use Magical Device · updated Broken, Rage");
    expect(c[3]).toMatchObject({ day: "2026-10-30", by: ["Maddox"] });
  });
  it("says 'updated' for a record edited on its own, and shortens long lists", () => {
    const one = changelog({ edits: Object.fromEntries([e("crawl-races.json.races/race-x", "Dwarf", "edited", "2026-11-01T00:00:00Z")]) });
    expect(one[0].title).toBe("Dwarf");
    expect(changeText(one[0])).toBe("updated");
    expect(changeText({ ...c[2], parts: ["A", "B", "C", "D", "E"].map(n => ({ n, how: "edited" })) })).toBe("updated A, B, C and 2 more");
  });
  it("names numbered choices", () => {
    const f = changelog({ edits: Object.fromEntries([e("crawl-classes.json.classes/class-fighter.choices/5", "5", "added", "2026-11-01T00:00:00Z")]) });
    expect(changeText(f[0])).toBe("added choice 5");
  });
  it("copes with an empty or missing log, and keeps to the limit", () => {
    expect(changelog(null)).toEqual([]);
    expect(changelog({ v: 1 })).toEqual([]);
    expect(changelog(LOG, 2)).toHaveLength(2);
  });
});

describe("dayLabel", () => {
  const now = new Date("2026-11-07T15:00:00Z");
  it("reads like people talk", () => {
    expect(dayLabel("2026-11-07", now)).toBe("Today");
    expect(dayLabel("2026-11-06", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-04", now)).toBe("3 days ago");
    expect(dayLabel("2026-10-31", now)).toBe("Oct 31");
  });
});
