# Two audits: endurance / spell length, and all-rounder bias

Branch `claude/matchday-coach-redesign`. Not merged, not deployed. The economy,
`ballDist`, the pitch/weather constants, player generation, the toss model, the
batting order, keeper selection, the captaincy model and the scout-fairness
rules were not touched.

---

## 1. Does endurance currently affect explicit spell length?

**No.** Verified in the source, not inferred. `foMdcBowlingPlan` had:

```js
const burst = bite ? 6 : 3;
for (let i = 0; i < burst; i++) { give(1 + i*2, openers[0]); give(2 + i*2, openers[1]); }
```

One constant, chosen by conditions, applied identically to both opening
bowlers. Nothing in the plan read stamina, and the death pair likewise got two
overs each regardless of who they were.

## 2. What the engine actually says about spell length

`tools/matchday-endurance.mjs` (new). It does **not** reimplement the fatigue
law. It forces a continuous ten-over spell in a real match through the
`ordersMap` channel, steps the match ball by ball inside the VM, samples
`M.fat[him]` against his own cumulative ball count **as the engine sets it**,
and then evaluates `ballDist` exactly at each sampled state. The trajectory is
deterministic, so it costs one match and carries no sampling error; the
evaluation is arithmetic, not Monte Carlo.

### The three laws the engine has

Read from `00-core.js` rather than assumed:

| | what it reads | starts at | reads stamina? |
|---|---|---|---|
| fatigue tank (`:3145`) | balls bowled **all innings** | ball 1 | **yes** — `(1.85 − stamina/100)/74 × ageTire × roleW` |
| fatigue penalty (`:1994`) | `bowlFat` | 0.12 | via the tank |
| `longSpell` (`:2002`) | balls **this spell** | 36 balls (6 overs) | no |
| `ageBowlLate` (`:2004`) | balls this spell | 18 balls | no — gated on **age > 30** |

The tank drains **only** at drinks (over 25, ×0.62) and the innings break
(×0.5). **It does not drain by resting.**

### Degradation through a spell (cost = runs − 25 × wickets, lower is better)

`balanced/Sunny`, fast:

```
stamina        1      2      3      4      5      6      7      8      9     10
     30     2.27   2.90   3.44   3.92   4.35   4.33   4.76   4.99   5.14   5.28
     60     2.23   2.78   3.26   3.69   4.06   4.08   4.48   4.80   5.11   5.28
     90     2.23   2.66   3.08   3.45   3.77   3.83   4.20   4.48   4.76   5.03
  fat  30  0.136  0.271  0.407  0.543  0.679  0.814  0.950  1.086  1.222  1.357
  fat  90  0.083  0.166  0.250  0.333  0.416  0.499  0.582  0.666  0.749  0.832
```

`green/Overcast`, fast, stamina 60 — the new ball is the whole story:

```
     1      2      3      4      5      6      7      8      9     10
 -3.32  -1.88  -0.76   0.13   0.85   1.83   2.89   3.34   3.75   3.97
 wkts/over 0.331 → 0.119 by over 7
```

Full tables for five bowling types × four conditions in `endurance.txt`.

### The decisive measurement, and it is a negative

Holding a man's **six overs fixed** and asking whether they are cheaper bowled
straight through or split 3+3 — same total fatigue either way, so the entire
difference is spell continuity:

```
                    st30   st45   st60   st75   st90
  age 24 fast       0.00   0.00   0.00   0.00   0.00
  age 28 fast       0.00   0.00   0.00   0.00   0.00
  age 32 fast       0.16   0.16   0.16   0.16   0.17
  age 36 fast       0.48   0.48   0.49   0.49   0.49
```

**Flat in stamina to two decimal places.** And what a rest is worth:

```
  stamina 30/45/60/75/90 → 0.12 0.12 0.12 0.12 0.13 runs   (age 27)
  age 24 / 28 / 32 / 36  → 0.12 0.12 0.21 0.38 runs        (stamina 60)
```

So: **the engine has no endurance-dependent optimal spell length.** Resting a
man does not empty his tank, and the only terms that read the unbroken-spell
counter ignore stamina entirely (one) or key on age (the other).

**A measurement that does not work, recorded so the next person doesn't repeat
it.** The obvious framing — "at which over is he worse than his replacement?",
against an identical fresh clone — answers 1 or 2 in every cell at every
stamina, because a man who has bowled at all is strictly worse than his own
fresh clone forever. True, and about nothing: a side has four other bowlers of
*different* quality, not unlimited clones.

## 3. What I changed in Auto — and what I deliberately did not

**I did not make burst length depend on the bowler.** I wrote that change,
measured it, and reverted it. Over the channel a burst length actually controls
(`ballsThisSpell`, holding the ball's age constant), the entire span from age 24
to 36 is **0.287 against 0.317 runs**, and stamina is exactly flat. Shipping a
differentiator would have meant picking a threshold between 0.204 and 0.22
myself — a crude band wearing a measurement's clothes, which is what the brief
forbids. The conditions-driven ceiling (6 overs where the new ball bites, 3
where it does not) stays, because *that* was measured: on green the cost goes
−3.32 → +1.83 across six overs.

**I did change total workload**, which the engine models strongly and which the
brief explicitly raised. The opening burst books two men for up to six overs
each; the death then chose the two best closers *ranked on their freshest
selves*, and routinely picked the same men. Measured, a quick costs **2.23 runs
in his first over and 4.48 in his seventh**, so those death overs were being
bought at roughly twice the price the ranking quoted. The death pair is now
chosen from closers **not already carrying the new ball**, falling back to the
best two when a side is too thin to afford the distinction.

## 4. Before / after bowling plans

Yorkshire, from `tools/matchday-selection.mjs`:

```
balanced / sunny
  before  new ball: Daan van Dijk and Zak Wilson for 3 overs each
          death:    Zak Wilson and Pranav Sharma hold overs 47-50     <- Wilson does both
  after   new ball: Daan van Dijk and Zak Wilson for 3 overs each
          death:    Pranav Sharma and Timo Nijhuis hold overs 47-50

green / overcast
  before  new ball: Daan van Dijk and Zak Wilson for 6 overs each
          death:    Zak Wilson and Daan van Dijk hold overs 47-50     <- BOTH openers
  after   new ball: Daan van Dijk and Zak Wilson for 6 overs each
          death:    Pranav Sharma and Timo Nijhuis hold overs 47-50
```

The plan stays partial: 16 of 50 overs painted on green, 34 left to the captain.

---

## 5. The all-rounder bias, decomposed

`tools/matchday-allrounder.mjs` (new): controlled elevens differing by exactly
one man, scored by the coach and then **played** — 1,200 paired fixtures a case,
both home and away, 21,600 matches.

**Two harness bugs I had to fix first, because both would have produced
confident nonsense.** `foMdcRefs` builds the reference opponent from whatever
squad it is handed, so scoring two elevens separately measured them against two
*different* yardsticks and invented an 11.9-run batting gap between sides whose
batting was character-for-character identical (the real optimiser computes refs
once per squad; the tool now does the same). And the `bowl` column added the
flex premium that `foMdcScoreXI` had already added, making a sixth bowler's
overs look 12 runs cheaper when they are not bowled at all.

### The decomposition (before)

```
case                                          total     bat    bowl    flex  allrnd  front
A  pure bat                                   194.5   220.1   -30.9     0.0     4.0      5
   all-rounder whose bowling is useless       204.5   220.1   -30.9     6.0     8.0      6
B  pure bat                                   194.5   220.1   -30.9     0.0     4.0      5
   a genuinely useful sixth option            204.5   220.1   -30.9     6.0     8.0      6
E  useless sixth option                       216.2   232.0   -30.9     6.0     8.0      6
   useful sixth option                        216.2   232.0   -30.9     6.0     8.0      6
```

Batting identical. Overs cost **identical**. The entire +10.0 preference is the
two premiums — and A and B are the same +10.0 whether the man can bowl or not.

## 6. Do `ALLROUND` and `SIXTH_BOWLER` double-count? **Yes.**

Not merely empirically — structurally. `ALLROUND` paid 4.0 per frontline bowler
ranked inside the side's top seven **by batting rank**, and every eleven has
seven men in its top seven. Measured on a side containing **no all-rounder at
all**:

```
top seven: T0(75) T1(72) T2(68) T3(65) X(53) Keeper(48) B0(20, FRONTLINE)
```

A specialist quick worth 20 runs a dismissal — a genuine number eleven —
collected the all-rounder premium. And what actually moved the term was how
many frontline bowlers were in the eleven: five bowlers → 4.0, six bowlers →
8.0. That is `SIXTH_BOWLER` again, spelled differently.

## 7. Simulation evidence

Calibration first: the two cases whose difference is carried **only** by the
measured bat+bowl terms give the exchange rate, and they agree.

| case | score | win-pts | score per win-point |
|---|---|---|---|
| D elite batter vs all-rounder | −12.7 | −5.31 | **2.4** |
| F all-rounder who must bowl | +32.4 | +13.10 | **2.5** |

Every case carried by the flat premiums is over-scored by 2.7× to 33×:

```
case                                            score says   win%     SE      z
A  pure bat vs useless all-rounder                  +10.0   49.04  0.0065  -1.48
B  pure bat vs useful sixth option                  +10.0   51.50  0.0081   1.86
E  useless vs useful sixth option                     0.0   52.67  0.0082   3.24
C  elite specialist bowler vs strong all-rounder    +12.5   50.38  0.0086   0.44
D  elite specialist batter vs strong all-rounder    -12.7   44.69  0.0086  -6.20
F  5 specialists vs 4 + all-rounder who must bowl   +32.4   63.10  0.0083  15.73
G  two all-rounders                                 +25.5   53.94  0.0083   4.73
H  three all-rounders                               +25.9   52.15  0.0085   2.52
I  six frontline vs seven, batting identical         +7.5   50.40  0.0078   0.51
```

- **A**: the +10 bought **nothing** — 49.04%, if anything slightly worse.
- **E**: the coach scored the two **identical**; the cricket separates them at
  z = 3.24.
- **F**: with `allround` equal on both sides and `flex` zero on both, the purely
  measured +32.4 delivered 63.10% at z = 15.7. **Genuine all-round cricket is
  already fully captured by bat + bowl.**
- **I**: a seventh option scores +7.5 and is worth 50.40% — nothing.

## 8. Coefficients changed, with justification

| | before | after | why |
|---|---|---|---|
| `ALLROUND` | 4.0 | **deleted** | fires on batting *rank*, hits genuine no. 11s, and moves with bowler count — it is `SIXTH_BOWLER` twice (§6). Case F proves nothing is lost. |
| `SIXTH_BOWLER` | 6.0 flat | **4.8 × quality weight** | flat 6.0 paid a bowl-30 man the same as a bowl-62 man. Fitted so a useful sixth option scores the **3.7** the cricket paid (B), and a useless one **0** (A). |
| `SEVENTH_BOWLER` | 1.5 flat | 1.5 **× quality weight** | magnitude was already right — case I measured a seventh at ~1.0 score-points. |
| `OPTION_SPAN` | — | **3.0** (new) | how much dearer than the attack's *marginal* man (5th-cheapest front option, the last one who actually bowls) an extra option's overs can be before he is not an option. Fitted: useless gap 3.14 → 0, useful gap 0.71 → 0.76 weight. |

**Validation — do the new scores predict the already-measured win rates better?**

```
case                    measured   implied |   OLD    err |   NEW    err
A useless 6th            -0.96pt      -2.4 |   10.0   12.4 |    0.0    2.4
B useful 6th              1.50pt       3.7 |   10.0    6.3 |    3.7    0.0
E useless vs useful       2.67pt       6.5 |    0.0    6.5 |    3.7    2.8
C elite bowl vs AR        0.38pt       0.9 |   12.5   11.6 |   12.5   11.6
D elite bat vs AR        -5.31pt     -13.0 |  -12.7    0.3 |  -18.0    5.0
F AR must bowl           13.10pt      32.1 |   32.4    0.3 |   32.4    0.3
G two AR                  3.94pt       9.7 |   25.5   15.8 |   20.1   10.4
H three AR                2.15pt       5.3 |   25.9   20.6 |   20.5   15.2
I 7th option              0.40pt       1.0 |    7.5    6.5 |    4.1    3.1

mean absolute error   OLD 8.93   NEW 5.65
```

**Residuals I am not claiming to have fixed**, because they are outside what
this audit was scoped to and would mean retuning bat-against-bowl weighting:

- **C** (11.6): swapping an elite specialist bowler for a strong all-rounder is
  scored +12.5 and plays dead even. The coach over-values the batting gain in
  that trade.
- **G/H** (10.4, 15.2): piling on all-rounders keeps scoring ~+20 while the
  cricket pays +3.9 then +2.2. There is a diminishing return the model lacks.
- **D** got *worse* (0.3 → 5.0). The old number was right by accident: the
  spurious rank-based `ALLROUND` on the specialist side happened to offset the
  over-large flex on the other. Trading a lucky cancellation for a principled
  model is the right trade, and the aggregate improved 37%.

## 9. Tests

Eight new tests in `test/matchday-coach.test.mjs` (23 → 31, all passing).

Group **K** pins the *negative* result, which is the point of it:

- `stamina does not change what a spell costs, so the coach does not pretend it
  does` — asserts the spell-cost spread across stamina 30/60/90 is < 0.01. **If
  somebody later gives the engine a stamina-in-spell law, this fails, and the
  failure message says: re-run the probe and give the coach burst lengths.**
- two bowlers alike but for stamina get identical plans
- the conditions still set the burst (green buys more overs than a road)
- an opener is not also handed the death when somebody else is rested
- ...but a thin attack may double up rather than leave the death unplanned

Group **L**:

- a sixth option who cannot really bowl earns no flexibility premium
- a genuine number eleven does not collect an all-rounder premium
- an all-rounder who genuinely bowls is still preferred, on measured cricket alone

The brief asked for a test showing two bowlers of different endurance getting
*different* spell lengths. The engine does not support that distinction, so the
test asserts the measured truth instead and is wired to fail loudly if that ever
changes.

## 10. Goldens

Re-blessed again, with the same proof as before and one addition. `matchday-goldens.mjs`
gave a **wrong instruction** after the first re-bless — it printed "NOT
selection-only; do not re-bless" whenever coach-off failed to reproduce the
master, which is exactly what *should* happen once the master is the coach's own
cricket. Fixed to work out which selector the file was recorded with.

The proof that only selection moved:

```
founding selector, all nine fixtures, today's build vs the ORIGINAL record:
  358/7 & 359/4 | 355/7 & 301/10 | 375/5 & 220/10 | 304/9 & 231/10 | 338/5 & 150/10
  354/5 & 100/10 | 335/7 & 249/10 | 251/10 & 53/10 | 280/10 & 163/10
  IDENTICAL — bit for bit
CAL_COACH_OFF=1 calibration → every band passes, fingerprint back to 373/6
toss call unchanged in 9/9
```

## 11. The server suite, and a latent hole the coach exposed

The previous report left one red server test — an era-2 bank threshold in
`world-p3` (016). With today's changes **that one passes** and a different
assertion in the same file failed instead (018, the academy accounting
identity), by **$457 on a $245,000 bank**. The failure moving is itself
informative: these assertions are sensitive to *which* club won *what* in one
seeded world, not to a systematic economic effect.

Bisected with `FO_COACH_OFF=1`: coach off 27/27, coach on 26/27. So the coach
was responsible — but for **exposing** the fault, not causing it.

The identity read

```js
bank1 === bank0 - academyBuild(2,3) - rounds * (academyUpkeep(3) - academyUpkeep(2))
```

and it omits overdraft interest, which the economy genuinely charges at
`DEBT_ROUND` = 3% a round. Buying a level makes the club poorer at *every*
round the walk replays from genesis, which can tip it into the red at rounds
where it was previously solvent. $457 is one round of interest on a small
overdraft — not an accounting error.

I confirmed this rather than assuming it: completing the identity with the
interest term and re-running gives **27/27**. The economy was right; the test
was incomplete, and had been since it was written — it happened to hold only
while that club stayed the right side of nothing. **No economy code, constant
or threshold was touched.**

## 12. Is the Match-Day Coach merge-ready?

**Yes.**

The coach now prices an extra bowling option once instead of twice, and for the
quality of the bowler rather than the fact of him; its bowling plan no longer
spends one man's legs twice; and it declines to model an endurance effect the
engine does not have.

```
node --test 'test/*.test.mjs'                       487 tests, 487 pass, 0 fail
cd server && node --test --test-concurrency=1 ...   437 tests, 437 pass, 0 fail
node tools/calibration-check.mjs                    PASS
node --test test/replay.test.mjs                    PASS
CAL_COACH_OFF=1 node tools/calibration-check.mjs    every band passes,
                                                    fingerprint back to 373/6
```

Both goldens were re-blessed on proof: the founding selector still reproduces
all nine original fixtures bit-for-bit, and the toss call is unchanged in 9/9.

Two things remain on the record as owner calls rather than defects:

1. **Residual scoring errors C, G and H** (§8). Real, measured, and each would
   require retuning the bat-versus-bowl weighting, which this audit was told
   not to disturb. C is the sharpest: swapping an elite specialist bowler for a
   strong all-rounder scores +12.5 and plays dead even.
2. **`matchday-toss.mjs --home` has still not been run at full N**, so the coach
   claims no home-ground toss effect.
