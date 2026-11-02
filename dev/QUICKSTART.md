# Quick start for Brody

Step by step, with nothing to install. Everything happens in your web browser.
For what this is all about, read [SUMMARY.md](SUMMARY.md) first. It takes about 3 minutes.

## 1. Open the pull request
1. Go to **github.com/brodywoe-svg/crawl-1st-edition** and click the **Pull requests** tab.
2. Open the pull request from Maddox. Its description links back here.
3. Click **Files changed** if you want to see exactly what was added. It's all documents, with no site changes yet.

## 2. Say yes, no or "let's talk" to the decisions
1. Read the table in [SUMMARY.md](SUMMARY.md) under "The decisions".
2. Go back to the pull request's **Conversation** tab and leave a comment. For example:
   > TypeScript + Vite: OK. React later: OK. Vercel: OK. Supabase: let's go with it.
   > Spells claude.ai editing: I don't use it, remove it.
3. If you want changes, say so in the comment. Maddox (or Claude) will update the docs.
4. When you're happy, click **Merge pull request** → **Confirm merge**.

## 3. Connect Vercel (once, about 5 minutes)
Vercel builds and hosts the new site. The project has to live on **your** account, because you own the repo.

1. Go to **vercel.com** and click **Sign Up**. Choose the **Hobby** plan, then **Continue with GitHub**, and sign in as `brodywoe-svg`.
2. When GitHub asks what Vercel may access, choose **Only select repositories** → `crawl-1st-edition` → **Install**.
3. In Vercel, click **Add New…** → **Project**, find `crawl-1st-edition` and click **Import**.
4. Check the settings before deploying:
   - **Framework Preset:** Vite
   - **Root Directory:** `./`, which is the default. Leave it.
   - **Build Command:** `npm run build`. **Output Directory:** `dist`. Both are usually filled in automatically.
5. Click **Deploy**.
   - If the new site's code isn't merged yet, this first deploy may fail. That's fine.
   - It works once Maddox's scaffold pull request is merged.
6. Send Maddox the site address Vercel shows you. It looks like `crawl-1st-edition.vercel.app`.

From now on, Vercel builds automatically. Nothing else needs to be clicked.

## 4. Try a preview link
On every pull request, Vercel's bot posts a comment with a **Preview** link.

1. Click it. It's a private test copy of the site with that pull request's changes.
2. Check that things look and work as you'd expect:
   - the pages you use,
   - Admin sign-in,
   - dark mode.
3. If something's wrong, comment on the pull request with what you clicked and what happened. A screenshot helps.

**Preview links don't change the real site.** You can click anything.

## 5. After merging
- Merging into `main` updates the new site on Vercel within about a minute.
- **The current site at `brodywoe-svg.github.io/crawl-1st-edition` keeps working exactly as now** until we switch over.
- Your Admin editing works as normal the whole time.

## Want to run the code yourself?
That's optional. See [SETUP.md](SETUP.md).
