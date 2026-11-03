/* Accounts on Supabase (dev/planning/supabase-admin-login.md). No DOM code here.
   Today only admins sign in, with an email and password. Player accounts will reuse this, with role "player".
   Off unless VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set (see .env.example); then the old
   admin.json password sign-in is used instead. The Supabase library is only downloaded when it's on. */
import type { SupabaseClient } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
/** Whether this build signs in with Supabase. */
export const SUPABASE_ON = !!(URL_ && KEY);

export interface Profile { name: string; role: "player" | "admin" }
export type AuthError = { code: "bad_login" | "not_admin" | "weak_password" | "offline" | "failed"; message?: string };

let client: Promise<SupabaseClient> | null = null;
function sb(): Promise<SupabaseClient> {
  if (!SUPABASE_ON) throw new Error("Supabase isn't configured");
  return client ??= import("@supabase/supabase-js").then(m => m.createClient(URL_!, KEY!));
}

async function profile(c: SupabaseClient, id: string): Promise<Profile | null> {
  const { data } = await c.from("profiles").select("display_name, role").eq("id", id).maybeSingle();
  return data ? { name: data.display_name, role: data.role } : null;
}

/** Sign in. Resolves to the admin's profile; throws an AuthError (a non-admin account is signed straight back out). */
export async function signInAdmin(email: string, password: string): Promise<Profile> {
  const c = await sb();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw { code: error?.status === 400 ? "bad_login" : "offline", message: error?.message } satisfies AuthError;
  const p = await profile(c, data.user.id);
  if (p?.role !== "admin") { await c.auth.signOut(); throw { code: "not_admin" } satisfies AuthError }
  return p;
}
/** The admin signed in earlier (Supabase keeps the sign-in in localStorage, across tabs), or null. */
export async function currentAdmin(): Promise<Profile | null> {
  const c = await sb();
  const { data } = await c.auth.getSession();
  if (!data.session) return null;
  const p = await profile(c, data.session.user.id);
  return p?.role === "admin" ? p : null;
}
export async function signOutSupabase(): Promise<void> { await (await sb()).auth.signOut() }

/** Change your display name (the only part of a profile the site can change). */
export async function setDisplayName(name: string): Promise<void> {
  const c = await sb(), { data } = await c.auth.getUser();
  if (!data.user) throw { code: "failed" } satisfies AuthError;
  const { error } = await c.from("profiles").update({ display_name: name }).eq("id", data.user.id);
  if (error) throw { code: "failed", message: error.message } satisfies AuthError;
}
export async function setPassword(password: string): Promise<void> {
  const { error } = await (await sb()).auth.updateUser({ password });
  if (error) throw { code: error.code === "weak_password" ? "weak_password" : "failed", message: error.message } satisfies AuthError;
}
/** Every admin's name (row-level security lets admins read all profiles). */
export async function adminNames(): Promise<string[]> {
  const { data, error } = await (await sb()).from("profiles").select("display_name").eq("role", "admin").order("display_name");
  if (error) throw { code: "failed", message: error.message } satisfies AuthError;
  return data.map(r => r.display_name);
}

/** Call the github server function (supabase/functions/github) as the signed-in user. Returns its reply as is. */
export async function githubFunction(body: object): Promise<Response> {
  const c = await sb(), { data } = await c.auth.getSession();
  return fetch(`${URL_}/functions/v1/github`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", apikey: KEY!, Authorization: "Bearer " + (data.session?.access_token ?? "") },
    body: JSON.stringify(body),
  });
}
