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
| 2 | Player accounts, and Character Creator characters saved to the cloud | Planned. Email: a free Gmail account, no domain |
| 3 | Campaigns: dungeon masters see their players' characters and propose changes to them | Planned |
| 4 | The tabletop on Supabase instead of Firebase, built on campaigns | Planned |
| Later | Rules checked on the server | Sketch only |

## Roles: players, dungeon masters, admins
- **Account roles** (`profiles.role`, from phase 1):
  - `player`: everyone, by default.
  - `admin`: edits game content, and can see everything for support. Set in the Supabase dashboard only.
- **Campaign roles** (`campaign_members.role`, phase 3):
  - `dm` or `player`, per campaign.
  - **Anyone can be a DM.** Whoever creates a campaign is its DM, and can make other members co-DMs. One account can be the DM of one campaign and a player in another.
- **What a DM can do with a player's character:** see it while it's in their campaign, and **propose** changes, which the player accepts or rejects.
  A DM never changes a player's saved character directly.

## Ground rules (every phase)
- **Row-level security (RLS) on every table.** These are database rules that Supabase enforces whatever the site sends,
  so permissions no longer depend on client code (today the tabletop's GM-only actions are enforced only in the browser, ARCHITECTURE §6).
- **Shared helper functions.** They're `security definer` with `search_path = ''`, like `public.is_admin()` in phase 1:
  - `is_admin()`,
  - `is_campaign_member(campaign uuid)`, `is_campaign_dm(campaign uuid)`, `can_view_character(id text)` (from phase 3).
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
  - phase 3 adds: the DMs of a campaign a character is in can see it.

**Sign-up** (in `supabase/config.toml`, then `config push`):
- Sign-up turned on.
- Email confirmation on.
- A CAPTCHA on sign-up (Cloudflare Turnstile, which is free and works on the `vercel.app` address).
- **Email, free and with no domain** (decided 2026-11-02): Supabase's built-in email only sends a handful an hour, so it's for testing only.
  Instead, confirmation and reset emails go through a **dedicated Gmail account** (e.g. a new `crawl…@gmail.com`, not a personal one) over Gmail's SMTP:
  - Turn on 2-step verification for it, make an **app password**, and enter it in the Supabase dashboard
    (**Authentication → Emails → SMTP settings**: host `smtp.gmail.com`, port 465, the Gmail address as the user and sender).
    It's never in the repo.
  - **Limits:** about 500 emails a day, plenty while testing. Some inboxes may file them as spam.
  - **Later:** if we get a domain, switch to a proper email service (e.g. Resend) in the same SMTP settings, with no code change.
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

## Phase 3: campaigns, and what DMs can see
A **campaign** is a group of players and their characters, run by one or more dungeon masters. In phase 4 it also becomes the tabletop game.

**Tables**
- **`campaigns`**:
  - columns: `id`, `name`, `created_by`, `invite_code` (random, unique; the DM can make a new one), `settings jsonb`, `created_at`;
  - any signed-in account with a confirmed email (not an anonymous one) can create a campaign, up to 10 each, checked on the server;
  - its creator becomes its DM automatically.
- **`campaign_members`**:
  - columns: `campaign_id`, `user_id`, `role` (`dm` | `player`), `name`, `color`, `joined_at`; primary key (`campaign_id`, `user_id`);
  - you join as a player through `join_campaign(code)`, a server function that checks the invite code;
  - a DM can make a player a co-DM, or remove a member;
  - the last DM can't leave without handing over the campaign or deleting it.
- **`campaign_characters`**:
  - columns: `campaign_id`, `character_id`, `shared` (the owner lets the party see the full sheet; off by default), `added_at`;
  - a player adds their **own** character to a campaign they're in; the player or a DM can take it out.
- **`character_changes`**: a DM's proposed edits to a player's character.
  - Columns: `id`, `character_id`, `campaign_id`, `proposed_by`, `changes jsonb` (a list of `{path, from, to}`, e.g. gold 10 → 60),
    `note` ("Loot from the goblin cave"), `status` (`pending` | `accepted` | `rejected` | `withdrawn` | `stale`), `created_at`, `decided_at`.
  - **Accepting** goes through `accept_change(id)`, a server function. It checks you own the character, applies every change in one step,
    and marks the proposal `stale` instead if the character has changed since (a `from` no longer matches).
  - **Where it shows:** the player sees "Your DM proposed 2 changes" in the Character Creator, with Accept and Reject.

**Who sees and changes what**

| | Player | DM (of this campaign) | Admin |
| --- | --- | --- | --- |
| Their own characters | see, change, delete | — | — |
| Characters in the campaign | the **party summary** (below); full sheets only for their own, or ones shared with them | **see** in full (not change) | see |
| Propose a change to a character | — | yes, for characters in their campaign | — |
| Accept or reject a proposal | their own characters | withdraw their own proposals | — |
| Campaign settings, invite code, members | — | yes | yes (support) |
| Create a campaign | yes, and become its DM | — | yes |

- A DM only sees a character while it's in their campaign. Taking it out, or the player leaving, ends that at once,
  because the database checks membership on every read.
- **Players can't see each other's full characters, by default** (decided 2026-11-02).
  - **The party summary.** Members see each character's name, race, class, level and portrait, through `campaign_party(c)`,
    a server function that returns only those fields, never the whole sheet.
  - **Sharing.** A player can share their full sheet with the rest of the party: `campaign_characters.shared` (off by default), which they switch on per campaign.
- Play-time changes (HP, conditions, spent Action Pool) aren't proposals. They go on the campaign's live copy (phase 4), which DMs control, as the tabletop's `snap`/`live` split does today.
- Helper functions: `is_campaign_member(c)`, `is_campaign_dm(c)`, and `can_view_character(id)` (owner, a DM of a campaign it's in, or an admin).

**RLS checklist:**
- a DM sees characters in their campaign but not the player's other characters;
- a DM can't change a character directly, only propose;
- a player in the same campaign sees another player's summary but not their full character, until that player shares it;
- after a character leaves the campaign, the DM can't see it;
- accepting a stale proposal changes nothing;
- a wrong invite code doesn't join;
- an 11th campaign is refused.

## Phase 4: the tabletop
This replaces `FirebaseNet` with a `SupabaseNet` behind the same `tabletop/net.js` API (`on`/`get`/`set`/`update`/`push`/`remove`/`presence`),
so `app.js` barely changes (as the Supabase decision says). The game data shape is in the header comment of `tabletop/app.js`.

- **A tabletop game is a campaign.** Today's `meta.gm`/`meta.gms`/`players` become `campaign_members`. Players' characters come from `campaign_characters`:
  the game's `snap` is the saved character, and `live` is the play state.
- **`campaign_items`**: everything else, one row per leaf of today's tree.
  - Columns: `campaign_id`, `kind` (`page` · `token` · `draw` · `fog` · `char` · `handout` · `turn` · `chat`), `page_id` (for per-page kinds),
    `item_id`, `data jsonb`, `updated_by`, `updated_at`.
  - Primary key (`campaign_id`, `kind`, `item_id`).
  - `SupabaseNet` maps each path onto it, e.g. `tokens/<pid>/<tid>` is kind `token`, page `pid`, item `tid`.
- **Who sees and changes what** (RLS):
  - **Members see their campaign's table. Players don't see:**
    - tokens and drawings on the GM layer,
    - handouts that aren't shown,
    - characters marked hidden, unless they own them,
    - whispers that aren't to or from them.
  - **DMs can change everything. Players can:**
    - move tokens they control (`data.ctrl`),
    - change their own character's live state,
    - post chat as themselves,
    - draw and erase their own drawings on the player layer.
- **Live updates:** Supabase Realtime.
  - Changes to `campaign_items` are streamed to each member, respecting RLS, so hidden things never reach a player's browser.
  - A Presence channel per campaign shows who's online.
- **Files:**
  - a private `campaign-assets` bucket: `<campaign>/maps/<page>`, `/tokens/…`, `/handouts/…`;
  - members can read, and DMs can upload;
  - maps stop being data URLs inside the database.
- **Players without accounts:** Supabase's anonymous sign-in for invite links, as Firebase does today, turned on only when phase 4 ships.
  An anonymous player can play, but can't create a campaign, and can later turn their session into a real account.
- **Out of scope:** moving existing Firebase games across (agreed: they won't carry over). Firebase stays as a fallback until phase 4 is tested.
- **RLS checklist:**
  - a non-member sees nothing;
  - a player can't see GM-layer tokens, hidden handouts or others' whispers, and can't move others' tokens or edit fog;
  - DMs can do everything;
  - an anonymous player can join and play.

## Later (sketch)
- **Rules on the server:** Edge Functions or database functions that check actions (e.g. spending from the Action Pool), once the rules are structured data.
- **Game content in the database:** only as a separate decision, if the JSON-on-GitHub workflow stops working for us.

## Steps
- [ ] Brody OKs Supabase, and the proposed entries in DECISIONS.md (staging project, the tabletop table design, anonymous players, roles).
- [ ] Create `crawl-dev`, add `npm run db:types`, and point Vercel previews at `crawl-dev` (dev/SETUP.md).
- [ ] Phase 1: `GITHUB_TOKEN` from Brody, then test end to end.
- [ ] Phase 2: make the Gmail account, add its SMTP settings and Turnstile; build `characters`, sign-up, the account page and sync (own PR).
- [ ] Phase 3: campaigns, members, characters in campaigns, DM change proposals and the Creator's accept/reject (own PR).
- [ ] Phase 4: the tabletop's tables, RLS, Realtime, storage, `SupabaseNet` (own PR, or two).

## Decided (2026-11-02, Maddox)
- **Free services only, no domain for now:** a dedicated Gmail account sends the account emails; the site stays on its `vercel.app` address.
- **Campaign limit:** 10 per account.
- **Party privacy:** players can't see each other's full characters unless the owner shares; everyone in the campaign sees the party summary.

## Open questions
- **Can admins see every player's characters?** Planned: yes, for support. Or only their owners?
- **Chat history:** keep it all, or cap it per game (e.g. the newest 1,000 messages)?
