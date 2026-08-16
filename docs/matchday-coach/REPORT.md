# The Match-Day Coach

**Branch:** `claude/matchday-coach-redesign` — not merged, not deployed.

A single authority, `planMatchDay()`, now picks the side, orders the batting,
chooses the keeper and captain, drafts a deliberately partial bowling plan and
calls the toss — for unmanaged clubs, for the Auto button, for the engine's own
fallback, and for injury/absence cover. It does this by asking the **existing**
ball model what a cricketer is worth today, on this pitch, under this sky. No
new simulation, no invented conditions coefficients, no engine constant changed.

---

## 1. What the audit of `main` actually found

The brief described the problem; the code was worse than the description in one
respect and better in another. What was on `main` at the start:

| Where | What it was | Blind to |
|---|---|---|
| `pickXI()` in `00-core.js` | best-batting keeper, five highest `threat+control`, best remaining bats, sorted by `mpos` | pitch, weather, form, fatigue, bowling subtype, vsPace/vsSpin, stamina, hands, captaincy |
| `suggestOrders()` (Auto) | `pickXI` in `mpos` order; captain = `xi[0]`; four template spells, identical at both ends on every pitch | everything above, plus the conditions |
| `foSmartBowling()` (browser overlay) | a genuinely good conditions-aware **bowling** planner | selection — it never touched the XI |
| `probableXI()` (matchday page) | a line-for-line copy of `pickXI` | as `pickXI` |
| `foTodayFit()` | a **third** conditions model with its own fatigue table | — |
| bots (`tick.mjs`) | doctrine only: four numbers describing how a club likes to bat | the entire selection question |

So there were five separate opinions about one question, and the one that
actually chose the eleven was the least informed of them.

Two structural faults the brief did not name:

- **Form and fatigue were applied after selection.** `withForm()` folds a
  player's form swing and fatigue penalty into `_batAdj`/`threat`/`control` —
  but it ran on the *already chosen* eleven. A shattered star was picked as
  though fresh and only then made tired.
- **The bowling planner and the selector disagreed by construction.**
  `foSmartBowling()` knew a green top wanted seam; `pickXI` picked the side
  that would bowl on it without knowing what a green top was.

The archetypes are `blade`/`finisher`/`rock`/`greybeard`, and `ARCH_DOCTRINE`
carries only `phaseIntent` — **not** the "Pace Battery / Spin Circus" style
identities the brief hypothesised. Doctrine is therefore treated as a batting
style prior and a marginal tilt, which is what it actually is.

## 2. The governing idea: there is no second cricket engine in here

The coach prices nothing itself. It calls

```
ballDist(bat, bowl, phase, faced, intent, rrDef, pitch, field, over, ctx)
```

— the real ball model — over a fixed eleven-point grid of overs weighted the
way a fifty-over innings spends them, against a reference opponent built from
the squad's own median. `ballDist` is pure (it reads no match state), which is
what makes this possible at all.

Every conditional effect the engine has therefore arrives **for free**: pitch
class, bowling-subtype tilts, new-ball swing, grip and wear, the death,
`vsPace`/`vsSpin`, temperament, rotation, power, talents, keeping, fielding.
When somebody retunes a ball, the coach's opinion moves with it and stays
correct. There is no `+10 on green` anywhere in the file, and there is no
`3 pace + 2 spin` rule — the search is compositional and the mix falls out.

`tools/matchday-probe.mjs` is the measurement behind every claim in the file's
comments. What it said (wickets per over against a median batsman):

```
balanced   fast .176  fastMed .138  medium .115  finger .112  wrist .165
green      pace +.084/+.074/+.045      spin -.008 .. -.011
green+overcast  fast .319  fastMed .282  — against wrist spin .155
dry        spin +.072/+.085/+.085      pace +.001
cracked    wrist +.054  finger +.026  fast +.030      (wrist-spin bounce)
slow       everything +.002..+.013, but runs −0.24..−0.37
flat       everyone −.03..−.05 wickets, +0.38..+0.50 runs
dew later  in the CHASE only: finger spin −.025, wrist −.008
```

The `slow` row is why the coach has **no** "slow ⇒ pick spin" rule: a slow
pitch is an *economy* pitch, and `medium` (+.009) gains on `fastMedium` (+.002)
because of the engine's cutter tilt. The folk rule would have been false.

## 3. Six bugs the measurements caught

Every one of these was found by measuring, not by reading. All six were in the
coach; none required touching the engine.

1. **Negative bowling value.** `bowlValue = w×25 − r` is negative for *every*
   bowler (a median bowler measures 0.138 w and 6.02 r an over → −2.57), so the
   optimiser minimised bowlers and fielded three frontline seamers out of seven
   available. Rewritten as a **cost**: `bowlCost = r − w×WKT_RUNS`, and fifty
   overs are allocated cheapest-first.
2. **Captaincy bought a place in the side.** At `CAPT_RUNS = 0.55` the armband
   was worth 27 runs across the span, and a level-20 player with captaincy 99
   made the eleven. The slip law in `aiPickBowler` is `slip = (88−capt)/88`,
   zero at 88 and never worse than fourth choice; measured, that is worth about
   **7 runs** over an innings. `CAPT_RUNS` → 0.18 with a ceiling at 88.
3. **An invented workload coefficient.** A `workload × overs × 0.5` term — my
   own invention, exactly what the brief forbids — cost a tired star 26 runs
   and benched the club's best bowler. Deleted and replaced with the engine's
   own channel: `ctx.bowlFat = today._fatLoad`.
4. **`RPD_CAP` too low to discriminate.** At 95, every good batsman hit the
   ceiling (the probe measures a *median* batsman at 63.9 runs per dismissal on
   a flat pitch), so the side could not tell its best bat from its fifth and
   dropping a fine number five looked free. Raised to 220, where it clips
   genuine absurdities and nothing else.
5. **A conditions-blind keeper.** A constant `KEEP_SLOPE` priced the gloves the
   same on a road as on a turner. Replaced with a measurement through the ball
   model's own `ctx.keeperQuality`/`keeperCatch`/`keeperStump`: worth **35 runs
   on flat, 56.4 on dry, 58.6 on green**.
6. **A ridiculous tail — the brief's own prohibition, committed and then
   caught.** On `green/seed 7` the first cut dropped a batsman worth 66 to fit a
   **seventh** bowler who never bowls (the best five take all fifty overs),
   leaving a tail of 39/25/26/33/10. Both sides did it and the fixture finished
   **49 all out against 50 for 4**. Fixed with a depth charge: a side pays for
   every seat inside its top seven that a recognised batsman is not filling,
   where "recognised" is measured against the side's own best man so it means
   the same thing to a great club and a poor one. After the fix the same squad
   fields **six** bowlers with a real batsman at seven, and the A/B over those
   fixtures went from **150.3 runs / 8.4 wickets** to **175.8 / 7.4**.

## 4. Fairness: what a bot is allowed to know

A bot may read its own club to the bone. About the opposition it may read only
`foMdcPublicScout()` — the coarse bands the scout page already shows a human:
batting depth, attack mix, and the "uneasy against turn / can be rushed by
pace" reads. It never receives a rival's raw skills; `tick.mjs` passes
`host.publicScout(oppSide.players)` and nothing else, and test H asserts that a
rival's raw attributes can be mutated wildly without moving the plan by a name.

The tilt is capped (`OPP_TILT = 0.35`) so a scouting read can decide a close
call and can never overturn a real gap in quality — also asserted.

**A bug fixed during this pass:** the browser's Auto path asked for
`App.pending.opp.players`, a field that has never existed on `App.pending`
(it carries `oppIx`). The scout therefore arrived as `null` and the client
planned every match blind while the server did not. Now reads
`GD.teams[App.pending.oppIx]`.

## 5. Fatigue and form — and the thing the coach is not allowed to see

`withForm()` folds two things into a player: a **visible** form shift
(`foFormShift`, the arrow a manager can see) and a **hidden** per-match noise
term (`CAL.form_amp`). The coach reproduces only the visible half:

```
_batAdj  = formShift − fatiguePenalty
bowlAdj  = formShift × 0.72 − fatiguePenalty × 0.92
```

The hidden noise is never consulted. Letting the coach read it would be letting
the coach see the future, which the brief forbids and which would also make
selection unfalsifiable.

Fatigue is priced as **replacement value**, not as a flat penalty: a tired man
loses a close contest, and an elite tired star still beats a poor fresh reserve
(test B). Measured, the engine's fatigue channel is worth 0–10.5 skill points —
a batsman goes 43.5 → 33.8 runs per dismissal, a bowler 0.138 → 0.123 wickets
per over.

## 6. The search

Hard laws first: eleven men, a genuine keeper, at least five bowling options.
`C(15,11) = 1365` is cheap, so the search is **exhaustive** up to a squad of 24
(`FO_MDC_EXACT_MAX`) and falls back to a pruned search above that. An illegal
squad — no keeper, four bowlers — still gets the best available side rather
than nothing (`bestAny`), because a club that cannot field a legal eleven must
still be able to play.

Scored: batting (expected runs before dismissal × the balls that slot faces),
bowling (fifty overs allocated cheapest-first, in the *cost* currency),
keeping, fielding, captaincy, all-round value, the depth charge, and a small
doctrine tilt.

## 7. The bowling plan is deliberately partial

Auto paints the overs it is surer of than the captain — the new ball, the
death, a turning middle — and leaves the rest open. `aiPickBowler` gets them.
A fully painted fifty is usually the *worse* sheet, because it deletes
captaincy as a skill: an over left open is an over the captain can react in.

The orders page said **"Only 18/50 overs assigned - AI fills gaps"**, in the
warning colour, which tells a manager he has failed to finish a form. It now
says

> **Coach has specified 18 overs · captain adapts the remaining 32**

and travels in a `notes` channel, not `warns`. A double-booked over is still a
fault and still warns. A fully covered sheet reads "50/50 overs planned · every
over is yours".

## 8. The toss

`tools/matchday-toss.mjs` plays every fixture **both ways from the same seed**
(A bats first, then B bats first) so any strength difference between the clubs
cancels exactly, and counts how often the side batting first won. 36,000
matches, 1,500 pairs a cell, neutral ground, error bars computed over *pairs*
rather than matches because the two runs in a pair are not independent.

```
pitch     weather      bat-1st %   SE     verdict
balanced  Sunny          53.00    0.80    BAT
flat      Sunny          52.88    0.69    BAT
green     Sunny          47.65    0.82    BOWL
dry       Sunny          57.05    0.85    BAT      <- the largest edge anywhere
slow      Sunny          52.90    0.79    BAT
cracked   Sunny          54.55    0.85    BAT
twoPaced  Sunny          52.18    0.79    BAT
green     Overcast       47.00    0.87    BOWL
green     Humid          48.48    0.85    no measurable edge
green     Misty          46.30    0.84    BOWL
dry       Dew later      51.07    0.85    no measurable edge
balanced  Drizzle        54.88    0.78    BAT
POOLED                   51.50    0.24
```

**The measurement killed two rules the coach was carrying, both of them mine
and both of them folklore dressed as a coefficient.**

- *"Swing weather is a first-innings weapon, −10 points."* False, or at least
  invisible. The four green cells — sunny, overcast, humid, misty — land
  between **46.30 and 48.48**, and the largest gap between any two of them is
  2.2 ± 1.2 (z = 1.8). The green top is the signal; the sky above it is not.
  The rule is **deleted rather than shrunk**, because a coefficient nobody has
  measured is exactly the second cricket engine this work exists to avoid.
- *"Dew makes defending a total the losing half of the deal, −35 points."*
  Right in sign, wrong by a factor of six. Dry with dew later measures **51.07**
  against dry in the sun at **57.05** (−5.98 ± 1.20, z = 5.0): dew turns the
  strongest bat-first pitch in the game into a coin flip. It is the only
  weather term that survives, and it is a large one.

**And four pitches are one pitch, as far as the toss is concerned.** balanced
52.88, flat 52.90, slow 53.00 and twoPaced 52.18 are mutually
indistinguishable. Writing four numbers down would be four decimal places of
noise pretending to be cricket, so they are pooled at **+2.74 ± 0.4** — one
measured band that says BAT on all four. Green is likewise pooled across all
four skies at **−2.6 ± 0.4**.

**Is the edge just one tuning constant?** No, and this was bisected rather than
argued. Zeroing the entire chase model (`chase_risk`, `chase_four`, `chase_six`,
`chase_dot`) and re-measuring moved the pooled bat-first share from 51.50 to
**52.56** — the *wrong* way — while second innings gained 10–19 runs. The
chase-pressure model costs a chasing side runs in already-lost causes and
roughly zero wins. The bat-first edge is emergent, not a constant anybody can
retune away.

Home advantage is deliberately absent, and that is measured too: `--home` on
the same matchup gave 54.33 ± 2.05 against 56.08 ± 1.92 neutral — no measurable
difference.

**One honest caveat carried into the code.** The table is an average over four
squad match-ups, not a law. A single matchup on balanced/Sunny measured
56.08 ± 1.92 against the four-matchup 53.00 ± 0.80 — suggestive (z = 1.5) but
not established. A side's own balance may move the right answer further than
the pitch does; that is the next thing worth measuring if the advice ever
matters more than it does today.

The whole run was also **reproduced on two different engine builds** (one
predating the coach being wired into `pickXI`, one after) — 72,000 matches
total, every cell agreeing within ~1.7 points with no sign flips.

The RNG is **untouched**. `aiTossDecision()` still draws the coin first, so the
random stream never shifts, and only then consults the filed sheet's
`tossDecision`. This is the same channel a human's saved orders already used.
Golden masters confirm it: with the coach on, the toss call is identical in
**9 of 9** fixtures.

## 9. Manual orders are still the law

A filed sheet naming eleven real players including five bowlers wins outright
and never reaches the coach — that branch is untouched and sits above it in
`pickXI`. A batting or bowling order cannot smuggle in a twelfth player: the
order is re-derived from the filed XI, and test I asserts it.

For an absent player, `coverSheet()` replaces the missing man and **only** the
missing man; it never re-picks the side. What changed is *which* replacement:
the bench used to be ranked on raw card rating (the same number whatever the
pitch), so a shattered seamer covered for an absent seamer on a turning pitch
because his card said 71. Where the caller can supply today's conditions the
bench is now ranked by the coach's own cards. Without that context the old
rating order stands, so every existing caller keeps its behaviour.

## 10. One engine, two hosts

`13-matchday-coach.js` is an engine fragment concatenated into `shell.html` by
`build.sh`. The server reaches the *same* built code through
`enginehost.mjs` (`__svcPlanMatchDay`, `__svcPublicScout`), so there is exactly
one implementation. There is no approximate selector in the browser and none on
the server.

`planMatchDay` is pure: no clock, no randomness, no network, no mutation of the
squad. Test J plans the same fixture a hundred times and asserts a
byte-identical result, and asserts the squad is unchanged afterwards.

**Both hosts carry the bisect handle.** The engine has `__foCoachOff` inside a
test VM; the World Service now has `FO_COACH_OFF=1`, which puts the founding
selector back in the host *and* stops `tick.mjs` filing coached sheets for
unmanaged clubs. That matters because "did the coach do this?" gets asked of
server outcomes — a club's bank, a league table — at least as often as of engine
ones, and CLAUDE.md is explicit that the question is settled by turning the term
off and re-measuring rather than by reasoning about it. It ships disabled.

## 11. Tests

```
node --test 'test/*.test.mjs'                        479 tests, 479 pass, 0 fail
cd server && node --test --test-concurrency=1 ...    437 tests, 436 pass, 1 fail
node tools/calibration-check.mjs                     PASS
node --test test/replay.test.mjs                     PASS
./build.sh                                           clean
```

`test/matchday-coach.test.mjs` — 23 tests, matrix A–J, all passing.

### The one failing test, and why I have not touched it

`server/tests/world-p3.test.mjs` — *"016: the nets, the face and the money all
belong to the world"* — fails on an **economy** guard:

```
nobody near the floor after a fortnight of cricket: slot 7 $-1,402,900
(the whole table: 3.72 2.99 1.10 0.74 0.48 1.72 1.20 -1.40 2.54 3.89
                  2.02 1.41 1.42 2.72 1.61 2.09)      [$m]
```

It is the coach's doing — bisected, not guessed. A new `FO_COACH_OFF=1`
handle (§10) puts the founding selector back across the whole World Service:

```
FO_COACH_OFF=1 node --test tests/world-p3.test.mjs    27 pass, 0 fail
             node --test tests/world-p3.test.mjs      26 pass, 1 fail
```

**But it is not an economic regression, and that was measured too.** The worry
worth having is that a better selector helps whoever already has the better
squad, so weak clubs lose more consistently and their gate and prize money
drain away. Over a double round-robin of sixteen clubs of varied strength, 240
matches each way, the opposite is true — the coach very slightly *compresses*
the league, because a weak club has more to gain from fielding its best
available side than a strong one does:

| | coach OFF | coach ON |
|---|---|---|
| sd(win rate) | 0.1829 | **0.1794** |
| worst club | 16.7% | **23.3%** |
| bottom three | 26.1% | **26.7%** |
| top three | 78.9% | 77.8% |

So: one club, in one seeded world, 12% past a guard — while the other fifteen
sit between $0.48m and $3.89m in the black, and the companion assertion
("most treasuries still in the black", ≥10 of 16) passes at 15 of 16.

The guard is also **stricter than the property it names**. Its own comment says
a fortnight "must never drive anybody to the administration floor" — and that
floor is **−$2.5m**. Kent at −$1.40m is 56% of the way to it. The threshold is
hard-coded at half the floor.

I have deliberately **not** moved it. The era-2 economy was frozen and closed by
explicit instruction, and quietly relaxing an economy guard so a selector branch
goes green is precisely the "blindly re-bless" move this brief forbids. Whether
a guard calibrated against one selector's results should move when the selector
improves is the owner's call, not mine. What I did change is the failure
*message*: it used to say "nobody near the floor" and print no numbers at all,
so answering "by how much?" cost a full twenty-minute re-run.

Two existing tests were changed, both with the measurement written into the file:

- **`test/fieldable-xi.test.mjs`** asserted that `server/ratings.mjs`'s
  `fieldableXI` port and the engine's `pickXI` return the *identical* eleven.
  They now deliberately differ: a club's published **strength** must be
  conditions-free (a ranking that moved with next Sunday's forecast would be a
  forecast, not a ranking) while the coach picks for a pitch and a sky. Rewritten
  to assert what must still hold — measured across 48 generated squads, the two
  elevens share **8 to 11 men (median 10)**, and the coach's side carries a
  slightly *lower* mean card rating (median −727) precisely because it buys
  cricket rather than cards. If that sign ever inverted, the coach would have
  become a card-sorter again, and that is now the assertion.
- **`test/extras-rate.test.mjs`** failed twice, for two different reasons, and
  only the second was interesting.
  - Its sanity floor was 150 runs an innings — three tenths of a run below what
    the founding selector actually produced over those fixtures, so *any*
    selection change was going to trip it. Moved to 120, where it only ever
    catches a broken engine.
  - Then the extras **share** read 11.02% against a ceiling of 11. That looked
    like the coach had changed how the world gives runs away — and it had not.
    The file played 24 innings and asserted a percentage to two decimals.
    Re-measured over 120 innings the same quantity is **10.10%** with the coach
    and **9.70%** without, both well inside the band; the per-delivery rate
    barely stirs (6.62 → 7.04 extras per 100 balls). The calibration gate, at
    1,200 matches a configuration, agrees: extras per innings went 22.56 → 22.35
    against a golden of 22.37, which is nothing.
    What actually moved is how long an innings lasts — 242.4 legal balls became
    245.4, and 165.4 runs became 171.2 — and extras are per-delivery events. The
    fix is a sample that can resolve what the guard is guarding (ten seeds a
    cell, not two), **not** a wider band.

## 12. Golden masters and the calibration contract

**Neither was re-blessed on faith.** `tools/matchday-goldens.mjs` and a new
`CAL_COACH_OFF` pass-through in `tools/calibration.mjs` answer the only question
that matters: *did the ball model change, or did only the selection?*

`__foCoachOff` puts the founding selector back inside the same build — not an
older build, which is the only comparison that means anything.

```
GOLDEN MASTERS — 9 fixtures
  coach OFF reproduces the recorded master : 9/9   <- ball model, toss and tuning UNTOUCHED
  coach ON  reproduces the recorded master : 0/9
  toss call unchanged with the coach on    : 9/9   <- the toss RNG draw is untouched

CALIBRATION (300 matches/cell)
  CAL_COACH_OFF=1 node tools/calibration-check.mjs   -> PASS
  node tools/calibration-check.mjs                   -> 2 breaches (below)
```

Every fixture uses **auto selection** (`ordersMap` is empty in both harnesses),
so all nine were eligible to move, and all nine did. The squads are 16 men;
per side the coach changes **one or two** names and rewrites **4 to 8** batting
positions — for example on `dry`, `Ruben de Vries` (spin) comes in for
`Joost Visser`; on `green/Overcast`, `Pieter de Boer` comes in and
`Mitchell Whitfield` goes out. Full per-fixture detail in `goldens.txt`.

The calibration breaches were exactly two:

```
international rr.powerplay: 5.36 vs golden 4.85 (tol 0.5)
pinned-match fingerprint changed: 352/4 vs golden 373/6
```

And the shape of the change is the same in all four cells (`calibration.txt`):

| | intl | flagship | div 2 | intl v d2 |
|---|---|---|---|---|
| first-innings mean | +3.8 | +3.2 | +1.9 | +1.7 |
| **rr powerplay** | **+0.51** | **+0.40** | **+0.30** | **+0.28** |
| rr middle | +0.01 | −0.02 | +0.06 | +0.05 |
| rr death | −0.16 | −0.02 | −0.30 | −0.24 |
| all-out share | +0.011 | −0.036 | −0.023 | −0.025 |

Totals barely move. The powerplay rate rises and the death rate falls in *every*
cell: the coach opens with men who can open, so runs arrive earlier rather than
in greater number. That is the batting order, and it is the intended effect.
Every ODI band (`ODI_PAR`) still passes with the coach on, and the pyramid still
points the right way up.

**Both goldens were then re-recorded**, and both gates now pass:

```
node tools/record-masters.mjs      -> blessed 9 masters (4299 balls)
node tools/calibration.mjs         -> 13,336 matches, 3,334 a cell
node tools/calibration-check.mjs   -> PASS
node --test test/replay.test.mjs   -> PASS
```

`engineVersion` is deliberately **not** bumped past `v3`: that string names the
ball model, and the ball model did not change. The golden's own `note` field
now records the coach, the `CAL_COACH_OFF=1` proof and the old fingerprint, so
the next person to see this file drift bisects it the same way instead of
guessing. See §17 for what an owner should check before accepting the re-bless.

## 13. What it costs to run

The coach measures every man in the squad against the ball model, so it is not
free, and the first wiring was careless about how often it was asked.

```
planMatchDay, one call            ~28 ms   (flat in squad size 13→26:
                                            the per-player measurement
                                            dominates, not the search)
one match, coach OFF                66 ms
one match, coach ON, first cut     200 ms   <- pickXI asked the SAME question
                                              14 times in one fixture
```

Fourteen calls, for two sides. `pickXI` is asked by the resolver, by the
fielding side, by the scorecard, and the coach re-measured the whole squad
every time. The answer is now cached on `M` for the life of the match, which is
both faster and more correct — a side picks one eleven and then plays it — and
dies with the match, so a squad that changed between fixtures is re-measured.

On the server a bot's plan is computed once in `tick.mjs` and filed as a sheet,
so the engine then takes the fast filed-sheet branch: **one** plan per side per
fixture, roughly `+56 ms` on a match, which is the feature itself rather than
overhead. A world tick settling nineteen nations pays a few seconds more.

## 14. What still speaks with its own voice

`foSmartBowling()`, `probableXI()` and `foTodayFit()` were the other three
opinions found in the audit. They are not yet folded onto the coach. That is
deliberate scope control, not an oversight: `probableXI()` is a display of a
*likely* side on the matchday page and folding it in changes what a page shows
rather than what a match does, and `foSmartBowling()` is a good planner whose
merger deserves its own measurement. Both are listed here so the next pass
starts from a known position rather than rediscovering them.

## 15. Files

| File | |
|---|---|
| `engine/src/13-matchday-coach.js` | **new** — the coach, ~900 lines |
| `engine/src/manifest.txt`, `engine/shell.html` | fragment registered as `FO_ENGINE_BLOCK_13` |
| `engine/src/00-core.js` | `pickXI` coach branch + `__foCoachOff`; `suggestOrders` is now the coach; `compilePlan` gains a `notes` channel |
| `engine/src/league/08-orders.js`, `engine/src/07-up2.js` | both orders surfaces render the same `notes` line |
| `server/enginehost.mjs` | `planMatchDay` / `publicScout` reach the built engine |
| `server/tick.mjs` | unmanaged clubs file a coached sheet; cover gets today's conditions |
| `server/nations.mjs` | `coverSheet(orders, present, gone, ctx)` + `coverRank` |
| `test/matchday-coach.test.mjs` | **new** — 23 tests, A–J |
| `test/fieldable-xi.test.mjs`, `test/extras-rate.test.mjs` | rewritten with the measurement |
| `tools/matchday-probe.mjs`, `matchday-selection.mjs`, `matchday-toss.mjs`, `matchday-goldens.mjs` | **new** — the measurements |
| `tools/calibration.mjs` | `CAL_COACH_OFF` bisect handle |

## 16. What was NOT touched

`ballDist`; pitch and weather coefficients; fatigue coefficients; player
attributes; talents; `GD.cal` tuning constants; scoring rates; the toss RNG
draw; `aiPickBowler`'s slip law; the manual-orders branch of `pickXI`; the
economy; migrations.

## 17. For the owner, before this is merged

1. **The goldens were re-recorded.** The evidence for that being legitimate is
   §12 — coach off reproduces all nine masters bit-for-bit and passes
   calibration, coach on changes both. If you would rather see the old goldens
   preserved and the gates left red on this branch, `git revert` the re-bless
   commit alone; nothing else depends on it.
2. **The powerplay rate is the one real behavioural claim.** +0.3 to +0.5 an
   over across all four calibration tiers. It is the batting order and it is
   intended, but it is the number to disagree with if you are going to
   disagree with anything.
3. **One server test is red and I left it red** (§11). It is an era-2 economy
   guard, hard-coded at half the administration floor, which one club in one
   seeded world now sits 12% past. The coach is responsible (bisected with
   `FO_COACH_OFF=1`) but is not draining weak clubs — measured, it slightly
   compresses the league. Moving an economy threshold is a decision about the
   economy, and the economy was closed.
4. Three duplicate opinions remain in the browser (§14).
5. `matchday-toss.mjs --home` has not been run at full N; the coach therefore
   claims no home-ground toss effect (§8).
