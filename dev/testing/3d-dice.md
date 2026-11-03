# 3D dice roller: prototype
**Status:** in progress  ·  **Who:** maddox  ·  **Plan:** none (a first Three.js test)  ·  **Outcome:** not decided yet

## What we're testing
Can Three.js run well inside the new Vite site, and do physical 3D dice feel right for Crawl?
In detail:
1. **The stack:** does Three.js plus a physics library build, bundle and deploy on Vercel with no extra setup?
   How big does it make the page, and how quickly does it load?
2. **Performance:** does it run smoothly on a normal laptop and on a phone?
3. **Fit:** are physical dice (rolled, bouncing, read off the top face) worth having on the tabletop?
   Or would they slow play down compared with today's instant rolls?

This doesn't change anything on the site. The test page isn't linked from the nav.

## What we built
- **Page:** `/testing/dice.html` on the Vercel site, or `npm run dev` then http://localhost:5173/testing/dice.html.
  Code: `web/testing/dice.html` and `web/src/testing/dice.ts`.
- **Libraries:**
  - [three](https://threejs.org) 0.187 for the 3D,
  - [cannon-es](https://github.com/pmndrs/cannon-es) 0.20 for physics. It's small and simple, but it hasn't been updated since 2022.
    If we keep 3D dice, Rapier (`@dimforge/rapier3d-compat`) is the maintained alternative. It's faster, but its download is bigger.
- **Dice:** d4, d6, d8, d10, d12 and d20.
  - The d10 is a real pentagonal trapezohedron, built in code.
  - The d4 is read like a real one: the number at the top point.
  - Opposite faces add up to sides + 1, as on real dice.
- **How to use it:**
  - Type a roll such as `2d6 + 1d20 + 3`, or click the quick buttons, then **Roll**.
  - The dice are thrown into a tray, and each result is read from the face pointing up once they stop.
  - Roll support: `NdM` terms and `+`/`−` numbers, up to 12 dice.
    Keep/drop (`4d6kh3`), exploding (`!`) and `d%` stay in the tabletop's `dice.js` for now.
- **On screen:** frames per second, plus how long the dice took to settle.
- **Where:** signed-in admins reach it from the **Testing** menu in the nav (visitors don't see the menu).
- **Round 2 (after Maddox tried it):**
  - With several dice, they knocked into each other and some rolls never settled.
    Now dice **don't collide with each other**, only with the tray. They're thrown in lanes across the tray, so they rarely end up overlapping.
  - **Hard 5-second limit** (it was 8 s at first; Maddox shortened it): any die still moving or tipped on an edge is then laid flat on its nearest face and read. The result line says when that happened.
  - **Layout:** the dice box is a **square canvas taking half the screen**: the left half on a computer, the top half on a phone. The controls sit beside or below it.

## What we learned
_Partly filled in from the first build. The rest needs trying on a laptop and a phone with a real GPU._
- **The stack:** it worked straight away, with `npm install three cannon-es` and an ordinary Vite entry. Nothing to configure for Vercel.
- **Bundle size:** the page's script is **628 KB, 160 KB gzipped**, almost all Three.js and cannon-es.
  Only this page loads it; the other pages are unchanged. Vite warns about chunks over 500 KB, which is expected here.
- **Correctness (headless Edge with software rendering):** rolls of `2d6 + 1d20 + 3`, `1d4 + 1d8 + 1d10 + 1d12`, `12d6` and `3d10 − 2`
  all settled and were read correctly, and the totals added up. `4d6kh3` is refused with a clear message.
  Software rendering only reached about 2–27 fps, so settle times there aren't meaningful.
- Smoothness (fps), laptop and phone:
- How long a roll takes to settle:
- Does it feel good? Would we use it at the table?

## Recommendation
_Ship, iterate or remove, decided together and logged in DECISIONS.md._
