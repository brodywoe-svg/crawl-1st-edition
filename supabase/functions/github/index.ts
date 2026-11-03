/* Saves to GitHub for signed-in admins (dev/planning/supabase-admin-login.md). Runs on Supabase (Deno), not in the browser.
   The site sends the GitHub contents call it wants to make: reading or committing one content file. This checks the caller
   is an admin, adds the GitHub key (a Supabase secret, so it never reaches a browser), makes the call and passes GitHub's
   reply straight back. The site's existing save code (putFile, the edit log, conflict handling) therefore works unchanged.

   Request (POST, JSON, with the user's Supabase sign-in as the Authorization header):
     { "method": "GET", "file": "crawl-items.json", "raw": true }      read a file (raw: just its text)
     { "method": "PUT", "file": "crawl-items.json", "message": "…", "content": "<base64>", "sha": "…" }   commit it
   Secrets (set with `npx supabase secrets set`, see dev/SETUP.md): GITHUB_TOKEN, a fine-grained token for this repo only,
   with Contents: Read and write. SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase. */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const REPO = "brodywoe-svg/crawl-1st-edition", BRANCH = "main";
/** Only the content files and the edit log (crawl-edits.json). Never admin.json, code or anything else. */
const FILE = /^crawl-[a-z]+\.json$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, "Use POST.");

  // who's asking: a signed-in admin
  const auth = req.headers.get("Authorization") ?? "", jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return reply(401, "Not signed in.");
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await sb.auth.getUser(jwt);
  if (!user) return reply(401, "Not signed in.");
  const { data: me } = await sb.from("profiles").select("display_name, role").eq("id", user.id).single();
  if (me?.role !== "admin") return reply(403, "Only admins can save.");

  // what they want
  let q: { method?: string; file?: string; raw?: boolean; message?: string; content?: string; sha?: string };
  try { q = await req.json() } catch { return reply(400, "Send JSON.") }
  if (!q.file || !FILE.test(q.file)) return reply(400, "That file can't be read or saved from the site.");
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return reply(500, "The GITHUB_TOKEN secret isn't set.");
  const url = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(q.file)}`;
  const headers: Record<string, string> = {
    Authorization: "Bearer " + token, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "crawl-1st-edition",
    Accept: q.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
  };

  let gh: Response;
  if (q.method === "GET") {
    gh = await fetch(`${url}?ref=${BRANCH}`, { headers, cache: "no-store" });
  } else if (q.method === "PUT") {
    if (typeof q.content !== "string" || !q.content) return reply(400, "Nothing to save.");
    // the name on the commit comes from the profile, not from the site
    const what = String(q.message || "Update from the admin page").replace(/\s*\(by [^)]*\)\s*$/, "").slice(0, 200);
    const body: Record<string, string> = { message: `${what} (by ${me.display_name || user.email})`, content: q.content, branch: BRANCH };
    if (q.sha) body.sha = q.sha;
    gh = await fetch(url, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } else return reply(400, "method must be GET or PUT.");

  // GitHub's own reply, so the site sees the same statuses (404 missing, 409 someone saved first) as before.
  // A 401 here means the GitHub token is wrong: the caller's sign-in was fine, so don't let the site treat it as theirs.
  const status = gh.status === 401 ? 502 : gh.status;
  return new Response(gh.body, { status, headers: { ...CORS, "Content-Type": gh.headers.get("Content-Type") ?? "application/json" } });
});
