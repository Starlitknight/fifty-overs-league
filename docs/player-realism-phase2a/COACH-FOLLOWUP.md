# PHASE 2A.1 — THE MATCH-DAY COACH RE-MEASURED AFTER SPELLS AND RECOVERY

Phase 2A changed the cricket underneath four of the Match-Day Coach's
calibrated assumptions. This follow-up re-measured each on the new
engine, changed the coach where the measurement said to, and re-blessed
the goldens ONCE for the integrated system. Same branch
(`claude/player-realism-phase2a`); instrument
`tools/coach-followup-probe.mjs`; raw numbers in
`coach-followup-evidence.json` and `golden-inspection.json` beside this
file.

Engine physics untouched throughout: FO_SPELL.margin, the recovery
constants, the fatigue laws, ballDist — all exactly as Phase 2A froze
them. The one engine-file change is a **pure refactor**: the accrual
and rest laws moved out of `apply()` into `foFatBatPerBall` /
`foFatBowlPerBall` / `foRestStep`, with `foFatProject` answering the
coach's planning question from the same law — proven byte-identical
against pre-refactor ball logs (three seeds, flags on and off, six
IDENTICAL results). No copied constants exist in
`13-matchday-coach.js`; a future fatigue change updates one law.

---

## 1. Sixth-bowler value by frontline fatigue state (measured, N=220)

Runs the sixth option saves, by frontline state × option quality:

| frontline state | weak (40) | marginal (52) | strong (64) |
|---|---|---|---|
| A all rested | 1.3 | 1.6 | 10.7 |
| B one mildly tired | 0.5 | 1.0 | 13.2 |
| C one weary | 1.9 | 6.9 | 17.8 |
| D two mildly tired | −0.7 | 3.4 | 15.7 |
| E two weary | −0.1 | 6.6 | 16.8 |
| F three weary | −0.4 | 5.9 | 21.2 |

The strong-64 column is him bowling ~10 overs **on merit** — priced by
the coach's fifty-over cost allocation already, not by the premium. The
insurance signal is the marginal column: ~1.6 runs fresh rising to ~6
under real workload stress. The weak column is noise around zero, which
`optionWeight` (unchanged) already enforces.

## 2. Seventh bowler (measured)

0.0 runs with a healthy six-option attack; +4.9 ±2.2 with two weary
quicks — where the sixth-term's need slope is already paying for the
same stress. Fresh-negligible is confirmed; **`SEVENTH_BOWLER` stays a
token 1.5**, deliberately asymmetric with the sixth.

## 3. The workload-insurance formula

```
old:  bowl += SIXTH_BOWLER(4.8) × optionWeight(sixth)
new:  bowl += (S6_BASE(2.0) + S6_NEED(4.0) × needLoad) × optionWeight(sixth)
      needLoad = Σ foFatigueLoad of the five men the allocation just
                 priced (already on every card as c.load)
```

Least-squares through the six measured marginal-quality states
(loadSum 0→1.30 maps to 1.6→5.9 runs). No thresholds, no role names:
quality × need, on inputs the coach already had.

**Behavioural proof** (probe §6, a 12-man pool where exactly one of
{56-level spare bat, sixth option} must sit out):

| frontline | sixth 42 | sixth 52 | sixth 58 |
|---|---|---|---|
| fresh | spare bat | spare bat | SIXTH |
| one weary | spare bat | SIXTH | SIXTH |
| three weary | SIXTH | SIXTH | SIXTH |

Sometimes batting depth, sometimes bowling depth; no canonical shape.

## 4. Captaincy re-priced: CAPT_RUNS 0.18 → 0.10

Measured slope, capt 40→88, N=350/cell (probe §5):

| attack | runs/pt | win pts per +10 |
|---|---|---|
| balanced (uniform 55s) | −0.01 | 0.2 |
| pace-heavy | 0.104 | 0.1 |
| spin-heavy | 0.124 | 1.3 |
| one weary quick | 0.111 | 1.8 |
| six options | 0.018 | 0.5 |

Captaincy is worth ~0.10–0.12 runs/pt where the attack is heterogeneous
enough for a wrong pick to cost something, and ~nothing where the
options are interchangeable. Real squads are the heterogeneous kind:
**CAPT_RUNS = 0.10** (the cluster, not the average with the degenerate
cells). The new ~3–4 run / ~4 win-point captaincy span is believable
cricket — fewer, longer-lived decisions — and the engine was not touched
to restore the old +7.8 (per the brief's §8).

## 5. Shirt test, before and after

Captaincy-99 middle-order bat vs the marginal front-line bat he
displaces (planMatchDay, 12-man squad):

| batting deficit | old coach (0.18) | new coach (0.10) |
|---|---|---|
| −8 | picked | picked |
| −12 | picked | picked |
| −16 | picked | **left out** |
| −20 | picked | left out |
| −26 | left out | left out |

The crossover moves from −20/−26 to −12/−16. A great captain still
breaks close calls; a materially inferior cricketer no longer buys a
place with an armband.

## 6. The opening burst (measured, N=200/cell)

Painted burst 0/2/3/4/5/6 overs each, by surface — runs conceded /
win% / openers' death overs under the captain:

* **green/overcast**: painting the swing pair saves ~5.7 runs
  (224.2 → 218.5); two overs paint as well as six — the value is naming
  the right PAIR, not the length.
* **balanced / green(sun) / flat**: painting saves nothing (0-paint was
  marginally the best row everywhere) and costs flexibility — unpainted,
  the captain brings his openers back at the death 4.2 overs a match
  against 2.9 painted.

**Change: `burst = bite ? 6 : 0`** (was `bite ? 6 : 3`). Where the ball
does nothing, Auto now paints no new-ball overs at all and the plan
says so ("new ball: left to the captain"). Phase 2A's continuation gate
is what makes this safe: the captain holds sensible spells by himself.

## 7. New-ball men at the death

The old coach categorically excluded openers from the death slots — a
correct rule about an engine where rest repaid nothing. Measured on the
new engine (probe §4): a four-over opener projects to a tank of
0.10–0.16 at over 47 — **under the 0.12 ramp** — and plays the death
dead level with a rested closer (RPO 7.3–7.4 both ways across five
profiles); only a pre-tired man (projected 0.27) or a stamina-25 man
after a six-over burst (0.38) still rightly ranks behind a fresh equal.

**Change:** the death pair is now chosen by scoring every candidate *as
he will be at over 47*: his painted overs run through `foFatProject`
and fed to ballDist through `ctx.bowlFat` — the same channel the match
charges. No categorical rules, no coach-side fatigue copy. Tests K
rewritten to assert both directions (the stamina-90 opener returns; the
stamina-25 twin ranks behind his fresh equal).

## 8. Example Auto plans, before → after

Real squad (Yorkshire, `tools/matchday-selection.mjs`):

* **balanced/sunny** — OLD: 3-over burst painted for both openers.
  NEW: "new ball: left to the captain — conditions do not separate the
  seamers"; only the death is painted; 46 overs open.
* **green/overcast** — OLD: 6-over burst; death barred to the openers,
  handed to rested closers. NEW: same 6-over burst for the swing pair,
  and the death goes to "Zak Wilson and Daan van Dijk … returning —
  projected fresh enough": the opening pair, back for 47–50, exactly
  the plan real sides bowl on a seaming deck.

## 9. Random-squad XI accuracy / regret (role bias)

`tools/matchday-regret.mjs`, 24 generated squads × 5 conditions, 60
paired fixtures a comparison, on the new engine and new coach:

| swap class | n | coach won | edge | z | regret when wrong |
|---|---|---|---|---|---|
| ALL | 145 | **75.9%** | +7.23 ±0.78 | 9.3 | 5.4% |
| specialist → all-rounder | 11 | 72.7% | +6.36 ±2.31 | 2.8 | 2.8% |
| all-rounder → batsman | 23 | 82.6% | +7.79 ±2.09 | 3.7 | 7.1% |
| all-rounder → bowler | 111 | 74.8% | +7.20 ±0.89 | 8.1 | 5.5% |

The pre-change benchmark was ~76% with no statistically meaningful role
asymmetry; the new coach reads 75.9% with the three rows symmetric
within their errors — **the workload-sensitive sixth-option value did
not reintroduce an all-rounder bias**.

## 10. Golden / replay strategy — the §12 proof

`golden-inspection.json`, all nine master fixtures:

* **Flags OFF (old physics), new coach: every master reproduces
  BIT-FOR-BIT** — toss identical, every ball identical. The coach's
  re-pricing changed no master XI, and its plan changes never reach
  headless fixtures (bowling plans apply through filed orders only). So
  every golden difference is attributable to the two Phase 2A engine
  mechanics and nothing else; the toss and random-stream invariants
  hold everywhere.
* **Flags ON: all nine diverge** at balls 18–100 — early
  bowling-change points, as the continuation gate predicts.
* **One integrated re-bless**: `tools/record-masters.mjs` re-recorded
  the nine masters (4,385 balls) on the finished system, and the full
  `tools/calibration.mjs` run regenerated `engine/calibration-golden.json`
  — once, for engine + coach together.

## 11. Tests and calibration

**The re-blessed calibration golden** (full 3,334-match cells, the one
integrated regeneration):

| cell | par | all-out | boundary %/ball | extras/inn |
|---|---|---|---|---|
| international | 276.8 → 274.4 | 29.6 → 30.9% | 8.85 → 8.77 | 22.5 → 22.0 |
| flagship clubs | 254.8 → 250.3 | 30.2 → 30.9% | 7.13 → 7.03 | 24.2 → 23.7 |
| division two | 238.9 → 234.2 | 24.5 → 26.6% | 5.16 → 5.07 | 29.5 → 28.6 |
| intl v div two | 265.5 → 261.9 | 30.7 → 33.1% | 6.74 → 6.63 | 26.7 → 26.2 |

Par down 2.4–4.7 (bowlers arrive fresher at every stage), all-out share
up 0.7–2.4 points (long spells finally cost their bowlers something),
boundaries ~1% relative lower, extras marginally down, the pyramid
ordering intact. The pinned fingerprint moves 362/8 → 365/6. All four
real-ODI bands still hold, and `calibration-check` **PASSES** against
the regenerated golden.

**Suites** (final build, re-blessed goldens): engine **488/488**,
server **437/437**, `calibration-check` **PASS**, replay goldens
**PASS**, Match-Day Coach suite **32/32** (including the rewritten K
tests asserting both directions of the projection). Two test
expectations moved with the behaviour and were root-caused before they
were touched:

* `fieldable-xi`'s ">80% flattered" count fell from 39 to 38 of its
  48 fixed squads. Traced squad by squad: generation is deliberately
  sim-aware (`foQsSquadStrength` fits a squad's strength through
  `pickXI`, i.e. through the coach), so the re-pricing legitimately
  nudged four marginal squads by one skill point. The protected
  property ("the old rating flattered nearly every club") holds at
  79.2%; the line moved to 75%.
* `world-p3` test 021: one seeded cup semi-final now ends in a TIE on
  the new engine. The bracket's own law (comps.mjs: "a tie in a
  knockout goes to the higher seat, which is what a seeding is for")
  advanced the right club; the test assumed winners always exist and
  now asserts the law instead.

**A stale gate, reported and not chased:** `tools/engine-bench.mjs`
fails its target bands on this branch — and fails them **worse on the
audit baseline** (balanced par 339.1 old v 319.3 new against a [252,
292] band; old wickets 5.83 under its 6.0 floor now inside at 9.25).
The bench's bands predate the current calibration contract and the
world it measures; Phase 2A moved every number *toward* them. The live
contract is `calibration-golden.json` + `calibration-check`, which
passes. Flagged for a separate decision; nothing in this phase touches
those bands.

## 12. Known limitations

1. `foFatProject` projects the PAINTED overs only — overs a captain
   later hands a man are unknowable pre-match, so death projections for
   unpainted bowlers assume rest. Stated in the helper's header.
2. The captaincy price is one number for a spread the engine pays
   between ~0 and 0.12 runs/pt depending on attack heterogeneity; a
   squad-aware price would be a second model for a third-order effect.
3. The insurance need reads pre-match load only; in-match stress that
   develops on the day is the captain's problem (and now his tools —
   rotation and recovery — actually work).
4. The regret/role-bias instrument is sampled at 24 squads × 60 pairs;
   its per-class SE is a few points and conclusions are directional.
