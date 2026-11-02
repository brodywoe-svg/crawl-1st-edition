# Planning

**Stage 2 of the feature lifecycle** (see `CLAUDE.md`): one specific feature, usually from a
[roadmap](../roadmap/) goal, planned before anything is built. It answers what exactly is in scope, how it will work, which files it touches,
and what we don't know yet. Its steps go in [`../TASKS.md`](../TASKS.md) as lines that link back here.

Bug fixes and small tweaks don't need a planning doc.
Claude Code agents: when asked to plan a feature, write the plan here, so the other developer and later sessions can see it.

When the plan is agreed, prototype it in [`../testing/`](../testing/).
If testing says "iterate", start a new planning doc (e.g. `tabletop-action-pool-v2.md`) that links the archived one.

File names: lowercase-with-dashes, e.g. `tabletop-action-pool.md`.

## Template
```markdown
# Feature name
**Status:** draft | agreed | testing | done  ·  **Owner:** brody | maddox  ·  **Roadmap:** link

## Goal
What this does, and for whom.

## Scope
- In:
- Out:

## How it works
The approach. Which parts of ARCHITECTURE.md / DATA-MODEL.md it touches, and any decisions it needs.

## Steps
- [ ] 

## Open questions
- 
```
