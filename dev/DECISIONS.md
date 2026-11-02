# Decisions

A log of technical choices and why we made them, so nobody (person or agent) undoes one by accident.
Add an entry when you pick between real alternatives, for example:
- a library or framework,
- hosting or a backend,
- a data-format change,
- a build tool.

Bug fixes and routine changes don't need one. Newest first. Never delete an entry. If a decision is reversed,
add a new entry and mark the old one **Replaced by**.

Template:
```
## YYYY-MM-DD: Decision in one line
**Status:** proposed | agreed | replaced by <date/title>  ·  **Who:** brody, maddox
**Why:** the problem and the options we weighed.
**Decision:** what we chose.
**Trade-offs:** what gets harder, and what to revisit later.
```

---

## 2026-11-02: Dev docs live in the repo as a few Markdown files
**Status:** proposed · **Who:** maddox
**Why:** Two people plus Claude Code agents need shared context that survives between sessions. Agents read
the repo, not chat history. We considered GitHub Projects and a heavier per-feature file system, but both felt like too much for now.
**Decision:**
- Use `CLAUDE.md` (loaded by Claude Code automatically), `dev/ARCHITECTURE.md`, `dev/DATA-MODEL.md`, `dev/TASKS.md`
  and this file. No tooling.
- Features follow a lifecycle with a folder per stage: `dev/roadmap/` → `dev/planning/` → `dev/testing/` → an outcome
  (ship, iterate or remove) logged here → `dev/archive/`.
**Trade-offs:** `TASKS.md` can get merge conflicts if both of us edit it at once. Revisit if it grows past one screen.

## 2026-11-02: `crawl-*.json` stays the source of truth for game content
**Status:** proposed · **Who:** maddox
**Why:** Brody edits content through the website's Admin UI, which commits these files straight to `main`. Moving
content elsewhere (e.g. Markdown) would break that workflow.
**Decision:** Keep the JSON files and their current formats. The dev docs are for development only. Any change to a file's
shape gets an entry here first, because the site, the creator, the tabletop and the build all read these files.
**Trade-offs:** Admin commits bypass PRs, so code PRs should leave the JSON alone to avoid conflicts. The planned
rebuild may revisit where content lives. When it does, it gets a new entry here.
