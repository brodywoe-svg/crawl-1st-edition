# What's changing, in plain words

_For Brody. Last updated 2026-11-02. To act on this, follow [QUICKSTART.md](QUICKSTART.md)._

## The short version
We want Crawl to become **fully digital**: the rules worked out by the app instead of by hand, and 3D views later.
The current website can't grow into that, because of how its code is put together.
So we're moving it to a modern setup, **one page at a time**, while the current site keeps running untouched.

## What stays the same for you
- **The site works the same.** Same pages, same addresses, same look.
- **Admin editing doesn't change.** You sign in and save the same way, and your edits go live in about a minute.
- **Your content is safe.** The game content stays in the same `crawl-*.json` files. Nothing about how it's stored changes.

## What's new
- **Preview links.** When someone opens a pull request, a private test copy of the site is built from it automatically.
  You can click around before anything goes live.
- **A Windows app that updates itself** (later). There's no more re-downloading the zip.
- **Room to grow:** automated rules, accounts and 3D can be built on top of this.

## The decisions (and who still needs to say yes)
| Decision | In plain words | Status |
| --- | --- | --- |
| **TypeScript + Vite** | TypeScript is JavaScript that catches mistakes before they reach players. Vite is the tool that turns the code into the website. | Maddox agreed, needs your OK |
| **React later** | React is a popular way to build complex screens. We'll use it later for the automated character sheet and combat. Not now. | Maddox agreed, needs your OK |
| **Vercel** | The service that hosts the new site. It builds it automatically and makes the preview links. Free for non-commercial projects. | Maddox agreed, needs your OK |
| **Supabase** | The "backend": where accounts, saved characters and online tabletop games will live. Like a locked filing cabinet on the internet that only lets each person open their own drawer. | **Agreed** (you OK'd it) |
| **Admin sign-in with Supabase** | Instead of the admin password, you'll sign in with your email and a password. Your saves work the same, but there's no secret key hidden in the site any more. Built, and switched on once the setup below is done. | Maddox is handling it |

The full reasoning for each one is in [DECISIONS.md](DECISIONS.md).

## The next goal: the site ready for session 2 (agreed 2026-11-04)
_Status: the new site's home page runs on React, and there are two prototypes to try (the Testing menu, when signed in as admin): a **play sheet** and a **dice roller**._
_Please read the questions for you in [testing/play-sheet.md](testing/play-sheet.md): they're about how the Action Pool rules should work. Also: 6 classes have no Max Pool / Action Die chart yet._
Session 1 is on paper. By session 2, players make and track their characters on the site (HP, Action Pool, conditions, gear, dice rolls), and the DM sees the party.
- **Your tabletop and Tree mode** are treated as proofs of concept: we learn from them, but don't build on them until we agree a final design.
  The big digital-tabletop vision is kept as ideas in [roadmap/digital-tabletop.md](roadmap/digital-tabletop.md).
- **Please check one table:** "Events: the state system" in [planning/character-data.md](planning/character-data.md).
  It's how the site will track the Action Pool, HP and so on, taken from your glossary. Tell us what's wrong or missing.
- **The current site stays exactly as it is** at its usual address, so players can use it for session 1. Your Admin editing there keeps working.
- **The new site moves to React now**, not later. React is the most popular way to build screens that update live, like a sheet where spending AP changes several numbers.
  Doing it now means we don't build the same screens twice.
- **Your wiki content gets a "rules data" layer** so the app can use it: costs, dice, damage and effects, kept **beside** your text, never replacing it.
  Nothing in your files changes for now, and your Admin editing works as before.
  Please read the open questions at the bottom of [planning/content-schema.md](planning/content-schema.md). In particular: who writes the rules data, you, or us with your sign-off?
- The plan is in [roadmap/playtest-mvp.md](roadmap/playtest-mvp.md). The three decisions to OK are the 2026-11-04 entries in [DECISIONS.md](DECISIONS.md).

## What we need from you
1. **Approve or question the decisions** above, by commenting on the pull request.
2. **Two small Supabase jobs** (about 10 minutes, once). You don't need to know anything about backends: follow step 6 of [QUICKSTART.md](QUICKSTART.md).
   - Accept Maddox's invite to the "Crawl" organization on supabase.com.
   - Make one GitHub key and paste it into Supabase. Only you can, because the repo is on your GitHub account.

   Maddox sets up your admin account; you'll get a starting password to change after you sign in.
3. **A custom domain?** Do you want an address like `crawlrpg.com` (about $10–15 a year)? Without one, the site lives at a `something.vercel.app` address.
   **Not needed for now:** we're sticking to free services, and player account emails will come from a dedicated Gmail account instead.
   The full database plan is in [planning/supabase-database.md](planning/supabase-database.md).
4. **A setup session with Maddox.** Every account, key and setting the backend needs, with who does each, is in one list:
   [planning/backend-setup-checklist.md](planning/backend-setup-checklist.md). Its "Open questions" at the bottom are the decisions we'll make together.

Already done: Vercel is connected, and the Spells page's old claude.ai editing was dropped on the new site.

## What happens next
1. Maddox ports the pages one by one, starting with the home page. Each one comes as its own pull request with a preview link.
2. When every page matches the current site, we switch over, and the old address forwards to the new one.
3. After that come the Windows app, player accounts and online play (on Supabase), and then the rules automation.

The detailed plan is in [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md).
