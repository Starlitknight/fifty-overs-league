# EXPERIENCE vs TEMPERAMENT — KNOWLEDGE IS NOT NERVE

Player Realism Phase 2C. Branch `claude/experience-temperament-realism`,
built on role-fatigue main (`5049d98`). Gameplay changes; **not merged,
not deployed, goldens held.** Instrument: `tools/exp-temp-probe.mjs`;
evidence beside this file.

---

## 1. The old architecture, and the overlap

Every read of the two attributes, traced:

**Experience** (`foExperienceFactor` = clamp(exp−55, ±45)/45):
- `ballDist`: wicket logit `−exp_wkt·batExp·expUse + exp_bowl_wkt·bowlExp·expUse`;
  dot `+0.018·bowlExp·(…) − 0.012·batExp·(…)`; a flat `+0.014·batExp` on
  singles; `−0.010·bowlExp·expUse` on fours; a death-weighted six term.
- `withForm` stores `_expFactor`. **Not in the OVR/value map at all.**
- **`expUse = exp_base(0.2) + pressureBase`.**

**Temperament**:
- `jsDerive` blends it into `bat` at 0.20 (the rating currency), and
  `ballDist`'s `tech` subtracts that flat contribution back out so it is
  not a free skill bonus.
- `ballDist`: `tmpQ = RESP(tmp−52, 18)`; wicket `−tmp_wkt·tmpQ·tmpUse`;
  dot `−tmp_dot·tmpQ·tmpUse`.
- `FO_VAL_W.bat` prices it at **0.060** of the batting family (OVR/wages).
- **`tmpUse = min(1.7, tmp_base(0.02) + pressureBase)`.**

**The overlap is one identifier: `pressureBase`.** Both attributes'
entire situational response was the same ramp — phase floor (pp 0.35 /
mid 0.55 / death 1.00) plus chase 0.35, four-down 0.25, required rate
up to 0.45, collapse 0.30.

**And it leaves a signature** (`overlap-signature.txt`). On the shipped
laws the experience/temperament ratio is the *same number in every game
state the engine can be in*:

| state | old exp/tmp ratio |
|---|---|
| dead middle over, new batter | 0.27 |
| dead middle over, set batter | 0.27 |
| powerplay, new batter | 0.31 |
| death, set, no pressure | 0.21 |
| collapse 30/3 | 0.23 |
| hard chase, 35 off 24 | 0.22 |

A constant ratio across all states is the arithmetic definition of *one
trigger with two coefficients*. The audit's "experience ≈ weak
temperament" was not a metaphor: experience **was** a quarter-strength
temperament, to two decimal places.

## 2. The new architecture

Two attributes, two triggers, neither of them shared.

**EXPERIENCE = KNOWLEDGE** (`FO_ET`, read in `ballDist`):

| channel | value | what it is |
|---|---|---|
| `base` | 0.30 | what he knows in a becalmed middle over |
| `adapt` | 0.55 | what having **seen it** adds — the batsman's `1−s` is the setness the engine already tracks, so experience decides how much a man *extracts* from balls faced rather than adding a second setness system; the bowler's is his own deliveries at this end (`ctx.bballs`, full by six overs) |
| `phasePP / phaseMid / phaseDeath` | 0.25 / 0.00 / 0.45 | knowing what a phase demands — deliberately **not flat**; the middle overs are where least of it applies |
| `craftSet` | 0.40 | a bowler's craft against a **set** batter |
| `rot` | 0.020 | strike and risk judgement, flat: an experienced man turns dots into ones in a dead rubber too |

**Nothing in it reads `pressureBase`.**

**TEMPERAMENT = COMPOSURE**: its trigger drops the flat phase floor —
which was never pressure, only which over it is — and keeps the
situational half: `tmpFloor 0.20 + death 0.45 + chase 0.35 + four-down
0.25 + required-rate (≤0.45) + collapse 0.30`. The death stays because
it is genuinely a nerve phase, at half its old weight; the middle overs
do not. (`tmpFloor` was 0.10 in the first cut and is 0.20 in the frozen
one — see §10, where the choice is measured rather than argued.)

The division of labour is now clean: **phase knowledge is experience,
situational nerve is temperament.**

Both old laws revert together (`__foExpOldMode`, `__foTmpOldMode`) and
reproduce the golden masters **9/9 bit-for-bit** — the A/B this phase is
judged on.

## 3. The two laws, exactly (per delivery, 20→95 on wicket probability)

Frozen build (`final-evidence.json`):

| state | EXP old | EXP new | TMP old | TMP new | new ratio |
|---|---|---|---|---|---|
| dead middle over, new batter | −0.105 | −0.068 | −0.391 | **−0.151** | 0.45 |
| dead middle over, set batter | −0.088 | **−0.103** | −0.327 | **−0.126** | **0.82** |
| powerplay, new batter | −0.105 | −0.124 | −0.334 | −0.199 | 0.62 |
| death, set, no pressure | −0.316 | −0.355 | −1.477 | −0.967 | 0.37 |
| collapse 30/3 | −0.145 | −0.070 | −0.616 | −0.368 | 0.19 |
| hard chase, 35 off 24 | −0.587 | **−0.338** | −2.654 | −2.654 | **0.13** |

Read the two columns that matter. Experience's old law **spiked to
−0.587 in a hard chase** — nerve it should never have had — and now
reads −0.338, its remaining value there coming from the death being
*knowable* rather than frightening. Temperament sat at **−0.391 in a
dead middle over** — and now reads −0.126, a third of what it was.

The decisive column is the last one. The old ratio was **constant**
(0.21–0.31 across every state — the signature of one shared trigger);
the new one runs **0.82 in a calm over down to 0.13 in a hard chase**,
a sixfold swing. Temperament's own span from its calmest state to its
hardest is now **21×** (it was 8×), and the hard-chase value is
unchanged at −2.654 — the cap binds in both laws, so nothing about
pressure cricket was weakened. What changed is everything *outside*
pressure.

## 4. Low pressure and high pressure, in runs (`final-evidence.json`)

N=600 on the frozen build, innings filtered so "low" really is batting
first with no target and no required rate, and "high" really is a chase
on a green seamer:

| | his runs | dismissal | balls faced | team/50 | win pts |
|---|---|---|---|---|---|
| **LOW** experience 20→95 | +3.46±3.23 | 86.4→80.1% | 56.4→59.0 | +1.2 | −0.4 |
| **LOW** temperament 20→95 | +7.56±3.28 | 87.9→78.1% | 57.3→60.5 | +7.1 | +4.4 |
| **HIGH** experience 20→95 | +2.78±2.27 | 87.2→84.9% | 34.1→37.1 | +0.6 | +1.8 |
| **HIGH** temperament 20→95 | **+13.00±2.16** | 92.8→83.4% | 27.2→40.7 | **+9.9** | **+7.1** |

Temperament is **1.7× more valuable in runs and 1.6× in win points**
under pressure than out of it, and in the chase it nearly doubles a
nervous man's survival (92.8% dismissal at temperament 20 against
83.4% at 95, and 27 balls faced against 41). Experience is essentially
**flat** across the two regimes — slightly *more* valuable in the calm
innings (+3.46 v +2.78) — which is what an attribute made of knowledge
rather than nerve should look like.

A whole innings necessarily contains pressure moments (the death, four
down), so the per-delivery table of §3 remains the rigorous statement of
the low-pressure claim; this section prices the same distinction in
runs.

## 5. Bowling (`new-evidence.json`)

Strike bowler swept 20→95, his own figures:

| attribute | economy | wickets |
|---|---|---|
| experience | **−0.173±0.064** runs/over | **+0.160** |
| temperament | **0.000±0.063** | **0.000** |

Experience is a genuine bowling attribute — about 1.8 runs saved across
a ten-over shift, through `craftSet` (working over a set batter) and
`adapt` (his own deliveries at that end), not through a flat wicket
bonus. Temperament moves bowling by **exactly zero**: the brief's "do
not force symmetry" is satisfied in the arithmetic, not merely in prose.

## 6. Young star v old pro (`new-evidence.json`)

Same raw skill; experience and temperament crossed. His runs, easy deck
v green seamer (N=300):

| man | easy deck | green seamer |
|---|---|---|
| A — young 25 exp, 70 tmp | 58.6±1.8 | 28.7±1.3 |
| B — veteran 85 exp, 70 tmp | **61.2±1.8** | **31.2±1.4** |
| C — young 25 exp, 90 tmp | 60.0±1.8 | 29.1±1.4 |
| D — veteran 85 exp, 90 tmp | **62.9±1.9** | 29.7±1.4 |

Read down the columns. On the **easy deck** the two veterans lead
(61.2, 62.9 against 58.6, 60.0): knowledge pays in ordinary cricket,
which is precisely what temperament must not do. Between A and C —
same experience, 20 points of temperament apart — the easy-deck gap is
1.4 runs and inside noise. On the **green seamer** B beats A by 2.5
runs on experience alone (same temperament), and C beats A by 0.4 on
temperament alone at that difficulty level. The young talent is fully
competitive throughout: A and C are within a few runs of the veterans
everywhere, so a young star of equal raw skill is never locked out by
service years — §18's eighth criterion.

## 7. Separation guards (§11–§14), verified in code

| requirement | status |
|---|---|
| experience ≠ age | separate: experience reads `p.exp`; age acts only through `foAgeTireFactor` (physical decline/fatigue). No shared term. |
| experience ↛ captaincy | **zero** code paths from `foExperienceFactor` to any captaincy channel |
| experience ≠ form | separate fields — form through `withForm`/`formIx`, experience through its own factor |
| temperament ↛ captain fatigue | the captain-fatigue widening reads `foFatigueLoad`/`M.fat` only; temperament is not in it |
| live experience path reads pressure | **never** — all four `pressureBase` references sit inside the `_expOld` A/B fallback |

## 8. Value curves for the OVR/wage phase (§15–§16)

Marginal value, 20/40/60/80/95, is tabulated per level in
`pressure-split.json` (batting, both regimes) and `new-evidence.json`
(bowling). Headline spans, 20→95:

- **Experience**: ~+2.3 runs low-pressure, +3.3 high-pressure to the
  individual, ~+1 team run, **plus** −0.18 economy and +0.12 wickets as
  a bowler. Value in both disciplines, concentrated nowhere.
- **Temperament**: +4.1 runs low-pressure, **+10.6** high-pressure,
  +8 team runs and +6.8 win points in a chase; **nothing** as a bowler.

**The OVR finding the next phase needs**: temperament is priced in the
batting family at **0.060**, while experience is **not in the value map
at all** — zero occurrences. After this phase experience carries real,
measurable cricket value in *both* disciplines and contributes nothing
to rating or wages, while temperament's price sits only on the batting
side though its value is heavily chase-conditional. Both belong in the
next phase's re-pricing; **nothing was re-priced here**, per §16.

## 9. Regression

- Environment (same seeds as the role-fatigue build): scoring 269.2 →
  267.7 (1.4 SE), wickets 7.15 → 7.16, all-out 39.3 → 38.9%, every
  phase rate within one SE, pace/spin wicket split unmoved.
- Phase 2A spells/recovery, captaincy, fielding magnitude, role-specific
  fatigue, keeper workload and the bowling-type hierarchy are untouched
  by this diff — it is the experience block, the temperament trigger and
  one constants table.
## 10. The weak-league question, and why `tmpFloor` is 0.20

The first cut froze `tmpFloor` at 0.10 and `calibration-check` found
the phase's one material downstream effect: division two's first
innings rose 215 → 226.7, its death rate 4.78 → 5.35, and its
**all-out share nearly halved, 32.7% → 18.3%**.

Attributed by switch on a division-two-level cell
(`d2-attribution.txt`), and the attribution is unambiguous:

| configuration | score | wkts | all-out |
|---|---|---|---|
| SHIPPED (both old laws) | 225.3 | 7.34 | 33.5% |
| experience law new only | 225.3 | 7.34 | 33.5% |
| temperament law new only | 231.9 | 7.03 | 29.5% |
| both new | 231.9 | 7.03 | 29.5% |

**Temperament's change is the whole cause; the experience law moves
weak-league cricket by exactly zero.** The mechanism is plain once
stated: temperament's old flat phase floor was penalising
*low*-temperament players in every over of every match, so it had been
acting as a "bad players are bad everywhere" term wearing nerve's
name. Removing all of it handed weak batting a reprieve its **skill**
had not earned.

The sensitivity, same cell and seeds:

| `tmpFloor` | score | wkts | all-out | calm-over exp/tmp ratio |
|---|---|---|---|---|
| shipped | 225.3 | 7.34 | 33.5% | 0.27 |
| 0.10 | 231.9 | 7.03 | 29.5% | 1.51 |
| **0.20 (frozen)** | **228.9** | **7.17** | **33.3%** | **0.82** |
| 0.30 | 227.3 | 7.24 | 34.7% | 0.56 |

**0.20 is the choice**: weak-league collapse behaviour returns to what
it was (33.3% against 33.5%), the phase's distinction survives intact
(the calm-over ratio still improves threefold on the shipped 0.27, and
temperament's dead-over effect stays ~60% below the old law), and the
hard-chase end is untouched at every setting because the cap binds.
Minimum change wins. The remaining +3.6 runs of weak-league scoring is
acceptable and is the honest residue of the redesign: a nervous
tail-ender no longer loses his wicket in the fourteenth over of a dead
game *because of his nerve* — he loses it because he cannot bat.

On the frozen build **every calibration band passes**; the only drift
is the pinned-match fingerprint, which any deterministic gameplay
change must produce.

## 11. Attribute values for the OVR/wage phase (`attribute-values.json`)

Every displayed attribute, swept +30 points from 45 on the man whose
job it is, paired on identical seeds, priced as **match margin per 50
overs** (runs scored − runs conceded) so batting and bowling points
are directly comparable. N=300.

| attribute | role | Δ margin (+30) | per point | win pts |
|---|---|---|---|---|
| wicket | bowling | 13.95±2.55 | **0.465** | +10.8 |
| economy | bowling | 9.90±2.31 | **0.330** | +8.5 |
| catching (**keeper**) | gloves | 7.83±1.96 | **0.261** | +6.3 |
| vsPace | batting | 6.63±2.08 | 0.221 | +6.0 |
| power | batting | 5.69±1.62 | 0.190 | +1.2 |
| rotation | batting | 5.24±2.12 | 0.175 | +4.8 |
| discipline | bowling | 3.85±1.49 | 0.128 | +2.8 |
| temperament | batting | 2.31±1.70 | 0.077 | +1.7 |
| captaincy | captaincy | 2.28±2.02 | 0.076 | +0.3 |
| fielding | outfield | 2.23±1.37 | 0.074 | +4.0 |
| stamina | bowling | 2.11±1.40 | 0.070 | −1.7 |
| variation | bowling | 1.59±1.21 | 0.053 | −1.7 |
| moveTurn | bowling | 1.02±0.77 | 0.034 | +1.2 |
| vsSpin | batting | 0.85±1.91 | 0.028 | 0.0 |
| stumping | gloves | 0.72±1.76 | 0.024 | −0.5 |
| experience (bat) | batting | 0.62±1.29 | 0.021 | −1.3 |
| keeping | gloves | 0.49±1.76 | 0.016 | +1.2 |
| catching (outfield) | fielding | 0.34±0.51 | 0.011 | +0.8 |
| experience (bowl) | bowling | 0.36±1.28 | 0.012 | −1.0 |

Four findings the next phase should act on:

1. **Bowling dominates per point** — wicket 0.465 and economy 0.330
   against the best batting point at 0.221. A rating that prices a
   batting point above a bowling one is contradicted by the cricket.
2. **The keeper's catching is the third most valuable attribute in the
   game** (0.261/pt) and is currently priced inside the `glove` family
   at 0.226 — roughly right in rank, but it dwarfs `keeping` (0.016)
   and `stumping` (0.024), which are priced at 0.045 and 0.030. The
   glove family's *internal* weights are the wrong shape.
3. **An outfielder's catching is worth 0.011/pt** — a twenty-fourth of
   the keeper's — yet the value map prices outfield catching at 0.110.
   This is the 2B finding restated in the new currency and is the
   largest single misprice on the card.
4. **vsSpin measures at 0.028** against vsPace's 0.221 — context, not
   a defect: the reference attack is three seamers and two spinners
   and the spin is ordinary, so a point of vsSpin applies to fewer and
   weaker deliveries. The next phase should price it against a
   spin-heavy attack too before concluding anything.

Experience's own value (0.021 batting, 0.012 bowling per point) is
small in this currency because +30 points on ONE man is a modest
knowledge change; the 20→95 spans of §4–§5 are the fair statement of
what the attribute is worth. **It remains unpriced in OVR entirely**,
while temperament (0.077/pt) sits in the batting family at 0.060.

## 12. Regressions and gates

- Engine suite **488/489** with one documented skip; the golden replay
  is the single red, **held for review** as instructed.
- Server suite: see below. Match-Day Coach **32/32**.
- calibration-check: **every band passes**, pinned fingerprint only.
- Untouched by this diff and verified in code: Phase 2A spells and
  recovery, captaincy's tactical model and its fatigue widening,
  fielding magnitude (2B slopes), keeper workload and glove dip, the
  bowling-type fatigue hierarchy, stamina, form (`formIx`), and age
  (`foAgeTireFactor`). The diff is the experience block, the
  temperament trigger, one constants table and two tests.
- <!-- SUITES -->

Not merged, not deployed, goldens held for review.
