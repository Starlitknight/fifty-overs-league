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
situational half: `tmpFloor 0.10 + death 0.45 + chase 0.35 + four-down
0.25 + required-rate (≤0.45) + collapse 0.30`. The death stays because
it is genuinely a nerve phase, at half its old weight; the middle overs
do not.

The division of labour is now clean: **phase knowledge is experience,
situational nerve is temperament.**

Both old laws revert together (`__foExpOldMode`, `__foTmpOldMode`) and
reproduce the golden masters **9/9 bit-for-bit** — the A/B this phase is
judged on.

## 3. The two laws, exactly (per delivery, 20→95 on wicket probability)

| state | EXP old | EXP new | TMP old | TMP new |
|---|---|---|---|---|
| dead middle over, new batter | −0.105 | −0.068 | −0.391 | **−0.082** |
| dead middle over, set batter | −0.088 | **−0.104** | −0.327 | **−0.069** |
| powerplay, new batter | −0.105 | −0.124 | −0.334 | −0.108 |
| death, set, no pressure | −0.316 | −0.356 | −1.477 | −0.822 |
| collapse 30/3 | −0.145 | −0.070 | −0.616 | −0.297 |
| hard chase, 35 off 24 | −0.587 | **−0.339** | −2.654 | **−2.525** |

Read the two columns that matter. Experience's old law **spiked to
−0.587 in a hard chase** — nerve it should never have had — and now
reads −0.339, its value coming from the death being *knowable* rather
than frightening. Temperament sat at **−0.391 in a dead middle over** —
nerve nobody needed — and now reads −0.082.

The new exp/tmp ratio runs **1.51 → 0.13**: experience is worth *more*
than temperament in a calm middle over and an eighth of it in a hard
chase. Temperament's own span from calmest to hardest state is now
**37×** (it was 8×).

## 4. Low pressure and high pressure, in runs (`pressure-split.json`)

N=900 with the innings filtered, so "low" really is batting first with
no target and no required rate, and "high" really is a chase on a green
seamer:

| | his runs | team/50 | win pts |
|---|---|---|---|
| **LOW** experience 20→95 | +2.29±2.61 | +1.0 | −0.5 |
| **LOW** temperament 20→95 | +4.12±2.59 | +3.8 | −0.8 |
| **HIGH** experience 20→95 | +3.25±1.82 | +0.9 | +0.3 |
| **HIGH** temperament 20→95 | **+10.63±1.78** | **+8.0** | **+6.8** |

Temperament is 2.6× more valuable under pressure than out of it, and
its **entire win value is in the chase** (+6.8 against −0.8). Experience
is essentially flat across the two regimes (1.4×) — which is what an
attribute made of knowledge rather than nerve should look like.

A whole innings necessarily contains pressure moments (the death, four
down), so the per-delivery table of §3 remains the rigorous statement of
the low-pressure claim; this section prices the same distinction in
runs.

## 5. Bowling (`new-evidence.json`)

Strike bowler swept 20→95, his own figures:

| attribute | economy | wickets |
|---|---|---|
| experience | **−0.179±0.090** runs/over | **+0.120** |
| temperament | 0.000±0.085 | 0.000 |

Experience is a genuine bowling attribute — about 1.8 runs saved across
a ten-over shift, through `craftSet` (working over a set batter) and
`adapt` (his own deliveries at that end), not through a flat wicket
bonus. Temperament moves bowling by **exactly zero**: the brief's "do
not force symmetry" is satisfied in the arithmetic, not merely in prose.

## 6. Young star v old pro (`new-evidence.json`)

Same raw skill; experience and temperament crossed. His runs, easy deck
v green seamer (N=300):

| man | easy | hard |
|---|---|---|
| A — young 25 exp, 70 tmp | 57.2±2.5 | 25.6±1.7 |
| B — veteran 85 exp, 70 tmp | 60.0±2.6 | 30.6±1.9 |
| C — young 25 exp, 90 tmp | 57.8±2.6 | 27.3±1.9 |
| D — veteran 85 exp, 90 tmp | 58.3±2.5 | 30.2±1.9 |

The veterans (B, D) are the better players on the hard day by ~4–5 runs;
on the easy day the four are within noise of each other, and the young
talent is fully competitive — a young star still outperforms a veteran
of equal skill whenever the cricket is not difficult, which is §18's
eighth criterion.

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
- <!-- SUITES -->

Not merged, not deployed, goldens held for review.
