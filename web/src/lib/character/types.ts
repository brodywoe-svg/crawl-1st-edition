/* A character, in three layers (dev/planning/character-data.md). No DOM code here.
   - build: the Character Creator's own fields (race, cls, base, prof, spells, inv…), left where the Creator keeps them.
     The Creator's fixChar() keeps any field it doesn't know, so the old Creator and the play sheet can share one object
     (decided 2026-11-04; nesting under `build` waits for the React Creator).
   - state: what changes in play. Changed only by events (apply.ts), which are kept in `log`.
   - derived: numbers worked out from the rules (derive.ts). Never saved. */

export type Mode = "explore" | "combat";
export interface Pool { ap: number; mp: number; ep: number }
export interface InvItem { iid?: string; n: string; qty: number; slot?: string }

export interface PlayState {
  mode: Mode;
  hp: number;
  tempHp: number;
  pool: Pool;               // what's in the Action Pool now
  conds: string[];          // condition ids (cond-restrained…)
  inv: InvItem[];
  money: number;            // in copper (C 1, S 10, G 100, P 1000)
  xp: number;
  conc: string;             // the spell being concentrated on, or ""
  notes: string;
  turn: number;             // turns started this combat
}

/** Something that happened in play. Every change to state is one of these. */
export type Event =
  | { t: "combatStart" }
  | { t: "combatEnd" }
  | { t: "turnStart"; roll: number; bonus?: { ap?: number; mp?: number }; keep?: Partial<Pool> }
  | { t: "gain"; ap?: number; mp?: number; ep?: number; keep?: Partial<Pool> }
  | { t: "spend"; ap?: number; mp?: number; for?: "action" | "spell" }
  | { t: "rest"; hours: number }
  | { t: "damage"; n: number }
  | { t: "heal"; n: number }
  | { t: "tempHp"; n: number }
  | { t: "cond"; add?: string; remove?: string }
  | { t: "item"; op: "add" | "remove" | "qty"; n: string; iid?: string; qty?: number }
  | { t: "money"; delta: number }
  | { t: "xp"; delta: number }
  | { t: "conc"; spell: string }
  | { t: "notes"; text: string }
  | { t: "roll"; expr: string; total: number; text: string; label?: string }
  | { t: "set"; field: "hp" | "tempHp" | "ap" | "mp" | "ep" | "money" | "xp"; value: number; why?: string };

export interface LogEntry { e: Event; at: number; by?: string }

/** Warnings come back from apply(): the sheet shows them, and asks the player where a choice is needed. The engine never decides silently. */
export type Warning =
  | { w: "overflow"; lost: Partial<Pool> }        // points that didn't fit in the Max Pool
  | { w: "death" }                                // the pool is full of Exhaustion Points
  | { w: "down" }                                 // HP reached 0
  | { w: "notEnough"; need: Partial<Pool> }       // tried to spend points that aren't there (nothing changed)
  | { w: "wrongPoints"; msg: string }             // e.g. AP on a spell in combat (nothing changed)
  | { w: "notInCombat" }                          // e.g. starting a turn in Exploration (nothing changed)
  | { w: "noMaxPool" }                            // no Max Pool known, so overflow can't be checked
  | { w: "exploreLimit" };                        // an action over 3 AP in Exploration (nothing changed)

/** The numbers the engine needs from derive(). */
export interface Limits { maxHp: number | null; maxPool: number | null }

/** The Creator's character, plus the play layers. */
export interface Character {
  id: string;
  v?: number;
  name?: string;
  made?: number;
  edited?: number;
  cls?: string;
  sheet?: Record<string, unknown>;
  snap?: Snap;
  inv?: { iid?: string; n?: string; qty?: number; slot?: string }[];
  // the play layers (v 2)
  state?: PlayState;
  logBase?: PlayState;       // the state before the first event still in the log, so undo can replay.
                             // (Not `base`: the Creator already uses that for ability scores.)
  log?: LogEntry[];
  overrides?: Record<string, number | string>;
  [k: string]: unknown;
}
export type PlayCharacter = Character & { v: 2; state: PlayState; logBase: PlayState; log: LogEntry[]; overrides: Record<string, number | string> };

/** The worked-out numbers the old Creator saves with each character (snapshot() in src/creator.js). */
export interface Snap {
  v?: number; name?: string; level?: number; portrait?: string; race?: string; cls?: string; bg?: string;
  abil?: Record<string, { n: string; score: number; mod: number; save: number; saveProf: boolean }>;
  skills?: { n: string; ab: string; total: number; prof: boolean; rank: number }[];
  hp?: number | null; hd?: string; ac?: number | null; init?: number; speed?: string;
  pool?: { max: string | number; die: string };
  passive?: Record<string, number>;
  spells?: { n: string; lv: number | null; rank: number; cost: string; time: string; range: string; dmg: string; desc: string; atk: number | null; dc: number | null }[];
  weapons?: { n: string; props: string; actions: string; acts: { n: string; ap: string; dmg: string; type: string; d: string }[]; sub: string }[];
  inv?: { n: string; qty: number; slot: string; weight: string; value: string; iid: string }[];
  wealth?: string;
  feats?: { n: string; d: string; src: string }[];
  langs?: string[];
}

/** Keep this many events with the character (character-data.md). Older ones fold into `logBase`. */
export const LOG_CAP = 500;
