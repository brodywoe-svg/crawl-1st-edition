# The Supabase database, in phases
**Status:** draft  ·  **Owner:** maddox  ·  **Roadmap:** none yet
**Builds on:** [supabase-admin-login.md](supabase-admin-login.md) (phase 1). **Needs:** Brody's OK on Supabase in [../DECISIONS.md](../DECISIONS.md).

## Goal
One plan for everything the database will hold, so each phase fits the next. Each phase is built and tested in its own PR.

**Scope: account data only.** Game content (spells, classes, items…) stays in `crawl-*.json` on GitHub
(see "`crawl-*.json` stays the source of truth" in DECISIONS.md). Admin saves keep going through the `github` function.

| Phase | What | Status |
| --- | --- | --- |
| 1 | Admins: `profiles`, sign-in, saving to GitHub | Built (PR #8). Waiting on the `GITHUB_TOKEN` secret |
| 2 | Player accounts, and Character Creator characters saved to the cloud | Planned. Blocked on email (see Open questions) |
| 3 | The tabletop on Supabase instead of Firebase | Planned |
| Later | Rules checked on the server | Sketch only |

## Ground rules (every phase)
- **Row-level security (RLS) on every table.** These are database rules that Supabase enforces whatever the site sends,
  so permissions no longer depend on client code (today the tabletop's GM-only actions are enforced only in the browser, ARCHITECTURE §6).
- **Shared helper functions.** They're `security definer` with `search_path = ''`, like `public.is_admin()` in phase 1:
  - `is_admin()`,
  - `is_game_member(game uuid)`,
  - `is_game_gm(game uuid)` (from phase 3).
- **Migrations:**
  - one new file per change (`npx supabase migration new <name>`);
  - never edit one that's already been pushed;
  - reviewed in a PR like any code.
- **Two projects:**
  - `crawl` is production.
  - `crawl-dev` is staging, the free plan's second project, in the same "Crawl" organization.
  - A migration goes to `crawl-dev` first, is tested there, then goes to `crawl`.
  - Vercel's **Preview** environment variables point at `crawl-dev`, and **Production** at `crawl`, so preview links never touch real accounts.
- **Typed client:**
  - `npm run db:types` writes `web/src/lib/database.types.ts` from the database (committed);
  - `lib/auth.ts` uses it, so a column typo is a type error;
  - re-run it after every migration.
- **After every push:**
  - the dashboard's **Advisors** (security and performance) show no warnings;
  - run the phase's RLS checklist with two test accounts on `crawl-dev`.

  Automated database tests (`supabase test db`) need Docker. Add them once one of us installs it.
- **Free plan limits:** 500 MB database, 1 GB file storage, 50,000 monthly users. A project pauses after a week without activity.
  All fine for testing. There are no point-in-time backups on the free plan, so revisit this before real players arrive.

## Phase 1: admins (built)
- `profiles`:
  - `id` (= the auth user), `display_name` (≤ 40 characters), `role` (`player` | `admin`, default `player`), `created_at`;
  - one row is made automatically for every new account (the `on_auth_user_created` trigger).
- RLS:
  - read your own profile, and admins read all of them;
  - change only your own `display_name`;
  - roles are set in the dashboard, never from the site.
- **Still to do:**
  - Brody makes the `GITHUB_TOKEN` and adds it under **Edge Functions → Secrets**. The repo is on his personal account,
    so only he can make a token limited to it;
  - then test end to end on a preview link.

## Phase 2: player accounts and characters
**`characters` table**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `text` primary key | The Creator's own id (`pc_…`), so a local copy and its cloud copy match up |
| `owner_id` | `uuid`, references `profiles`, on delete cascade | Indexed |
| `name` | `text` | For lists, without loading `data` |
| `data` | `jsonb` | The whole character, the same shape as `localStorage crawl-characters` (with its `v`) |
| `edited_at` | `timestamptz` | From the character's `edited`, so the newer copy wins |
| `created_at` | `timestamptz` | |

- A size check, `octet_length(data::text) < 1000000`. Portraits are data URLs inside `data` today, and move to file storage later (`portraits/<user>/<character>`).
- RLS:
  - you can see, add, change and delete only your own characters;
  - admins can see all of them (for support; see Open questions);
  - phase 3 adds: the GMs of a game a character is in can see it.

**Sign-up** (in `supabase/config.toml`, then `config push`):
- Sign-up turned on.
- Email confirmation on.
- A CAPTCHA on sign-up (Cloudflare Turnstile, which is free).
- A custom email provider. Supabase's built-in email is only for testing (a handful per hour).
- A password-reset page (`web/account.html`) that the reset email links to.

**Site:**
- `lib/auth.ts` gets `signUp`, `signIn` for any account, `resetPassword` and `onAuthChange`.
- A new **Account** button in the nav for players. The Admin button stays as it is.
- **Syncing characters without forking the Creator:**
  - `src/creator.js` (shared with the old site) gets a one-line hook: `persist()` calls `window.crawlCloud?.save(c)`, and deleting calls `.remove(id)`.
    It does nothing on the old site.
  - The new site defines `crawlCloud` in `web/src/lib/characters.ts`.
  - **On sign-in, merge:**
    - characters only on this device are uploaded,
    - characters only in the cloud are downloaded,
    - for the rest, the newer `edited` wins.
  - localStorage stays as the offline copy.
- The tabletop's "add character" reads the cloud list when the player is signed in, as well as the same-tab localStorage.

**RLS checklist:**
- user A can't see, change or delete user B's characters;
- a signed-out visitor sees nothing;
- an admin can see both;
- a 2 MB character is refused.

## Phase 3: the tabletop
This replaces `FirebaseNet` with a `SupabaseNet` behind the same `tabletop/net.js` API (`on`/`get`/`set`/`update`/`push`/`remove`/`presence`),
so `app.js` barely changes (as the Supabase decision says). The game data shape is in the header comment of `tabletop/app.js`.

**Tables**
- **`games`**: `id`, `name`, `owner_id`, `settings jsonb` (`playerPage`, `fps`), `invite_code` (random, unique), `created_at`.
  Only admins can create games while the tabletop is in private testing.
- **`game_members`**:
  - columns: `game_id`, `user_id`, `role` (`gm` | `player`), `name`, `color`; primary key (`game_id`, `user_id`);
  - replaces `meta.gm`, `meta.gms` and `players`;
  - you join only through `join_game(code)`, a server function that adds you as a player when the invite code is right.
- **`game_items`**: everything else, one row per leaf of today's tree.
  - Columns: `game_id`, `kind` (`page` · `token` · `draw` · `fog` · `char` · `handout` · `turn` · `chat`), `page_id` (for per-page kinds),
    `item_id`, `data jsonb`, `updated_by`, `updated_at`.
  - Primary key (`game_id`, `kind`, `item_id`).
  - `SupabaseNet` maps each path onto it, e.g. `tokens/<pid>/<tid>` is kind `token`, page `pid`, item `tid`.

**Who sees and changes what** (RLS):
- **Members see their game. Players don't see:**
  - tokens and drawings on the GM layer,
  - handouts that aren't shown,
  - characters marked hidden, unless they own them,
  - whispers that aren't to or from them.
- **The GM can change everything. Players can:**
  - move tokens they control (`data.ctrl`),
  - change their own characters,
  - post chat as themselves,
  - draw and erase their own drawings on the player layer.

**Live updates:** Supabase Realtime.
- Changes to `game_items` are streamed to each member. The stream respects RLS, so hidden things never reach a player's browser.
- A Presence channel per game shows who's online (replacing `players.online`).

**Files:**
- a private `game-assets` bucket, laid out as `<game>/maps/<page>`, `/tokens/…`, `/handouts/…`;
- members can read, and GMs can upload;
- maps stop being data URLs inside the database.

**Players without accounts:** Supabase's anonymous sign-in, used for invite links, as Firebase does today. It's turned on only when phase 3 ships.
An anonymous player can later turn their session into a real account.

**Out of scope:** moving existing Firebase games across (agreed: they won't carry over). Firebase stays as a fallback until phase 3 is tested, then it's removed.

**RLS checklist:**
- a non-member sees nothing;
- a player can't see GM-layer tokens, hidden handouts or others' whispers, and can't move others' tokens or edit fog;
- the GM can do everything;
- a wrong invite code doesn't join;
- an anonymous player can join and play.

## Later (sketch)
- **Rules on the server:** Edge Functions or database functions that check actions (e.g. spending from the Action Pool), once the rules are structured data.
- **Game content in the database:** only as a separate decision, if the JSON-on-GitHub workflow stops working for us.

## Steps
- [ ] Brody OKs Supabase, and the proposed entries in DECISIONS.md (staging project, the tabletop table design, anonymous players).
- [ ] Create `crawl-dev`, add `npm run db:types`, and point Vercel previews at `crawl-dev` (dev/SETUP.md).
- [ ] Phase 1: `GITHUB_TOKEN` from Brody, then test end to end.
- [ ] Phase 2: answer the email question; build `characters`, sign-up, the account page and sync (own PR).
- [ ] Phase 3: tables, RLS, Realtime, storage, `SupabaseNet` (own PR, or two).

## Open questions
- **Email for player accounts (blocks phase 2):** confirmation and reset emails need an email provider (e.g. Resend's free tier)
  **and a domain to send from**. This is the same question as Brody's "custom domain?" in SUMMARY.md.
- **Can admins see every player's characters?** Planned: yes, for support. Or only their owners?
- **After testing, who can create tabletop games:** any player, or still only admins?
- **Chat history:** keep it all, or cap it per game (e.g. the newest 1,000 messages)?
