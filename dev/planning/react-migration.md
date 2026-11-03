# Move the UI to React
**Status:** draft (starts after the [TypeScript + Vite refactor](typescript-vite-refactor.md))  ·  **Owner:** maddox  ·  **Roadmap:** none yet

## Goal
Use React for Crawl's UI where hand-written DOM code stops scaling: the parts that react live to game state.
Examples are an automated character sheet, where spending AP updates a dozen numbers, combat phases, and the tabletop.
React also gives us React Three Fiber for 3D views, and a large set of ready-made components.
See the "plain TypeScript now, React later" entry in [DECISIONS.md](../DECISIONS.md).

## Scope
- **In:**
  - adding React to the Vite project,
  - building new rules-automation UI in React,
  - moving existing pages over one at a time, when it's worth it.
- **Out:** these aren't goals in themselves.
  - Rewriting every page at once.
  - Rewriting stable compendium pages that work fine. They move only if they need new features.

## How it works
**When to start:**
- after the Vite refactor has cut over, **and**
- when we plan the first rules-automation or new tabletop UI.

That first new screen is the trial. It gets a testing doc, and its outcome (ship, iterate or remove) decides whether React becomes the default.

**Page by page:**
- Vite builds React and plain TypeScript pages side by side, and a page can even mount a React component inside existing DOM.
- No big rewrite is needed.
- Suggested order once we're committed:
  1. new rules UI,
  2. the tabletop (the most live state),
  3. the creator (the most complex),
  4. the compendium pages, only when touched.

**What makes it cheap:** the refactor keeps game logic in framework-free `lib/` modules (data, the markup renderer, Admin saving, dice, rules).
React components call the same `lib/` code, and only the `ui/` and `pages/` layers get rewritten.

## Steps
- [ ] Wait until the Vite refactor has cut over.
- [ ] Add React to the Vite config (`@vitejs/plugin-react`), along with the lint rules.
- [ ] Build the first rules-automation screen in React as a prototype. Write up what we learned in `dev/testing/`.
- [ ] Outcome: ship (React becomes the default for new UI, logged in DECISIONS.md), or iterate, or remove (stay plain TypeScript).
- [ ] If shipped, plan the tabletop and creator moves as their own docs.

## Open questions
- **How to share state between pages.** A single-page app with a router would let React keep state across pages.
  Separate HTML pages keep URLs simple. Decide when the tabletop moves.
- **State library.** React's built-in state and context might be enough, or we might want a small store such as Zustand. Decide during the prototype.
- **Preact instead of React.** Preact is the same API in about 4 KB. It's worth a look if page size matters for mobile.
