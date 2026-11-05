/* How events, warnings and money read on the play sheet. */
import type { Event, Pool, Warning } from "../../lib/character/types";

const pts = (p: Partial<Pool>) => (["ap", "mp", "ep"] as const).filter(k => p[k]).map(k => `${p[k]} ${k.toUpperCase()}`).join(", ");

/** "12 (G) 5 (S)" from copper, as the Creator writes money. */
export function money(cp: number): string {
  const g = Math.floor(cp / 100), s = Math.floor((cp % 100) / 10), c = cp % 10;
  return [g && `${g} (G)`, s && `${s} (S)`, c && `${c} (C)`].filter(Boolean).join(" ") || "0";
}

export function eventText(e: Event, condName: (id: string) => string): string {
  switch (e.t) {
    case "combatStart": return "Combat started: the pool emptied, except EP";
    case "combatEnd": return "Combat ended: the pool emptied, except EP";
    case "turnStart": return `Turn: Action Die ${e.roll}${e.bonus?.ap || e.bonus?.mp ? ` + ${pts(e.bonus)}` : ""}`;
    case "gain": return `Gained ${pts(e) || "nothing"}`;
    case "spend": return `Spent ${pts(e)}${e.for === "spell" ? " on a spell" : ""}`;
    case "rest": return `Rested ${e.hours} hours`;
    case "damage": return `Took ${e.n} damage`;
    case "heal": return `Healed ${e.n}`;
    case "tempHp": return `${e.n} temporary HP`;
    case "cond": return e.add ? `Now ${condName(e.add)}` : `No longer ${condName(e.remove || "")}`;
    case "item": return e.op === "add" ? `Added ${e.qty && e.qty > 1 ? e.qty + " × " : ""}${e.n}` : e.op === "remove" ? `Removed ${e.n}` : `${e.n}: ${e.qty}`;
    case "money": return `${e.delta >= 0 ? "Gained" : "Spent"} ${money(Math.abs(e.delta))}`;
    case "xp": return `${e.delta >= 0 ? "+" : ""}${e.delta} XP`;
    case "conc": return e.spell ? `Concentrating on ${e.spell}` : "Stopped concentrating";
    case "notes": return "Notes changed";
    case "roll": return `${e.label ? e.label + ": " : ""}${e.text}`;
    case "set": return `Set ${e.field} to ${e.value}${e.why ? ` (${e.why})` : ""}`;
  }
}

export function warningText(w: Warning): string {
  switch (w.w) {
    case "overflow": return `Your pool is full: ${pts(w.lost)} didn't fit and ${Object.values(w.lost).reduce((a, b) => a + (b || 0), 0) === 1 ? "was" : "were"} lost.`;
    case "death": return "Your Action Pool is completely filled with Exhaustion Points. By the rules, you die.";
    case "down": return "You're at 0 HP.";
    case "notEnough": return `Not enough points: you need ${pts(w.need)} more. Nothing was spent.`;
    case "wrongPoints": return w.msg + " Nothing was spent.";
    case "notInCombat": return "Turns only happen in combat. Start combat first.";
    case "noMaxPool": return "This character has no Max Pool yet (its class has no chart), so overflow isn't checked. Set one under Adjust.";
    case "exploreLimit": return "In Exploration you can't take an action that costs more than 3 AP.";
  }
}
