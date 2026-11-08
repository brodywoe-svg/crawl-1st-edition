/* Accounts on Supabase (dev/planning/supabase-admin-login.md, supabase-database.md). No DOM code here.
   Anyone can make an account (a player). Admins are accounts whose profile role is "admin", set in the Supabase dashboard.
   Off unless VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set (see .env.example); then the old
   admin.json password sign-in is used instead. The Supabase library is only downloaded when it's on. */
import type { SupabaseClient } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
/** Whether this build signs in with Supabase. */
export const SUPABASE_ON = !!(URL_ && KEY);
/** The shortest account password: the lowest Supabase allows (supabase/config.toml). Not the admin.json password, which stays at 12. */
export const MIN_PASSWORD = 6;

export interface Account { id: string; email: string; name: string; role: "player" | "admin" }
export type AuthError = {
  code: "bad_login" | "taken" | "weak_password" | "confirm_email" | "rate_limit" | "offline" | "failed";
  message?: string;
};

let client: Promise<SupabaseClient> | null = null;
/** The Supabase client, created on first use. */
export function supabase(): Promise<SupabaseClient> {
  if (!SUPABASE_ON) throw new Error("Supabase isn't configured");
  return client ??= import("@supabase/supabase-js").then(m => m.createClient(URL_!, KEY!));
}

/** Turn a Supabase auth error into one of ours. */
function authError(e: { code?: string; status?: number; message?: string } | null): AuthError {
  const c = e?.code || "";
  if (c === "invalid_credentials") return { code: "bad_login" };
  if (c === "user_already_exists" || c === "email_exists") return { code: "taken" };
  if (c === "weak_password") return { code: "weak_password", message: e?.message };
  if (c === "email_not_confirmed") return { code: "confirm_email" };
  if (c.startsWith("over_") || e?.status === 429) return { code: "rate_limit" };
  if (!e?.status) return { code: "offline", message: e?.message };
  return { code: "failed", message: e?.message };
}

async function accountOf(c: SupabaseClient, user: { id: string; email?: string }): Promise<Account> {
  const { data } = await c.from("profiles").select("display_name, role").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email || "", name: data?.display_name || "", role: data?.role === "admin" ? "admin" : "player" };
}

/** Sign in with an email and password. Throws an AuthError. */
export async function signIn(email: string, password: string): Promise<Account> {
  const c = await supabase();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw authError(error);
  return accountOf(c, data.user);
}
/** Make a new (player) account and sign in to it. Throws an AuthError ("confirm_email" if the project asks for email confirmation). */
export async function signUp(email: string, password: string, name: string): Promise<Account> {
  const c = await supabase();
  const { data, error } = await c.auth.signUp({ email, password, options: { data: { display_name: name } } });
  if (error) throw authError(error);
  if (!data.session || !data.user) throw { code: "confirm_email" } satisfies AuthError;
  return accountOf(c, data.user);
}
/** Email a password-reset link that opens redirectTo (the site's account.html). */
export async function sendPasswordReset(email: string, redirectTo: string): Promise<void> {
  const { error } = await (await supabase()).auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw authError(error);
}
/** Whoever is signed in (Supabase keeps the sign-in in localStorage, across tabs and visits), or null. */
export async function currentAccount(): Promise<Account | null> {
  const c = await supabase();
  const { data } = await c.auth.getSession();
  return data.session ? accountOf(c, data.session.user) : null;
}
/** Called on every sign-in change. event is Supabase's, e.g. "SIGNED_IN", "SIGNED_OUT", "PASSWORD_RECOVERY". */
export async function onAuthChange(cb: (event: string, userId: string | null) => void): Promise<void> {
  (await supabase()).auth.onAuthStateChange((event, s) => cb(event, s?.user.id ?? null));
}
export async function signOutSupabase(): Promise<void> { await (await supabase()).auth.signOut() }

/** Change your display name (the only part of a profile the site can change). */
export async function setDisplayName(name: string): Promise<void> {
  const c = await supabase(), { data } = await c.auth.getUser();
  if (!data.user) throw { code: "failed" } satisfies AuthError;
  const { error } = await c.from("profiles").update({ display_name: name }).eq("id", data.user.id);
  if (error) throw { code: "failed", message: error.message } satisfies AuthError;
}
export async function setPassword(password: string): Promise<void> {
  const { error } = await (await supabase()).auth.updateUser({ password });
  if (error) throw authError(error);
}
/** Every admin's name (row-level security lets admins read all profiles). */
export async function adminNames(): Promise<string[]> {
  const { data, error } = await (await supabase()).from("profiles").select("display_name").eq("role", "admin").order("display_name");
  if (error) throw { code: "failed", message: error.message } satisfies AuthError;
  return data.map(r => r.display_name);
}

/** Call the github server function (supabase/functions/github) as the signed-in user. Returns its reply as is. */
export async function githubFunction(body: object): Promise<Response> {
  const c = await supabase(), { data } = await c.auth.getSession();
  return fetch(`${URL_}/functions/v1/github`, {
    method: "POST", cache: "no-store",
    headers: { "Content-Type": "application/json", apikey: KEY!, Authorization: "Bearer " + (data.session?.access_token ?? "") },
    body: JSON.stringify(body),
  });
}
