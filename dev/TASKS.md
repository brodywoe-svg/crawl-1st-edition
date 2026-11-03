# Tasks

The one shared to-do list for Crawl's software. Keep it short:
- one line per task,
- tick it in the PR that finishes it,
- delete done items once they've been released for a while (git history keeps them).

Format: `- [ ] Task (@owner)`. The owner is `@brody`, `@maddox`, or left off if no one has it yet.
If a task needs more than a line of explanation, write a doc in [planning/](planning/) and link it from the task.

## Now
- [ ] Review the decisions (TypeScript + Vite, React later, Vercel, Supabase): start at [QUICKSTART.md](QUICKSTART.md). Supabase is still open. (@brody)
- [ ] TypeScript + Vite refactor: [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md). Every page and the tabletop now run on the new site; next, rewrite the page scripts as TypeScript, then the Windows app and cutover. (@maddox)

## Next
- [ ] Try the 3D dice prototype on a laptop and a phone, fill in [testing/3d-dice.md](testing/3d-dice.md), then decide ship / iterate / remove (@maddox, @brody)
- [ ] Add the Vercel site address to Firebase's authorized domains, so online tabletop play works there (@brody)

## Later
- [ ] Move the UI to React after the Vite refactor: [planning/react-migration.md](planning/react-migration.md)

## Done
- [x] Connect the repo to Vercel (@brody)
- [x] Spells page claude.ai mode: dropped on the new site (@maddox, 2026-11-02)
- [x] Dev docs set up: `CLAUDE.md`, `dev/ARCHITECTURE.md`, `dev/DATA-MODEL.md`, this list, `dev/DECISIONS.md` (@maddox)
