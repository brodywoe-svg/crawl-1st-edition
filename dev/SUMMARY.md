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
| **Supabase vs Firebase** | Where accounts, saved characters and online tabletop games will live. Maddox suggests Supabase: stronger security, and better suited to game rules. | **Your call** |

The full reasoning for each one is in [DECISIONS.md](DECISIONS.md).

## What we need from you
1. **Approve or question the decisions** above, by commenting on the pull request.
2. **Supabase or Firebase?** If you're unsure, ask Maddox, or ask Claude to explain the trade-offs.
3. **The old claude.ai editing on the Spells page.** That page started life as an artifact in the claude.ai chat app, and it can still save spells back there.
   Do you still edit spells that way? If not, we'll remove it.
4. **Connect Vercel** (about 5 minutes, once). See step 3 of [QUICKSTART.md](QUICKSTART.md).
5. **A custom domain?** Do you want an address like `crawlrpg.com` (about $10–15 a year)? Without one, the site lives at a `something.vercel.app` address.

## What happens next
1. Maddox ports the pages one by one, starting with the home page. Each one comes as its own pull request with a preview link.
2. When every page matches the current site, we switch over, and the old address forwards to the new one.
3. After that come the Windows app, accounts and online play (Supabase or Firebase), and then the rules automation.

The detailed plan is in [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md).
