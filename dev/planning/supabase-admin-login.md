# Supabase admin login (and the groundwork for player accounts)
**Status:** draft, being built on branch `supabase-admin-login`  ·  **Owner:** maddox  ·  **Roadmap:** none yet
**Next phases:** [supabase-database.md](supabase-database.md) (player accounts, characters, the tabletop).
**Needs:** Brody's GitHub key ([../QUICKSTART.md](../QUICKSTART.md) step 6). Supabase itself is agreed (DECISIONS.md, 2026-11-02).

## Goal
Replace the admin password scheme with real accounts, on the new site.

Today each admin's GitHub key sits, encrypted, in the public `admin.json`. A password unlocks it in the browser, and the browser saves straight to GitHub.
That works, but:
- the security rests entirely on password strength, because anyone can download the encrypted keys and try passwords offline;
- the unlocked key lives in the browser;
- admin-only pages (Tabletop, the Testing menu) are only hidden with CSS.

**Next, built on this:** player accounts, with Character Creator characters saved to the cloud.

## Scope
- **In:**
  - a Supabase project in a shared "Crawl" organization (Maddox and Brody are both owners);
  - a `profiles` table, with roles `admin` and `player`;
  - email + password sign-in for admins on the new site;
  - a server function that saves to GitHub for admins;
  - the account box (your name and your password) rewired to Supabase.
- **Out (for now):**
  - player sign-up and cloud characters (designed for here, built in their own plan);
  - the old site, which keeps the `admin.json` password until cutover;
  - the Windows app;
  - moving the tabletop off Firebase;
  - moving game content out of `crawl-*.json`;
  - password reset by email (an admin who forgets their password is reset from the dashboard).

## How it works
- **Accounts:** Supabase Auth, with email + password (12 characters minimum).
  - Public sign-up was **off** at first; since phase 2 (2026-11-03) anyone can make a player account ([supabase-database.md](supabase-database.md)).
    Admins are still made admins only in the dashboard.
  - Every account gets a row in `public.profiles` (`supabase/migrations/…_profiles.sql`): `display_name`, and `role` (`player` by default).
  - You become an admin only when someone sets `role = 'admin'` in the dashboard.
  - Row-level security (database rules that Supabase enforces itself, whatever the site sends):
    - you can read your own profile, and admins can read everyone's;
    - you can change only your own `display_name`;
    - nobody can change a role from the site.
- **Saving:** content still goes to `crawl-*.json` through GitHub, so Admin saves, the edit log and the history panel all work as before.
  - The difference: the browser no longer holds a GitHub key.
  - It sends the GitHub call to a Supabase Edge Function (a small piece of server code), `supabase/functions/github`.
  - The function:
    - checks that the caller is signed in and is an admin;
    - allows only `crawl-*.json` files, never `admin.json` or code;
    - adds the GitHub key, which is stored as a Supabase secret, `GITHUB_TOKEN`;
    - writes the commit's "(by name)" from the caller's profile.
  - In the site, `gh()` in `web/src/lib/github.ts` sends calls through the function when you're signed in with Supabase.
    `putFile`, the edit log and the old page scripts (which call `gh` and `putFile`) don't change.
- **The site:**
  - `web/src/lib/auth.ts` does the sign-in.
  - `web/src/ui/admin.ts` shows an email field and the Supabase version of the account box.
  - It's on only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are set (in `.env.local`, and in Vercel's settings).
    Without them, the new site keeps the old password sign-in, so this can be merged before the project exists.
- **Tabletop:** signing in on the site in the same tab still counts as admin in the tabletop (same `sessionStorage` marker).
  The tabletop's own sign-in box still expects the old `admin.json` format (see ARCHITECTURE §9). It moves to Supabase with the tabletop work.
- **Later, player accounts:**
  - turn sign-up on;
  - add a `characters` table (`owner_id`, `name`, `data jsonb`, `updated_at`), where each row can be read and written only by its owner;
  - the Creator then syncs `localStorage crawl-characters` to it, and the tabletop reads it.
  This plan's tables are designed so that doesn't need to change anything here.

## Steps
- [x] Code: `supabase/` (config, migration, `github` function), `lib/auth.ts`, the `gh()` routing, the admin UI. Off by default.
- [x] Brody OKs Supabase (2026-11-02). This login's design is Maddox's call.
- [ ] Maddox: create the Supabase organization and project, and invite Brody (dev/SETUP.md, "Supabase").
- [ ] Push the database migration and the auth settings, deploy the function, set `GITHUB_TOKEN` (dev/SETUP.md).
- [ ] Invite both admins and set their role to admin.
- [ ] Add the two `VITE_SUPABASE_*` settings in `.env.local` and in Vercel.
- [ ] Test on a preview link: sign in; save something small; check the commit shows "(by name)" and the edit history records it; sign out; check a non-admin account is refused.
- [ ] Decide: ship (retire `admin.json` at cutover) / iterate / remove.

## Open questions
- **Password reset:** by email (needs an email provider, and a page to finish the reset) or from the dashboard only? Dashboard only for now.
- **The GitHub key for the function:** whose account makes it? It's a fine-grained token for this repo only, with Contents read and write.
  If Brody makes it, commits show as Brody's GitHub account, with "(by name)" in the message saying who really edited.
- **Region** for the project: pick the one closest to most players (e.g. US East).
- **When to retire `admin.json`:** at cutover, once the old site stops using it.
