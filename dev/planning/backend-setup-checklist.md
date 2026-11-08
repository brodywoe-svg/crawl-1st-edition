# Backend and API setup: the full checklist
**Status:** draft, for Brody and Maddox to go through together (week of 2026-11-04)  ·  **Owner:** maddox, brody  ·  **Roadmap:** none yet

## Goal
One list of every outside service, key and dashboard setting the backend needs, now and later, so we can work through it in one sitting and know who does what.
This doc doesn't change any plan. The "how" for each step lives in the doc it links to; this is the agenda.

**Legend:**
- **Who:** `B` Brody, `M` Maddox, `B+M` together.
- **Needs:** a decision we must make first (marked **Decide**), or another step.
- Secrets (tokens, passwords, secret keys) are typed straight into the dashboard or your own terminal. **Never into chat, a PR, or the repo.**

## Session to-do: Maddox + Brody, 2026-11-08 (about 2 hours)
Goal: **real accounts on the new site.** Admins sign in with email and password and save content, players make accounts, and characters sync between devices.
Steps are in order. The numbers (1.4…) point to the tables below; the click-by-click is in [../SETUP.md](../SETUP.md) "Supabase" and [../QUICKSTART.md](../QUICKSTART.md) step 6.

**Where things stand (checked 2026-11-07 from Maddox's PC):**
- **Done:**
  - the "Crawl" organization and project exist (`rdyqicarngehabyvilha`, US East), and the repo is linked to it;
  - both database migrations are pushed (`profiles`, `characters`);
  - the auth settings match `config.toml` (`npx supabase config diff` shows no differences; the repo's pooler numbers were changed to match the live project, so a later `config push` changes nothing);
  - the `github` function is deployed (2026-11-07). Without a signed-in admin it answers 401, as it should.
- **Not done:**
  - there's no `GITHUB_TOKEN` secret, so admin saves through the function fail until Brody adds it;
  - `crawl-dev` doesn't exist;
  - `npm run db:types` doesn't exist;
  - there's no `.env.local` on Maddox's PC.
- **Unknown, check at the start:** whether Brody accepted the org invite, the admin roles, and Vercel's environment variables.

### A. Start (15 min)
- [ ] **Merge PR #14** (it brings PR #13's play sheet into `main`, plus the phone menus). Look at its preview first.
- [ ] Decide together:
  - [ ] **Shared passwords:** which password manager holds the database password and, later, the Gmail and Cloudflare logins? (Suggestion: Bitwarden, free.)
  - [ ] **Can `crawl-dev` save to GitHub?** Suggestion: no. Give it no `GITHUB_TOKEN`, so an admin save from a preview link fails safely instead of committing to the real `main`.
  - [ ] **Custom domain:** not now (agreed: free services). Confirm.
  - [ ] **Where admin saves go:** A, GitHub with Brody's key (built; needs only the key), or B, game content in Supabase (no key, 2–3 days of work). The full comparison is in [../DECISIONS.md](../DECISIONS.md), 2026-11-07. Suggestion: A now, B after session 2. **If B:** skip steps 1.5, 1.6 and 1.12 below, and admin saving waits for B to be built.

### B. Supabase: admins (40 min)
- [ ] (1.2) Brody accepts the invite to the **Crawl** organization. If there's no invite yet, Maddox sends one: Organization → Team → Invite, as **Owner**.
- [x] (1.3) Maddox: auth settings. Already in sync (checked with `npx supabase config diff`, 2026-11-07). Nothing to push.
- [x] (1.4) **URL Configuration**: set from `supabase/config.toml` and pushed (2026-11-07). Site URL `https://crawl-1st-edition.vercel.app` (the site, not the vercel.com dashboard address); redirects for it, Vercel previews and localhost. Passwords: 6 characters minimum.
- [ ] (1.5) **Brody** makes the GitHub key: QUICKSTART step 6B (fine-grained, this repo only, Contents read and write, 1-year expiry).
- [ ] (1.6) **Brody** pastes it as the `GITHUB_TOKEN` secret (Edge Functions → Secrets). **Not in chat, not to Maddox.**
- [x] (1.6) Maddox: `npx supabase functions deploy github` (done 2026-11-07). Redeploy only if the function's code changes; secrets don't need a redeploy.
- [ ] (1.12) Brody: a calendar reminder to renew the key in 11 months.
- [ ] (1.7) Admin accounts:
  - Authentication → Users → **Add user** for each of you, with a starting password (6+ characters, but choose a long one: admins can save to GitHub);
  - then the SQL from SETUP.md step 7 sets `role = 'admin'` and your names.
- [ ] (1.11) Dashboard → **Advisors**: security and performance show no warnings.

### C. Turn it on (15 min)
- [ ] (1.8) **Brody**, in Vercel → Project → Settings → Environment Variables:
  - add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from Supabase → Project Settings → API Keys (the **publishable** key, never the secret one);
  - for now, the same values for **Production and Preview** (Preview moves to `crawl-dev` in E);
  - then **Redeploy**.
- [ ] Maddox: copy `.env.example` to `.env.local` and fill in the same two values (never committed).

### D. Test together (30 min), on the production site after the redeploy
- [ ] **Admin:**
  - each of you signs in with email and password, and changes your password (Admin Options → Admins and sign-in);
  - make a tiny content edit and save;
  - on GitHub, the commit says "(by your name)" and the edit history shows it;
  - sign out.
- [ ] **Players:**
  - each make a test player account (any email you can read);
  - make a character signed out, then sign in: it uploads;
  - sign in on a second browser or your phone: it's there.
- [ ] **Privacy:** player A can't see B's characters; an admin can see both. (Checklist in [supabase-database.md](supabase-database.md), phase 2.)
- [ ] **Play sheet:** open your character on two devices; change HP on one, reload the other, and the change is there.
- [ ] **Refused:** a player account has no admin tools, and a save attempt fails.
- [ ] **Password reset** by email works for a team member's address.
- [ ] Note anything that went wrong in [../testing/play-sheet.md](../testing/play-sheet.md) or here.

### E. If there's time: staging and loose ends
- [ ] (2.1, 2.2) Create `crawl-dev` (same org), and push the migrations and config to it. **No `GITHUB_TOKEN`**, as decided in A.
- [ ] (2.3) Brody: in Vercel, point **Preview** at `crawl-dev`.
- [ ] (2.4) Maddox: add `npm run db:types`.
- [ ] (2.5) Brody: Firebase console → Authentication → Authorized domains: add the Vercel address, so the old tabletop works there.

### F. Game questions for Brody (15 min, any time)
- [ ] The rules questions in [../testing/play-sheet.md](../testing/play-sheet.md): EP in a full pool, temp HP, Exploration's 3 AP.
- [ ] Classes with no Max Pool / Action Die chart: Cleric, Druid, Paladin, Sorcerer and Warlock, plus Ranger's blank rows.
- [ ] Coin rates (C 1 / S 10 / G 100 / P 1000?), XP or milestones, who writes the rules data, and monsters.
- [ ] The home page questions in [home-page.md](home-page.md).

### Not tomorrow (needed before people outside the group sign up)
- Section 3: Turnstile and a Gmail sender, then email confirmation on.
- Phase 3 (campaigns).
- Backups.

## Accounts and services at a glance
| Service | What it's for | Account owner | Plan | Status |
| --- | --- | --- | --- | --- |
| GitHub | The repo; the content "database"; later, Windows app releases | Brody | Free | Live |
| Vercel | Hosts the new site, PR previews | Brody (Hobby: one person) | Hobby (free, non-commercial) | Connected |
| Supabase | Accounts, characters, campaigns, tabletop, file storage | "Crawl" org, both owners | Free (2 projects) | Code built; projects to set up |
| Firebase | Today's tabletop sync | Brody | Free (Spark) | Live, to be retired after phase 4 |
| Cloudflare (Turnstile) | CAPTCHA on sign-up | to decide | Free | Not started |
| Gmail (dedicated) | Sending account emails | to decide | Free | Not started |
| Domain (optional) | e.g. `crawlrpg.com` | to decide | ~$10–15/year | Not decided |

## 1. Now: switch on Supabase (phases 1 and 2)
Detailed steps: [../SETUP.md](../SETUP.md) "Supabase", [../QUICKSTART.md](../QUICKSTART.md) step 6.

| # | Step | Who | Needs |
| --- | --- | --- | --- |
| 1.1 | Create the **Crawl** organization (Free) and the `crawl` project; save the database password in a password manager | M | **Decide** the region (closest to most players, e.g. US East) |
| 1.2 | Invite Brody as Owner; Brody accepts | M, then B | 1.1 |
| 1.3 | `npx supabase link`, then `db push --remote` (profiles, characters) and `config push` (auth settings) | M | 1.1 |
| 1.4 | **Authentication → URL Configuration:** Site URL = the Vercel address; Redirect URLs = `<vercel address>/**` plus the localhost ones | M | 1.3 (config push resets the Site URL to localhost) |
| 1.5 | Fine-grained GitHub token: `crawl-1st-edition` only, **Contents: Read and write**, 1-year expiry | B | Only Brody can (his repo) |
| 1.6 | Save it as the `GITHUB_TOKEN` Edge Function secret; deploy the `github` function | B (secret), M (deploy) | 1.5 |
| 1.7 | Add both admin users; set `role = 'admin'` and names in the SQL Editor | M | 1.3 |
| 1.8 | Vercel → Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (the **publishable** key only); redeploy. Also in each dev's `.env.local` | B (Vercel is his), M (`.env.local`) | 1.1. See 2.3 for which environments |
| 1.9 | Test phase 1 on a preview link: sign in, save, check the commit's "(by name)" and the edit history, a non-admin is refused | B+M | 1.6–1.8 |
| 1.10 | Test phase 2 with two test accounts (checklist in [supabase-database.md](supabase-database.md)) | B+M | 1.9 |
| 1.11 | Dashboard **Advisors** (security, performance) show no warnings | M | 1.3 |
| 1.12 | Calendar reminder to renew `GITHUB_TOKEN` before it expires | B | 1.5 |

## 2. Soon: staging, and the Firebase domain
| # | Step | Who | Needs |
| --- | --- | --- | --- |
| 2.1 | Second project, `crawl-dev`, in the same org. Repeat 1.3, 1.4, 1.6, 1.7 for it (its own `GITHUB_TOKEN` secret, or the same token) | M | **Decide:** should staging be able to commit to GitHub at all? A preview admin save lands on the real `main` |
| 2.2 | `crawl-dev` redirect URLs must allow Vercel's **preview** addresses (e.g. `https://crawl-1st-edition-*.vercel.app/**`) | M | 2.1 |
| 2.3 | Vercel env vars: **Preview** → `crawl-dev`, **Production** → `crawl` | B | 2.1 |
| 2.4 | Add `npm run db:types` (`supabase gen types`) and commit `web/src/lib/database.types.ts` | M | 2.1. SETUP.md says it was "added with phase 2"; it isn't in `package.json` yet |
| 2.5 | Firebase console → **Authentication → Settings → Authorized domains**: add the Vercel address, so online tabletop play works on the new site | B | Firebase is on Brody's account |

## 3. Before sign-up opens beyond our group
Agreed in DECISIONS.md (2026-11-02, item 5). Both are dashboard/config settings, not code.

| # | Step | Who | Needs |
| --- | --- | --- | --- |
| 3.1 | Cloudflare account → **Turnstile** widget for the Vercel address (and localhost, and preview addresses) | B or M | **Decide** whose account |
| 3.2 | Put the Turnstile **secret** key in Supabase (Authentication → Attack Protection, or `[auth.captcha]` in `config.toml` via `env()`); the **site** key goes in a new `VITE_TURNSTILE_SITE_KEY` | M | 3.1, plus a small code change in the sign-up box |
| 3.3 | Dedicated Gmail account for Crawl, 2-step verification on, an **app password** for SMTP | B or M | **Decide** whose account / the address |
| 3.4 | Supabase **Authentication → Emails → SMTP**: Gmail's host, port, address, app password; raise the hourly email limit | M | 3.3 |
| 3.5 | Turn **email confirmation on**; edit the email templates (confirm, reset) to say "Crawl" | M | 3.4 |
| 3.6 | Test: a non-team address can sign up, confirm, and reset its password | B+M | 3.5 |

## 4. Phases 3 and 4 (campaigns, the tabletop)
Plans: [supabase-database.md](supabase-database.md). Phase 3 is migrations only, no new services. Phase 4 needs:

| # | Step | Who | Needs |
| --- | --- | --- | --- |
| 4.1 | **Realtime:** add `campaign_items` to the Realtime publication (in a migration) | M | Phase 4 code |
| 4.2 | **Storage:** private `campaign-assets` bucket and its policies; later a `portraits` bucket | M | Phase 4 code |
| 4.3 | **Anonymous sign-ins** on (`enable_anonymous_sign_ins`), only when phase 4 ships | M | Phase 4 tested on `crawl-dev` |
| 4.4 | Retire Firebase once phase 4 is tested: remove the SDK and config, then delete the Firebase project | B (console), M (code) | 4.1–4.3; existing games won't carry over (agreed) |

## 5. Cutover and the Windows app
Plan: [typescript-vite-refactor.md](typescript-vite-refactor.md) ("Deploy" and "Windows app").

| # | Step | Who | Needs |
| --- | --- | --- | --- |
| 5.1 | **Decide:** custom domain or stay on `*.vercel.app` | B+M | Free-only was agreed for now |
| 5.2 | If a domain: buy it, point DNS at Vercel, then update every place that lists the address: Supabase Site/Redirect URLs (both projects), Turnstile hostnames, Firebase authorized domains (if still in use), Gmail sender name | B | 5.1 |
| 5.3 | GitHub Releases for `electron-updater`: who publishes releases, by hand or from a GitHub Actions workflow (which uses Actions' built-in token, no new secret) | M | **Decide** manual vs automated |
| 5.4 | **Decide:** code-sign the Windows app? Unsigned means a SmartScreen warning on first install. Signing costs money (e.g. Azure Trusted Signing, about $10/month) | B+M | — |
| 5.5 | Retire `admin.json` once the old site is gone | M | Cutover |

## 6. Not planned yet: worth deciding
These aren't in any plan. Each is a question, not a commitment.
- **Two-factor login on every account** that can reach the backend: GitHub, Vercel, Supabase, Cloudflare, the Gmail. (Recommended; free.)
- **Backups.** The free Supabase plan has no point-in-time recovery. Options: a scheduled `supabase db dump` (e.g. a weekly GitHub Action, which needs the database password as a GitHub Actions secret), or Pro ($25/month) when real players arrive.
- **Free projects pause** after a week with no activity. Fine while testing; once players depend on it, either keep it busy (a scheduled ping) or move to Pro.
- **Sign in with Discord or Google** instead of only email + password. Many tabletop groups live on Discord. Each one needs an OAuth app on that service, and its client secret in Supabase.
- **Error reporting** (e.g. Sentry's free plan), so we hear about crashes before players tell us.
- **Server-side rules** (the "Later" section of [supabase-database.md](supabase-database.md)): more Edge Functions, no new services.

## Open questions (to settle in the session)
- Region for both Supabase projects.
- Can `crawl-dev` commit to GitHub (2.1)?
- Whose account owns Cloudflare and the Gmail (3.1, 3.3)? Shared credentials need a shared password manager. Which one?
- Custom domain, yes or no (5.1)?
- Windows releases by hand or automated; code signing yes or no (5.3, 5.4)?
- Which of section 6 do we want, and when?
