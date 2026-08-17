# CAPTAINCY REALISM — JUDGEMENT, MOMENTS, THE FIELD, AND A SLIVER OF LEADERSHIP

Branch `claude/captaincy-realism`, built on Phase 2A main (`f03ba28`).
Gameplay changes; **not merged, not deployed, goldens not re-blessed.**
Instrument: `tools/captaincy-realism-probe.mjs`; evidence beside this
file (`baseline-evidence.json`, `new-uniform-evidence.json`,
`new-het-evidence.json`, `env-old.json`, `env-new.json`).

---

## 1. The old architecture, and what it measured

Captaincy on the Phase 2A engine was three small things: the **slip
law** in `aiPickBowler` (one die per change point — with probability
`0.85·(88−capt)/88` reach past the best-ranked man, never past the
fourth, and *nothing at all above 88*), a **dot-ball sliver** in
ballDist worth well under a run a match, and the coach's price. The
field (`aiField`) was one fixed policy for every captain who ever
lived, blind to an exposed tail. The ranking the slip drew from could
not see a new batter's arrival window, read a partnership only as a
step at 45, and burned the closer's last overs at 42.

**The baseline, measured** (paired seeds; uniform reference side):

| capt | conceded/50 | win% |
|---|---|---|
| 20 | 265.0 ±1.4 | 49.5 |
| 55 | 265.6 | 50.9 |
| 70 | 263.8 | 50.0 |
| 80 | 263.4 | 50.1 |
| 88 | 264.1 | 52.0 |
| 95 | 262.8 ±1.4 | 52.3 |

Key gaps, paired-diff (N=2000 seeds): 70→80 = 1.01±0.48 runs;
**80→95 = 0.90±0.47 runs, +1.2±0.9 win pts; 88→95 = 0.57±0.30**
(mechanically the code gave nothing above 88; the residual is the tiny
slivers plus noise); 20→95 = **3.38±0.65 runs, +3.8±1.1 pts**. Context
spans ran 2.8–5.9 runs. And the wicket ledger was identical at
captaincy 20 and 95 to the third decimal (7.091 v 7.098 wkts/inn):
**the old captain created no wickets**. The top-end compression the
brief refuses is confirmed, quantified, and the baseline banked.

One measured surprise worth keeping: on the OLD engine the biggest
captaincy value was in *obvious* environments (a dominant seamer:
5.0±2.1 runs) and the smallest in close-call ones (0.9±1.6), because a
missed obvious choice is expensive and a missed coin-toss is free.
"Difficult" for a captain is not "close" — it is
consequential-but-not-obvious, and the redesign's environments are
built on that distinction.

## 2. The new architecture

Four channels, every one deterministic from the match seed, every one
with an attribution off-switch, no cliffs anywhere:

**A · Judgement as a reading error** (replaces the slip). Every
candidate's true score reaches the captain through deterministic noise
of amplitude `FO_CAPT.amp(9) × (102−capt)/82` score points — 9.0 at
captaincy 20, 5.2 at 55, 2.4 at 80, 1.5 at 88, **0.77 at 95, never
zero**. He picks the best of what he *reads*. A close call stays a
close call for everybody (a 95 taking the second of two near-equals is
not a blunder); a large gap is misread only by a poor captain; regret
declines continuously and never reaches zero. The same noisy read
judges the Phase 2A continuation margin, so change-point *quality* —
persisting with a spent man, breaking a working spell early — is now
captaincy's, while spell length itself stays the engine's.

The noise alone turned out to be the wrong shape of wrongness. Round-1
measurement (`pre-anchor-uniform.json` / `pre-anchor-het.json`, kept
as the record of why) showed the 20→95 gap *shrinking* below baseline while the
noise-off control *widened* it: a poor captain's random churn was
rotating bowlers onto Phase 2A's fresh-legs recovery, and the engine
was paying him for indecision. The cricket-honest correction is the
failure mode the brief itself names: poor captains do not churn, they
**persist too long**. The continuation read therefore carries a
confirmation-bias anchor of `FO_CAPT.anchor(6) × (102−capt)/82` score
points in the incumbent's favour — 6.0 at captaincy 20, 0.5 at 95 — so
a weak captain leaves a weary man on past the point the clean numbers
would pull him, and the fatigue he keeps in the attack is where his
runs leak. Same error curve, same determinism, no new constants
family.

**B · The moments** (new terms in the true ranking, all captains',
seen through each captain's noise): the exposed tail wants
wicket-takers (`threat` weighted up from six down, harder the deeper);
a batter ≤3 balls at the crease is the strike bowler's window; the
partnership alarm is continuous (reaches the old 45-step's weight at a
hundred-run stand instead of firing flat); and overs 41–46 refuse to
burn the closer's last two overs — Phase 2A's rest-and-return is what
makes holding him back physically real.

**C · The field as a decision** (`aiFieldWant` / `aiField`). The
context policy itself learned the tail (seven down in the middle overs
wants an attacking field — measured at ~0.34 runs/over of net value
against tail and new batters through the existing ballDist field terms
and posted geometry, no new fields invented). Captaincy sets how
reliably the right intent is actually posted: at captaincy 20 the side
settles for a balanced field at 55% of att/def moments, at 95 at 4.7%
— continuous, deterministic per over.

**D · Organisation** (the leadership sliver, replaces the 0.0002 dot
term). One channel only: a well-led side's *positioning* — dots up,
cut-off boundaries — riding the same pathway as `ctx.fieldAvg` at
about half that term's slope, worth ~1.5 runs across the whole 20→95
span. Deliberately tiny beside a fielding system the audit already
calls oversized; it never touches the catch or stumping contests (a
captain cannot give a man better hands, only a better position); it is
a multiplier around par 50, so a poor captain costs what a fine one
buys. It does not duplicate experience (individual, pressure-scaled),
temperament (individual nerve), fielding skill (individual hands) or
bowling skill (individual delivery) — it is the team-organisation
residue the brief asks for, and nothing else.

What was deliberately **not** built: batting captaincy (experience and
temperament already own individual composure; the captain earns his
keep in the field), a day's-figures reaction (§3F — tested as a risk
of yo-yo changes against the deterministic replay guarantee; the
smoothed signal added nothing in paired tests that the fatigue channel
does not already say, so it was left out), and any captaincy→wicket or
captaincy→skill shortcut anywhere.

## 3. The new captaincy curve

<!-- NEW-CURVE -->

## 4. Where the value comes from (attribution)

<!-- CHANNELS -->

## 5. Wickets attributable to captaincy

<!-- WICKETS -->

## 6. Easy v difficult decision environments

<!-- DIFFICULTY -->

## 7. Archetypes: what each captain visibly does

<!-- ARCHETYPES -->

## 8. Calibration movement (old v new)

<!-- CALIBRATION -->

## 9. The coach: re-priced captaincy and the shirt test

<!-- COACH -->

## 10. Regressions and suites

<!-- SUITES -->
