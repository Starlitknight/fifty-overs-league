# Fifty Overs — Resolver (Phase 0 feasibility artifacts)

Headless, deterministic match resolver built on the **real** game engine in
`Fifty_Overs_Club_Manager_2026_v11_6.html`. No engine-logic (`ballDist`/`apply`)
changes — only an additive entry point and a per-team input redirect.

## Files
- `resolve-harness.js` — additive `<script>` payload. Defines
  `window.__resolveMatch(homeSquad, awaySquad, homeOrders, awayOrders, conds)`
  and redirects batting phase-intent to a per-team `ordersMap` (see notes below).
  Injected at load for the proof; will be baked into the pinned build in Phase 4.
- `proof/prove.mjs` — Playwright determinism proof (6 checks).
- `proof/resolve-harness.html` — the same harness wrapped in a `<script>` tag
  (source for baking into the HTML build later).

## Run the proof
```bash
cd resolver/proof
npm link playwright            # global Playwright 1.56.1 is preinstalled
NODE_PATH=/opt/node22/lib/node_modules node prove.mjs
# exit code 0 = all checks pass
```

## What `__resolveMatch` returns
```
{ result_text, winner_team, mom,
  scorecard: [inn0, inn1],   // batTeam, bowlTeam, runs, wkts, legal, overs,
                             // extras, batting[], bowling[], fow[], pships[]
  worm,                      // [[over,runs,wkts]...] per innings
  log,                       // ball-by-ball commentary entries
  seed, pitch, meta }
```

## Determinism / trust-boundary notes
- Match randomness comes only from `M.rand = rng(seed)` (splitmix32, line 294).
  There is **no `Math.random`** anywhere in the file, and `new Date()` appears
  only in UI clock code, never the engine.
- The harness runs the **exact** `simBackground()` ball loop
  (`while(!M.done){autoPick(); stepBall()}`) with `M.isUserMatch=false`, which
  disables every global/DOM tactical leak (field plan, keeper-global, the
  `ordersFor` App.orders fallback). `render()`/`onMatchEnd` are neutralized.
- The one additive routing change: the stock dispatch
  `intent = userBat ? userPhaseIntent(inn) : aiIntent(inn)` only lets the home
  (`M.user`) side read submitted intent, and always AI-drives the away side. Both
  functions are wrapped to read `M.ordersMap[inn.batTeam].phaseIntent` instead
  (mirroring the existing per-team `plannedBowler()` pattern). This changes only
  the *source* of the intent integer; run/wicket/score computation is untouched.
- Every live global the harness touches (`M`, `App.orders`, `App.page`,
  `App.tossState`, `onMatchEnd`, `UI.usePlan`, `__RESOLVE_ACTIVE`) is saved and
  restored — a resolve has zero side effects on a running game.

## Engine build hash
`sha256(Fifty_Overs_Club_Manager_2026_v11_6.html)` (unmodified) =
`e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff`

This will be recomputed over the final baked build and pinned per-league in Phase 4.
