# FIELDING REALISM — THE MAGNITUDE, NOT THE IDENTITY

Player Realism Phase 2B. Branch `claude/fielding-realism`, built on
captaincy-realism main (`c74f70c`). Gameplay changes; **not merged,
not deployed.** Instrument: `tools/fielding-realism-probe.mjs`;
evidence beside this file.

The audit's verdict stands at the head of this phase: fielding WORKS
— real positions through `foFieldAssign`, real hands in a real
contest, individual identity the engine can see — and it is worth far
too much. The mission is to shrink what it is *worth* without touching
what it *is*. The geometry survives untouched; only two slopes move.

---

## 1. The shipped curve, reproduced

Team fielding+catching swept together, 20→95, batting and bowling
identical in every cell (N=300/cell, opponent fixed at par):

| lvl | conceded/50 | wkts | win% | catches | saves (runs) | misfields |
|---|---|---|---|---|---|---|
| 20 | 320.6 | 4.39 | 13.2 | 1.42 | −25.8 | 25.8 |
| 30 | 306.6 | 5.26 | 24.0 | 2.05 | −16.7 | 16.7 |
| 40 | 292.5 | 6.15 | 37.0 | 2.92 | −7.1 | 8.1 |
| 50 | 274.9 | 7.08 | 59.8 | 3.60 | +3.7 | 1.9 |
| 60 | 258.8 | 7.69 | 68.5 | 4.28 | +17.2 | 0.0 |
| 70 | 238.5 | 8.38 | 82.3 | 4.97 | +28.7 | 0.0 |
| 80 | 226.9 | 8.73 | 87.2 | 5.46 | +33.6 | 0.0 |
| 90 | 215.8 | 9.12 | 92.0 | 5.91 | +36.9 | 0.0 |
| 95 | 210.7 | 9.32 | 93.2 | 6.16 | +37.7 | 0.0 |

**20→95 = 109.9 runs. 40→80 = 65.6. 50→70 = 36.5.** The audit's
numbers (≈322→215, ≈65) reproduce on the shipped build to within a
run or two. The indictment is confirmed before anything is touched.

## 2. The decomposition: where the excess actually lives

The same nine levels with GROUND ONLY moved (catching pinned at par),
then CATCHING ONLY moved (ground pinned at par). The channels turn
out to be **additive to the decimal** on the 40→80 band:

| channel | 20→95 | 40→80 | 50→70 |
|---|---|---|---|
| ground only | 76.3 | **50.0** | 27.3 |
| catching only | 33.5 | 15.6 | 7.4 |
| both (sum: 109.8 / 65.6 / 34.7) | 109.9 | 65.6 | 36.5 |

This **overturns the suspicion the phase opened with**. Catching was
the first suspect; the measurement says the dominant channel is the
ground game, by more than three to one over the strategic band.

The event ledger says why, and it is precisely the asymmetry the
engine's own `FO_FLD` population comment once warned about: a good
stop has to *beat* a +37/+44 offset while a misfield only has to
*lose* to a −59. The contest transitions from misfield-fest to
save-fest across a narrow skill window centred near par:

- **level 20**: 25.6 misfields an innings, zero saves — fieldRuns −25.6
- **level 40**: 8.1 misfields, one bare save — fieldRuns −7.1
- **level 60**: no misfields at all, 11+ saves — fieldRuns +17.2
- **level 95**: fieldRuns +44.4 (ground-only cell)

Eight fumbles an innings from a level-40 side fails the brief's own
believability test for leaving ground fielding alone (§6: "if ground
fielding alone produces believable boundary saving / single
suppression / misfield cost, LEAVE IT ALONE" — it does not). And a
70-run swing in direct event value is before the `fieldAvg`
positioning term in ballDist adds its share.

Catching's excess, by contrast, lives at the **extremes**: the catch
channel alone moves wickets 5.18→8.87 an innings across 20→95 —
nearly ±2 wickets from hands alone — because a 95 converts 97.3% of
everything (near-automatic) while a 20 converts 51.7%. But its
realistic 40→80 band is 15.6 runs, which sits inside the brief's
15–30-run sanity range *on its own*. Catching needs its extremes
compressed; the ground game needs its slope brought down across the
whole range.

## 3. The mechanism: two slopes around par, geometry untouched

One lever per channel, both the same shape, both around the par the
band offsets were solved against, both A/B-switchable, both proven
bit-identical to shipped play at 1.0 (replay masters green on the
instrumented build):

- **catching**: an outfielder's hands enter the contest as
  `cpar + ck × (raw − cpar)` — par catchers untouched, extremes
  compressed toward par, ordering preserved (assignment still posts
  the best hands in the cordon), Safe Hands (+11) and weather at full
  size, **the keeper's gloves not compressed at all** (they route
  through `foKeeperQuality`, audited correct).
- **ground**: `par + gk × (raw − par)` at the single site where a
  fielder's skill meets a dealt difficulty.

Nothing else moves: same geometry, same shot directions, same
assignment, same band offsets, same drop margin, same run-out model,
same talents. `__foFldK` / `__foFldKG` sweep the candidates on
identical seeds; `FO_FLD.ck` / `FO_FLD.gk` freeze what measurement
chooses.

## 4. The sweep and the chosen slopes

<!-- SWEEP -->

## 5. Catch conversion shape at the chosen slope

<!-- SHAPE -->

## 6. Individual fielders: elite and liability

<!-- INDIV -->

## 7. Positional identity

<!-- POS -->

## 8. Conditions

<!-- COND -->

## 9. Run-outs and the arm (guard)

<!-- ARM -->

## 10. The keeper (guard)

<!-- KEEPER -->

## 11. Captaincy interaction (report only)

<!-- CAPT -->

## 12. The Match-Day Coach

<!-- COACH -->

## 13. Attribute values and the wage question

<!-- ATTR -->

## 14. Calibration

<!-- CAL -->

## 15. Regressions, suites, A/B proof

<!-- SUITES -->
