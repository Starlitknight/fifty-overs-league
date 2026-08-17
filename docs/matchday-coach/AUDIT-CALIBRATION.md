# Final calibration pass: is there a systematic role bias left?

Branch `claude/matchday-coach-redesign`. The engine — `ballDist`, pitch and
weather constants, player generation, talents, fatigue, stamina — and the
economy, finances, wages, transfer prices and calibration bands were not
touched. Everything below changes, or declines to change, the coach's own
selection utility.

---

## 1. What the residual actually is

Three hypotheses were tested. **Two were eliminated by measurement and the
third was built, played, and rejected.** No role coefficient was added.

### Hypothesis 1 — the bat and bowl channels are on incompatible scales

The coach's two channels genuinely are different quantities: `bat` is
`Σ rpd × SLOT_BALLS[slot]`, whose weights sum to 6.26; `bowl` is the cost of
fifty overs in runs. Nobody had checked that a point of one buys the same
cricket as a point of the other.

`tools/matchday-exchange.mjs` builds two ladders that move **one channel at a
time** — a top-order batsman swept with bowling frozen, a bowler swept with
batting frozen — scores each rung with the coach and plays it against one fixed
opponent, paired on seeds, home and away. 1,500 pairs a rung, 30,000 matches.

```
win-points per BAT  score-point : 0.3447
win-points per BOWL score-point : 0.3112
ratio (bowl / bat)              : 0.903
```

**Within 10%, and inside the noise (≈±0.06).** The channels are already on one
scale. Correcting a 10% difference would be fitting noise, so nothing changed.

### Hypothesis 2 — `SLOT_BALLS` over-prices lower-order batting

An all-rounder always bats at six, seven or eight. If the slot weights are too
fat down the order, every all-rounder is bought at a price the cricket never
pays. Measured by sweeping a **bowler's batting** with his bowling untouched, so
the bowl channel is frozen and only slot value moves:

```
  skill   bat score      win%      SE
     20       237.8     57.96    0.86
     32       238.8     57.60    0.88
     44       242.0     59.44    0.87
     56       276.3     62.60    0.85
```

The naive slope across all four rungs is 0.119 — a third of the top-order rate —
and that number is **wrong**, for the same reason a first attempt at the bat
ladder was wrong: it is fitted across a cliff. The 44→56 step jumps 34.3 model
points for one 12-point skill step because the man crosses `DEPTH_CAPABLE` and
releases a 26-run depth charge. Split at the cliff:

```
  20 -> 44   (below the threshold throughout)   4.2 pts buy 1.48 win-pts → 0.352
  top-order ladder, same measurement                                     → 0.347
  44 -> 56   (crossing the threshold)          34.3 pts buy 3.16 win-pts → 0.092
```

**`SLOT_BALLS` is correct to within a hundredth.** Eliminated.

### Hypothesis 3 — the depth charge

The cliff is real: releasing one seat is priced at 26 runs and buys about a
quarter of that. And the men who release a seat are exactly the all-rounders.
This looked like the answer.

So it was built: a quadratic charge, `DEPTH_RUNS × gap² / 4`, which leaves the
four-seat catastrophe priced where it was (104) and makes one seat cheap (6.5).

It is not the answer, for two reasons.

**It cannot be.** Every controlled case sits at gap 0, 1 or 2 — and cases F, G
and H all move the *same single seat* (gap 1 → 0), while the cricket pays them
**+13.1, +3.9 and +2.2** win-points. One term with one value per seat moves all
three together. Making C/G/H fit broke F by 25 points and the mean absolute
error over the controlled set **rose, 5.87 → 6.51**.

## 2. Decomposition, all twelve cases

No hidden `allround` bucket exists any more; the column is printed and is zero
everywhere. `gap` is the number of unfilled top-seven seats.

```
case                                          total     bat    bowl    flex  allrnd  front  gap
A  pure bat                                   210.0   239.6   -30.9     0.0     0.0      5    1
   all-rounder whose bowling is useless       210.0   239.6   -35.7     4.8     0.0      6    1
B  pure bat                                   210.0   239.6   -30.9     0.0     0.0      5    1
   a genuinely useful sixth option            213.7   239.6   -32.0     4.8     0.0      6    1
E  useless sixth option                       221.7   251.5   -35.7     4.8     0.0      6    1
   useful sixth option                        225.3   251.5   -32.0     4.8     0.0      6    1
C  elite specialist bowler                    409.0   217.6   185.1     4.8     0.0      6    2
   strong all-rounder                         415.0   251.5   157.3     4.8     0.0      6    1
D  elite specialist batter                    235.7   265.3   -30.9     0.0     0.0      5    1
   strong all-rounder                         217.7   239.6   -28.0     4.8     0.0      6    1
F  five specialists                           210.0   239.6   -30.9     0.0     0.0      5    1
   four + all-rounder who must bowl           222.9   262.0   -40.2     0.0     0.0      5    0
G  five specialists                           210.0   239.6   -30.9     0.0     0.0      5    1
   two all-rounders                           210.6   255.1   -50.5     4.8     0.0      6    0
H  five specialists                           221.7   251.5   -30.9     0.0     0.0      5    1
   three all-rounders                         222.7   272.7   -56.0     4.8     0.0      6    0
I  no all-rounder anywhere                    226.9   256.7   -30.9     0.0     0.0      5    1
   one useful sixth option                    225.3   251.5   -32.0     4.8     0.0      6    1
J  four elite bowlers + weak all-rounder      166.4   187.3   -22.2     0.0     0.0      5    0
   five elite bowlers                         216.9   174.5    41.1     0.0     0.0      5    1
K  five medium specialists                    225.4   374.4  -149.8     0.0     0.0      5    1
   four + elite all-rounder                   288.0   406.8  -119.8     0.0     0.0      5    0
L  same card spent on batting                 235.7   265.3   -30.9     0.0     0.0      5    1
   same card spent on both                    222.7   244.7   -28.0     4.8     0.0      6    1
M  six frontline                              225.3   251.5   -32.0     4.8     0.0      6    1
   seven frontline, batting identical         229.5   251.5   -29.4     6.3     0.0      7    1
```

Case **L** is card-equal by construction and checked, not claimed: `jsDerive`
rates both men at exactly **71000**. (The first pair tried — bat 74 against
bat 56 / bowl 60 — reads balanced and is not: 71000 against 63000.)

Measured win rates, 1,200 paired fixtures a case:

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
M  six frontline vs seven                            +7.5   50.40  0.0078   0.51
```

## 3. Random-squad validation — the number that decided it

30 generated squads across the world's strength distribution × 5 conditions.
The coach picks; each rejected near-miss XI is **one swap away** and is played
against the same opponent from the same seeds. 189 comparisons, ~22,700 matches.

```
                              LINEAR (shipped)          QUADRATIC (candidate)
swap class                 n   won    edge    SE      n   won    edge    SE
ALL                      189  76.2%  +6.87  0.64    197  78.7%  +7.64  0.65
specialist -> all-rounder 15  86.7%  +9.67  1.87     17  64.7%  +6.57  2.22
all-rounder -> batsman    33  72.7%  +5.76  1.60     40  60.0%  +2.77  1.21
all-rounder -> bowler    141  75.9%  +6.84  0.74    140  85.7%  +9.16  0.76
```

**The shipped selector picks the better eleven 76.2% of the time**, with a mean
edge of +6.87 win-points over what it rejected, and a mean regret of 4.66
win-points on the quarter of occasions it is wrong.

The bias question is whether the three rows disagree. Under the linear charge
they do not: all three are positive and the largest gap, "all-rounder over a
batsman" against "all-rounder over a bowler", is **1.08 ± 1.76, z = 0.6**.

Under the quadratic charge that gap becomes **6.39 ± 1.43, z = 4.5** — a real,
significant asymmetry. Cheapening the depth charge weakens the one term that
protects specialist batting, so the coach starts keeping all-rounders over
batsmen it should not (60.0%, edge +2.77). **Overall accuracy rose slightly and
role symmetry — the thing this pass exists to fix — got significantly worse.**

So the quadratic charge was reverted. This is success criterion 3 answered
through its second branch: changing C/G/H makes overall selection worse.

## 4. Why C, G and H are over-scored, honestly

They are hand-built extremes that stack an unusual amount of one thing. Three
scale hypotheses were tested and two were measured to be correct already; the
third cannot separate F from G/H because they move the same term identically.
What is left is a genuine limitation and it is written down rather than papered
over: **the coach's utility is a linear sum, and stacking all-rounders has
diminishing returns it cannot express.** Two all-rounders pay +3.94 win-points
and three pay +2.15 — less than two — and no linear model reproduces a curve
that turns over.

Fixing that means a non-linear interaction term, which is a new model rather
than a calibration, and every version of it tried here traded a controlled-case
gain for a real-squad bias. On real squads the effect does not appear: the
random-squad table shows no systematic preference in either direction.

## 5. Endurance: the negative result is unchanged

Nothing in this pass touched spell length. `K: stamina does not change what a
spell costs` still asserts the measured fact (spread < 0.01 across stamina
30/60/90) and still fails loudly if the engine ever gains a genuine
stamina × continuous-spell interaction. Existing fatigue still moves a player's
value, cumulative workload still degrades him, and the death pair is still
chosen from bowlers who did not take the new ball.

## 6. One authority — the cleanup, and what it found

| helper | was | now |
|---|---|---|
| `probableXI()` (32-matchday.js) | **B, contradicting** | quotes `planMatchDay` |
| `foSmartBowling()` (03-onboarding.js) | **A — a second gameplay authority** | delegates to the coach |
| `foTodayFit()` (01-club-home.js) | **B, a third conditions model** | quotes `foMdcCard` |

**The serious one was `foSmartBowling`.** `03-onboarding.js` *overrode*
`window.suggestOrders` with it, so **the shipped Auto button never reached the
coach at all.** It carried its own `newBallBites`/`turnLater` rules, its own
opener/middle/finisher weights, its own fatigue table, its own captaincy
tiebreak and its own "+12 for pace on a green top" — and it tiled **all fifty
overs** across the two ends, 25 and 25. The orders page had just been taught to
say "Coach has specified 18 overs · captain adapts the remaining 32" about a
sheet in which every over was in fact filled. 183 lines deleted; the name
survives as a one-line delegation because `window.__fol` exports it.

`probableXI` was a line-for-line copy of the *old* `pickXI`, on a page whose own
comment promised "No 'probable' guesswork: this is the teamsheet". It now asks
the coach with the fixture's pitch and sky. A manager's saved sheet still wins
in both places.

`foTodayFit` fills a "Today" column beside the very fixture the coach is picking
for, with its own invented coefficients. It reads the coach's own card now
(rpd and bowl value, already measured in today's conditions and already
carrying form and fatigue), cached per squad-and-conditions so a fifteen-row
table costs one call.

**There is now exactly one gameplay selection authority: `planMatchDay()`.**

## 7. Coefficients changed in this pass

**None.** `SIXTH_BOWLER` 4.8, `SEVENTH_BOWLER` 1.5, `OPTION_SPAN` 3.0,
`DEPTH_RUNS` 26 linear, no `ALLROUND` — all exactly as committed before this
pass. The only code changes are the three one-authority fixes and comments
recording what was measured.

That is deliberate. The brief asked for *the minimum calibration needed to
remove systematic role bias*, and the measurements say the minimum is zero: the
scales are right, and the random-squad validation shows no systematic bias to
remove.

## 8. Proof

```
node --test 'test/*.test.mjs'                     487 tests, 487 pass, 0 fail
cd server && node --test --test-concurrency=1     437 tests, 437 pass, 0 fail
node tools/calibration-check.mjs                  PASS
node --test test/replay.test.mjs                  PASS
./build.sh                                        clean
matchday coach tests                              31 pass, 0 fail
```

**Goldens: nothing re-blessed, because nothing changed.**

```
test/golden/masters.json was recorded with: the MATCH-DAY COACH
  coach OFF reproduces it : 0/9
  coach ON  reproduces it : 9/9
  toss call unchanged     : 9/9
  VERDICT: the selector these were recorded with still reproduces them exactly,
           so the ball model, the toss and the tuning are UNTOUCHED.

CAL_COACH_OFF=1 calibration-check → every statistical band passes; fingerprint
returns to 373/6, the founding selector's original value.
```

Manual filed XIs remain authoritative — asserted by
`I: a filed eleven is honoured, and an order can never smuggle in a twelfth man`,
and by the saved-sheet branch in both `probableXI` and `pickXI`.

## 9. Known remaining limitations

1. **Stacked all-rounders.** The utility is linear and the cricket's returns
   diminish (two all-rounders +3.94 win-points, three +2.15). No linear model
   expresses that. Real squads do not show it (§3); hand-built extremes do.
2. **Case C.** Swapping an elite specialist bowler for a strong all-rounder
   scores +12.5 and plays dead even. Same root cause.
3. **`matchday-toss.mjs --home` has never been run at full N**, so the coach
   claims no home-ground toss effect rather than a measured one.
4. The random-squad swap classes are unevenly covered (15 / 33 / 141), because
   a fifteen-man squad rarely leaves a good all-rounder out. The thin class
   still reaches z = 5.2, but its error bar is the widest of the three.
