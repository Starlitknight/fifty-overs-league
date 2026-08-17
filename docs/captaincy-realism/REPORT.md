# CAPTAINCY REALISM — JUDGEMENT, MOMENTS, THE FIELD, AND A SLIVER OF LEADERSHIP

Branch `claude/captaincy-realism`, built on Phase 2A main (`f03ba28`).
Gameplay changes; **not merged, not deployed, goldens not re-blessed.**
Instrument: `tools/captaincy-realism-probe.mjs`; evidence beside this
file — `baseline-evidence.json` (old engine), `new-uniform-evidence.json`
and `new-het-evidence.json` (final build), `difficulty-evidence.json`
(N=1600 environments), `env-old.json` / `env-new.json` (world A/B),
`shirt-test.txt`, `calibration-drift.txt`, and the two superseded
sizing rounds kept as the record of *why* the constants are what they
are: `pre-anchor-*.json` (no anchor — the churn inversion) and
`anchor6-*.json` (anchor 6, before the sweep froze 9).

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

Constants frozen after two sizing rounds (`FO_CAPT = {amp:9, anchor:9,
fieldSlip:0.55, orgDot:0.012, orgFour:0.010}`; the anchor's sweep is
in the commit that froze it: anchor 6 → 4.30±0.72 runs, anchor 9 →
4.67±0.73, amp 11 *lost* value both ways because more reading noise is
more churn). Final build, N=500 per curve point, N=2000 per paired
gap.

**The curve** (conceded/50ov defending, win% — uniform attack):

| capt | conceded | win% |
|---|---|---|
| 20 | 264.3 | 49.1 |
| 40 | 263.8 | 49.4 |
| 55 | 263.7 | 48.1 |
| 70 | 261.8 | 53.2 |
| 80 | 261.9 | 51.4 |
| 85 | 260.0 | 55.2 |
| 88 | 260.8 | 54.6 |
| 92 | 260.0 | 53.0 |
| 95 | 259.6 | 53.3 |

**The gaps that were the point** (paired seeds, N=2000):

| gap | uniform | varied attack | old engine |
|---|---|---|---|
| 70→80 | 1.25±0.55 | 0.99±0.55, +1.9 pts | 1.01±0.48 |
| 80→95 | **1.51±0.63** | **1.04±0.60, +1.9±1.1 pts** | 0.90±0.47 |
| 88→95 | 0.35±0.52 | **0.93±0.51** | 0.57±0.30 (mechanical zero) |
| 20→95 | **3.96±0.74, +3.2±1.2 pts** | **4.67±0.73, +4.9±1.1 pts** | 3.38±0.65 |

80→95 is measurably nonzero at 2.4 standard errors on the uniform
side and carries two win points on the varied one; 88→95 — where the
old law gave *mechanically nothing* — resolves at 0.93±0.51 on a real
attack. The whole 20→95 span lands at 4–4.7 runs and 3.2–4.9 win
points against the brief's ≈5–10 / 5–8 sanity range: just under the
bottom of it, and left there deliberately. The next constant that
would push it inside (anchor 12, amp 14) is past the point where the
incumbent bias exceeds what a captain can even perceive — the range
was a sanity check, not a target, and this is where honest sizing
stops. On clone attacks 88→95 stays inside its standard error, which
is itself correct cricket: seven points of judgement buy little when
every candidate is the same man.

## 4. Where the value comes from (attribution)

Each channel has an off-switch; the 20→95 paired gap (N=1500) is
re-measured with one channel frozen at a time. The columns are the
gap that REMAINS with the channel off — the channel's own worth is
the shortfall against the all-on row (channels interact, so the
shortfalls need not sum to the total):

| configuration | uniform | varied attack |
|---|---|---|
| all channels on | 4.69±0.85 | 4.47±0.84 |
| judgement noise off | 3.46±0.81 | 3.40±0.82 |
| situation terms off | 4.85±0.84 | 3.86±0.83 |
| field judgement off | 4.12±0.76 | 3.96±0.78 |
| field policy off (old aiField) | 4.32±0.78 | 4.45±0.78 |
| organisation term off | 3.03±0.86 | 3.41±0.84 |
| continuation anchor off | 3.14±0.85 | 3.12±0.85 |

Read as contributions: the **anchor** carries ~1.3–1.6 runs (the
largest single channel — persisting with the weary man is the
costliest thing a poor captain does), **judgement noise** ~1.1–1.2,
**organisation** ~1.1–1.7 (at the top of its design intent),
**situation terms** ~0.6 on a varied attack and nothing on clones
(exactly right — the moments only pay when there is a right man to
bring), the **field** ~0.4–0.6 in runs. The pre-anchor round told the
opposite story — noise-off *widened* the gap because churn was
rotating bowlers onto Phase 2A's fresh legs — and that inversion is
dead: noise-off now shrinks the gap on both sides.

The field channel deserves an honest note: its run value is modest
because the existing ballDist att/def terms are themselves nearly
value-neutral by design (the audit measured this). What the channel
buys is *visible* captaincy — the wrong-field rate falls 41.6% → 4.5%
across the range (§7) — through geometry that already exists, with no
new fields invented, as the brief required.

## 5. Wickets attributable to captaincy

The old engine's ledger was identical at captaincy 20 and 95 to the
third decimal. The new one (900 innings a side, uniform attack):

| | capt 20 | capt 95 | Δ |
|---|---|---|---|
| wkts/inn | 7.210 | 7.319 | **+0.109** |
| in the first over of a spell | 1.836 | 2.008 | **+0.172** |
| against the tail (8+ down) | 1.360 | 1.420 | +0.060 |
| 50-stands conceded | 1.546 | 1.503 | −0.043 |

Every one of those wickets arrives through a believable chain and
nothing else: the right bowler is standing at the change point
(judgement + moments), the tail sees a wicket-taker with an attacking
field (policy + field judgement), the new batter meets the strike
bowler inside his arrival window, and organisation's dots add the
pressure the engine already converts. There is no captaincy term in
any dismissal contest — a ninth of a wicket an innings, a fifth more
strike at the fall of a spell's first over, and fewer fifty-stands
survived is what good leadership is *worth*, not what it is *given*.

## 6. Easy v difficult decision environments

Dedicated run at N=1600 per cell (`difficulty-evidence.json` — the
batteries' own §4 cells were underpowered at N=400, and the first het
battery's were outright contaminated by the --het overlay leaking
into the controlled compositions; the probe now forbids that):

| environment | capt 20→95 worth | win pts |
|---|---|---|
| simple: five clones | 4.34±0.82 | +4.0±1.4 |
| obvious: dominant seamer, green | 6.03±1.02 | +2.0±1.3 |
| difficult: real spreads + moments | 4.82±0.80 | **+3.7±1.2** |

Three findings. **The difficult cell is alive**: the
consequential-but-not-obvious environment — a weary strike man, a
death specialist to hold back, a sixth option, moments that shift the
right answer — was worth 0.9±1.6 runs on the old engine and carries
4.82±0.80 now, the largest relative gain of any environment.
**Obvious remains the biggest run-leak** (6.03), exactly as chapter 1
predicted: a missed dominant option is loud and expensive, and no
honest model makes missing it cheap. But **wins move where decisions
are hard**: +3.7 points in the difficult cell against +2.0 in the
obvious one, because the obvious environment's runs come off a
green-pitch total where the match is often already decided. And the
clones are no longer free (4.34, was 1.75–4.0 across rounds) for a
reason worth naming: fatigue differentiates identical men as the
innings wears on, so the anchor's persist-too-long failure costs even
when the team sheet says the bowlers are interchangeable.

## 7. Archetypes: what each captain visibly does

From the decision log (`__foCaptLog`, varied attack, 200 matches per
level): every over the captain records what he chose against what the
clean ranking said, whether a defined moment (exposed tail, new
batter, alarming stand, death) was met with the right response, and
the field he posted against the field the context wanted.

| capt | off-true picks | missed moments | wrong field |
|---|---|---|---|
| 20 | 30.9% | 27.1% | 41.6% |
| 40 | 30.8% | 26.8% | 41.4% |
| 55 | 28.6% | 26.6% | 31.2% |
| 70 | 25.3% | 23.4% | 21.5% |
| 80 | 22.9% | 22.5% | 14.8% |
| 90 | 17.8% | 19.1% | 7.6% |
| 95 | **15.8%** | **17.3%** | **4.5%** |

Monotone on every column, no cliff anywhere, and the floor is never
zero: a 95 still misreads one pick in six and one moment in six,
because some calls are genuinely close and the noise never vanishes.
What a spectator sees is what the numbers say: the poor captain leaves
the weary quick on two overs too long with a balanced field while the
eight-wicket tail blocks out; the fine one has the strike bowler on,
catchers in, the moment the new man walks in.

## 8. Calibration movement (old v new)

Two instruments. The **environment battery** (`env-old.json` v
`env-new.json`, same seeds, N=450): scoring 264.1 → 263.5/50ov,
wickets 7.22 → 7.19, all-out rate identical at 0.378, powerplay /
middle / death run-rates within a standard error each, pace-v-spin
wicket split within one SE, fielding event counts (catches, drops,
saves, run-outs) stable, and the paired values of experience,
temperament and the sixth bowler preserved. The redesign moved the
captaincy curve without moving the world.

**calibration-check** (`calibration-drift.txt`): every calibration
band passes against the frozen contract; the single drift is the
pinned-match fingerprint (370/6 v golden 365/6), which is what a
deterministic change to bowling-change and field decisions must
produce. Goldens and the calibration golden are deliberately **not
re-blessed** — that waits for this model to be accepted at review.

## 9. The coach: re-priced captaincy and the shirt test

CAPT_RUNS was priced against the slip law, which gave nothing above
88 and ~nothing on uniform attacks. Re-measured on the judgement
engine (coach-followup-probe §5, capt 40/64/88 across attack shapes):
pace-heavy 0.105 runs a point, spin-heavy 0.101, one tired quick
0.053, balanced 0.037, six options 0.028. Priced by the same
philosophy 2A.1 used — real squads are the heterogeneous kind, so the
price follows that cluster: **CAPT_RUNS 0.10 → 0.09**. (The
tired-quick cell halved because the anchor means a weak captain now
mishandles the weary man *himself*; part of that cost was already
priced into fatigue.) **CAPT_CEIL 88 → 95**: the batteries put 88→95
at ~0.05 runs a point, so value exists there and a flat 0.09 overpays
that stretch by at most ~0.3 runs — immaterial beside the invariant.

The **shirt test** (`shirt-test.txt`): the crossover is unchanged from
the shipped 2A.1 coach, byte for byte — a captaincy-99 middle-order
bat is picked over the marginal front-liner down to a batting deficit
of −12 and left out from −16, and the armband never chooses the
captain of the XI over a man who deserves his place. The armband
breaks ties; it does not buy a materially worse cricketer a shirt.

## 10. Regressions and suites

On the final head, in full:

- **Engine: 487/488.** The single red is `golden-master replays
  reproduce shipped gameplay bit-for-bit` — expected, deliberate, and
  the brief's own instruction: gameplay changed and the goldens are
  not re-blessed until the model is accepted. There is no other
  engine failure.
- One statistical test needed an honest repair, not a retune:
  `orders.test.mjs`'s phase-plan test asserted wickets-up over SIX
  fixed seeds, and the new deterministic decision stream re-dealt
  every innings so that particular six landed 4–2 the wrong way —
  forever, not as flake. Measured at N=48 the mechanic is emphatic
  (5.7 → 7.9 wkts/inn defending v launching, 40 of 48 seeds the right
  way); the test now runs eighteen seeds of its own with the
  measurement in its comment.
- **Server: 437/437** with `--test-concurrency=1`. The living fold,
  settles, transfers and world logic never see the captaincy code.
- **Replay determinism: 3/3** seeds bit-identical on re-run — every
  read, anchor and field slip is hashed from the match seed; there is
  no live RNG anywhere in the new channels.
- **calibration-check**: all bands pass; pinned-match fingerprint
  drift only (§8), not re-blessed.
- Manual orders remain law: a painted plan still overrides every
  captaincy channel (the aiPickBowler changes live inside the
  auto-path only, and the orders suite passes in full).

Not merged, not deployed, goldens held. The branch is a complete,
measured proposal awaiting review.
