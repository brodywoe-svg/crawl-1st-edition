# Developer setup

How to get a Windows PC ready to work on Crawl's code. **This isn't needed for editing game content.**
Admin editing on the website works in any browser with nothing installed.

> The new TypeScript + Vite + React project (see [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md))
> doesn't exist yet. The `npm` commands below will work once it lands. Until then, use the current commands in `CLAUDE.md`.

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
npm run build             # the production build into dist/, the same thing CI runs
```

When you're done, commit, push, and open a PR with `gh pr create`.

## Troubleshooting
- **"command not found" right after installing:** reopen the terminal. If it still fails, restart the PC.
- **Pages show no data:** use `npm run dev`. Opening the HTML file directly doesn't work, because pages fetch their JSON over HTTP.
- **Every file shows as changed after a build on Windows:** that's line endings (see ARCHITECTURE.md §8). This goes away after the cutover.
