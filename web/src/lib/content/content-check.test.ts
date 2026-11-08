/* npm run content:check — adapts the real crawl-*.json, validates every record against the schema, and prints coverage
   and warnings. Warnings don't fail it: Admin saves land on main directly, and content in progress must never break anything.
   It fails only if a record breaks the schema or a reference points at nothing (dev/planning/content-schema.md). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adapt } from "./adapt";
import { SCHEMAS, type Content } from "./types";

const ROOT = join(__dirname, "../../../..");
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, f), "utf8"));
const content: Content = adapt({ classes: read("crawl-classes.json"), items: read("crawl-items.json"), glossary: read("crawl-glossary.json") });

describe("content check", () => {
  it("every adapted record matches the schema", () => {
    const bad: string[] = [];
    for (const [kind, schema] of Object.entries(SCHEMAS)) {
      for (const rec of (content as any)[kind].values()) {
        const r = schema.safeParse(rec);
        if (!r.success) bad.push(`${kind} ${rec.id}: ${r.error.issues.map(i => i.path.join(".") + " " + i.message).join("; ")}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("every reference points at something", () => {
    const missing: string[] = [];
    for (const it of content.items.values()) {
      for (const p of it.props) if (!content.properties.has(p)) missing.push(`${it.id} → ${p}`);
      for (const a of it.actions) if (!content.actions.has(a)) missing.push(`${it.id} → ${a}`);
      for (const d of it.damage) if (d.type && !content.damageTypes.has(d.type)) missing.push(`${it.id} → ${d.type}`);
    }
    expect(missing).toEqual([]);
  });

  it("reads what the play sheet needs", () => {
    expect(content.conditions.size).toBeGreaterThan(0);
    expect(content.classes.size).toBeGreaterThan(0);
    // every chart row that has a Max Pool has a whole number, and every Action Die is dN
    for (const k of content.classes.values()) for (const r of k.chart) {
      if (r.pool != null) expect(Number.isInteger(r.pool)).toBe(true);
      if (r.die != null) expect(r.die).toMatch(/^d\d+$/);
    }
  });

  it("prints coverage and warnings", () => {
    const items = [...content.items.values()], weapons = items.filter(i => i.cat === "Weapon");
    const charted = [...content.classes.values()].filter(k => k.chart.some(r => r.pool != null && r.die != null));
    const lines = [
      `Classes with a usable chart: ${charted.length} of ${content.classes.size}`,
      `Items: ${items.length}; value read ${items.filter(i => i.cp != null).length}, weight read ${items.filter(i => i.lb != null).length}`,
      `Weapons with damage read: ${weapons.filter(w => w.damage.length).length} of ${weapons.length}`,
      `Glossary: ${content.conditions.size} conditions, ${content.properties.size} properties, ${content.damageTypes.size} damage types, ${content.actions.size} actions (incl. item actions), ${content.rules.size} other rules`,
      `Actions with a cost: ${[...content.actions.values()].filter(a => a.cost).length} of ${content.actions.size}`,
      `Automated effects: 0 (everything is still text; stage B adds crawl-rules.json)`,
      `Warnings (${content.warnings.length}):`, ...content.warnings.map(w => "  - " + w),
    ];
    console.log("\n" + lines.join("\n") + "\n");
    expect(lines.length).toBeGreaterThan(0);
  });
});
