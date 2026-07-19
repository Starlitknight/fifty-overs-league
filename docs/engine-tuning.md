# The engine tuning layer

The match engine ships as a pristine, hash-locked file (`./build.sh` must
always print sha256 `e558745e…`). All balance changes therefore live in ONE
place: `client/src/features/engine-tuning.js`, a runtime layer that wraps
the engine's global `ballDist` and reshapes each ball's outcome
distribution **before** the engine's single seeded draw.

Multiplying an outcome's probability by `f` and renormalizing is exactly a
`+log(f)` shift on that outcome's logit — the same currency the engine's
own model trades in.

## Fairness rules (do not break these)

- **No extra randomness.** The layer is a pure function of the ball
  context; matches stay seed-deterministic and consume the same number of
  `M.rand()` draws as stock.
- **Symmetric only.** Adjustments key off pitch, innings, over, bowler
  type/hand, batter hand, field setting and intent — never off which team
  is the user's, and never off story/campaign state. Both sides of every
  match are tuned identically, so solo narrative can never buy a
  multiplayer edge.
- **Kill switch.** `window.__foTuneOff = 1` restores the stock model
  (used by the A/B benchmark; also an emergency revert).

## What it currently models

| Upgrade | Effect |
| --- | --- |
| Pitch wear | Dry decks turn more in the 2nd innings and from footholes late in any innings; cracked pitches → more uneven-bounce bowled/lbw after innings one; green seam movement fades in innings two. |
| Matchup geometry | Spin turning **away** from the bat (off-spin→LHB, leg-spin/SLA→RHB) boosts caught/stumped; spin turning **in** trades edges for lbw/bowled; cross-angle pace edges slightly more, same-angle pace pins pads. |
| Field × intent | Attacking field vs attacking bat: edges carry, ring leaks fours. Spread field vs slogger: fours smothered into twos, sixes the risky way over. Blockers sit safely on an attacking field but score slower. |

All numbers live in the module's single `CFG` object with per-knob
comments. Magnitudes are deliberately gentle (≤ ~18% on any one outcome).

## The benchmark gate

After **any** edit to `CFG` (or anything else that could shift balance):

```
./build.sh && node tools/engine-bench.mjs      # BENCH_N=24 for more seeds
```

It plays a matrix of full seeded matches through the real engine
(balanced/dry/green × tuning off/on), prints the comparison table, checks
the tuned model against target bands from the modern-ODI audit
(first-innings par, wickets, spin share of bowler-credited wickets), and
verifies seed-determinism. Non-zero exit = a band was missed → fix the
numbers before shipping. Requires the environment's playwright+chromium
(same as the resolver probes); it is intentionally not part of the fast
`node --test` suite.

Baseline at introduction (N=20): balanced par 277→272 (stock→tuned),
dry-pitch spin wickets/match 8.1→8.5 with pace down in kind.

## Where it applies

The layer is part of the campaign bundle, which `build.sh` embeds in both
`index.html` and `client/game.html`. Anything that simulates through those
builds — live user matches, the career world's headless `simWorld`
matches, server-side broadcast preparation — gets the same tuned model. A
simulator running a different build would produce stock-model matches:
internally consistent, just statistically slightly different.
