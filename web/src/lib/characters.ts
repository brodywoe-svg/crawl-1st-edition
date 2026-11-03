/* Characters saved to your account (phase 2, dev/planning/supabase-database.md). No DOM code here.
   A character is the Character Creator's own object, stored whole in the characters table's data column.
   This device's localStorage copy and the cloud copy are matched by id; the one edited most recently wins. */
import { supabase } from "./auth";

/** The parts of a Creator character this needs. The rest is kept as is. */
export interface Char { id: string; name?: string; edited?: number; made?: number; [k: string]: unknown }

/** When a character was last changed (ms). Old characters may only have "made". */
export const stamp = (c: Char): number => Number(c.edited || c.made || 0);

/** Every character in your account. */
export async function fetchCharacters(): Promise<Char[]> {
  const { data, error } = await (await supabase()).from("characters").select("data");
  if (error) throw error;
  return data.map(r => r.data as Char).filter(c => c && c.id);
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
    upload: the ones the account doesn't have yet, or has an older copy of. */
export function mergeCharacters(local: Char[], cloud: Char[]): { merged: Char[]; upload: Char[] } {
  const byId = new Map(cloud.map(c => [c.id, c])), upload: Char[] = [];
  for (const c of local) {
    const o = byId.get(c.id);
    if (!o || stamp(c) > stamp(o)) { byId.set(c.id, c); upload.push(c) }
  }
  return { merged: [...byId.values()].sort((a, b) => stamp(b) - stamp(a)), upload };
}
