# Tasks

The one shared to-do list for Crawl's software. Keep it short:
- one line per task,
- tick it in the PR that finishes it,
- delete done items once they've been released for a while (git history keeps them).

Format: `- [ ] Task (@owner)`. The owner is `@brody`, `@maddox`, or left off if no one has it yet.
If a task needs more than a line of explanation, write a doc in [planning/](planning/) and link it from the task.

## Now
- [ ] Review the decisions (TypeScript + Vite, React later, Vercel, Supabase): start at [QUICKSTART.md](QUICKSTART.md). Supabase is still open. (@brody)
- [ ] Connect the repo to Vercel ([QUICKSTART.md](QUICKSTART.md), step 3) (@brody)
- [ ] Answer the Spells page claude.ai-mode question in the refactor plan (@brody)
- [ ] Plan the TypeScript + Vite refactor: [planning/typescript-vite-refactor.md](planning/typescript-vite-refactor.md) (@maddox)

## Next

## Later
- [ ] Move the UI to React after the Vite refactor: [planning/react-migration.md](planning/react-migration.md)

## Done
- [x] Dev docs set up: `CLAUDE.md`, `dev/ARCHITECTURE.md`, `dev/DATA-MODEL.md`, this list, `dev/DECISIONS.md` (@maddox)
