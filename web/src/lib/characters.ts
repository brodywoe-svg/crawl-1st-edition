/* Characters saved to your account (phase 2, dev/planning/supabase-database.md). No DOM code here.
   A character is the Character Creator's own object, stored whole in the characters table's data column.
   This device's localStorage copy and the cloud copy are matched by id; the one edited most recently wins. */
import { supabase } from "./auth";

/** The parts of a Creator character this needs. The rest is kept as is. */
export interface Char { id: string; name?: string; edited?: number; made?: number; [k: string]: unknown }

/** When a character was last changed (ms). Old characters may only have "made". */
export const stamp = (c: Char): number => Number(c.edited || c.made || 0);

/** Every character in your account. Filtered by owner because an admin may read everyone's (for the DM view),
    and those must never land in the admin's own list.
    others: ids of other accounts' characters this account can read (only an admin sees any), so copies
    already pulled onto this device by mistake can be dropped instead of uploaded as yours. */
export async function fetchCharacters(ownerId: string): Promise<{ mine: Char[]; others: Set<string> }> {
  const db = await supabase();
  const [own, rest] = await Promise.all([
    db.from("characters").select("data").eq("owner_id", ownerId),
    db.from("characters").select("id").neq("owner_id", ownerId),
  ]);
  if (own.error) throw own.error;
  if (rest.error) throw rest.error;
  return { mine: own.data.map(r => r.data as Char).filter(c => c && c.id), others: new Set(rest.data.map(r => r.id as string)) };
}
/** Add or update characters in your account. */
export async function saveCharacters(ownerId: string, list: Char[]): Promise<void> {
  if (!list.length) return;
  const rows = list.map(c => ({ owner_id: ownerId, id: c.id, name: String(c.name || ""), data: c, edited_at: new Date(stamp(c) || Date.now()).toISOString() }));
  const { error } = await (await supabase()).from("characters").upsert(rows, { onConflict: "owner_id,id" });
  if (error) throw error;
}
export async function deleteCharacter(ownerId: string, id: string): Promise<void> {
  const { error } = await (await supabase()).from("characters").delete().eq("owner_id", ownerId).eq("id", id);
  if (error) throw error;
}

/** Combine this device's characters with the account's. For each id the newer copy wins.
    upload: the ones the account doesn't have yet, or has an older copy of.
    others: ids that belong to other accounts; local copies of those are dropped, never uploaded. */
export function mergeCharacters(local: Char[], cloud: Char[], others: Set<string> = new Set()): { merged: Char[]; upload: Char[] } {
  const byId = new Map(cloud.map(c => [c.id, c])), upload: Char[] = [];
  for (const c of local) {
    const o = byId.get(c.id);
    if (!o && others.has(c.id)) continue; // someone else's character, pulled in before the owner filter
    if (!o || stamp(c) > stamp(o)) { byId.set(c.id, c); upload.push(c) }
  }
  return { merged: [...byId.values()].sort((a, b) => stamp(b) - stamp(a)), upload };
}
