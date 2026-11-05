/* The typed content schema, stage A (dev/planning/content-schema.md). No DOM code here.
   Zod schemas describe what the app reads after adapt.ts converts today's crawl-*.json. The files themselves don't change.
   Only the kinds the play sheet needs so far. Every record keeps its prose (text) next to anything structured. */
import { z } from "zod";

/** A stable id, prefixed by kind: "cond-restrained", "action-charge", "i-buckler". */
export const Id = z.string().regex(/^[a-z]+-[a-z0-9-]+$/);

/** What something costs from the Action Pool. The rules for paying (AP for spells only outside combat…) live in the engine. */
export const Cost = z.object({
  ap: z.number().int().nonnegative().optional(),
  mp: z.number().int().nonnegative().optional(),
  gainEp: z.number().int().nonnegative().optional(),
  extra: z.boolean().optional(), // "+1 AP": added to the cost of what it modifies
});
export const Damage = z.object({ dice: z.string(), type: Id.optional(), typeName: z.string() });
/** Not automated yet: shown to the player and applied by hand. Structured effects come in stage B (crawl-rules.json). */
export const Effect = z.object({ do: z.literal("text"), text: z.string() });

const base = { id: Id, n: z.string().min(1), text: z.string() };

export const Condition = z.object({ ...base, kind: z.literal("condition") });
export const Property = z.object({ ...base, kind: z.literal("property") });
export const DamageType = z.object({ ...base, kind: z.literal("damage") });
/** A glossary rules entry that isn't one of the kinds above (Combat Rules, Game Systems…). */
export const Rule = z.object({ ...base, kind: z.literal("rule"), sec: z.string() });
export const Action = z.object({
  ...base, kind: z.literal("action"),
  sec: z.string(),                       // Weapon Actions, Combat Actions, General Actions, or "Item" for an item's own
  cost: Cost.optional(),
  requires: z.array(z.string()),         // feature or feat names, as written (resolved to ids in a later stage)
  effects: z.array(Effect),
});
export const ChartRow = z.object({ lv: z.number().int().min(1).max(20), pool: z.number().int().positive().nullable(), die: z.string().regex(/^d\d+$/).nullable() });
export const ClassInfo = z.object({ id: Id, n: z.string(), hd: z.string(), chart: z.array(ChartRow) });
export const Item = z.object({
  id: Id, n: z.string(), text: z.string(),
  cat: z.string(), sub: z.string(), slot: z.string(),
  cp: z.number().nonnegative().nullable(),     // value in copper (C 1, S 10, G 100, P 1000); null = "Varies" or blank
  lb: z.number().nonnegative().nullable(),     // weight in pounds
  props: z.array(Id),                          // property ids, for the ones the glossary defines
  propText: z.string(),                        // the props line as written
  damage: z.array(Damage),
  range: z.object({ ft: z.number(), long: z.number().optional() }).nullable(),
  actions: z.array(Id),                        // its weapon actions (ids in Content.actions)
});

export type Cost = z.infer<typeof Cost>;
export type Damage = z.infer<typeof Damage>;
export type Condition = z.infer<typeof Condition>;
export type Property = z.infer<typeof Property>;
export type DamageType = z.infer<typeof DamageType>;
export type Rule = z.infer<typeof Rule>;
export type Action = z.infer<typeof Action>;
export type ChartRow = z.infer<typeof ChartRow>;
export type ClassInfo = z.infer<typeof ClassInfo>;
export type Item = z.infer<typeof Item>;

/** Everything adapted, keyed by id, plus what couldn't be read. */
export interface Content {
  classes: Map<string, ClassInfo>;
  items: Map<string, Item>;
  conditions: Map<string, Condition>;
  properties: Map<string, Property>;
  damageTypes: Map<string, DamageType>;
  actions: Map<string, Action>;
  rules: Map<string, Rule>;
  warnings: string[];
}

/** The schema for each kind, for validating adapted content (content-check.test.ts). */
export const SCHEMAS = { classes: ClassInfo, items: Item, conditions: Condition, properties: Property, damageTypes: DamageType, actions: Action, rules: Rule } as const;
