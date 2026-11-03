# Developer setup

How to get a Windows PC ready to work on Crawl's code. **This isn't needed for editing game content.**
Admin editing on the website works in any browser with nothing installed.

> The new TypeScript + Vite site lives in `web/` (see [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md)).
> Every page runs on it. The old site still uses `python tools/build.py` (see `CLAUDE.md`).

## 1. Install the tools (once)
Open PowerShell and run:

```powershell
winget install Git.Git
winget install GitHub.cli
winget install OpenJS.NodeJS.LTS
```

- **Git** keeps the history and handles branches.
- **The GitHub CLI** (`gh`) opens PRs from the terminal.
- **Node.js (LTS)** runs Vite and installs the libraries. It comes with `npm`.

Then **close and reopen the terminal** so it can find the new commands, and check that they work:

```powershell
git --version
gh --version
node --version
npm --version
```

Optional:
- **VS Code** (`winget install Microsoft.VisualStudioCode`), an editor with good TypeScript support.
- **Claude Code**.
- **Python 3**, needed only for the old `tools/build.py` until we cut over.

## 2. Sign in and get the code (once)
```powershell
gh auth login
gh repo clone brodywoe-svg/crawl-1st-edition
cd crawl-1st-edition
```

Git needs a name and email for your commits. The repo is public, so use your GitHub **no-reply** email, from GitHub → Settings → Emails:

```powershell
git config user.name "Your Name"
git config user.email "12345+you@users.noreply.github.com"
```

## 3. Day to day
```powershell
git checkout main
git pull                  # Admin saves land on main all the time, so always pull first
git checkout -b my-change
npm install               # after a pull that changed package.json
npm run dev               # local site with live reload; open the address it prints
npm run typecheck         # check the TypeScript for mistakes
npm run build             # the production build into dist/, the same thing Vercel runs
```

When you're done, commit, push, and open a PR with `gh pr create`.

## Hosting (Vercel)
- You don't need the Vercel CLI or an account to develop.
- Vercel builds every PR and posts a **preview link** on it. Merging into `main` updates the production site.
- The Vercel project lives on Brody's account. For the one-time connection steps, see [QUICKSTART.md](QUICKSTART.md), step 3.
- The build settings are in `vercel.json`. For example, commits that only change `crawl-edits.json`, `dev/` or Markdown don't trigger a rebuild.

## Supabase (accounts)
Plan: [planning/supabase-admin-login.md](planning/supabase-admin-login.md). Until these steps are done, the site uses the old password sign-in.
**Never put the secret key, the database password or a GitHub token in the repo**, in `.env.example`, or in chat.

**Once, to set up the project:**
1. Sign up at **supabase.com** (with GitHub is easiest). Create an organization called **Crawl** on the **Free** plan.
2. Under the organization's **Team**, invite the other developer as **Owner**.
3. **New project:** name it `crawl`, choose the region closest to the players, and let it generate a database password.
   Save that password in your password manager; it's only needed by the CLI.
4. In the project, open **Authentication → Sign In / Providers** and keep **Email** on. Sign-up and email confirmation are set by `config push` in step 5
   (sign-up on, confirmation off for now; see [planning/supabase-database.md](planning/supabase-database.md), phase 2).
5. In a terminal at the repo root, link the repo to the project and push the database and the auth settings:
   ```powershell
   npx supabase login                       # opens the browser
   npx supabase link --project-ref <ref>    # <ref> is in the project's URL: supabase.com/dashboard/project/<ref>
   npx supabase db push --remote            # creates the profiles table (supabase/migrations); without --remote it targets a local database
   npx supabase config push                 # auth settings from supabase/config.toml
   ```
   `config push` shows what it will change and asks first. It also sets the site URL to localhost. Afterwards, under **Authentication → URL Configuration**:
   - set **Site URL** to the Vercel address;
   - under **Redirect URLs**, add the Vercel address followed by `/**` (e.g. `https://crawl-1st-edition.vercel.app/**`), and keep the `localhost` ones.
     Password-reset emails link to `account.html`, and only addresses listed here are allowed.
6. **The GitHub key for saving.** On GitHub: **Settings → Developer settings → Fine-grained tokens → Generate new token**.
   - Resource owner: `brodywoe-svg`. Repository access: **only** `crawl-1st-edition`.
   - Permissions: **Contents: Read and write**. Nothing else.

   Store it as a function secret, and deploy the function:
   ```powershell
   npx supabase secrets set GITHUB_TOKEN=<paste the token>   # typed in your own terminal; don't paste it anywhere else
   npx supabase functions deploy github
   ```
7. **Admins.** **Authentication → Users → Add user** for each admin, with their email and a starting password (12+ characters).
   Then, in the **SQL Editor**, make them admins and set their names:
   ```sql
   update public.profiles p set role = 'admin', display_name = 'Brody Woelke'
   from auth.users u where p.id = u.id and u.email = 'their@email';
   ```
   They can change their name and password later from the site (**Admin Options → Admins and sign-in**).
8. **Turn it on in the site.** **Project Settings → API Keys**: copy the project URL and the **publishable** key
   (never the secret key). Then:
   - locally: copy `.env.example` to `.env.local` and fill both in (`.env.local` isn't committed);
   - on Vercel: **Project → Settings → Environment Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then redeploy.

**The staging project** ([planning/supabase-database.md](planning/supabase-database.md)): make a second project, `crawl-dev`, in the same organization.
Steps 3–8 are the same for it. Point Vercel's **Preview** environment variables at `crawl-dev`, and **Production** at `crawl`.
Switch which project the CLI talks to with `npx supabase link --project-ref <ref>` before each `db push --remote`.

**Day to day:**
- A database change is a new file in `supabase/migrations/` (`npx supabase migration new <name>`), reviewed in a PR.
  Push it to `crawl-dev` first and test it, then push it to `crawl` once it's merged (`npx supabase db push --remote`, after linking each one).
- Then refresh the TypeScript types: `npm run db:types` (added with phase 2).
- After changing `supabase/functions/github`, run `npx supabase functions deploy github`.
- Free projects pause after a week with no activity. If sign-in stops working, open the dashboard and restore the project.

## Troubleshooting
- **"npm is not recognized" right after installing:** the terminal still has the PATH from before the install.
  Fully quit VS Code or Windows Terminal (every window) and reopen it, or restart the PC. To fix only the current window, run:
  `$env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")`
- **"npm.ps1 cannot be loaded because running scripts is disabled":** this is Windows PowerShell's default safety setting. Allow scripts for your own user, once:
  `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`
  Or skip the setting and type `npm.cmd` instead of `npm`.
- **Pages show no data:** use `npm run dev`. Opening the HTML file directly doesn't work, because pages fetch their JSON over HTTP.
- **Every file shows as changed after a build on Windows:** that's line endings (see ARCHITECTURE.md §8). This goes away after the cutover.
