# Latent talent, effective cricket, and a card that stays 0–100

The 99 ceiling is gone. This is what replaced it, why each number is the number
it is, and which measurement settled it. Everything here is reproducible from
the repository with one command; nothing below is an opinion that was not first
a reading.

## The three numbers

| | what it is | where it lives | bounds |
|---|---|---|---|
| **latent** | what a cricketer can do | `p.skills`, stored | none; a corruption guard at 250 |
| **effective** | what the frozen B1 ball model is handed | computed, never stored | whatever the transform yields |
| **OVR** | what a manager reads | derived, never stored as truth | 0–100, approached asymptotically |

Latent is the only one anything ever writes. Generation, development, training,
ageing and migration all write latent and nothing else.

## What the frozen engine actually does above 99

B1 established a useful individual range of "roughly 20–95". That was the top of
the range B1 *swept*, and it was read ever after as the range the engine can
take. `tools/engine-domain.mjs` asks the real question against the shipped
`ballDist` — a pure function, so these are exact numbers and not a sample:

```
                                     85     95    110    140    200
batsman v bowler 85, runs/over      6.75   7.50   8.05   8.29   8.32
bowler v batsman 100, runs/over     7.75   7.23   5.95   4.51   3.99
keeper catching, wicket %/ball      1.64   1.74   1.92   2.36   3.64
```

**There is no wall.** The model is monotone, continuous, non-inverted and sane
to 140 in every contest measured. What it has instead is its own *diminishing
returns* — ten points buys 0.76 runs an over at 85 and 0.21 at 110 — which is
the property this change wanted and which was there all along, behind a clamp
that stopped anybody reaching it.

Three families fail differently at absurd values, and that is what makes the
transform per-family rather than one curve:

- **core** (batting and bowling) — the bowling wicket rate turns over somewhere
  between 150 and 200, as a better bowler starts conceding so little that nobody
  can get out to him.
- **field** (ground fielding) — the spatial contest puts an absolute skill
  against an absolute difficulty roll bounded at 100, so a fielder at 100 wins
  every contest there is; and `ballDist`'s own `fieldAvg` term is clamped
  *inside the frozen model* at 85.8. This family is nearly spent by 100, and B1
  said so.
- **glove** — enters `ballDist` as a linear term in **log-odds**
  (`lo.wC += 0.009*(catching − 74)`), which is exponential in probability. At an
  effective 500 a keeper turns a third of all deliveries into wickets; at 1000,
  all of them.

## The transform

```
effective(v) = v                                v ≤ 99
             = 99 + S·ln(1 + (v − 99)/S)        v > 99
```

Monotone (derivative `S/(S + v − 99)`, strictly positive for every finite `v`),
continuous, and C¹ at the knee — the derivative there is exactly 1, so nothing
kinks. It has **no plateau and no asymptote**: `ln` is unbounded, so latent 130
is strictly better than latent 120 for ever, however small the margin. It is not
a clamp wearing a different number.

| family | keys | S | effective(110) | effective(130) | effective(250) |
|---|---|---:|---:|---:|---:|
| core | vsPace, vsSpin, power, rotation, temperament, wicket, economy, discipline, moveTurn, variation, stamina | 16 | 107.4 | 116.2 | 136.5 |
| field | fielding | 4 | 104.3 | 107.7 | 113.6 |
| glove | catching, keeping, stumping | 12 | 106.8 | 114.3 | 130.3 |

**The knee is 99 for every family, and that is a proof rather than a taste.**
Below 99 the transform is the identity, and:

- the baked reference squads top out at **97**;
- the calibration harness's elite cell scales them by 1.30 and clamps at **98**;
- every cricketer in every existing save was written by a generator that clamped
  at 99.

So the B1 golden replay and the calibration golden are bit-for-bit untouched *by
construction*, and "no ordinary-world regression" is a theorem about this
function rather than a measurement that could have come out either way. Both
gates are green on every run regardless.

**S is set so the corruption bound is already safe.** Read the softnesses
against the measured ceilings: `effective(250)` is 136.5 / 113.6 / 130.3, all
inside the domain where the engine is still telling the truth. There is no input
a corrupted row could contain, however absurd, that this function can turn into
an unhealthy input to the ball model. The safety is structural, not defended by
a check.

**Stamina comes out safe without a special case**, which is worth stating
because it was the one family with a sign error waiting in it. A bowler
accumulates fatigue at `(1.85 − stamina/100)/74` a ball, which reaches zero at
stamina 185 and goes *negative* above it. Effective stamina cannot exceed 136.5,
where the rate is 0.0066 a ball against an ordinary 0.0115: a legendary engine
tiring at 57% of the usual rate, and not a tireless one.

### The corruption bound

`FO_LATENT_MAX = 250`. It is documented as corruption protection and is
deliberately nowhere near the game — the world's tallest measured latent
attribute is 126. It exists so a truncated write or a hand-edited save cannot
hand the ball model an attribute of 1e9 and take a match with it. If a player
ever arrives near it, his row is damaged; he is not a great cricketer.

## OVR stays 0–100, and approaches rather than stops

The anchors used to end `[93,94] [97,98] [100,100]` with `Math.min(100, …)`
holding everything above. Two things were wrong with those last three numbers
and they were the same thing twice: the ladder said a level of 100 exists and is
worth exactly 100, and a clamp decided everything past it.

The anchors now stop at `[93,94]`, and above that:

```
OVR(L) = 100 − 6·exp(−(L − 93)/6)
```

94 at level 93, so it joins the anchors exactly; slope 1 there, so it joins them
smoothly; rising for ever; never reaching 100. **There is no clamp left in the
mapping**, and there is nothing above 100 to label.

| OVR | level needed | what the ladder says |
|---:|---:|---|
| 85 | 84 | a clear international |
| 90 | 89 | one of the best players in the world |
| 92 | 91 | — |
| 95 | 94.1 | era-defining |
| 97 | 97.2 | all-time |
| **98** | **99.6** | the first rung that *requires* a latent above 99 |
| 99 | 103.8 | plausibly the best this simulation has produced |
| 100 | 107.9+ | theoretical; asymptotic, never actually reached |

Five levels buy five points of card at 85 and one point at 98. **Nothing at or
below 94 moves by a hundredth** — those anchors are the same anchors — so the
existing world is untouched and the hardening bites only in the band the world
barely reaches. That is what makes the elite tail have to be *built* out of
latent talent rather than assembled out of ceilings.

### OVR is priced in effective points

`foValSum` reads each attribute through `foEff`. The measured weights are runs
per point, so they only mean anything about points the ball model can spend: a
latent fielding of 130 is worth 0.200 runs a point exactly as far as the engine
can read it, and the engine stops reading ground fielding at about 100.

**This does not recreate the flat top**, and that is the point of the transform
being per-family. The two families carrying almost all of a cricketer's weight —
batting and bowling, whose rows sum to 0.69 and 1.00 against fielding's 0.31 —
keep climbing. It is only the families the *engine* has finished with that stop
paying.

## Ageing: two curves that have to agree

`FO_AGE_DECAY` says what a year takes, per attribute, on latent values. Power,
stamina and fielding peak at 27 and go fastest; temperament and variation peak
at 33 and barely move. Loss accelerates 18% a year past the peak and is **two
thirds proportional to the attribute, one third flat**.

That last split is not a taste. Decline is priced in raw points, where a great
player has more to lose; development is priced in thresholds, which get dearer
the higher a man already is. Fully proportional decline against sub-proportional
development is a ratchet pointing downward, and it points hardest exactly where
the world can least afford it.

`FO_AGE_PHASE` says where a man of a given age stands relative to a
twenty-five-year-old on the same career, and the generator deals him at
`mark + phase(age)`. The numbers are read off `tools/career-arc.mjs` — one real
cricketer run from nineteen to retirement through the shipped nets and the
shipped decline curve — rather than invented. That is what makes the deal and
the mechanisms describe the *same* career: a boy dealt six points under his mark
climbs to it by twenty-six because that is precisely what the nets do to him.
The population is then stationary by construction rather than by a balance that
must be re-struck every time either curve moves.

## Development past 99

`skillThreshold` is unchanged below the knee — the ordinary world's training
economy is exactly the economy it was — and geometric above it at 1.18 a point.
Against a focused skill's roughly 600 training points a season:

```
 50 → 51     155 points   a few rounds
 95 → 96     222 points   a few rounds
 99 → 100    271 points   a season's focus
104 → 105    641 points   a couple of seasons
109 → 110  1,514 points   a long project, on one skill
119 → 120  8,788 points   not in a career
```

50 → 60 is routine, 95 → 105 is a career's work, and 120 is out of reach of
training altogether — a latent that high has to have been *born*.

The rate was 1.30 first and that was too steep, which is worth recording because
it failed in the exact way this change was written to stop: a point above 105
cost more than a career could pay, so an elite cricketer could not improve at
all, and the top of the world drained because its men could only fall. **A
ceiling made of prices is still a ceiling.**

## Reproducing everything here

```bash
./build.sh
node tools/engine-domain.mjs          # the frozen engine's real input domain
node tools/world-audit-b2.mjs --cards # rarity, latent tails, archetype preservation
node tools/top-end-proof.mjs --n=400  # separation, shape, ordinary-world regression
node tools/career-arc.mjs --skills    # one career, entry to retirement
node tools/lifecycle-audit-b2.mjs --seasons 20
node tools/calibration-check.mjs      # the B1 freeze
node --test 'test/*.test.mjs'
```
