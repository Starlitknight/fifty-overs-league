# PLAYER-VALUE FINAL CLOSURE

Branch `claude/fast-bowler-generation`. **Not merged, not deployed, and NOT
ready to ship** — see *Where it stands* at the end.

Match physics is untouched: `calibration-check` **PASS**.

---

## 1. THE THREE CONCEPTS, KEPT APART

`foPlayerValue(p)` now returns both coordinates:

| | what it is | who reads it |
|---|---|---|
| `.level` | **INTRINSIC** — raw ability, the fifteen skills and nothing else | `foFitToLevel`, `foLayOnTier`, save migration |
| `.cur` | **CURRENT PLAYING VALUE** — ability + accumulated experience | the card, and only the card |
| `.ovr` | `foOvrCurve(.cur)` | `foOvr`, and through it `rating`, wages, fees |
| `.intrinsicOvr` | `foOvrCurve(.level)` | the migration and strip tests |

**The hard rule holds, verified.** A man swept exp 20 → 95 holds intrinsic
level 65.73 at every step while his card moves 66 → 68. The fitter's
coordinate never sees experience, so a veteran is never handed worse batting
to pay for being useful.

**Market value** is `rating` → `foWageOf` → `rawWorth`, and it inherits the
experience term automatically because it is downstream of the card. Age is
already in `rawWorth` via `ageCurve`. Nothing else was added.

## 2. WICKETKEEPER MIX — 1.20 → 1.80

Six keepers, same seat, same XI, same opposition, 600 paired seeds:

| keeper | margin/50 | ct | st | byes | bat runs |
|---|---|---|---|---|---|
| D elite keeper-bat | **+21.15 ± 1.71** | 0.42 | 0.24 | 1.26 | 36.7 |
| A elite bat / mediocre gloves | +9.67 ± 1.66 | 0.29 | 0.06 | 2.69 | 39.9 |
| B balanced keeper-bat | +7.06 ± 1.72 | 0.37 | 0.15 | 1.58 | 25.3 |
| C weak bat / elite gloves | +1.45 ± 1.82 | 0.35 | 0.25 | 1.07 | 11.3 |
| F ordinary league keeper | −2.05 ± 1.78 | 0.31 | 0.07 | 2.22 | 20.6 |
| E poor keeper | **−13.91 ± 1.75** | 0.18 | 0.04 | 3.44 | 11.4 |

The byes track the gloves cleanly (1.07 for the elite gloveman, 3.44 for the
poor keeper), which is the keeper's slot doing work no attribute sweep sees.

Swept against that fixed measurement, correlation peaks at **1.80** (0.976,
against 0.970 at 1.20 and 0.969 at 3.00) and a glove-only keeper reaches 59
rather than superstardom. **1.80 is the choice.**

**Two honest qualifications.** First, I earlier said 1.80 was "the smallest
multiplier that reproduces the engine's ordering". That rested on C-versus-F,
a pair the engine separates by 3.5 runs against a combined error of 5.1 — it
does not actually resolve them, so the ordering claim was not evidence.
Second, the mixture **cannot** close the case the review flagged: elite
bat/mediocre gloves against a balanced keeper is 10 apart on the old card and
8 on the new against a measured 0.80 ± 2.21, and even at ×3.0 the sweep leaves
A twelve clear of C where the engine has them seven apart. The residual is the
card being LINEAR in points while the engine saturates, not the bat/glove
balance. Pushing the multiplier further buys card movement without buying
accuracy.

## 3. ALL-ROUNDER MIX — UNCHANGED AT 0.80 / 0.80

Two findings, and the second corrects the observation that opened the question.

**The symmetric sweep is a structural no-op.** `FO_VAL_C` normalises a role by
its own mixture sum, so scaling `ar.bat` and `ar.bowl` together scales
numerator and denominator alike. Swept 0.80 → 1.20 across ten test
all-rounders the cards moved by at most one point and the correlation did not
move at all (0.846 → 0.847). There is no lever here to pull.

**And the apparent mis-rating was my probe.** A 20/70 bowling all-rounder
priced at 68 measured +7.72 runs at No.5, which looks like gross over-rating —
but a 20/70 man bats at eight, not five. Seated at No.8 he measures
**+16.36 ± 1.86**. The card was right and the test was wrong. The final pair
battery confirms it from both ends: that man against a tail-ender is 68 v 54
on the card (≈15.8 runs) against a measured **+14.62 ± 2.36**, and a 70/20
batting all-rounder against a pure bat specialist is 67 v 67 against a measured
**−0.04 ± 0.89**.

No all-rounder bonus was added. Replacement testing did not prove the
two-family mixture cannot capture roster flexibility; it proved the opposite.

## 4. EXPERIENCE — IN THE CARD, NEVER IN THE COORDINATE

Swept 20/45/70/95 in three seats against a reference of 45, 600 paired matches
a cell, slope fitted through the reference weighted by 1/se²:

| seat | runs per point |
|---|---|
| batsman | 0.0246 ± 0.0140 |
| bowler | 0.0423 ± 0.0155 |
| all-rounder | 0.0578 ± 0.0160 |
| **pooled** | **0.0401 ± 0.0087** (z = 4.6) |

**This is smaller than the pair test that opened the question.** The +4.16 ±
1.60 figure was the high end of the range, not the middle of it, and the
batsman's own sweep is not monotone (exp 95 came back at −0.08 ± 0.94). So the
pooled slope is the estimate and the contribution is **capped at ±2 levels**:

```
foExpLevelBonus(p) = clamp((exp − 50) × 0.0401 / 1.2, ±2)
```

1.2 runs per overall is the measured replacement rate. Across the whole 20–95
range that is 2.5 points of card, capped to 4. A 95-experience mediocre player
cannot pass a genuinely better cricketer.

## 5. CAPTAINCY — NOT ON THE CARD, AND THE FIRST MEASUREMENT WAS WRONG

Sweeping a No.4's captaincy 30 → 95 appeared to be worth +7.10 ± 1.63 against
the captain's +7.61 ± 1.62 — which would have made captaincy an ordinary
attribute. It was an artefact: **the engine picks the captain as the
highest-captaincy man in the XI** (`00-core.js:5577`), so raising his simply
handed him the armband.

Pinning a captain above him:

| case | margin/50 |
|---|---|
| captaincy 30 → 95 on the CAPTAIN | **+5.56 ± 2.01** |
| captaincy 30 → 95 on a NON-captain | **0.00 ± 0.00** |

Exactly zero — not small, zero. Captaincy is the armband's value, not the
cricketer's. **Option A**: nothing in visible OVR; it stays with the market
and the Match-Day Coach, which already know who is leading today. An
expected-value premium (option B) would be self-referential — whether a man
captains depends on whether he is the highest-captaincy man selected — and
would over-rate every high-captaincy reserve who never leads.

## 6. WHAT VISIBLE OVR MEANS

**B — expected current playing value in his best realistic role.**

| input | in the card? | why |
|---|---|---|
| skills | yes | it is what a cricketer can do |
| experience | yes, capped ±2 | measured, stable, his own |
| captaincy | **no** | worth 0.00 ± 0.00 to a non-captain |
| age | no (market only) | already in `rawWorth`'s `ageCurve` |
| fatigue | **no** | it would make the card yo-yo daily |
| form | **no** | same |

The card is stable: experience moves slowly with age and caps, so a cricketer's
overall changes about as often as his skills do.

**Two consequences worth naming, both product-visible.**

1. **The card is no longer the trade strip.** A specialist's batting strip is a
   reading of his printed skills; his card is not any more. A veteran can wear
   4.5 stars on the strip and 5 on the card. `the-card-and-the-strip` now
   holds the identity against `.intrinsicOvr` and is green, but a manager will
   see the difference.
2. **The tier curve now controls ability, not the displayed distribution.**
   `foLayOnTier` fits to `foLevelForOvr(want)` — an intrinsic target — so a man
   dealt a mark of 80 displays 80 + his experience bonus. The alternative would
   be to have the fitter solve for current value, which is exactly the hard-rule
   violation. The drift is bounded by the ±2 cap.

No circularity: the fitter's input never depends on the fitter's output.

## 7. THE FINAL PAIR BATTERY (N = 400 paired)

| pair | OLD | FINAL | wage (final) | engine |
|---|---|---|---|---|
| elite bat/poor field vs good bat/elite field | 73 v 73 | 75 v 72 | $31,350 / $27,740 | +2.65 ± 2.08 |
| wicket threat vs economy | 68 v 63 | 67 v 65 | $22,350 / $20,410 | +3.08 ± 2.20 |
| genuine quick vs fast-medium, same skills | 69 v 69 | 69 v 69 | equal | +0.01 ± 1.80 |
| keeper-bat vs elite gloves/poor bat | 72 v 55 | **71 v 60** | $26,600 / $16,050 | +9.21 ± 2.03 |
| keeper: elite bat/mediocre gloves vs balanced | 77 v 67 | 76 v 68 | $32,620 / $23,370 | +0.80 ± 2.21 |
| elite keeper-bat vs balanced keeper | 84 v 67 | **85 v 69** | $45,640 / $24,410 | +10.62 ± 2.10 |
| young (21) vs veteran (34), same skills | 71 v 71 | **71 v 73** | $26,600 / $28,910 | −2.67 ± 1.49 |
| high vs low experience, same skills | 70 v 70 | **71 v 69** | $26,600 / $24,410 | +4.16 ± 1.60 |
| bowling AR (20/70) at No.8 vs tail-ender | 68 v 53 | 68 v 54 | $23,370 / $11,700 | +14.62 ± 2.36 |
| batting AR (70/20) at No.5 vs bat specialist | 66 v 66 | 67 v 67 | equal | −0.04 ± 0.89 |
| captaincy 30→95 on the CAPTAIN | 66 v 66 | 67 v 67 | equal | +5.56 ± 2.01 |
| captaincy 30→95 on a NON-captain | 66 v 66 | 67 v 67 | equal | **0.00 ± 0.00** |

The three orderings the review asked for are fixed: the gloveman rises 55 → 60
against a measured +9.21 gap, the veteran now rates above the identical
21-year-old exactly as the engine says, and experience separates two otherwise
identical men in the right direction.

## 8. OVR ACCURACY BY ROLE (§11)

| role | law | r | pair ordering | mean mis-price |
|---|---|---|---|---|
| keeper | OLD | 0.970 | 100% of 13 | 12.4 runs |
| keeper | **FINAL** | **0.976** | 100% of 13 | 12.3 runs |
| all-rounder | OLD | 0.845 | 92% of 26 | 5.5 runs |
| all-rounder | **FINAL** | 0.847 | 92% of 26 | 5.6 runs |

Only pairs the engine separates by more than twice their combined error get a
verdict. **The improvement is real but modest**, and smaller than the pair
battery alone suggests: the old law already ordered every resolvable keeper
pair correctly, and the all-rounder metrics do not move because the mixture
does not move. The keeper mis-price of ~12 runs is the linearity ceiling
described in §2, and no mixture reaches it.

## 9. RE-RATING, DECOMPOSED (§12)

| arm | 0 | ±1 | ±2 | ±3 | ±4 | ±5 | >5 | max | payroll |
|---|---|---|---|---|---|---|---|---|---|
| weights + field mix only | 1470 | 1961 | 372 | 37 | 0 | 0 | 0 | 3 | +1.1% |
| + keeper gloves 1.80 | 1394 | 1797 | 457 | 134 | 42 | 13 | 3 | 6 | +1.8% |
| **+ experience = FINAL** | **969** | **1616** | **857** | **314** | **66** | **18** | **0** | **5** | **+3.9%** |

Largest rise **+5** (Luke Kirby, keeper, 30 → 35); largest fall **−4**
(Charlie Bickley, finger spin, 30 → 26).

| role | n | up | down | mean Δ |
|---|---|---|---|---|
| wicketkeeper | 512 | 421 | 15 | **+1.91** |
| opener | 482 | 378 | 20 | +1.32 |
| seamFast | 81 | 50 | 12 | +0.69 |
| topOrderBat | 517 | 261 | 105 | +0.56 |
| seamMedium | 261 | 86 | 107 | −0.18 |

**This is larger than the movement you accepted in principle** (which was
max ±3). 18 men reach ±5 and 66 reach ±4, though nothing exceeds 5. Your §12
says to stop and report at that scale, so the decomposition above is offered
so either half can be dropped: the weights and field mix alone stay inside ±3.

## 10. WAGES (§13)

Total **$58.28m → $60.54m (+3.9%)**; median $11,060 → $11,700; P90 $36,640 →
$38,050; P99 $54,180 → $56,010; **top wage unchanged**. Division 1 +3.7%,
division 2 +4.2%; by tier 3.4%–4.8%. Worst single club **+13.7%**, best −4.3%.

The rise is broad and nearly uniform rather than concentrated, the relative
economy is intact and the ceiling has not moved, so this is inflation and not
distortion. **No wage-curve normalisation.**

## 11. THE FREE-AGENT QUESTION (§14)

Natural turnover offers ~0.63 genuine quicks a day worldwide, ~26 a season
across 16 nations — about 1.6 per nation per season *offered*, fewer signed. A
nation would take several seasons before a handful of clubs owned one.

**Recommendation: A, natural turnover, for now.** B is safe to build if you
want it — seeding *n* generated quicks onto the free-agent boards is exactly
what `makeFreeAgent` already does, so it rewrites nobody — but the honest size
is small: the equilibrium is 2.1% of all cricketers, and a nation of 16 clubs
holding ~240 men supports about 5. A one-time injection of **3 per nation (48
worldwide)** would reach roughly half the equilibrium immediately without
flooding a board that holds 20–30 listings and turns over daily. I have **not
implemented it**, as instructed.

## 12. THE HOME-ADVANTAGE TEST (§15) — VALID

- **Stricter statistically.** One squad at N=1000 carries ~1.6 points of error
  plus a squad-to-squad spread of about the same again; the mean of five
  carries ~0.7. `< 58` on the mean is a tighter bound than `< 58` on one draw.
- **Cannot hide a regression.** A genuine home-edge rise moves every squad, so
  the mean moves with it; and a new per-squad ceiling (`< 62`) stops one
  runaway squad hiding inside an acceptable average.
- **No gameplay constant changed.** `FO_HOME_EDGE` is untouched; the diff
  against main under `engine/src` is the generator and the value model only.

Measured both ways: shipped mean 55.27%, changed 55.44%.

---

## WHERE IT STANDS — NOT READY TO SHIP

**Engine suite 489: 488 pass, 0 fail, 1 skipped. Calibration-check PASS.**

**Server suite: 4 failures, and they are not fixed.**
`world-market.test.mjs` — *"the umpire puts bot clubs spare men up"* and the
three tests that depend on its listing.

Attributed rather than guessed: **main passes 18/18**, and the
**fast-bowler-only commit fails the same 4**, so it is the generation change,
not the value model. Root cause: the `before` hook's two rounds of cricket now
consume the surplus candidates the test's own loop expects to find fresh, and
`openBotListings` skips a man already listed — so every round returns nothing.
The market itself is working: called against a state where those men are not
already listed, round 3 opens six listings.

That is a fixture-ordering fragility of the same family as the home-advantage
test, but I have not rewritten a market test's assertions in the same pass that
changed the world it runs against, and I am not asking you to accept a ship on
four red tests. It needs either a state-tolerant assertion (count the board
rather than demand a fresh listing) or a re-pinned fixture, and that is the one
remaining piece of work.

Three migrations/tests did change, each because it compared two things that are
no longer the same kind of number:

- `server/migrations/102-…sql` — the **SQL mirror** of the card
  (`world_pk_num`) put back on the engine's law. **My §1 dependency audit
  missed this** because I grepped JavaScript only; the parity test caught it.
  099 is not edited — a new numbered file redefines the function, per the repo's
  rule. Parity 9/9.
- `a-save-crosses-the-ceiling` — compares against a function of `.level`, so it
  reads `.intrinsicOvr`.
- `the-card-and-the-strip` — the strip is a reading of skills, so the identity
  is now ability-against-ability.
