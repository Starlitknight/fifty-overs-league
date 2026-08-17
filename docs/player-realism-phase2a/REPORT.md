# PLAYER REALISM PHASE 2A — BOWLING SPELLS + IN-MATCH RECOVERY

Engine change on branch `claude/player-realism-phase2a`, built from the
audit baseline `fccfd30` (docs/player-realism-audit). Two connected
mechanics in `engine/src/00-core.js`, nothing else touched:

1. **The continuation gate** in `aiPickBowler` — spells exist because a
   decision stands until something changes.
2. **Off-spell recovery** in `apply()` — an over at fine leg finally
   repays something.

Both carry runtime A/B levers (`__foSpellOff`, `__foRestOff`) and tuning
levers (`__foSpellMargin`, `__foRestR`, `__foRestFloor`); every constant
below was swept through those levers against the shipped build before
being frozen into source. Instrument: `tools/spell-probe.mjs`; raw
numbers: `spell-evidence.json` beside this file. Match samples are
paired-seed, N=150–800 as noted; ballDist-level numbers are exact.

**NOT MERGED. NOT DEPLOYED. Goldens and calibration NOT re-blessed.**

---

## 1. The laws, before and after

**Unchanged:** every accrual law from the audit — per legal ball the
striker gains `(1.75−st/100)/120 · ageTire · (keeper 1.04)` and the
bowler `(1.85−st/100)/74 · ageTire · (fast 1.08, fm 1.04)`; drinks ×0.62
once an innings; innings break ×0.5; the ballDist ramp at 0.12; the
pre-match word ladder; the between-match server law. ballDist itself is
untouched — not one probability changed for any given context.

**Old spell selection:** `aiPickBowler` re-ranked and re-rolled the slip
every over. Captaincy ≥92 always got rank 1; below 88 the top pick with
probability `1−0.85·(88−capt)/88`, else the 2nd–4th.

**New spell selection:** the ranking and the slip are identical, but
first: *if the man who bowled this end's previous over is still
available and scores within `FO_SPELL.margin = 8` of the top of the
ranking, he continues — for every captain alike.* Only outside the
margin is there a change point, where the old slip law applies
unchanged. Deterministic; no new dice.

**Old recovery:** none. The tank of a resting bowler was constant
between the two scripted cliffs.

**New recovery:** every legal ball, each member of the bowling side who
is neither the current bowler nor mid-spell (bowled this end's previous
over) recovers:

```
fat' = floor + (fat − floor)·(1 − 0.0165),   floor = 0.35 × his match peak
```

The peak (`M.fatPk`) is tracked at accrual; the floor makes rest unable
to erase a day's work. Batting-side players are untouched.

## 2. Why margin 8 (measured, N=220/cell)

Ordinary captain (40), balanced pitch, recovery on:

| margin | 1-over spells | 2 | 3–5 | 6+ | mean | longest (balls) | ≥36-ball share | conceded |
|---|---|---|---|---|---|---|---|---|
| OFF (audit) | 78.3% | 14.6% | 6.9% | 0.2% | 1.32 | 15.2 | 1.0% | 265.2 |
| 0 | 45.6% | 18.4% | 21.4% | 14.6% | 2.73 | 33.9 | 49.2% | 260.7 |
| 4 | 35.2% | 14.1% | 29.7% | 21.0% | 3.43 | 37.3 | 56.2% | 260.9 |
| **8** | **34.7%** | **6.4%** | **34.8%** | **24.1%** | **3.88** | **39.2** | **57.6%** | 261.4 |
| 12 | 35.2% | 3.7% | 33.9% | 27.2% | 4.14 | 40.5 | 60.6% | 261.9 |
| 16 | 28.1% | 5.9% | 28.8% | 37.2% | 4.54 | 42.1 | 75.3% | 265.1 |

The regime is broad and stable from 0–12 and cliffs at 16, where the
margin swallows the mid-overs spin bonus (+14) and three quarters of
bowler-innings run past 36 straight balls. 8 sits mid-regime: spells of
3–5 overs are the modal shape, one-over changes survive at the death
and at genuine tactical switches, and the elite captain's table (capt
95: 39.5% / 40.1% / 18.2%, mean 3.79) is *similar but not identical* —
he still breaks spells at better moments; he is no longer the only
captain who has spells at all. Most of the transformation arrives by
margin 0, which is the cleanest possible statement of the diagnosis:
the churn was the re-rolled slip, not the ranking.

Success criteria 1–3: **met** — one-over share 78%→35%, recognisable
spells at every captaincy, and the 36-ball fatigue ramp fires in ~58%
of bowler-innings (from 1%), i.e. the longSpell term is now a live
mechanic.

## 3. Why r = 0.0165, floor = 0.35 (exact)

Tank after a five-over spell (stamina 55, 0.569 at the break), by rest:

| law | 2 ov off | 5 ov | 10 ov | 20 ov | RPO on return (5 off) |
|---|---|---|---|---|---|
| none (audit) | 0.569 | 0.569 | 0.569 | 0.569 | 6.76 |
| r .008 fl .35 | 0.535 | 0.490 | 0.428 | 0.340 | 6.67 |
| **r .0165 fl .35** | **0.502** | **0.424** | **0.336** | **0.249** | **6.60** |
| r .030 fl .35 | 0.456 | 0.348 | 0.259 | 0.209 | 6.52 |
| r .0165 fl .20 | 0.487 | 0.390 | 0.282 | 0.176 | 6.57 |
| r .0165 fl .50 | 0.518 | 0.457 | 0.389 | 0.323 | 6.64 |

The chosen curve repays ~12% of the tank after two overs off, ~25%
after five, ~41% after ten, ~56% after twenty — first overs meaningful,
diminishing after, floored at 0.35× the man's worst point so an innings
never hands back a fresh bowler (criterion 5). r=.030 made ten overs
off nearly a reset; r=.008 made rest cosmetic.

**Stamina and recovery (§4 of the brief):** the candidate
stamina-scaled law (`r·(0.7+st/150)`) was played against the flat law
over a 7-over spell + 10 off across stamina 30–90: it moves the
returning tank by at most ±0.036 on top of the 0.22 separation the
accrual law already produces between stamina 30 and 90. Stamina already
acts three times (accrual, pre-match penalty, pre-match load); a fourth
helping bought no cricket the accrual does not already express, so
**recovery is flat in stamina** — exactly the "simplest realistic
model" the brief allows. High stamina still means: slower filling,
lower peaks, better return condition — see §5B.

**Bowling type (§5 of the brief):** no type term was added. The
existing laws (fast 1.08×, fm 1.04× accrual) plus conditions scoring
already produce the right shapes — see §4 below.

## 4. Spells by trade and surface (capt 60, N=220)

Mean spell / share of 6+-over spells:

| type | balanced | green | dry | flat |
|---|---|---|---|---|
| fast | 3.35 / 7% | 3.39 / 8% | 3.09 / 4% | 3.24 / 7% |
| fast-medium | 3.20 / 6% | 3.36 / 10% | 3.18 / 5% | 3.17 / 6% |
| medium | 3.17 / 7% | 3.33 / 9% | 3.07 / 5% | 3.18 / 7% |
| finger spin | 5.23 / 53% | 5.08 / 52% | **9.51 / 96%** | 5.13 / 52% |
| wrist spin | 5.28 / 54% | 5.41 / 57% | **9.74 / 98%** | 5.12 / 52% |

Quicks bowl 3–4 over bursts; spinners hold 5-over middle spells
everywhere and, on a turning deck, bowl through — nearly always the
full ten unbroken (§6E of the brief: emergent from the dry-deck +18
ranking bonus, no spinner exception written). The 96–98% on dry is at
the deterministic end — flagged in §9 as a watch item, not a defect:
long unbroken spin spells on turners are real cricket; their near-
inevitability here is the dry bonus dominating the margin.

## 5. The critical cricket tests

**A. Rest and return** (full 50-over manual plans so patterns are
exact; N=150; the new-ball quick studied):

| plan | engine | his econ | death RPO | tank at over 45 |
|---|---|---|---|---|
| 4 on, back at death | OLD | 4.84 | 6.51 ±0.42 | 0.189 |
| 4 on, back at death | **NEW** | 4.88 | **5.67 ±0.35** | **0.125** |
| death only 41–50 | OLD | 6.27 | 5.72 | — |
| death only 41–50 | NEW | 6.42 | 5.89 | — |
| 6 straight, done | OLD/NEW | 4.59/4.71 | — | — |
| 10 straight | OLD/NEW | 5.08/5.12 | — | — |

The headline of the phase: under the old engine a quick who bowled four
early overs came back at the death 0.8 RPO worse than a man saved
entirely for the death; under the new engine he returns within noise of
death-only freshness **while also having bowled the new ball**. Saving
a bowler for a later spell now has a genuine physical meaning
(criterion 6). Continuous 10-over spells remain the worst pattern —
recovery did not erase the cost of over-bowling.

**B. Stamina pair under natural management** (same quick at stamina
35 v 85, captain free): 8.71 v 8.83 overs/innings, economy 5.65 v 5.46,
longest spell 4.95 v 5.47 overs, peak tank 0.814 v 0.572. The
high-stamina man sustainably does slightly more work at better quality
— meaningful, not overpowering (criterion 7).

**C. Five v six bowlers, old v new** (6th = part-time seam 52; runs the
6th saves / win points, N=220):

| scenario | OLD | NEW |
|---|---|---|
| fresh, balanced | 7.5 runs / +4.3 pts | 1.7 / +1.6 |
| one weary quick | 6.7 / +8.9 | 0.0 / +0.7 |
| two weary quicks | 9.0 / +5.5 | **9.8 / +6.8** |
| green | 6.4 / +4.3 | 1.7 / −0.5 |
| flat | 5.8 / +7.3 | 4.1 / +5.5 |

The answer the brief asked for: **yes, the sixth bowler's value changes
once real recovery exists** — for a healthy frontline it collapses
(five bowlers can now manage their own legs), while a genuinely
compromised attack (two tired quicks) still buys full value from the
extra option. Five-v-six is now situational rather than an always-on
premium (criterion 8). This will eventually need the follow-up phase to
re-teach the Match-Day Coach, whose `SIXTH_BOWLER = 4.8` premium was
measured against the old engine (deliberately not touched here, §9).

**D. Captaincy re-measured** (powered pair, N=800): capt 20 v 95 =
263.7 v 260.5 conceded (−3.2 ±1.5) and 49.4% v 53.3% wins (+3.9 ±2.5).
Old engine: −3.7 runs, +7.8 ±4 win points across the same span. The
runs value is intact; the win-point value is roughly halved because a
captain now makes ~15 real decisions an innings instead of 50 —
decisions are rarer, each one lasts longer. Spell shape is essentially
captaincy-independent (capt 20: 34.9% one-over; capt 95: 40.0%), which
is the design goal: captaincy is *which* bowler at the change point,
never spell length itself (criterion 9). Bad captains' bad picks now
persist for a spell — visible as the conceded spread — which reads as
believable stubbornness rather than absurdity.

**E. Manual orders** (criterion 10): three filed full-innings plans
(7-over opening spell; 4 on / rest / 4 on; saved for the death)
executed **exactly, 40/40 innings each**, with the tank physics running
underneath (the death-saved man returns with a partly drained tank, as
in test A).

## 6. The scoring environment, old v new (paired, N=400)

| | runs/50ov | wkts/inn | all-out | PP RPO | mid RPO | death RPO |
|---|---|---|---|---|---|---|
| OLD | 266.2 ±1.6 | 6.90 | 35.7% | 4.77 | 5.09 | 7.09 |
| NEW | 264.4 ±1.5 | 7.13 | 35.9% | 4.85 | 5.04 | 6.98 |

Net: −1.8 runs (≈1 SE), +0.23 wickets, all-out rate unchanged, death
scoring down ~0.11 (death bowlers arrive fresher), powerplay up ~0.08,
long-spell wickets up. Small, explicable, and in the directions the
mechanics predict — the environment moved by about a third of a
calibration band width, not a regime change.

## 7. Test results

| suite | result | classification |
|---|---|---|
| engine `node --test test/*.test.mjs` | **486/487 pass** | the 1 failure is `replay.test.mjs` golden masters — ball-for-ball divergence is the *intended consequence* of changed bowler selection; NOT re-blessed (that is a review decision; the file's own header documents `tools/record-masters.mjs` + bench gate) |
| `matchday-coach.test.mjs` incl. test K (stamina/spell regression) | **pass** | the brief expected K to fail if a stamina × spell interaction entered `ballDist`; it did not — ballDist is untouched and recovery is a tank mechanic, flat in stamina. K is still asserting a true fact about the engine. |
| statistical engine suites (tuning, extras, fielding-contest, engine-room) | pass | environment shift (§6) stayed inside every band |
| calibration-check | see §8 | |
| server suite | see §8 | |

## 8. Calibration

<!-- CAL-RESULTS -->

## 9. Known limitations

1. **Dry-deck spinners bowl through almost deterministically** (96–98%
   of their spells 6+ overs). Real, but the margin never loses to the
   +18 dry bonus; if variety is wanted a later phase could let the
   partnership/variation term outrank a mid-spell spinner more often.
2. **Pavilion rest is still free-but-flat**: batting-side players
   neither accrue nor recover while padded up. Out of scope here; the
   innings break already covers most of it.
3. **Captaincy's win-point value roughly halved** (7.8→3.9 ±2.5) as an
   arithmetic consequence of fewer, longer-lived decisions. Reported,
   not tuned around; if review wants the old magnitude back, the
   natural lever is letting the slip also err on the continue/change
   call for poor captains (an "elite captains break spells at better
   moments" mechanic the brief explicitly permits) — not implemented.
4. **The Match-Day Coach now misprices two things it was taught from
   the old engine**: the sixth-bowler premium (4.8 runs vs a measured
   ~1.7 for healthy attacks) and, less so, endurance-blind spell plans.
   Deliberately untouched per the brief; needs the agreed follow-up.
5. The audit's own spell-distribution baseline carried a small
   instrumentation artifact (extras could split a measured spell; the
   engine's own `spellB` counter was unaffected and corroborated the
   churn finding). Fixed in `tools/realism-lib.mjs` in this phase; the
   OFF rows in §2 are the corrected baseline (78% one-over at capt 40,
   45% at capt 95, against the audit's 80%/51%).

## 10. Success criteria

1. ordinary captains bowl recognisable multi-over spells — **met** (§2)
2. one-over churn no longer dominant — **met** (78%→35%)
3. longSpell fatigue a real mechanic — **met** (1%→58% activation)
4. rest provides measurable partial recovery — **met** (§3, §5A)
5. recovery does not reset workload — **met** (0.35×peak floor; 10-straight still worst)
6. saving a bowler has real value — **met** (death RPO 6.51→5.67)
7. stamina meaningful, not overpowering — **met** (§5B)
8. five-v-six situational — **met** (§5C)
9. captaincy remains decision quality — **met with a caveat** (§5D: runs value intact, win-points roughly halved)
10. manual orders authoritative — **met** (40/40 exact)
11. calibration controllable — see §8
