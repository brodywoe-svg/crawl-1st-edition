/* The open character, for the play sheet and dice roller (a Zustand store). The rules live in lib/character; this only
   loads and saves. Characters stay where the Character Creator keeps them, localStorage "crawl-characters", so the Creator
   and the play sheet share them, and ui/cloud-characters.ts syncs them with your account as before.
   Each save re-reads the list first and replaces only this character, so a save never undoes the Creator's changes to others. */
import { create } from "zustand";
import { loadContent } from "../../lib/content/load";
import type { Content } from "../../lib/content/types";
import { record, undo } from "../../lib/character/apply";
import { derive, type Derived } from "../../lib/character/derive";
import { migrate } from "../../lib/character/migrate";
import type { Character, Event, PlayCharacter, Warning } from "../../lib/character/types";

const LS = "crawl-characters";
/** The character open in this tab, so a reload or the dice roller still has it. */
const OPEN = "crawl-play-open";
const remember = (id: string) => { try { if (id) sessionStorage.setItem(OPEN, id); else sessionStorage.removeItem(OPEN) } catch { /* private mode */ } };
const readAll = (): Character[] => { try { const v = JSON.parse(localStorage.getItem(LS) || "[]"); return Array.isArray(v) ? v.filter(c => c && c.id) : [] } catch { return [] } };

/** Save one character into the shared list, and hand the list to the account sync if it's running. */
function save(c: PlayCharacter): void {
  const list = readAll(), i = list.findIndex(x => x.id === c.id);
  if (i >= 0) list[i] = c; else list.unshift(c);
  try { localStorage.setItem(LS, JSON.stringify(list)) } catch { /* full or private mode: the sheet keeps working in memory */ }
  window.crawlCloud?.saved(list as any);
}

interface CharacterStore {
  content: Content | null;
  list: Character[];                 // every character in this browser (and, once synced, your account)
  char: PlayCharacter | null;
  derived: Derived | null;
  sample: boolean;                   // the built-in sample: played in memory, never saved
  warnings: Warning[];               // from the last event
  init(): void;
  refreshList(): void;
  open(id: string): void;
  openSample(): void;
  close(): void;
  dispatch(e: Event): Warning[];
  undo(): void;
  setOverride(key: string, value: number | null): void;
}

let started = false;

export const useCharacter = create<CharacterStore>((set, get) => {
  const show = (char: PlayCharacter | null, sample = get().sample) => set({ char, sample, derived: char ? derive(char, get().content) : null });
  const commit = (char: PlayCharacter) => { char.edited = Date.now(); if (!get().sample) save(char); show(char) };

  return {
    content: null, list: [], char: null, derived: null, sample: false, warnings: [],
    init() {
      get().refreshList();
      if (started) return; // once per page: listeners and content
      started = true;
      let last = ""; try { last = sessionStorage.getItem(OPEN) || "" } catch { /* private mode */ }
      if (last === "pc_sample") get().openSample(); else if (last && !get().char) get().open(last);
      loadContent().then(content => { set({ content }); const c = get().char; if (c) show(c) });
      // another tab (the Creator), or the account sync, changed the characters
      const reload = () => { get().refreshList(); const c = get().char; if (c && !get().sample) { const fresh = readAll().find(x => x.id === c.id); if (fresh) show(migrate(fresh)) } };
      window.addEventListener("storage", e => { if (e.key === LS) reload() });
      window.addEventListener("crawl-characters-changed", reload);
    },
    refreshList() { set({ list: readAll().filter(c => c.done || c.snap) }) },
    open(id) { const c = readAll().find(x => x.id === id); if (c) { set({ warnings: [] }); show(migrate(c), false); remember(id) } },
    openSample() { if (get().char?.id === "pc_sample") return; set({ warnings: [] }); show(migrate(SAMPLE()), true); remember("pc_sample") },
    close() { set({ char: null, derived: null, sample: false, warnings: [] }); remember("") },
    dispatch(e) {
      const { char, derived } = get();
      if (!char || !derived) return [];
      const r = record(char, e, derived, undefined);
      set({ warnings: r.warnings });
      if (r.log !== char.log) commit({ ...char, state: r.state, logBase: r.logBase, log: r.log });
      return r.warnings;
    },
    undo() {
      const { char, derived } = get();
      if (!char || !derived || !char.log.length) return;
      const u = undo(char, derived);
      set({ warnings: [] });
      commit({ ...char, ...u });
    },
    setOverride(key, value) {
      const char = get().char; if (!char) return;
      const overrides = { ...char.overrides };
      if (value == null) delete overrides[key]; else overrides[key] = value;
      commit({ ...char, overrides });
    },
  };
});

/** A level 1 character to try the sheet with, without making one. The numbers are made up for testing. */
function SAMPLE(): Character {
  return {
    id: "pc_sample", v: 1, name: "Sample Fighter", cls: "class-fighter", made: 0, done: true, sheet: {},
    inv: [{ n: "Battleaxe", qty: 1, slot: "main" }, { n: "Light Crossbow", qty: 1, slot: "off" }, { n: "Rations", qty: 5 }, { n: "Crossbow Bolts", qty: 20 }],
    snap: {
      v: 1, name: "Sample Fighter", level: 1, race: "Dwarf", cls: "Fighter", bg: "Soldier", hp: 14, ac: 15, init: 1, speed: "25 ft", hd: "d10",
      pool: { max: "5", die: "d4" },
      abil: Object.fromEntries([["str", "Strength", 16], ["dex", "Dexterity", 12], ["con", "Constitution", 15], ["int", "Intelligence", 8], ["wis", "Wisdom", 13], ["cha", "Charisma", 10]]
        .map(([k, n, s]) => { const mod = Math.floor((+s - 10) / 2); return [k, { n: String(n), score: +s, mod, save: mod + (k === "str" || k === "con" ? 1 : 0), saveProf: k === "str" || k === "con" }] })),
      skills: [["Athletics", "str", 4, true, 1], ["Perception", "wis", 2, true, 1], ["Stealth", "dex", 1, false, 0], ["Survival", "wis", 1, false, 0]]
        .map(([n, ab, total, prof, rank]) => ({ n: String(n), ab: String(ab), total: +total, prof: !!prof, rank: +rank })),
      weapons: [{ n: "Battleaxe", props: "1d8 slashing, Versatile 1d10", actions: "", acts: [], sub: "Axes" }, { n: "Light Crossbow", props: "1d8 piercing, Ammunition 80/320, Loading", actions: "", acts: [], sub: "Crossbows" }],
      inv: [{ n: "Battleaxe", qty: 1, slot: "main", weight: "4 lbs", value: "10 (G)", iid: "" }, { n: "Rations", qty: 5, slot: "", weight: "2 lbs", value: "5 (S)", iid: "" }, { n: "Crossbow Bolts", qty: 20, slot: "", weight: "1.5 lbs", value: "1 (G)", iid: "" }],
      wealth: "12 (G) 5 (S)",
      feats: [{ n: "Second Wind", d: "Sample feature text.", src: "Fighter" }],
    },
  };
}
