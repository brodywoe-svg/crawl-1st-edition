# Testing

**Stage 3 of the feature lifecycle** (see `CLAUDE.md`): building a planned feature as a prototype and recording what
we learned. One write-up per feature, linked from its [planning](../planning/) doc.

**Where prototype code lives:**
- on a branch,
- in a folder next to the write-up (e.g. `testing/threejs-tree/`), or
- behind an opt-in switch on the site, as Tree mode does.

A prototype never replaces existing behavior until the outcome is agreed.

This folder is for **write-ups and prototypes**, not automated test suites.

**Testing ends with an outcome**, decided by both of us and logged in [`../DECISIONS.md`](../DECISIONS.md):
- **Ship**: build it properly into the site, and update `ARCHITECTURE.md` / `DATA-MODEL.md`.
- **Iterate**: start a new planning doc for the next round.
- **Remove**: take the prototype out, and write down why.

Then move this write-up and the planning doc to [`../archive/`](../archive/).

File names: lowercase-with-dashes, e.g. `threejs-skill-tree.md`.

## Template
```markdown
# Feature name: prototype
**Status:** in progress | finished  ·  **Who:** brody, maddox  ·  **Plan:** link  ·  **Outcome:** ship | iterate | remove

## What we're testing
The question this prototype answers.

## What we built
Where the code is (branch, folder or switch) and how to try it.

## What we learned
- 

## Recommendation
Ship, iterate or remove, and why.
```
