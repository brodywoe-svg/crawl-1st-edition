# Backend and API setup: the full checklist
**Status:** in progress; the 2026-11-08 session to-do is at the top  ·  **Owner:** maddox, brody  ·  **Roadmap:** none yet

## Goal
One list of every outside service, key and dashboard setting the backend needs, now and later, so we can work through it in one sitting and know who does what.
This doc doesn't change any plan. The "how" for each step lives in the doc it links to; this is the agenda.

**Legend:**
- **Who:** `B` Brody, `M` Maddox, `B+M` together.
- **Needs:** a decision we must make first (marked **Decide**), or another step.
- Secrets (tokens, passwords, secret keys) are typed straight into the dashboard or your own terminal. **Never into chat, a PR, or the repo.**

## Session to-do: Maddox + Brody, 2026-11-08 (about 2 hours)
Goal: **real accounts on the live site.** Players make accounts and their characters sync between devices; admins sign in with email and password.
Work top to bottom. In section 2 we pick **Path A or Path B** for admin saves; sections 3A and 3B are the only parts that differ.
The numbers (1.4…) point to the tables below; the click-by-click is in [../SETUP.md](../SETUP.md) "Supabase" and [../QUICKSTART.md](../QUICKSTART.md) step 6.

### Where things stand (checked 2026-11-07 evening)
| | Status |
| --- | --- |
| Supabase project "Crawl" (`rdyqicarngehabyvilha`), linked to the repo | ✅ |
| Database: `profiles` and `characters`, with row-level security | ✅ pushed |
| Auth settings: sign-up on, 6-character passwords, Site URL `https://crawl-1st-edition.vercel.app`, redirects for it, previews and localhost | ✅ pushed (`config diff` is clean) |
| `github` Edge Function | ✅ deployed; answers 401 without an admin. **No `GITHUB_TOKEN`**, so saves through it fail |
| Maddox: admin account and `.env.local`; Supabase sign-in works on his local server | ✅ |
| Live site uses Supabase | ❌ Vercel has no `VITE_SUPABASE_*` variables, so it still uses the `admin.json` password |
| PR #14 (home page, phone menus, Tree mode in Testing, play sheet code) | ❌ not merged; the live site is the old `main` |
| Brody: org invite, admin account | ❓ check at the start |

### 1. Start (10 min)
- [ ] Brody is in the **Crawl** Supabase organization (Organization → Team). If not, Maddox invites him as **Owner** and he accepts.
- [ ] Look at the PR #14 preview together: the home page, the example sheet, What's new, the phone menus, Tree mode under Testing. Then **merge it**.

### 2. Decide together (20 min)
- [ ] **Where admin saves go** (the proposal is in [../DECISIONS.md](../DECISIONS.md), 2026-11-07):

  | | **Path A: GitHub (with a key)** | **Path B: game content in Supabase** |
  | --- | --- | --- |
  | In short | Saves commit `crawl-*.json` to GitHub, through the `github` function and Brody's key | The content lives in Supabase tables; admins save straight to the database; no key |
  | Ready for the MVP | Yes: only the key is missing (about 10 min) | No: 2–3 days of Maddox's work |
  | Good | Built and deployed. Git keeps every version (diffs, `git revert`). The old site, tabletop and Windows app keep working. Nothing extra to back up | No key to make, store or renew. A save shows at once (no 1–2 min rebuild). Real permissions in the database. A full edit history (fixes "latest change only"). Fits the typed content schema and automated rules |
  | Bad | Brody owns a key with write access to the repo, renewed yearly. Saves wait for a Vercel rebuild. The edit log keeps only the latest change per record | Content history leaves git. Needs an export to the repo as a backup (the free plan has no downloadable backups). The old site, tabletop and Windows app read the repo's files, so they go stale unless the export keeps them updated. Brody's workflow and the `crawl-*.json` rules change. Saves and reading content both depend on Supabase |
  | Suggestion | **A now**, for the MVP | **B after session 2**, with stage B of the content schema |
- [ ] **Shared passwords:** which password manager holds the database password and, later, the email and Cloudflare logins? (Suggestion: Bitwarden, free.)
- [ ] **Custom domain:** not now (free services). Confirm.
- [ ] Write the answers into DECISIONS.md (status **agreed**) before going on.

### 3A. If Path A: GitHub with the key (25 min)
- [ ] (1.5) **Brody** makes the key: QUICKSTART step 6B. Fine-grained, **this repo only**, Contents **read and write**, 1-year expiry.
- [ ] (1.6) **Brody** pastes it as the `GITHUB_TOKEN` secret: Supabase → Edge Functions → Secrets. **Not in chat, not to Maddox, not in a file.** No redeploy needed.
- [ ] (1.12) **Brody:** a calendar reminder to renew it in 11 months.
- [ ] Maddox: on his local server, a tiny admin save now **works**, and the GitHub commit says "(by Maddox Turner)". Undo it with a second save.

### 3B. If Path B: game content in Supabase (10 min tomorrow, then Maddox builds it)
- [ ] **Don't make a GitHub key.** Skip 1.5, 1.6 and 1.12. The `github` function stays deployed but unused, and is removed when B ships.
- [ ] Agree how Brody edits until B ships: **on the old site** (GitHub Pages Admin, as today). Saves on the new site fail until then, safely.
- [ ] Agree the switch-over: on the day B ships, a one-time import copies `crawl-*.json` into Supabase, and from then on Brody edits only on the new site.
- [ ] Agree the backup: a GitHub Action exports the content back to `crawl-*.json` in the repo (nightly, or after each save), with GitHub's built-in token. It also keeps the old site and tabletop up to date.
- [ ] Maddox writes `dev/planning/content-in-supabase.md` (tables `content` and `content_history`, readable by everyone, writable by admins; `putFile()` and `loadJson()` switch over; the export Action) and claims it in TASKS.md.

### 4. Both paths: Brody's admin account, and switching the live site on (20 min)
- [ ] (1.7) **Brody's admin account:** Authentication → Users → Add user (his email, a long password he chooses, **Auto Confirm User**). Then the SQL from SETUP.md step 7 with his email and `display_name = 'Brody Woelke'`. Check with:
  ```sql
  select u.email, p.display_name, p.role from public.profiles p join auth.users u on u.id = p.id;
  ```
- [ ] (1.11) Dashboard → **Advisors**: Security and Performance show no warnings.
- [ ] (1.8) **Brody**, in Vercel → Project → Settings → Environment Variables:
  - `VITE_SUPABASE_URL` = `https://rdyqicarngehabyvilha.supabase.co`;
  - `VITE_SUPABASE_PUBLISHABLE_KEY` = the **publishable** key (`sb_publishable_…`), never the secret one;
  - for both **Production and Preview** (Preview moves to `crawl-dev` later);
  - then **Redeploy** production. The live site's nav button now reads **Sign in**.

### 5. Test together on the live site (30 min)
- [ ] **Admins:** each signs in, sees Admin Options and Testing, and changes their display name.
- [ ] **Admin save:**
  - Path A: a tiny edit saves; the GitHub commit says "(by name)"; What's new shows it after the rebuild. Undo it.
  - Path B: a save fails with an error, and nothing changes on GitHub (expected until B ships).
- [ ] **Players:** each makes a test player account (any email). No admin tools.
- [ ] **Sync:** make a character signed out, then sign in: it uploads. Sign in on a phone: it's there, and home says "Saved to your account".
- [ ] **Privacy:** player A can't see player B's characters; an admin can see both (checklist in [supabase-database.md](supabase-database.md), phase 2).
- [ ] **Password reset** by email works for a team member's address. (Other addresses get no email until we set up a sender, so for now an admin resets players' passwords in the dashboard.)
- [ ] Note anything that went wrong here.

### 6. If there's time
- [ ] (2.1–2.3) Create `crawl-dev`, push the migrations and config to it, give it **no `GITHUB_TOKEN`**, and point Vercel's **Preview** at it.
- [ ] (2.4) Maddox: `npm run db:types`.
- [ ] (2.5) Brody: Firebase → Authentication → Authorized domains: add the Vercel address, so the old tabletop works there.
- [ ] Game questions for Brody:
  - the rules questions in [../testing/play-sheet.md](../testing/play-sheet.md) (EP in a full pool, temp HP, Exploration's 3 AP);
  - classes with no Max Pool / Action Die chart (Cleric, Druid, Paladin, Sorcerer, Warlock; Ranger's blank rows);
  - coin rates, XP or milestones, who writes the rules data, monsters;
  - Tree mode moving to Testing, and showing his name in What's new ([../DECISIONS.md](../DECISIONS.md) 2026-11-07, [home-page.md](home-page.md));
  - keep both Admin "Last edited by" and What's new, or merge them.

### Not tomorrow (before people outside the group sign up)
- An email sender (Gmail) and Turnstile, then email confirmation on (section 3 below).
- Phase 3: campaigns.
- Backups (with Path B, the export Action comes first).

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
