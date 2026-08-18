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

Two families were swept on identical seeds. The **single-slope family**
(`k` applied per channel; `sweep-evidence.json`) tamed the extremes but
ran into a structural bind: compression squeezes more of the skill
range *into* the steep transition around par, so even gk=0.3 kept 22
of the ground channel's 50-run band — while one elite fielder's value
fell 5.0 → 2.1 runs. Within-XI spread softens nothing (67.1 v 68.5 —
the steep zone is wider than any realistic spread), and the channels
turn superadditive under compression (52.2 both-swept at (0.5, 0.75)
against 43.8 predicted).

The **two-term anchor** (`eff = par + T×(teamMean−par) +
I×(raw−teamMean)`) tried to give team magnitude and individual
identity separate knobs — and was refuted by measurement: the XI's
total effective skill telescopes to depend only on T, so a signed star
raises the team mean and taxes his ten teammates; his paired value
collapsed from +5.0 to +0.34 runs at T=0.3 even with I=1. **The
negative result is the finding**: per-man honesty and team magnitude
cannot be decoupled by any linear mechanism, because a team is eleven
honest per-man values plus mild convexity. The general form stays in
the code, frozen at T=I, as the record of why.

**The frontier, both-swept, par cell pinned at 275 everywhere:**

| pair (gk, ck) | 40→80 | 50→70 | 20→95 | misf@20 | 1 elite |
|---|---|---|---|---|---|
| shipped (1, 1) | 65.6 | 36.5 | 109.9 | 25.6 | +5.0 |
| **(0.35, 0.55) — frozen** | **40.2** | **18.6** | **68.0** | **8.6** | **+2.7** |
| (0.30, 0.50) | 35.3 | 16.8 | 60.6 | 7.1 | ~2.0 |
| (0.25, 0.45) | 32.4 | 15.3 | 55.3 | 6.0 | ~1.8 |

The brief's 15–30-run hypothesis and its 3rd/4th criteria (elite
visible, liability costly) pull against each other on this frontier —
below (0.30, 0.50) the team band buys its last few runs directly out
of individual identity. **(0.35, 0.55)** is the frozen balance point:
the band falls 39%, a level-20 side fumbles 8.6 times an innings
instead of 25.6, and one elite fielder still swings +2.7 runs and
+4.4 win points. The final frozen curve
(`frozen-evidence.json` verify section): 40→80 = 38.9, 50→70 = 17.9,
20→95 = 67.9, wickets 5.37 → 8.90 across the full span.

## 5. Catch conversion shape at the chosen slope

At ck = 0.55 (straight chance; angle adds difficulty on top —
`frozen-evidence.json` §1 tables):

| skill | routine | moderate | difficult | extreme | overall |
|---|---|---|---|---|---|
| 20 | 100% | 48% | 0% | 0% | 64.5% |
| 50 | 100% | 86% | 0% | 0% | 75.7% |
| 70 | 100% | 100% | 13% | 0% | 81.9% |
| 95 | 100% | 100% | 58% | 0% | 88.7% |

The shape the brief asked for: routine stays routine for everybody
(the band offset already guaranteed it — a 20 was never useless),
elite hands are still clearly better where it is hard, **95 is no
longer automatic** (88.7% overall against the shipped 97.3%, taking
58% of difficult chances instead of 100%, and still 0% on the extreme
band — luck keeps its seat), and the whole skill separation lives in
the moderate/difficult bands where a spectator would put it.

## 5. Catch conversion shape at the chosen slope

<!-- SHAPE -->

## 6. Individual fielders: elite and liability

Frozen slopes, N=400 paired, all-par XI (`frozen-downstream.json`):

| change | runs | win pts |
|---|---|---|
| 1 elite (90/90) | +2.69±0.97 | +4.4 |
| 2 elite | +3.76±1.11 | +6.6 |
| 3 elite | +7.33±1.28 | +8.1 |
| 1 liability (25/25) | −2.54±0.91 | ~0 |
| 2 liabilities | −3.43±1.09 | −2.8 |
| 3 liabilities | −4.86±1.17 | −5.4 |

One elite fielder is a real signing; three are valuable (+8 win
points) and sub-additive — they do not transform an attack. One
liability costs; three cost more but less than three times one.
Exactly the diminishing-returns shape the brief ordered.

## 7. Positional identity

The assignment engine still tells men apart (per-post event labels):
the **elite catcher** (90 hands, 50 legs) lifts cordon catches 19%
over par (0.250 v 0.210/inn) and total catches to 3.27; the **elite
athlete** (90 legs, 50 hands) lifts neither cordon number — his value
arrives through ground saves instead; the liability is hidden at
mid-on but still found (3.12 team catches, more misfields). A
specialist catcher is worth more in catching positions, an athlete
where the ground matters — compression did not blur them.

## 8. Conditions

Team 40v80, paired, five pitches × five batting styles: the band runs
**34.6 to 45.7 runs** with green highest (45.0±2.0 — more chances
carried to hand) and balanced lowest (37.4±1.6). A natural, believable
spread produced by the existing model; no pitch-specific fielding
coefficients were added or needed.

## 9. Run-outs and the arm (guard)

0 / 1 / 3 Rocket Arms: 0.610 / 0.693 / 0.755 run-outs an innings,
conceded 277.6 / 276.7 / 275.5. Within noise of the audit's shipped
values — the recalibration did not touch the run-out model and the
measurement confirms it did not move. Left exactly alone.

## 10. The keeper (guard)

Keeper 50 / 74 / 95: stumpings 0.085 / 0.210 / 0.320 an innings, byes
3.13 / 1.90 / 1.18, keeper catches 0.25 / 0.38 / 0.41 — byte-for-byte
the shipped slopes. The keeper's separate pathway (`foKeeperQuality`)
did its job: outfield compression never reached the gloves.

## 11. Captaincy interaction (report only)

Re-measured at N=2000 paired (`captaincy-remeasure.json`): captaincy
20v95 is now worth **5.26±0.80 runs and +5.9±1.3 win points** against
3.96/+3.2 on shipped fielding, 80v95 = 2.20±0.70. Cricket-sensible:
when the field saves less, the captain's bowling-change judgement —
above all the persist-too-long anchor, whose attribution roughly
doubles to ~2.3 runs — decides more of the match. The organisation
sliver's isolated attribution fell into the noise (4.67 all-on v 4.61
org-off); its ballDist pathway was deliberately left uncompressed, so
this is attribution noise plus channel interaction at N=1200. Per the
phase brief **no captaincy constant was touched**; both measurements
are recorded here for the promised post-fielding captaincy review.

## 12. The Match-Day Coach

`FIELD_RUNS` was wrong at the definition level: it multiplies the
XI's MEAN fielding, so its honest value is the engine's team slope
per mean-point — which even on the shipped engine was ~1.6 (65.6
runs over 40 points), against which the old 0.30 undercharged the
field several times over. Controlled seat contests caught it: the
coach took bat 65/field 30 over bat 62/field 90 while the cricket
paid the fielder 4.3±1.9 runs. **FIELD_RUNS 0.30 → 0.95** (the
frozen team slope, 38.9/40): the resolved crossover flips to the
fielder, the measured ties stay with the bat, coach suite 32/32.
(`coach-crossover.txt`, including the harness lesson: the first run
let the coach dodge the choice by dropping a core bat and keeping
both candidates.)

## 13. Attribute values and the wage question

Marginal value of +20 points on one man, paired (N=400):

| family | runs | per point |
|---|---|---|
| batting (vsPace+vsSpin) | 5.63±1.35 | 0.281 |
| bowling (wicket+economy) | 9.61±1.75 | 0.481 |
| fielding (ground) | −0.08±0.80 | ≈0 (≤0.04) |
| catching | 0.13±0.30 | ≈0 (≤0.02) |

Secondary attributes are now unambiguously secondary — a point of
hands can no longer rival a point of bat. The elite-fielder pair
(§6) puts the combined 40-point fielding+catching package at ~2.7
runs ≈ 0.034/pt, roughly **an eighth of batting**.

**Wages** (report only, per the brief): wages derive from rating;
rating gives an outfielder's hands `fielding 0.200 / catching 0.110`
of the field family, deliberately capped at about **a sixth** of his
card — priced when a point of fielding bought shipped-sized cricket.
The cricket share is now nearer an **eighth to a ninth**, so the
rating/wage system mildly overprices fielding for outfielders (order
1.3–1.5×, worst for pure batsmen with golden hands). This is flagged
for a follow-up wage/valuation recalibration and deliberately NOT
bundled into this engine phase.

## 14. Calibration

The world A/B (`env-new.json` v the captaincy phase's, same seeds,
N=450): scoring **263.5 → 270.1**/50ov, wickets 7.19 → 7.22
(unchanged), all-out 37.8 → 39.9%, phase run-rates lifted evenly.
The event ledger explains the lift honestly: generated-world XIs
field slightly above par, so compression cost them saves (8.1 →
6.0/inn) and returned a few misfields (0.5 → 1.3). 270 sits inside
the 2026 ODI layer's own stated 265–270 par target, so **no
compensating retune** of unrelated batting/bowling coefficients is
proposed (the brief's §17 rule). Temperament and sixth-bowler paired
values ticked up 1.5–2.5 SE with the livelier scoring — noted, not
chased.

`calibration-check` (`calibration-drift.txt`): the pinned fingerprint
changed (as any deterministic gameplay change must), and one real
band breach — **division_two first-innings mean 233.7 → 217.4**
(1.4× tolerance). That is the compression's mirror side: the weak
league's ~36-median fielders are judged at `par + 0.35×(raw−par)`,
so the misfield hemorrhage the `FO_FLD` population essay described
("twelve misfields and not one good stop is not a broadcast anybody
wants") shrinks and weak-league scores fall. Recorded as honest,
directional drift. **Goldens and the calibration golden are not
re-blessed** — that waits for this model to be accepted at review.

## 15. Regressions, suites, A/B proof

On the final head (build `20260818-0058-59f1ce`):

- **Engine: 487/488.** The single red is the golden-master replay —
  expected and deliberate: gameplay changed, goldens held for review.
- One source-shape test followed the code it guards: the
  ground-contest assertion ("one comparison, no thresholds") now
  matches the line with the slope in it — the slope changes what the
  number *is*, never how the contest works. Fielding-contest suite
  9/9.
- **Server: 437/437** (`--test-concurrency=1`). The living fold and
  settles never see the fielding constants.
- **Match-Day Coach: 32/32** with the re-priced FIELD_RUNS.
- **Deterministic repeat: 3/3** bit-identical — the slopes are pure
  functions of skill; no new randomness anywhere.
- **The A/B proof, exact**: with `__foFldK=1;__foFldKG=1` the frozen
  build reproduces the pre-fielding golden masters **9/9 bit-for-bit**
  — OLD and NEW are one build, one switch, identical seeds, and the
  inertness of the mechanism at slope 1 was proven twice more along
  the way (replay green on both instrumented pre-freeze builds).

Not merged, not deployed, goldens held. The branch is a complete,
measured proposal awaiting review.
