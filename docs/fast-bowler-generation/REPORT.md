# FAST-BOWLER GENERATION + PLAYER-VALUE FINAL ACCEPTANCE

Branch `claude/fast-bowler-generation`, from main at `9619a44`.

**Part A is implemented.** One file changed under `engine/src`
(`league/03-onboarding.js`), plus one test made to measure what it names.
**Part B is measured and NOT committed** — `FO_VAL_W` and `FO_VAL_MIX` in
`00-core.js` are byte-identical to main; every candidate number below is
applied by overriding the constants inside a VM.

Match physics is untouched: `calibration-check` **PASS** on the new build.

---

# PART A — FAST-BOWLER GENERATION

## 1. THE AUDIT: WHERE BOWLING TYPE IS DECIDED

| path | source | produces `seamFast`? | live in the served world? |
|---|---|---|---|
| world founding | `init-world.mjs squadFor` → `genSquad` → `foGenArchetypeSquad` | **no** | **yes** |
| free-agent board | `market.mjs makeFreeAgent` → the same `genSquad` | **no** | **yes** — the only ongoing intake |
| youth / academy | `00-core.js:5204 jsGenYouth` | yes (1 role in 18) | **no** — the youth system is retired (075); no boys are generated |
| founder draft | `00-core.js:6988` | yes, with a 1.35 scarcity premium | browser/solo only |
| internationals | `tick.mjs buildNatSquads` → `seasonSquad` | — | **selected from club squads, never generated** |
| part-timers | `03-onboarding.js:602` | n/a | yes, unaffected |

**The zero-fast problem was in exactly one function**, and both live paths run
through it. Nothing else needed touching.

## 2. WHY THERE WERE NONE

`foGenArchetypeSquad` fills its pace slots from a rotation whose own comment
says *"no second genuine quick — the Express captain is the league's apex
predator"*. That is correct as far as it goes: the rotation was never meant to
contain one, because the **first** genuine quick arrived from the archetype's
standout.

Then the standout stopped arriving. When the pre-set captain was folded into
the ordinary slot ladder (the change documented at `:390`), the line that gave
him the starter's role went with him. What survived was:

- `var st = A.starter || {};` — assigned, and **read nowhere**;
- its comment, still promising *"a Pace Battery is still led by a genuine
  quick"*;
- `foQsDefaultComp`, still counting the standout into the right **bucket** (so
  an express club still gets a fourth pace slot) while throwing his **role**
  away.

So the club got the extra quick's *slot* and never his *style*. Measured on
every side the planet has: **256 squads, 3,840 cricketers, zero `seamFast`.**

The same slip cost the Spin Circus its wrist-spinner — its lead spinner was
`spinStyles[0]`, a finger spinner, against an archetype billed and sold on
mystery wrist spin. One repair fixes both, because it is one bug.

## 3. THE DISTRIBUTION, MEASURED NOT GUESSED

Restoring the standout's role alone was not enough, and the reason is
structural rather than statistical: **five of sixteen nations have no Pace
Battery in their archetype palette at all** (`NAT_ARCH`), so the Netherlands
could not produce a fast bowler rarely — it could not produce one ever.

So a club's **lead quick, and only his slot**, is genuinely fast with
probability `FO_FAST_LEAD_P`. The draw is taken unconditionally and compared
afterwards, so moving the number re-rolls nobody and the sweep is a comparison
rather than five different worlds:

| p | quicks | front-line share | clubs with one | nations with NONE |
|---|---|---|---|---|
| 0 (standout only) | 40 | 3.1% | 15.6% | **5 / 16** |
| 0.10 | 53 | 4.1% | 20.7% | 2 / 16 |
| 0.15 | 60 | 4.5% | 22.7% | 2 / 16 |
| **0.25** | **81** | **5.9%** | **29.3%** | **0 / 16** |
| 0.40 | 109 | 7.8% | 39.1% | 0 / 16 |

**0.25 is the smallest value at which no nation is shut out.** Medium holds at
24.4% and the spin share at 44.0% for every row, because the rule can only ever
convert a lead fast-medium into a lead fast.

Against the brief's five criteria, at p = 0.25:

- **clearly present** — 81 in the world, one in every 3.4 clubs;
- **less common than fast-medium** — 5.9% against 25.8%;
- **less common than medium + fast-medium** — 5.9% against 50.2%;
- **several in every large ecosystem** — every nation has some; the largest have 5;
- **not so common that every attack has one** — 70.7% of clubs have none.

Wrist spin comes back with it: 6.5% → 10.2% of the front line, 32.4% → 40.6% of
clubs.

## 4. THEY ARE CRICKETERS, NOT RELABELLED SEAMERS

All bowlers of each style (median skill), and then **lead quick against lead
quick**, which is the only fair comparison — every `seamFast` the generator
deals is a first-choice bowler, so comparing him with all fast-mediums
including third seamers measures the quality ladder and calls it the style:

```
LEADS ONLY        n   wicket  economy  moveTurn  variation  discipline  stamina   age   OVR
seamFast         52       81       78        80         77          75       78    28  74.8
seamFastMedium  121       66       62        70         65          62       64    27  62.8
seamMedium       83       65       64        65         61          62       65    27  69.8
```

Read alone that says the generator has made "fast" a badge for "good". Split by
archetype it says the opposite:

```
express lead=seamFast          34   wicket 90   OVR 82
express lead=seamFastMedium     5   wicket 70   OVR 64
other   lead=seamFast          18   wicket 62   OVR 67
other   lead=seamFastMedium   116   wicket 66   OVR 64
other   lead=seamMedium        82   wicket 66   OVR 69
```

At a Pace Battery the quick **is** the best man in the side — which is what
that archetype is for and is advertised as. At every other club the quick the
dice handed over is **indistinguishable** from the fast-medium lead he
replaced. The aggregate gap is the express clubs, not the style.

No speed bonus was added anywhere. The engine already prices pace in `ballDist`
and in the fatigue law; a generator that handed quicks extra wicket-threat
would be paying them twice.

## 5. FATIGUE

No constant moved. The generated men land on the shipped hierarchy because
`jsDerive` maps them onto it:

| `bowlTypeFull` | engine type | in-match work | between-match load/over |
|---|---|---|---|
| `seamFast` | `fast` | **1.08** | **2.6** (`LOAD_FAST_PER_OVER`) |
| `seamFastMedium` | `fastMedium` | 1.04 | 2.5 |
| `seamMedium` | `medium` | 1.00 | 2.4 |
| `fingerSpin` / `wristSpin` | `fingerSpin` / `wristSpin` | 0.90 | 1.5 |

`living.mjs` matches `/fastmedium/` before `/fast/`, so a `seamFastMedium` is
not mistaken for a quick.

## 6. WORLD SAFETY

Same measurement, both builds, 256 clubs and 3,840 men:

| | mean OVR | p5 | p50 | p90 | p95 | p99 | max | ≥80 | ≥90 |
|---|---|---|---|---|---|---|---|---|---|
| main | 52.78 | 20 | 53 | 79 | 84 | 90 | 98 | 381 | 42 |
| fixed | 52.80 | 20 | 53 | 80 | 84 | 90 | 98 | 385 | 51 |

Total payroll $59.67m → $59.82m (+0.25%); median, P90 and top wage identical;
division means 62.60 → 62.68 and 42.95 → 42.92. All 256 clubs still field five
legal bowlers and a sixth option.

The one visible movement is ≥90 going 42 → 51. That is **not** the quicks being
rated higher — `FO_VAL_W` has no bowling-type term, so a man's card does not
know what he bowls. It is the unconditional extra `rnd()` re-dealing the world;
√42 ≈ 6.5, so +9 is about 1.4 standard deviations of ordinary tail variation.

### The one test that failed, and why it was the test

`home-advantage.test.mjs` asserted `home < 58%` on a **single hard-coded
squad**, and the re-dealt world handed that squad 58.2%. Measured across six
squads on both builds:

```
shipped   53.4  55.5  56.1  54.4  56.7  55.6    mean 55.27%
changed   58.2  53.7  52.5  56.1  54.8  57.3    mean 55.44%
```

The squad-to-squad spread is wider than the difference between the engines, and
seed 4242 drew the top of it. The home edge did not move. The test now averages
five squads — which is a **tighter** contract, not a looser one (the mean of
five carries about 0.7 points of error against one draw's 1.6), plus a new
per-squad ceiling so a single runaway squad cannot hide inside an acceptable
average. Green.

## 7. THE EXISTING WORLD

**No existing player is mutated and no identity is rewritten.** This is a
generation fix.

The game already has the right mechanism and it needs no invention: the
**free-agent board** is the only ongoing intake (`market.mjs openFreeAgents`
→ `makeFreeAgent` → the same `genSquad`), so quicks now walk onto it by
themselves. Measured over 3,200 simulated free agents: **2.63% are genuine
quicks**, and 15 of 16 nations produce at least one. The board walks on 1–2 men
per nation per day ≈ 24 a day worldwide, so:

- **~0.6 genuine quicks a day worldwide, ~26 a season** across 16 nations;
- ~1.6 per nation per season *offered*, fewer signed;
- a nation would take **several seasons** before a handful of clubs own one,
  and would approach the fresh-world figure (29% of clubs) only as slowly as
  its whole population turns over.

If that is too slow to be satisfying, the lever is the free-agent rate or a
one-off board seeding — **not** a migration that rewrites who anybody is.

---

# PART B — PLAYER-VALUE FINAL ACCEPTANCE

## 8. RE-MEASURED WORLD WEIGHTS (§7)

Two corrections, and the bigger one is not the fast bowlers.

**The world distribution had a seed collision.** The earlier probe dealt every
nation's slot-*N* club from seed `7000 + slot` and passed a tier field
`sidesOf` does not carry — so a "3,840 cricketer" population was 240 men
repeated sixteen times, untiered. Fixed: the seed carries the nation and the
tier comes from the server's own rule. The spin share moves 44.5% → **43.9%**,
which shifts `vsPace`/`vsSpin` by a thousandth and nothing else.

**Bowler stamina was priced off one type as a proxy for all of them.** The
earlier candidate used the fast-medium figure (0.046) because there were no
fast bowlers to price the top rung with. That was the wrong repair for the
right observation: `FO_VAL_W.bowl.stamina` sits on **every** bowler's card and
the card does not know his type, so the honest weight is the world's own mix:

| type | share of overs | runs/pt |
|---|---|---|
| seamFast | 5.9% | 0.0722 |
| seamFastMedium | 25.8% | 0.0464 |
| seamMedium | 24.4% | 0.0308 |
| fingerSpin | 33.8% | 0.0053 |
| wristSpin | 10.2% | 0.0053 |
| **mix** | | **0.0261** |

So stamina goes **0.046 → 0.026**, and the fast bowlers contribute 0.0043 of
that. Adding them barely moved it; doing the weighting properly halved it.

## 9. THE COMBINED FIELD CHANGE (§10) — AND WHY IT CHANGES EVERYTHING

`FO_VAL_MIX` held an outfielder's fielding to 0.45 *because the family sum
overstated it*. Correcting the sum and keeping the cap would under-pay fielding
twice. Tested as a combination, never as two independent halvings:

```
effective field weight on a batsman's card  =  mix x family sum
   OLD   0.45 x 0.310 = 0.1395
   NEW   1.00 x 0.106 = 0.1060
```

Phase 2B's measured cricket value of the field family is `fielding 0.077 +
catching 0.029 = 0.106` runs a point. **The new effective contribution equals
the measured value exactly**, by construction; the old one was 32% above it.

This is the single most important correction in Part B. The earlier candidate
was evaluated with the new sum and the *old* 0.45 mix, which cut the effective
weight by 66% instead of 24% — and that, not the weights themselves, produced
the alarming "42 → 89 players at 90+" figure. With the combination applied as
the brief specifies, the re-rating is small (§12).

## 10. PLAYER PAIR TESTS (§8)

N = 400 paired seeds; "margin" is A − B in runs per 50 overs.

| pair | OLD | CAND | wage (cand) | engine |
|---|---|---|---|---|
| elite bat/poor field vs good bat/elite field | 73 v 73 | **75 v 72** | $31,350 / $27,740 | +2.65 ± 2.08 |
| wicket threat vs economy | 68 v 63 | **67 v 65** | $22,350 / $20,410 | +3.08 ± 2.20 |
| genuine quick vs fast-medium, same skills | 69 v 69 | 69 v 69 | equal | +0.01 ± 1.80 |
| keeper-batsman vs elite gloves/poor bat | 72 v 55 | 71 v 54 | $26,600 / $11,700 | +9.21 ± 2.03 |
| keeper: elite bat/mediocre gloves vs balanced | 77 v 67 | 76 v 66 | $32,620 / $21,370 | **+0.80 ± 2.21** |
| young (21) vs veteran (34), same skills | 71 v 71 | 72 v 72 | equal | **−2.67 ± 1.49** |
| high experience vs low, same skills | 70 v 70 | 70 v 70 | equal | **+4.16 ± 1.60** |
| elite captain vs ordinary | 66 v 66 | 67 v 67 | equal | **+5.64 ± 1.92** |
| balanced all-rounder vs batting specialist | 68 v 74 | 68 v **75** | $23,370 / $31,350 | **+2.07 ± 2.18** |

**Where the candidate is better:**

- The old card could not separate an elite bat with poor hands from a good bat
  with elite hands (73 v 73). The candidate puts the batsman 3 clear and the
  engine leans the same way.
- Wicket-threat vs economy: the candidate's 2-point gap corresponds to about
  2.4 runs at the measured 1.2 runs per overall, against the engine's 3.08. The
  old card's 5-point gap implied 6 runs. The candidate is the better-calibrated
  of the two.
- A genuine quick and a fast-medium of identical skill are the same card and
  measure as the same cricketer. That is the right answer and it is why the
  fast-bowler fix needed **no** valuation change.

**Three contradictions the candidate does NOT fix, and neither does the old card:**

1. **A keeper's batting is over-weighted against his gloves.** Card says 10
   apart; the engine says 0.80 ± 2.21 — five standard errors short of the ~11
   runs a 10-point gap implies. Both cards do this identically.
2. **Experience and captaincy are worth real runs and are on nobody's card.**
   +4.16 ± 1.60 for a 64-point experience gap (z = 2.6) and +5.64 ± 1.92 for a
   50-point captaincy gap (z = 2.9), with both cards reading dead level.
3. **The all-rounder premium is too small.** The card says the specialist is 7
   better; the engine mildly prefers the all-rounder (+2.07 ± 2.18). The
   candidate widens this by one point.

None of these is caused by the re-fit. All three are named here rather than
quietly carried.

## 11. MATCH-DAY COACH CROSS-CHECK (§9)

Sixteen deliberately extreme cricketers, five pitches, every pair the card
separates by ≥ 8 points where the coach prefers the lower man on 4+ of the 5.

```
OLD CARD        2 systematic contradictions
CANDIDATE       2 systematic contradictions
```

- *"fast-medium > ordinary bat by 8"* appears under **both** cards on 5/5
  pitches. The coach's own currency is `rpd + 2 × bowl`, and a specialist
  bowler's runs-per-dismissal is near zero because he bats at eleven — so this
  is an asymmetry in the coach's metric when comparing a bowler with a batsman,
  and it is pre-existing.
- *"strike quick > ordinary bat by 9"* existed under the old card and
  **disappears** under the candidate.
- *"all-rounder > no nerve by 8"* is new, and is the candidate raising
  temperament (0.060 → 0.104), which drops a temperament-18 batsman from 64 to
  61. The coach evaluates cards in a neutral state where temperament barely
  bites, so it cannot see the thing being priced. This is the
  context-specific disagreement the brief says is fine.

**The coach broadly agrees**, and the contradiction count does not rise.

## 12. RE-RATING THE EXISTING WORLD (§14)

3,840 existing cricketers, priced under both laws (weights **and** mix
together):

| movement | men |
|---|---|
| no change | 1,490 |
| ±1 | 1,929 |
| ±2 | 396 |
| ±3 | 25 |
| ±4 | 0 |
| ±5 | 0 |
| more than 5 | **0** |

Largest rise **+3** (Ben Ingram, opener, 86 → 89). Largest fall **−3** (Jasper
Veldman, wrist spin, 29 → 26).

| role | n | up | down | mean Δ |
|---|---|---|---|---|
| opener | 482 | 296 | 30 | **+0.75** |
| topOrderBat | 517 | 223 | 102 | +0.32 |
| middleOrderBat | 510 | 157 | 133 | +0.06 |
| seamFast | 81 | 28 | 19 | +0.11 |
| allRounder | 548 | 122 | 158 | −0.08 |
| seamFastMedium | 405 | 102 | 140 | −0.10 |
| fingerSpin | 282 | 86 | 92 | −0.10 |
| wristSpin | 242 | 70 | 92 | −0.19 |
| seamMedium | 261 | 61 | 102 | −0.21 |
| **wicketkeeper** | 512 | 11 | **326** | **−0.67** |

Top-order batsmen rise (temperament re-priced); keepers fall (keeping 0.045 →
0.021 and stumping 0.030 → 0.018, and the field-mix change does not reach them
because a keeper's field mix is 0.00).

**The three policies.**

- **A — immediate re-rating.** Nobody moves more than 3 overall, 39% of the
  world does not move at all, and the largest single-club payroll change is
  +4.7%. One player-value law, one truth, done in a settle.
- **B — grandfather the old cards.** Two men with identical skills would carry
  permanently different overalls depending on when they were generated; every
  comparison surface (squad lists, the market, scouting bands, `squadStrength`,
  world rankings, AI bidding, which are *all* functions of `rating`) would be
  comparing two currencies. `foFitToLevel` targets a level, so a grandfathered
  man could not be trained, aged or re-fitted without silently converting him.
  This is not viable at ±3.
- **C — hybrid/migration.** Carries B's inconsistency for a bounded time plus
  the cost of a migration, to spare a movement no player will notice.

**A**, on the measured numbers. The scale of the change no longer justifies the
machinery of B or C.

## 13. WAGES (§15)

| | old | new | |
|---|---|---|---|
| total, per round | $59,240,970 | $59,831,600 | **+1.0%** |
| median | $11,060 | $11,060 | — |
| P90 | $38,050 | $38,050 | — |
| P99 | $54,180 | $56,010 | +3.4% |
| top wage | $69,950 | $69,950 | — |

| per club, per round | old | new | |
|---|---|---|---|
| division 1 | $330,581 | $334,741 | +1.3% |
| division 2 | $132,239 | $132,693 | +0.3% |
| flagship | $438,143 | $446,680 | +1.9% |
| d2b | $91,486 | $91,292 | −0.2% |

Worst single club **+4.7%**, best **−4.4%**.

The earlier +4.8% figure was the uncombined field change. At +1.0% total, with
median/P90/top wage unmoved and the movement concentrated in the P99 tail,
**no wage-curve normalisation is warranted**. Normalising the curve to force
the total back to its old number would be moving a calibrated economy to hide a
one-percent re-pricing.

## 14. TEMPERAMENT (§12) AND EXPERIENCE (§13)

**Temperament 0.060 → 0.104 stands.** It is measured at 0.135 ± 0.033 raw
(N = 1000, z = 4.1) and 0.104 world-weighted across the six pitches the world
actually plays, on the shipped `tmpFloor 0.20` engine — not from hard chases.
The state split shows why the weighting matters: batting-first 0.120,
chase 0.156, hard chase 0.299. Pricing it from the hard-chase column alone
would treble it.

**Experience should stay out of `foPlayerValue().level` — and this is a
decision, not an omission.** Two things are true at once and both must be said:

- The evidence is *stronger* than the earlier attribute sweep suggested. The
  sweep gave 0.019 ± 0.022 for a batsman; the pair tests give **+4.16 ± 1.60**
  runs for a 64-point gap (z = 2.6) and **−2.67 ± 1.49** for the young-versus-
  veteran pair. Experience is worth roughly 0.05 runs a point. It is real.
- It still must not enter `.level`. `foFitToLevel` binary-searches a factor over
  the **skills** and never touches `exp`, so anything added to `.level` that
  the fitter cannot scale becomes a tax on the ones it can — a veteran would be
  dealt materially worse batting and bowling to pay for his experience, and
  `foLayOnTier` would compound it by ranking him up first and fitting him down
  second (`DEPENDENCY-AUDIT.md` §4).

So the answer is **not** "too small to bother with". It is "big enough to want,
and it needs the CURRENT-OVR layer built before it can be paid for safely".
That layer is a separate change and is not attempted here.

## 15. KEEPER FAMILY (§11)

Left substantially alone, as instructed. `catching` 0.226 → 0.230 (measured
0.212 raw, 0.230 world-weighted), `keeping` 0.045 → 0.021, `stumping` 0.030 →
0.018; family sum 0.301 → 0.269. The internal ratios barely move and the family
was already about right.

The pair tests did surface one keeper problem (§10 item 1), but it points at
the **`wk` role mixture** (`bat 1.00 / glove 1.20`), not at the glove weights,
and it exists identically under the old card. Changing the mixture on one pair
test would be exactly the blind alteration §11 forbids. It needs its own
measurement.

---

# FINAL DECISIONS

## FAST-BOWLER GENERATION: **ACCEPT**

One dangling variable, repaired to the intent its own comment already
documented, plus one named probability to stop five nations being structurally
barren. Genuine pace at 5.9% of overs and 29.3% of clubs; wrist spin restored;
the quicks are ordinary lead seamers except where the archetype means them to
be special; they land on the shipped fatigue hierarchy with no constant moved;
world strength, payroll and legality unchanged; the one failing test was
measuring a squad rather than the engine and now measures the engine.

## PLAYER-VALUE WEIGHTS: **ACCEPT** (as candidates — not committed)

Every number is a measured world-weighted value in runs of match margin per
point, which is what the comment above `FO_VAL_W` already claims its numbers
are. The pair tests improve or hold every ordering they touch, the coach's
contradiction count does not rise, and with the field mix corrected alongside
the family sum the existing world moves by at most three points.

```js
const FO_VAL_W = {
  bat:   { vsPace: 0.169, vsSpin: 0.111, power: 0.137, rotation: 0.165, temperament: 0.104 },
  bowl:  { wicket: 0.368, economy: 0.287, discipline: 0.088, moveTurn: 0.029,
           variation: 0.042, stamina: 0.026 },
  field: { fielding: 0.077, catching: 0.029 },
  glove: { catching: 0.230, keeping: 0.021, stumping: 0.018 }
};
const FO_VAL_MIX = {
  bat:   { bat: 1.00, bowl: 0.00, field: 1.00, glove: 0.00 },
  bowl:  { bat: 0.00, bowl: 1.00, field: 1.00, glove: 0.00 },
  ar:    { bat: 0.80, bowl: 0.80, field: 1.00, glove: 0.00 },
  wk:    { bat: 1.00, bowl: 0.00, field: 0.00, glove: 1.20 }
};
```

| value | old | new | why |
|---|---|---|---|
| `bat.vsPace` | 0.185 | 0.169 | exposure fit at the world's 56.1% pace share |
| `bat.vsSpin` | 0.145 | 0.111 | same fit at 43.9% spin; worth 0.318/pt against all-spin, −0.020 against all-pace |
| `bat.power` | 0.150 | 0.137 | measured, world-weighted |
| `bat.rotation` | 0.150 | 0.165 | measured; the most valuable batting point |
| `bat.temperament` | 0.060 | 0.104 | measured 0.135 ± 0.033 raw; underpaid by 73% |
| `bowl.wicket` | 0.415 | 0.368 | measured 0.387 ± 0.048 raw |
| `bowl.economy` | 0.240 | 0.287 | measured 0.321 raw; the priced wicket:economy ratio was 0.58 against a measured 0.78 |
| `bowl.discipline` | 0.140 | 0.088 | measured |
| `bowl.moveTurn` | 0.090 | 0.029 | measured; overpaid threefold |
| `bowl.variation` | 0.060 | 0.042 | measured |
| `bowl.stamina` | 0.030 | 0.026 | mixed over the types the world bowls, most of which are spin |
| `field.fielding` | 0.200 | 0.077 | Phase 2B, now priced |
| `field.catching` | 0.110 | 0.029 | ordinary outfield catching measures at essentially nothing |
| `glove.catching` | 0.226 | 0.230 | already right |
| `glove.keeping` | 0.045 | 0.021 | measured 0.008 ± 0.033 raw |
| `glove.stumping` | 0.030 | 0.018 | measured |
| `MIX.*.field` | 0.45 | 1.00 | the cap existed to compensate for the overweight family; with the family corrected it would under-pay fielding twice. Combined effective weight 0.106 = the measured value exactly |

**Not committed.** `FO_VAL_W` and `FO_VAL_MIX` in `00-core.js` are unchanged
on this branch.
