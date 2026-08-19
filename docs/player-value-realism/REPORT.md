# PLAYER VALUE / OVR / WAGE REALISM — PHASE 3

Branch `claude/player-value-realism`, from main at `9619a44` (the build that
shipped Experience vs Temperament).

**No engine change was made.** The match physics on this branch is
byte-identical to the deployed engine: `engine/src/*` is untouched and the
source still hashes to `48e37b`, which is the asset `index.html` names. Every
weight in this report is a **candidate**, evaluated by overriding
`FO_VAL_W` inside a VM. Nothing is committed to the value model itself.

---

## §1 THE PIPELINE, AND THE THING THAT CONSTRAINS EVERYTHING ELSE

Full map in `DEPENDENCY-AUDIT.md`. Three findings drive the rest of the phase.

**`foPlayerValue().level` is the generator's target function.** `foFitToLevel`
(`00-core.js:1209`) binary-searches one scale factor over `FO_FIT_KEYS` — the
fifteen *skills* — until `.level` reaches a target. `foLayOnTier` deals a
club's squad off the same coordinate. So any attribute added to `.level` that
the fitter cannot scale becomes a **tax on the ones it can**: a veteran priced
for his experience would be dealt materially worse batting and bowling to pay
for it, and `foLayOnTier` compounds it by ranking him up first and fitting him
down second. This is why the brief's optional three-way split is required
rather than optional.

**The whole economy is one scalar.** `jsDerive` sets
`p.rating = foOvr(p) × 1000` (`:6516`), and wages, fees, quicksell, scout
fees, AI listing, AI bidding, squad strength and the world rankings are all
functions of it. `foWageOf` is cubic, so **+1 OVR at 70 is +4.3% wage and +5
OVR is +23%**; a fee is the wage times a constant, so it follows exactly.

**Training, ageing and the Match-Day Coach are downstream** — they move skills
and let the value model re-read them — so nothing in this phase can break them.
`foStars` and `foOvrLabel` are pure functions of the card and need no work.

The one place holding a second opinion is the founder draft (`:7041-7074`),
which prices a keeper at `0.62 × keeping` — an attribute the engine now
measures at 0.008 runs a point.

## §2 THE THREE CONCEPTS

The architecture can represent them, but only if they are kept apart:

- **INTRINSIC LEVEL** — `foPlayerValue().level`, raw abilities only. This is
  what `foFitToLevel` and `foLayOnTier` target. Re-weighting *within* the
  skills is safe here. Adding a non-scalable attribute is not.
- **CURRENT OVR** — the card. May include stable current-value attributes the
  fitter does not scale, **provided it is computed outside the fitting loop**.
- **MARKET VALUE** — current contribution plus age, career and leadership;
  the input to wages and fees.

No new visible rating is needed. The split is internal.

## §3 EXPERIENCE — WHERE IT BELONGS

Option **B** (experience affects market/current value, never intrinsic
generation level) is safe by construction. Option **A** is safe only if the
experience term is added *after* fitting and the fitter keeps targeting the
raw-skill level. Anything that puts experience inside `.level` is unsafe for
the reason in §1.

And the measurement says the question is smaller than it looks:

| | runs/pt | se | z |
|---|---|---|---|
| experience, batting | 0.019 | 0.022 | 0.9 |
| experience, bowling | 0.055 | 0.024 | 2.3 |

At N=1000 a batsman's experience is **not distinguishable from zero** in match
margin. A bowler's craft is real but small. Whatever layer experience is put
in, it should carry a weight of that size — which is a fraction of a point of
card, not a visible premium.

## §4-§5 THE DATASET

`tools/attribute-value-matrix.mjs`, **232 cells**, in
`docs/player-value-realism/cells/`. Every attribute swept +30 points from 45
on the man whose job it is, paired on identical seeds, priced in **match
margin per 50 overs** (what A scored minus what A conceded) with win
probability alongside.

The design is a **star, not a full cross**: one reference cell (balanced pitch,
balanced attack, ordinary league) and each context dimension moved one at a
time. A full 6 × 3 × 3 would be millions of matches. Pitch × attack
interactions are **not measured and not claimed**.

Match state is recovered by splitting the reference cell's own seeds, classified
off the **control** run so the treatment cannot move a seed between buckets.

Reference values, N=1000 (`value-tables.txt`):

| attribute | family | runs/pt | se | z |
|---|---|---|---|---|
| wicket | bowl | 0.387 | 0.048 | 8.1 |
| economy | bowl | 0.321 | 0.042 | 7.6 |
| catching (keeper) | glove | 0.212 | 0.035 | 6.0 |
| rotation | bat | 0.187 | 0.039 | 4.8 |
| vsPace | bat | 0.186 | 0.038 | 4.8 |
| power | bat | 0.179 | 0.027 | 6.6 |
| temperament | bat | 0.135 | 0.033 | 4.1 |
| captaincy | secondary | 0.126 | 0.038 | 3.3 |
| discipline | bowl | 0.093 | 0.026 | 3.6 |
| stamina (fast) | stamina | 0.072 | 0.026 | 2.8 |
| vsSpin | bat | 0.067 | 0.038 | 1.7 |
| fielding | field | 0.055 | 0.024 | 2.3 |
| experience (bowl) | secondary | 0.055 | 0.024 | 2.3 |
| stamina (fast-med) | stamina | 0.046 | 0.025 | 1.8 |
| variation | bowl | 0.039 | 0.022 | 1.8 |
| stamina (bat) | stamina | 0.036 | 0.016 | 2.3 |
| stamina (medium) | stamina | 0.031 | 0.023 | 1.3 |
| moveTurn | bowl | 0.025 | 0.013 | 2.0 |
| stumping | glove | 0.024 | 0.033 | 0.7 |
| experience (bat) | secondary | 0.019 | 0.022 | 0.9 |
| stamina (keeper) | stamina | 0.017 | 0.012 | 1.4 |
| catching (outfield) | field | 0.012 | 0.010 | 1.1 |
| keeping | glove | 0.008 | 0.033 | 0.2 |
| stamina (spin) | stamina | 0.005 | 0.026 | 0.2 |

The sample size mattered. At N=400 the standard error is about 0.06 runs,
which resolves wicket-threat and says nothing whatever about experience; every
attribute was re-run at N=1000.

**A measurement artefact worth naming before anyone reads the state table.**
In the *easy chase* column almost every attribute measures negative. That is
not cricket, it is the currency: a better side chasing an easy target wins
*earlier*, scores fewer total runs, and its margin per 50 falls. The
batting-first column is the clean one for batting attributes, and the hard-chase
column amplifies every attribute by roughly the same factor — so its **ratios**
are informative and its **levels** are not.

## §6 VS PACE / VS SPIN — THE BRIEF WAS RIGHT

The old single-fixture probe read vsSpin at 0.028 runs a point and it was an
artefact of a batsman who barely faced any. Measured along the exposure line
(over allocation confirmed even across the five bowlers, so the sheet's
composition is what a batsman meets):

| attack | spin share | vsPace | vsSpin |
|---|---|---|---|
| all pace | 0.00 | 0.186 | −0.020 |
| pace-heavy | 0.21 | 0.361 | 0.110 |
| balanced | 0.42 | 0.186 | 0.067 |
| spin-heavy | 0.60 | 0.105 | 0.153 |
| all spin | 1.00 | 0.063 | 0.318 |

Weighted least squares (weights 1/se², which demotes the one N=200 pace-heavy
cell sitting two standard errors off the line):

```
vsPace = 0.072 + 0.174 × paceShare
vsSpin = −0.035 + 0.333 × spinShare
```

Both intercepts are consistent with zero, which is the design checking itself:
a point of vsSpin should be worth nothing when no spin is bowled, and it is.

The world bowls **44.5% spin** (`world-distribution.json`, counted off the
front five of every side the planet has). At that exposure:

**vsPace 0.168, vsSpin 0.113.** `FO_VAL_W` currently says 0.185 / 0.145. The
pace premium is roughly right in direction and the gap is smaller than the
model claims — and vsSpin is emphatically **not** a weak attribute.

## §7 WORLD-WEIGHTED VALUES

`tools/world-distribution-probe.mjs` asks the shipped engine rather than
assuming: `condOf` enumerated over **every fixture of a season in all sixteen
nations** (3,584 fixtures) for the pitches, and every side the planet has
dealt its own squad for the types.

Pitches: balanced 30.5%, green 19.5%, dry 18.4%, slow 15.6%, twoPaced 10.4%,
cracked 5.5%, **flat 0.0%**. Flat is never a groundsman's leaning — it exists
only when a manager calls for it — so it is measured and carries weight zero.
Two-paced and cracked were measured specifically so the weighting covers 100%
of the pitches the world plays on rather than 84%.

Raw and world-weighted values are in `value-tables.txt`, both printed, per the
brief. The weighting is over **pitches only**: the star design has no pitch ×
attack cell, so weighting the two as though they were independent and
multiplying them would invent an interaction nothing measured. The attack
dimension is used on its own, for the two attributes it decides.

### A finding that fell out of this and is not about valuation

**The world contains no fast bowlers at all.** 256 squads, 3,840 cricketers,
zero `seamFast`. The cause is one line in the generator
(`03-onboarding.js:310`): `paceStyles = ["seamFastMedium", "seamFastMedium",
"seamMedium", "seamMedium"]`. `seamFast` is not in the rotation.

It is out of scope here and is **not** touched, but three things downstream
assume it exists: the founder draft charges a 1.35 scarcity premium on
`seamFast` (harmless — the solo draft pool uses a different role list at
`:5204` that does include it), the role-fatigue workload hierarchy's top rung
is a job nobody in the world holds, and pricing a bowler's stamina at the
fast-bowler figure would price that same absent job. The candidate weights use
the **fast-medium** stamina figure for that reason.

## §8 ROLE REPLACEMENT VALUE

`tools/role-replacement-probe.mjs`. One man in a full XI replaced by a better
man of the same role — upgraded through the engine's own `foFitToLevel`, so the
step is a genuine five overall rather than five points on some attributes — and
the fixture played on paired seeds.

| seat | OVR | Δ margin/50 | per OVR | win pts |
|---|---|---|---|---|
| batsman | 58.7 → 64.3 | 6.77 ± 1.15 | **1.213** | 5.1 |
| bowler | 55.5 → 60.6 | 6.53 ± 1.24 | **1.270** | 7.0 |
| keeper | 59.9 → 64.8 | 5.46 ± 1.09 | **1.129** | 5.7 |
| all-rounder | 53.6 → 58.5 | 4.36 ± 1.04 | **0.896** | 4.3 |

**The sample size changed the answer.** At N=300 the bowler's point measured
1.52 against the batsman's 0.94 and looked like a 1.6× cross-role distortion.
At N=1000 the gap is gone. Every pair is inside about one and a half standard
errors of every other.

## §9 ROLE FAIRNESS — THE MEASUREMENT SAYS DO NOTHING

A point of overall buys about **1.1 runs of match margin, and it buys the same
at every seat**. OVR is already a common currency and wants no cross-role
multiplier.

That is not an accident: `FO_VAL_C` normalises each role's mixture by its own
weight sum, so a cricketer whose every relevant skill is L comes out at level L
in *every* role he could fill. The construction is right and the measurement
confirms it. The correct action on §9 is to leave the role mixture alone —
worth recording, because "measure first" produced a null and a null is a
result.

The all-rounder sitting lowest (0.896) is the only hint of structure — his
five overall is spread across two trades, so each improves less — but at 1.2
standard errors it is not something to price.

## §10+ THE CANDIDATE WEIGHTS

Every number is the world-weighted measured value in runs of match margin per
point, which is what the comment above `FO_VAL_W` already **claims** its
numbers are.

| family | attribute | old | candidate | ratio |
|---|---|---|---|---|
| bat | vsPace | 0.185 | 0.168 | ×0.91 |
| | vsSpin | 0.145 | 0.113 | ×0.78 |
| | power | 0.150 | 0.137 | ×0.91 |
| | rotation | 0.150 | 0.165 | ×1.10 |
| | **temperament** | 0.060 | **0.104** | **×1.73** |
| | *sum* | 0.690 | 0.687 | |
| bowl | wicket | 0.415 | 0.368 | ×0.89 |
| | **economy** | 0.240 | **0.287** | **×1.20** |
| | discipline | 0.140 | 0.088 | ×0.63 |
| | **moveTurn** | 0.090 | **0.029** | **×0.32** |
| | variation | 0.060 | 0.042 | ×0.70 |
| | stamina | 0.030 | 0.046 | ×1.53 |
| | *sum* | 0.975 | 0.860 | |
| field | **fielding** | 0.200 | **0.077** | **×0.38** |
| | **catching** | 0.110 | **0.029** | **×0.26** |
| | *sum* | **0.310** | **0.106** | **×0.34** |
| glove | catching | 0.226 | 0.230 | ×1.02 |
| | keeping | 0.045 | 0.021 | ×0.47 |
| | stumping | 0.030 | 0.018 | ×0.60 |
| | *sum* | 0.301 | 0.269 | |

The headlines: **the field family is priced at three times what it is worth**
(the Phase 2B finding, now priced), **temperament is underpaid by 73%**,
**economy is underpaid relative to wicket-threat** (measured ratio 0.78 against
a priced 0.58), and **moveTurn is overpaid threefold**. The glove family was
already about right — its internal ratios barely move.

### FIELD_SHARE is now redundant

`FO_VAL_MIX` holds an outfielder's fielding to 0.45 of its family value,
described in the source as "the one deliberate cap" that stops a specialist
fielder becoming a professional cricketer. With the honest weight the cap is
no longer doing that work: at mix 1.00 and family sum 0.106, fielding is 13.8%
of a batsman's card, and a specialist fielder (fielding 95, everything else 20)
prices at level 30 — correctly bad. Keeping the 0.45 **on top of** the corrected
weight would under-pay fielding twice. Recommendation: if the weights go in,
`FO_VAL_MIX` field goes to 1.00 for bat/bowl/ar in the same change. The keeper's
0.00 stays — a gloveman does not field in the ring.

### WHAT IT ACTUALLY DOES — AND THE HALF THAT IS EASY TO MISS

Held against the **same** cricketers (3,840 men, dealt once by the engine's own
generator across every side the planet has, at the server's own tier rule, then
priced twice):

| | mean | p5 | p50 | p95 | max | ≥80 | ≥90 |
|---|---|---|---|---|---|---|---|
| old | 52.8 | 20 | 53 | 84 | 98 | 381 | 42 |
| new | 53.0 | 18 | 53 | 87 | 99 | 461 | **89** |

Dealt **fresh** under each price list:

| | mean | p5 | p50 | p95 | max | ≥80 | ≥90 |
|---|---|---|---|---|---|---|---|
| old | 52.8 | 20 | 53 | 84 | 98 | 381 | 42 |
| new | 52.8 | 20 | 53 | 84 | 98 | 384 | **43** |

**The re-fit does not change the world's talent. It re-labels the men who
already exist.** `foFitToLevel` aims at a level and `foLayOnTier` deals target
overalls, so the generator absorbs a re-pricing rather than passing it on — the
median skill of a dealt world moves by at most one point on any attribute.
Reporting only the first table would have said "the re-fit doubles the number
of 90-overall cricketers in the game", which is true of the existing save for
one settle and false of the game.

The elite lift on the fixed population is the honest consequence of removing an
overpriced family: typical fielding (median 48/51) sits *below* a good
batsman's batting, so the old field weight was dragging good batsmen down, and
removing the drag lifts them. **This is the main risk in the change and the
thing to decide on**, and it is a one-time re-labelling, not a permanent
inflation.

### THE 30 BIGGEST MOVERS

Full list in `refit-tables.txt`; `refit.json` carries 60. The shape of it:

- **Up (+5 to +7): elite openers and top-order batsmen with high temperament.**
  Freddie Wells 77→84, Ben Ingram 79→85, Ollie Hollins 85→91, Joe Ellison
  87→92, Bas Terpstra 86→91. Every one of them has temperament 78–107.
- **Down (−5 to −8): men whose card was mostly hands.** Melle Scholten 12→7
  (fielding 42, catching 65), Sam Taylor 79→74 (fielding 99), Harry Clarke
  25→18 (fielding 86), Tommy Ainsworth 30→23 (fielding 93/80).

Both directions are the intended corrections arriving on the men they should
arrive on.

### WAGES AND THE TRANSFER MARKET

On the fixed population the round wage bill moves **$59.13m → $61.97m, +4.8%**,
and the median man does not move at all ($11,060). The change is concentrated
at the top, because `foWageOf` is cubic: the +6 OVR men cost about 25% more and
the −6 men about 20% less.

Fees follow by construction — `rawWorth = wage × 18 × 2.4 × ageCurve × form` —
so a fee moves by exactly the wage's percentage. `market.mjs wageFromRating`
is a deliberate mirror of `foWageOf` held equal by
`server/tests/world-fee-agrees.test.mjs`; **it needs no change**, because the
re-fit moves the card, not the curve the card is fed into.

AI behaviour follows the same scalar: the bid gate is
`rating > mine.best × 1.04` and the surplus score uses `rating/1000 × 0.072`,
so both re-rank with the cards and neither has a constant to retune.

---

## WHAT IS NOT DONE, AND WHY

Stated plainly rather than left to be discovered:

- **The weights are not committed.** No line of `engine/src/` is changed. They
  are evaluated in a VM. Committing them is a decision about the ±7 OVR
  re-labelling of the existing world, which is a call to make with the evidence
  above, not one to slip in with a measurement.
- **Pitch × attack interactions** are not measured (star design, §4).
- **Player pair sanity tests** and the **Match-Day Coach comparison** are not
  run. The coach reads skills directly and is not a value consumer (§1), so it
  cannot be broken by a re-weighting; the pair tests are worth doing before any
  commit and are not a prerequisite for reading this.
- **Experience's layer is argued from the code and measured for size, but no
  experience term is proposed**, because at 0.019 ± 0.022 runs a point for a
  batsman there is nothing yet to place.
