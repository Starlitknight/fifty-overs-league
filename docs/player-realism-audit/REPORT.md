# PLAYER REALISM SYSTEMS AUDIT

**Fatigue · Experience · Captaincy · Fielding · Wicketkeeping**

Audit of the shipped engine, build `20260817-0057-17bd94` (the committed
`assets/fo-20260817-0057-17bd94.js` matches the current source hash exactly,
so the audit measures precisely what production runs). **No gameplay was
changed.** Every number below was read out of the built `index.html` in a VM
by the probes in `tools/`:

| probe | what it measures | evidence |
|---|---|---|
| `tools/realism-lib.mjs` | the shared harness (ordinary XI, instrumented match runner, exact ballDist reader, posed aiPickBowler, fatigue laws) | — |
| `tools/fatigue-probe.mjs` | Part I | `fatigue-evidence.json` |
| `tools/experience-probe.mjs` | Part II | `experience-evidence.json` |
| `tools/captaincy-probe.mjs` | Part III | `captaincy-evidence.json` |
| `tools/fielding-probe.mjs` | Parts IV–V | `fielding-evidence.json` |
| `tools/interaction-probe.mjs` | Parts VI–VII | `interaction-evidence.json` |

Statistical method: `ballDist` is a pure function, so every per-delivery
number is **exact** (no sampling error at all). Match-level numbers are
paired-seed samples on the same ordinary XI `tools/attribute-value.mjs`
uses (five front-line bats 55–61, keeper, five bowlers with a real tail),
N = 240–300 fixtures a cell, quoted with the standard error of the mean.
Win-rate cells carry an SE near ±2.9 points; treat any win-rate difference
under ~6 points as unresolved, and trust the graded trends and the exact
per-ball numbers over any single cell.

---

## 1. Executive summary

The five systems are **real, honest about what they model, and mostly
well-shaped** — the big 2026 rebuilds (fatigue ramp at 0.12, experience
as pressure-scaled composure, captaincy as bowler choice, fielding as a
geometric contest) did what their comments claim. Every mechanism the
cards promise exists and can be measured. The genuine problems:

1. **Team fielding is the strongest force in this entire audit — and
   probably too strong.** Moving all eleven men's fielding+catching
   20→95 with batting and bowling held identical moves runs conceded
   322 → 215 per 50 overs and the win rate 5% → 85%. Even the
   realistic middle of the scale (40→80, roughly the live world's
   spread) is worth **65 runs and 61 win points** — real elite-v-poor
   fielding sides differ by perhaps 15–30 runs. The engine's own B2
   weights already know this (fielding 0.244 runs/pt beats vsPace's
   0.186), so the game is internally consistent — it is cricket the
   magnitude argues with. The compounding channel is wickets: a poor
   side converts barely half its chances (52% on the routine line,
   worse at full stretch), wickets stop falling, and the
   setness/standard machinery pays the batting side twice.
2. **Temperament and experience are the same lever at very different
   sizes.** Both are pressure-scaled batting composure with the same
   trigger (`pressureBase`); temperament's span is worth ~5× experience's
   span at the same moments (in a 40-off-24 chase, temperament 30→85
   halves the per-ball dismissal chance, 18.7%→9.6%, while experience
   20→85 trims it 18.7%→16.2%). Experience is the *smaller* copy plus a
   bowler-side term; for a batsman nothing about "years served" is
   distinct from "calm nerves". Conceptual double-count — though at
   these magnitudes nothing is paid twice at damaging size.
3. **Resting a bowler during an innings repays nothing.** The in-match
   tank (`M.fat`) only ever decays at drinks (×0.62, once an innings) and
   the innings break (×0.5). A quick who bowls 5-on / 10-off / 5-on comes
   back exactly as tired as he left. Spell selection *penalises* a tired
   man (aiPickBowler) but his legs never actually recover — "hold him
   back for the death" cannot exist as a plan.
4. **Ordinary captains bowl no spells.** 80% of all spells under a
   capt-40 skipper are a single over (the pick re-rolls every over), so
   the 36-ball long-spell fatigue term fires in 1.3% of bowler-innings;
   only capt-95 sides bowl recognisable 3–5 over spells (52% reach the
   ramp). Real one-day captains bowl spells at every level of ability.
5. **Catching and the gloves are immune to fatigue and form entirely.**
   The catch/stump contests read raw `skills.catching`/`skills.keeping`;
   `withForm()` adjusts only ground fielding (`p.field`). Measured: a
   'weary' XI misfields twice as often (0.45→0.94) while its drop rate
   does not move (11.1%→10.8%). No keeper has ever dropped one for
   being tired. The in-match tank touches no fielding channel at all.

An honourable sixth: the Match-Day Coach prices captaincy at
`CAPT_RUNS = 0.18` runs/pt (≈8.6 runs over capt 40→88) against a
measured on-field value of ~4 runs and ~8 win points across the *whole*
20→95 span on an ordinary attack — it will hand a captaincy-99 batter a
shirt while he bats **20 points below** the man he displaces.

The rest is in believable territory: stamina is worth ~12 runs/50 overs
across an attack (30→90); pre-match fatigue words are strong but
deliberately so; the sixth bowler is worth 1–3 wins per hundred and
visibly spares frontline legs; drop rates stay cricket at both extremes
(a 95 catcher still puts down 1 in 20 he reaches); keeper quality is a
real 20–30 runs across its span with the right surface coupling; and
captaincy is pure decision quality — no aura anywhere.

---

## 2. Current fatigue architecture

Fatigue is four separate systems that meet at the ball model. All four
are real; they do not all talk to each other.

```
BETWEEN MATCHES (server/living.mjs — the world's law)
  each appearance bills fatN: 6 base + 2.4/over pace (1.5 spin)
      + 0.05/ball faced + 7 keeping + 4 captaincy
  each night repays 35% of what stands; cap 80
  fatN -> 11-word ladder (rested … clinically dead)
      |
PRE-MATCH (engine, withForm())
  word -> foFatigueIndex 0..10
  foFatiguePenalty = ix*1.05*ageTire − max(0,stamina−60)*0.045   [0..13.5]
      -> batting −pen, bowling −0.92·pen, ground fielding −0.34·pen
  foFatigueLoad  = ix*0.072*ageTire + ageExtra − max(0,st−55)*0.0018
      -> the tank he STARTS the match with (0..0.86)
      |
IN-MATCH (engine, apply())
  per legal ball: striker  += (1.75−st/100)/120 · ageTire · (keeper 1.04)
                  bowler   += (1.85−st/100)/74  · ageTire · (fast 1.08, fm 1.04)
  drinks (over 25): everyone ×0.62 — the only in-innings recovery
  innings break:    everyone ×0.5
  ballDist ramp: effect zero below tank 0.12, linear above
      full span ≈ +0.9 RPO and −24% wickets for the bowler,
                  −0.5 RPO and +37% dismissal risk for the batsman
      |
SPELL (engine)
  brec.spellB = consecutive same-end balls (reset unless he bowled over-2)
  longSpell term starts at 36 balls; ageBowlLate at 18 balls (age>30)
  aiPickBowler penalises spellB ≥ 30 and tank > 0.55
```

Things worth knowing that the code does not advertise:

* **Stamina acts three times, age twice, and neither acts between
  matches.** Stamina slows accrual, softens the pre-match penalty and
  load; age multiplies accrual and the penalty and has its own late-spell
  / late-innings ballDist terms. The between-match law (`living.mjs`)
  charges and repays every man identically — a 36-year-old fast bowler
  and a 21-year-old recover at exactly 35%/night.
* **The keeper's in-match multiplier (1.04) applies to his batting**, not
  his keeping; standing 50 overs accrues nothing in-match (measured: the
  keeper ends matches with a *lower* tank than the No.4 bat, 0.118 v
  0.187). His keeping day is billed only between matches (+7).
* Post-match "tired" flags in the client (and patch 09's `fatN`
  accumulation) mirror the server law for offline play.

## 3. Stamina / workload results

All numbers `fatigue-evidence.json`; paired seeds; N=240.

**The exact ball-model price of a spent bowler** (tank 0 → 1): economy
5.84 → 6.74 RPO, wickets 1.65% → 1.26%/ball, dots 39.0% → 33.3%. For a
spent batsman: 5.84 → 5.36 RPO and dismissal 1.65% → 2.26%. Both ramps
start at 0.12 — inside the range real spells reach, as the comment
claims.

**One opening bowler's stamina** (fast-medium, age 27):

| stamina | his economy | his wkts/inn | tank peak | win% |
|---|---|---|---|---|
| 30 | 5.43 ±0.08 | 1.57 | 0.98 | 51.0 |
| 45 | 5.43 ±0.08 | 1.70 | 0.90 | 53.1 |
| 60 | 5.35 ±0.08 | 1.63 | 0.81 | 52.1 |
| 75 | 5.23 ±0.08 | 1.63 | 0.72 | 51.7 |
| 90 | 5.17 ±0.08 | 1.66 | 0.62 | 52.3 |

A real curve now (compare the flat 5.35/4.98/5.13/5.12 the old model
measured): 60 points of stamina ≈ 0.26 RPO ≈ 2.6 runs across his ten
overs. **The whole attack's stamina** is far larger: 30→90 saves
12.0 ±3.0 runs/50 overs and moves the win rate 47.7% → 63.5%.

**Age:** the accrual multiplier spans 0.88 (≤22) to 1.32 (36+) — a
35-year-old at stamina 55 accrues like a 27-year-old at stamina ~25 —
and the exact `ageBowlLate`/`ageBatLate` terms add a visible second tax
late in spells and long innings (tables in evidence §2). Quicks accrue
8% faster than spinners in-match (`roleW`) and are billed 60% more per
over between matches — both taxes exist, both modest, direction right.

**Trades:** fast 1.08×, fast-medium 1.04×, everyone else 1.0× in-match;
2.4 v 1.5 per over between matches. A spinner CAN bowl day-in day-out;
a seamer cannot — the steady states below bear it out.

**Long batting innings:** the `longInn` term (from 70 balls faced) plus
the age term: a 27-year-old's dismissal risk at 130 balls is +0.2%/ball
over his 70-ball self; a 34-year-old pays double. Real and gentle. A
long innings also fills the batsman's tank (0.009–0.013/ball), which he
carries into the second innings **as a bowler** if he has one — the
all-rounder's double shift is genuinely modelled.

**Recovery inside a match — the answer is NO.** The trace shows a
bowler's tank strictly monotone through an innings except two cliff
events: drinks (×0.62 at over 25) and the innings break (×0.5). Ten
overs at fine leg repay 0.000. The only "rotation" reward is indirect:
aiPickBowler stops throwing him the ball while his tank exceeds 0.55.

**Spells:** under an ordinary captain 80% of spells are one over; the
mean longest same-end spell is 15.3 balls, and 1.3% of bowler-innings
ever reach the 36-ball `longSpell` ramp — **the term is decorative in
AI-v-AI cricket at ordinary captaincy** (it does fire under elite
captains — see §8 — and under a manager's painted bowling plan).

**Five v six bowlers** (N=240): a sixth option at level 46 bowls 4.2
overs, saves 2.6 runs/50, +1.3 win points, and cuts the frontline peak
tank 0.93→0.85; at level 55 he bowls 6.9 overs, saves 5.6 runs, +3.0
win points, peak 0.81. The Match-Day Coach's `SIXTH_BOWLER = 4.8` runs
premium is the right order.

**Between matches** (the law, played exactly): a seamer bowling ten
overs *every day* settles at fatN 80 ('exhausted', −8.4 skill points
before the toss); one rest day between outings, 52 ('moderate', −5.3);
two, 41 ('satisfactory', −4.2). A spinner playing daily: 59 ('weary').
A specialist bat: 25 ('passable'). Congestion therefore creates real
rotation decisions — but since recovery is flat 35%/night for everyone,
rotation is about *workload spacing*, never about *who* recovers faster.

**Pre-match words on the day** (whole XI, N=240): 'satisfactory' costs
a side 15 scored / +23 conceded and drops the win rate 53%→21%;
'weary' → 6.3%. The ladder is the single biggest lever in this entire
audit — half a class of skill per word. It is *meant* to be the big
managerial consequence and the steady states above show ordinary
calendars keep sides in the top three words; but anything that touches
the ladder (training plans, congestion, the +8/+16 intensive-nets load)
is touching a hair trigger.

## 4. Experience architecture

One entry point, deliberately: `foExperienceFactor(p) = clamp(exp−55)
/45` in ±1, read inside `ballDist` only (the old flat `withForm` bonus
is gone). The factor is scaled by

```
expUse = exp_base(0.2) + pressureBase
pressureBase = phase(pp .35 | mid .55 | death 1.0)
             + chase .35 + wkts≥4 .25 + min(.45, rrDef·.55)
             + collapse(since≤2 & wkts≥2) .30
```

and buys, per unit factor: wicket logit −0.055 (bat) / +0.050 (bowl),
small dot/boundary shifts, and one **always-on** term — `L['1'] +=
0.014·batExp` (strike rotation). Experience never enters aiIntent,
aiPickBowler, the coach's XI pricing, or anything else tactical.

## 5. Experience results

Exact, identical players (`experience-evidence.json` §1): experience is
**genuinely context-sensitive** — the effect grows with the same
pressure number everything else uses.

| state | dismissal %/ball, exp 10 → 90 | relative |
|---|---|---|
| ordinary middle over | 1.72 → 1.60 | −7% |
| 150/7 with 15 overs left | 1.87 → 1.69 | −10% |
| 230/8 at the death | 5.84 → 5.09 | −13% |
| chase 60 off 60, 3 down left | 4.99 → 4.19 | −16% |
| chase 8 off 6 | 9.44 → 7.74 | −18% |

Bowling: an exp-90 bowler at the death takes 5.69%/ball against an
exp-10 man's 5.06% (+12%) and is 0.25 RPO cheaper — same shape.

**Season value** (one No.3, N=300): exp 10→95 buys +3.5 runs/innings
(44.5→48.0) — ≈ **+0.4 runs/innings per +10 exp** — and does not
resolve at the team-win level (all cells 52–54%). For a bowler, exp
10→95 buys +0.17 wickets/innings and −0.08 RPO. Age does not change
what experience buys (the exp-30→80 gap is +2.4 runs at 21 and +4.3 at
36 — more of the veteran's innings are long/pressured ones, which is
the right direction).

So: **not always-on** (the flat rump `exp_base=0.2` plus the rotation
term is a fraction of the pressure half), **not too strong** — if
anything too weak to ever notice on a card (a full card grade of
experience is worth less than two skill points of batting), and **not
duplicated by captaincy or form** (separate channels entirely). The
one real duplication is temperament — next chapter.

## 6. Temperament v experience

Temperament went through the same 2026 surgery: its flat share was
pulled out of the batting blend and returns only under
`tmpUse = min(1.7, 0.02 + pressureBase)` — **the identical trigger
experience uses**. The two attributes are the same mechanism at
different gains:

| state (bat) | dismissal %/ball | loE/loT | loE/hiT | hiE/loT | hiE/hiT |
|---|---|---|---|---|---|
| ordinary middle over | | 1.94 | 1.53 | 1.82 | 1.43 |
| chase 40 off 24 | | 18.7 | 9.6 | 16.2 | 8.2 |
| chase 8 off 6 | | 13.2 | 6.6 | 11.3 | 5.6 |
| collapse, 3 quick wickets | | 2.30 | 1.46 | 2.09 | 1.32 |

(loE=20/hiE=85 experience, loT=30/hiT=85 temperament; everything else
identical.) Same-state slope check: in a last-over chase, +30
experience moves the wicket 5.69→5.26 while +30 temperament moves it
5.69→3.97.

**What temperament does that experience does not:** carry ~5× the
composure budget, batting only. **What experience does that
temperament does not:** work for bowlers, add a whisper of always-on
strike rotation, and appear on the card as a separate ladder word.
For a batsman they are one concept priced twice at different rates —
the engine is not paying twice *dangerously* (the sum is still a sane
pressure effect), but a manager reading two attributes is being told
there are two levers when there is one and a half. Flagged in §15.

Also worth stating: temperament at 18.7%/ball in a hard chase means a
nervy tail-ender's survival expectancy is five balls. That is at the
brutal end of plausible; the *gap* (2× between corners) is the
questionable part rather than either endpoint alone.

## 7. Captaincy architecture

Captaincy is three things and only three:

1. **The slip law** (`aiPickBowler`): the engine scores every available
   bowler for the coming over the way a good captain would (phase,
   pitch, weather, the stand, his spell, his tank, overs left, talents,
   movement in the conditions). Captaincy decides how much of that
   ranking the side actually gets: `capt ≥ 92 →` always the top pick;
   below that the top pick with probability `1 − 0.85·(88−capt)/88`,
   otherwise the 2nd–4th. Deterministic per over identity.
2. **The on-field sliver** in ballDist: `dot += (captBowl−50)·0.0002`,
   `W −= (captBat−50)·0.00012` — a quarter of the old aura, worth well
   under a run a match across the whole scale.
3. **The coach's price** when picking an XI: `0.18 runs/pt`, capped at
   captaincy 88.

Captaincy does **not** touch: the toss (fixed 35%/60% bat probability
by pitch), field settings (`aiField` reads score state only), batting
intent, or batting order. The captain's own blindness is structural:
his bowler score never reads **runs conceded today** (he cannot pull a
man being carted beyond what fatigue implies) and never reads the
**batting side's wickets** (he does not hunt an exposed tail with his
strike bowler).

## 8. Captaincy results

**The slip law measured** (4,000 over-identities per point): matches
the closed form exactly; P(top choice) = 0.34 at capt 20, 0.73 at 60,
0.92 at 80, 1.000 at 88 — and **flat at 1.0 from 88 up**, so the `≥92`
early-return is redundant code, not a second cliff. 87 v 88 differs by
one pick in a hundred: no behavioural cliff survives measurement; the
"elite threshold" is a smooth linear approach that merely *ends* at 88.
The only oddity is the ceiling itself: captaincy above 88 buys nothing
at all, which the coach's pricing already knows (`CAPT_CEIL 88`).

**Whole matches** (armband on the No.1, everything else identical,
N=300): conceded 266.5 → 262.7/50ov and win 48.2% → 56.0% across capt
20→95 — ≈ **+1 win point and −0.5 conceded runs per +10 captaincy**,
monotone. Not an aura anywhere: the batting side's number is flat.

**The tactical table** (`captaincy-evidence.json` §3, seven posed
situations, expected cost from exact per-ball numbers with a wicket
priced at 20 runs): a capt-20 side loses 0.5–2.9 expected runs *per
over of that situation* to inferior picks; capt 95 loses ≈0. The
engine's own ranking agrees with the exact cost ranking on conditions
questions (green-top seamer, dry-deck spinner, resting the 0.75-tank
quick) — good captains genuinely exploit conditions, and the "regret"
of a poor captain is real, bounded, and never absurd (never past the
4th-best option). Two deliberate disagreements with the posed "sensible
answer": with a 60-run stand building, the engine prefers mid-over
spin/variation over the strike seamer (defensible cricket, but the
partnership term never overrides the phase prior), and its death
choice keeps some pace-at-the-death preference the cost table does not
fully endorse.

**Spells are a captaincy output** (§5): capt 20 bowls 80% one-over
spells (mean longest spell 15.3 balls); capt 60, 69%/20.5; capt 95,
51% one-over and 30% 3+-over spells, mean longest 35.3 balls, and 52%
of bowler-innings reach the 36-ball fatigue ramp. Two readings: the
long-spell fatigue term only exists in elite-captained cricket, and
mid-scale captains churn bowlers in a way no real one-day side does.

**Captaincy × experience** (four-team square): experience (whole XI
30→85) is worth ~11 win points; captaincy 25→92 inside either
experience level is worth 0–1 points in this square (N under-resolves
the ~5-point true effect, but the ordering is unambiguous). The two
never substitute for each other — different channels, independent
contributions, no double-count.

**The shirt test** (shipped Match-Day Coach, 12-man squad): a
captaincy-99 middle-order bat is selected while batting up to **20
points below** the weakest front-line bat he displaces; at −26 he is
finally left out. Internally consistent with `CAPT_RUNS` (8.6-run
premium ÷ ~0.45 runs/batting-pt ≈ 19 points) — but three times the
~2–3 runs the slip is measured to be worth on an ordinary attack over
capt 40→88. The previous audit's "captaincy must not buy a shirt"
finding **does not fully hold**: it no longer buys a *terrible*
cricketer a place, but it still buys a clearly-worse one.

## 9. Fielding architecture

Five channels, one law ("a chance is a number and a man"):

```
ballDist            ctx.fieldAvg (XI mean, withForm-adjusted): dots up,
                    fours down — max ±0.1 RPO across 20→95
                    wRO logit += min(0.26, 0.13·rocketArms)
GROUND CONTEST      every in-play ball gets a direction (shot-shaped
(groundFieldingAdjust) wagon wheel); the POSTED man nearest the line
                    (foFieldAssign: best hands to the cordon, best
                    athletes deep, weakest hidden at mid-on/off)
                    contests difficulty = 100·u^2.6 + band + angle;
                    win on a 4 → save 2 (deep) or cut it dead (ring);
                    win on 2 → 1; lose on dot/1 → fumble/misfield
CATCH CONTEST       wC lands AT the nearest man (keeper if nobody near,
                    c&b if straight); his catching (keeper: quality
                    blend) + Safe Hands 11 + Lightning Hands 10 versus
                    difficulty; lose by ≤16 = DROP, worse = "beat him"
                    (chance nobody could take); weather: chilly −9,
                    misty −6
RUN-OUTS            wRO outcome credited by draw weighted fielding ×1.5
                    Rocket Arm; no separate throwing skill exists
GLOVES              quality blend (.50 keep .26 stump .24 catch) v par
                    74 → byes/legbyes/wides; stumping read straight
                    (0.030/pt on the wST logit), keeper catching
                    straight (0.009/pt on wC); stumping miss model
                    0.20 − 0.0038·(kq−74)
```

Fatigue integration is asymmetric by construction: pre-match penalty
reaches ground fielding at ×0.34, **catching and keeping read raw
skills** (no form, no fatigue, ever), and the in-match tank reaches no
fielding channel at all.

## 10. Fielding results

(`fielding-evidence.json`, N=260/cell.)

**Team fielding+catching 20→95, everything else identical:**

| level | conceded/50ov | catches | drops* | net ground runs saved | run-outs | win% |
|---|---|---|---|---|---|---|
| 20 | 322.2 ±1.9 | 1.25 | 0.45 | −24.6 | 0.44 | 5.4 |
| 40 | 296.0 ±1.9 | 2.44 | 0.43 | −6.8 | 0.53 | 20.0 |
| 60 | 259.2 ±1.8 | 4.05 | 0.53 | +17.5 | 0.60 | 57.7 |
| 80 | 230.6 ±1.7 | 5.15 | 0.43 | +32.9 | 0.55 | 81.3 |
| 95 | 214.7 ±1.8 | 6.06 | 0.37 | +37.2 | 0.60 | 85.2 |

\* "drops" counts only chances the man got hands to (the contest's ≤16
window); chances that beat him outright convert straight to runs and
are under-counted by this instrumentation because the ground-fielding
pass wipes the event stamp — the exact conversion arithmetic below is
the honest measure of the extremes.

**This is the strongest lever in the audit — roughly 14 runs/50 overs
per +10 team points**, and 65 runs / 61 win points even across the
realistic 40→80 band. Batting and bowling on both sides are *identical*
in every row of that table. The mechanism is compounding: the catch
contest turns skill into wickets (1.25 → 6.06 caught per innings),
wickets turn into setness and resources for the batting side, and the
ground contest adds ±25 net runs on top. Real cricket puts elite-v-poor
fielding at 15–30 runs; the engine pays three times that across its
full scale. Flagged P1 (§15) — with the caveat that the engine's
economy, wages and the B2 attribute weights already price fielding this
way, so any resizing is a calibration event, not a bug fix.

**Catching alone** (ground fielding held at 55): catching 20→95 is
conceded 282.1 → 250.8 and win 36.2% → 68.8% — about a third of the
combined effect. **Per-chance conversion, exact** (contest arithmetic,
routine line, angle 0): a catching-20 man takes 52%, drops 14%, is
beaten by 34%; a 55 man takes 78%; a 95 man takes 97%, drops 2%, is
beaten by ~1%. A 95 catcher still puts down one in twenty he reaches
(sampled hands-reached drop rate 5.3%), a 20 catcher still takes half —
cricket variance survives at both extremes. Chilly weather adds ~+2
points of drop rate (−9 catching), visible in the sample.

**One man matters** (one fielder moved in an average XI, N=260): one
elite (90/90) fielder is worth −3.4 conceded runs and +5.8 win points,
and takes ~1.05 dismissals an innings against the average man's 0.65;
one liability (15/15) costs +10.2 runs and −9.8 win points and almost
vanishes from the wicket column (0.18) — the assigner posts him at
mid-on/mid-off but the shot-shaped traffic still finds him. Identity is
real — catches happen at posts, the cordon takes the edges, boundary
riders save twos — nothing collapses into the fieldAvg blob (which is
itself only worth ±0.1 RPO). If anything a single bad fielder is
*extremely* expensive (a tenth of an innings' runs for one man's hands).

**Run-outs:** 0.61/innings baseline — the real game's rate almost
exactly. Rocket Arm: +0.07/innings for one, +0.15 for three (the wRO
logit caps at two arms' worth) and ~+1.5–3 win points — **valuable
flavour rather than power**. There is no separate throwing/arm
attribute (the credit draw weights `fielding ×1.5` for Rocket Arm) and
no deterrence model (the brief asked; the answer is "not modelled").

**Fielding × texture:** the full-scale gap is 98–114 runs everywhere —
102.8 flat, 104.1 balanced, 98.7 slow, 114.1 green. The hypothesis
"fielding matters more when more balls are in play, less in
boundary-heavy innings" is **not supported**: green tops, where every
run is scarcer and edges fly, show the *largest* absolute gap. Fielding
value is effectively surface-independent in this engine.

**Fielding × fatigue** (interaction §3): a 'weary' side's ground game
degrades through the ×0.34 pre-match term — saves 8.11→7.07/inn,
misfields 0.45→0.94 — but its **drop rate does not move** (11.1% →
10.8%; the catch count falls 4.10→2.72 only because a blunted attack
creates fewer chances). In-match tiredness changes nothing in the
field. The engine claims fatigue costs output; in the field the claim
is one-third true.

## 11. Wicketkeeping

Exact terms: keeper quality 30→90 moves byes 1.68%→0.52% of balls
(≈ −6 extras an innings), stumping 30→90 moves wST 0.009%→0.055%/ball
(≈ ×6), keeper catching 30→90 moves wC 0.72%→1.22%/ball — the two
named skills read directly, as the 2026 fix promises.

Whole matches (all three glove skills 30/50/70/90, N=260):

| condition | conceded/50, kq 30→90 | byes+lb/inn | stumpings/inn | keeper ct/inn | win% 30→90 |
|---|---|---|---|---|---|
| green / all-pace | 259.5 → 227.0 | 12.5 → 5.1 | 0.02 → 0.28 | 0.25 → 0.35 | 32.9 → 62.5 |
| balanced / mixed | 278.3 → 259.7 | 13.6 → 6.4 | 0.01 → 0.26 | 0.25 → 0.61 | 35.4 → 59.4 |
| dry / all-spin | 240.2 → 220.7 | 11.6 → 5.3 | 0.04 → 0.30 | 0.21 → 0.40 | 36.0 → 60.4 |

**+10 keeper quality ≈ 3–5 runs and ≈ 4–5 win points** — the gloves
are worth roughly a quarter of the whole-team fielding lever, on one
man. The surface story is real but not the folk version: stumpings do
concentrate on turning decks as expected, yet the *largest* total
slope is green/pace (32.5 runs across the span), where a poor keeper
leaks byes off seam and the low-scoring context makes every leak dear
— which matches the Match-Day Coach's own measurement (its KEEP_SLOPE
evidence also found green/pace ≥ dry/spin). The batting trade is a
real dilemma: 60 glove points ≈ 25–28 win points ≈ roughly 8–10 points
of batting on this scale — a genuine keeper-batter tradeoff, though at
these slopes glove quality will usually win it. Keeper *workload*:
billed honestly between matches (+7/day, the second-highest bill in
the law), invisible in-match (§3.7), and his hands never tire —
flagged with fielding.

## 12. Attribute interactions

| pair | verdict | evidence |
|---|---|---|
| experience × temperament | **same trigger, different gains — conceptual overlap** (batting) | §6 |
| experience × fatigue | additive, no cross-term; exp buys no tired-legs immunity, fatigue erodes no composure | exact, interaction §1 |
| experience × age | additive; veterans' innings shapes give exp slightly more to do | exp-evidence §3 |
| captaincy × experience | independent channels, both real, no overlap | capt §4 |
| captaincy × sixth bowler | **no meaningful interaction**: the sixth option is used equally (5.1 v 5.3 overs) and pays similarly at capt 20 and 95 — its value comes from the ranking, which every captain samples | interaction §2 |
| captaincy × fatigue | the captain reads the tank (>0.55 penalty, confirmed in the posed tests); on a low-stamina attack capt 20→95 is worth +3.0 win points / −2.4 runs — same order as on a fresh attack, no multiplier | interaction §2, capt §3 |
| fielding × fatigue | one-third wired (ground only, pre-match only) | interaction §3 |
| fielding × captaincy | not connected (aiField ignores captaincy) — no double-count, arguably a missing link | structural |
| keeping × fatigue | not connected in-match; billed between matches | §3.7, §11 |

**Are we paying for the same cricket twice?** Once, partially:
experience/temperament on the batting side. Everything else is either
cleanly additive or a genuine (and desirable) interaction.

## 13. Player-value sanity checks

(interaction §4, N=300; win SE ±2.9 — read trends, not single cells.)

| pair | win% | his output |
|---|---|---|
| No.3: bat 70 / exp 30 | 54.7 ±2.9 | 47.7 runs |
| No.3: bat 66 / exp 80 | 53.3 ±2.9 | 47.9 runs |
| opener: bowl 72 / exp 30 | 61.2 ±2.8 | 1.28 wkts |
| opener: bowl 68 / exp 80 | 63.5 ±2.8 | 1.39 wkts |
| No.3: bat 70 / field 35 | 50.8 ±2.9 | — |
| No.3: bat 66 / field 85 | **59.5 ±2.8** | — |
| captain: bat 62 / capt 30 | 54.0 ±2.9 | — |
| captain: bat 58 / capt 90 | 56.5 ±2.9 | — |

Read (differences carry an SE near ±4): the batting-v-experience and
bowling-v-experience trades sit **at the crossover** — 4 points of
primary skill and 50 points of experience are the same cricketer, to
the resolution of 300 matches, with the experienced bowler if anything
ahead (his own wickets rise 1.28→1.39). Captaincy-90 against 4 batting
points is likewise a coin toss (+2.5 ±4). The one decisive trade is
fielding: **bat 66 / field 85 beats bat 70 / field 35 by 8.7 win
points** — a 50-point fielding edge on one man is worth several times
a 4-point batting edge. Secondary attributes tilting close calls is
exactly the believable ordering the brief asks for; fielding once
again refuses to stay secondary (§10), and the coach's captaincy
*pricing* (§8) is more generous than this measured reality.

## 14. The sanity matrix

**FATIGUE**

| statement | verdict | note |
|---|---|---|
| long bowling workloads reduce effectiveness | **GREEN** | tank ramp real, +0.9 RPO fresh→spent |
| fast bowlers tire more than spinners | **GREEN** | 1.08×/2.4-per-over v 1.0×/1.5 — modest but present twice |
| stamina affects physical resilience | **GREEN** | attack 30→90 = 12 runs, 16 win pts |
| taking a bowler off provides useful recovery | **RED** | structurally absent: nothing repays but drinks/break |
| sixth bowlers can relieve workload | **GREEN** | −0.08/−0.11 peak tank, runs and wins follow |
| fixture congestion creates rotation decisions | **GREEN** | daily seamer 'exhausted', 1-in-3 rest keeps him 'moderate'; flat 35% recovery for all is the YELLOW inside the green |

**EXPERIENCE**

| statement | verdict | note |
|---|---|---|
| experienced players handle difficult situations better | **GREEN** | −7% ordinary → −18% last-over chase |
| experience does not simply boost every ball | **GREEN** | exp_base 0.2 rump only |
| young talent can still outperform veterans | **GREEN** | 4 skill pts ≈ 50 exp pts |
| experience and temperament are meaningfully different | **YELLOW/RED** | same trigger, 5× gain gap, bat-side duplicate |

**CAPTAINCY**

| statement | verdict | note |
|---|---|---|
| good captains make better bowling changes | **GREEN** | the slip law is the whole skill |
| captaincy more valuable when decisions are difficult | **GREEN** | regret scales with the gap between options |
| good captains exploit conditions better | **GREEN** | ranking matches exact cost on green/dry |
| poor captains make believable mistakes | **GREEN** | never past 4th choice; regret bounded |
| captaincy does not magically increase skills | **GREEN** | sliver ≪ 1 run/match |
| — the churn: mid-scale captains bowl no real spells | **YELLOW** | 80% one-over spells at capt 40 |
| — the coach's captaincy price | **YELLOW** | ~3× the measured on-field value; buys a −20 bat a shirt |
| — captain blind to today's figures / exposed tail | **YELLOW** | structural blind spots |

**FIELDING**

| statement | verdict | note |
|---|---|---|
| good fielding saves runs | **YELLOW** | it saves ~14 runs/10 pts — several times real cricket's rate; direction right, magnitude high |
| great fielders take more chances | **GREEN** | conversion 52%→97% exact; drop rate 26%→5% sampled |
| bad fielders cost matches occasionally | **GREEN/YELLOW** | one liability ≈ −10 win pts — more than occasionally |
| run-out ability matters | **YELLOW** | rate realistic (0.61/inn); Rocket Arm mild; no throwing skill, no deterrence |
| individual fielders matter | **GREEN** | posts, cordon, hiding the weak — identity real |
| fielding remains noisy, not deterministic | **GREEN** | unreachable chances at every skill, 95 still drops 1-in-20 |
| fatigue can affect fielding where appropriate | **YELLOW/RED** | ground-only, pre-match-only; hands never tire |

**KEEPING**

| statement | verdict | note |
|---|---|---|
| better keepers convert more chances | **GREEN** | stumpings ×14 across the span, keeper catches +50% |
| keeping matters more where chances concentrate | **GREEN** | stumpings on turn as expected; total slope steepest green/pace — matches the coach's own evidence |
| poor keeping costs runs and wickets | **GREEN/YELLOW** | −19 to −33 runs at kq 30: real, arguably a size up |
| keeping workload has physical consequences | **YELLOW** | between-match bill only; in-match nothing |

## 15. Problems worth fixing

Ranked by how much cricket they distort:

**P1a — Team fielding magnitude.** ~14 runs/50ov per 10 team points;
65 runs and 61 win points across the realistic 40→80 band; one
liability fielder ≈ 10 runs. Real cricket's elite-v-poor spread is
15–30 runs. The compounding is in the catch→wicket→setness chain. The
biggest *cricket* distortion found — and also the most entangled with
the shipped economy (B2 weights, wages, the coach's FIELD_RUNS all
already price it), so it is a deliberate calibration decision, not a
quick fix.

**P1b — In-match rest repays nothing.** The tank only falls at two
scripted moments. No incentive exists (for AI or manager) to *rest and
return* a strike bowler; the fatigue game is purely "don't over-bowl
him", never "hold him back for the death". The smallest change with
the largest realism payoff in this audit.

**P1c — Bowling-change churn at ordinary captaincy.** 80% one-over
spells is not one-day cricket anywhere on earth; it also silently
disables the long-spell fatigue term for most of the world. The slip
law re-rolls per over with no stickiness.

**P1d — Experience/temperament conceptual duplication.** One pressure
trigger, two cards, 5× gain difference, batting only. Either give
experience its own *distinct* job (see §16) or accept that temperament
is the composure card and experience is flavour.

**P2a — Hands never tire (or vary).** Catch/stump contests read raw
skills: no form, no pre-match ladder, no in-match tank. The one
fielding channel spectators most associate with tired sides (the
put-down at deep midwicket in the 48th) cannot happen for fatigue
reasons.

**P2b — The coach's captaincy price.** `CAPT_RUNS 0.18` v a measured
~0.05–0.08 runs/pt on ordinary attacks. A 20-point-worse bat with an
armband gets picked.

**P2c — Captain blind spots.** No reaction to a bowler's day figures;
no tail-hunting; `capt ≥ 92` early-return is dead code shadowed by the
88 slip floor (cosmetic only).

**Explicitly NOT problems** (measured and fine): stamina magnitudes,
age-fatigue coupling, the pre-match ladder's strength (strong but
intentional and reachable only through mismanagement), sixth-bowler
value, fieldAvg size, drop rates, Rocket Arm size, keeper slopes and
surface coupling, the experience *magnitude* itself, captaincy's
whole-match size, the absence of a captaincy aura.

## 16. Proposed Phase 2 (PROPOSE ONLY — nothing here is implemented)

### P2-0 · Decide the fielding budget, then compress toward it  [P1]
* **Current:** team fielding+catching worth ~14 runs/10 pts; catch
  conversion 52%→97% across 20→95; one liability fielder ≈ 10 runs.
* **Measured problem:** §10 — elite-v-poor ≈ 100 runs where real
  cricket pays 15–30.
* **Desired:** fielding stays the biggest secondary system (it is in
  real cricket too) at roughly half to a third of its current slope.
* **Smallest change:** compress the CATCH contest's skill slope, not
  the bands: judge the catcher's hands at
  `cpar + k·(catching − cpar)` with k ≈ 0.55–0.65 (one constant in the
  contest; par-level cricket unchanged, extremes pulled in). Ground
  contest can keep its slope — its ±25 net runs are the defensible
  half.
* **Expected size:** full-scale gap ~100 → ~50–60 runs; the 40→80 band
  ~65 → ~35.
* **Calibration risk:** HIGH — wicket rates, all-out share and par all
  move; the FO_FLD band offsets were solved against the current slope
  and would need one re-solve. This is a bless-the-goldens event and
  must ride its own branch with `calibration-check` re-baselined.
* **Coach/valuation impact:** large — B2 fielding/catching weights,
  wages and FIELD_RUNS all re-measure (the tooling exists:
  `attribute-value.mjs`).
* **Tests:** fielding-probe §2/§5 slopes; the calibration suite.
* **Honest alternative:** accept the magnitude as this game's identity
  (it is consistent everywhere money touches it) and document it. The
  measurement makes the choice explicit; it does not force it.

### P2-1 · Spell rest actually recovers the tank  [P1]
* **Current:** `M.fat` decays only at drinks (×0.62) and the break (×0.5).
* **Measured problem:** §3 trace — flat tank across ten resting overs.
* **Desired:** a bowler rested 4–5 overs comes back partly refreshed;
  "hold him for the death" becomes a real plan.
* **Smallest change:** in `apply()`, alongside the two accrual lines,
  decay every non-striker non-bowler's tank by a small per-ball factor
  gated to bowlers off their spell, e.g. `M.fat[nm] *= (1 - r)` with r
  sized so ~5 overs off repays ~25–35% (r ≈ 0.001/ball, stamina-tilted).
  One term, one place, zero new state.
* **Expected size:** rested-and-returned bowlers ~0.1–0.2 tank lower at
  the death; ~1–3 runs/innings redistribution.
* **Calibration risk:** medium — touches every innings; par bands and
  goldens shift. Needs `calibration-check` re-baseline decision.
* **Coach/valuation impact:** none structural (stamina value shrinks
  slightly; re-run `attribute-value`).
* **Tests:** fatigue-probe §4 trace shows decay; golden replay decision.

### P2-2 · Give experience its own job (or fold it)  [P1]
* **Current:** exp = small temperament with a bowler side.
* **Options, smallest first:** (a) move the *collapse* and *death-overs
  execution* shares of pressureBase from temperament to experience so
  temperament = raw pressure nerve, experience = situations that reward
  having-been-there (collapse, tail-shepherding, death bowling); (b)
  wire experience into `aiIntent` (an experienced side misjudges
  affordable risk less — a small noise term shrinking with exp);
  (c) accept and document.
* **Size/risk:** (a) is redistribution, near-zero net calibration
  movement; (b) touches chase pacing — medium risk.
* **Valuation impact:** attribute-value weights for exp/temperament
  shift; wages follow.

### P2-3 · Sticky spells  [P1]
* **Current:** the pick re-rolls every over; only 'save overs', spellB
  ≥30 and tank >0.55 push back.
* **Smallest change:** in `aiPickBowler`'s scoring, add a continuation
  bonus for `spellB ∈ (0, 30)` (e.g. +6·skill-scaled) so captains at
  every level finish 3–5 over spells; the slip still decides *which*
  ranking they follow.
* **Expected:** one-over spell share 80%→(30–40)%; longSpell term live
  for everyone; churn gone from the broadcast.
* **Risk:** medium (bowler usage patterns shift; goldens move).
  Coach bowling plans unaffected (orders already override).

### P2-4 · Let the ladder reach the hands  [P2]
* **Current:** catch/stump contests read raw skills.
* **Smallest change:** apply the existing `fieldAdj`-style term to the
  catch contest only (`cSkill −= 0.34·foFatiguePenalty(f)` at
  pre-match, optionally `− k·M.fat[f.name]` in-match with tiny k).
* **Expected:** a 'weary' side drops ~0.3 more chances a match; ties
  the visible drop to the visible word.
* **Risk:** low-medium (drop ledger moves; FO_FLD bands may need a
  point of re-solve).

### P2-5 · Re-price the coach's captaincy premium  [P2]
* **Current:** 0.18 runs/pt (capped 88) → −20-bat armbands selected.
* **Smallest change:** re-measure with captaincy-probe §2 on the
  coach's own reference attack and set `CAPT_RUNS` to the measured
  slope (~0.06); keep the cap.
* **Risk:** minimal — selection-only, no ball-model change; matchday
  goldens for selection may re-bless.

### P2-6 · A cheap eye for the day's figures  [DO-NOT-CHANGE candidate]
Adding "runs conceded today" to the captain's score is tempting and
dangerous (feedback loops with the slip's determinism; risks yo-yo
changes). Recommend leaving unless P2-3 lands first and the churn is
gone; then a small penalty for `today's RPO ≫ his par` is safe to trial.

**Recommend NOT changing:** the pre-match ladder magnitudes, the
stamina/age laws, the temperament magnitude on its own, fieldAvg,
Rocket Arm, keeper slopes, the slip law's shape (including the 88
ceiling — it reads as "beyond this there is nothing left to read"),
and the between-match 35% flat recovery (flat is simple and the
workload side already differentiates trades; only revisit if P2-1
lands and in-match/between-match stop rhyming).

## 17. Final questions, answered

**FATIGUE**
1. *Does stamina matter enough?* Yes — 12 runs/16 win points across an
   attack's span, ~2.6 runs on one bowler; visible, not dominant.
2. *Does intra-match rest work realistically?* No. Drinks and the
   break are the only recovery; resting overs repay nothing (RED).
3. *Is workload management meaningful?* Yes at selection level (sixth
   bowler, aiPickBowler's tank/spell penalties); no at the
   rest-and-return level (see 2).
4. *Is rotation meaningful?* Yes — the between-match law makes daily
   seam bowling unsustainable and rest days matter; but recovery speed
   is identical for every man alive.

**EXPERIENCE**
5. *What does it actually do?* Pressure-scaled composure (wicket/dot)
   both ways, plus a whisper of always-on strike rotation; nothing
   tactical.
6. *Context-sensitive?* Yes, cleanly — one shared pressure number.
7. *Too strong or weak?* Weak: full span ≈ 3.5 runs/inn for a bat,
   0.17 wkts for a bowler. +10 exp ≈ 0.4 runs. Defensible, but under
   half of temperament's same-trigger effect — a card grade of it is
   nearly invisible.
8. *Different from temperament?* Mechanically no (batting), only in
   gain and in having a bowler side. The audit's clearest duplication.

**CAPTAINCY**
9. *What does it do?* Chooses bowlers well or badly. That is ~all, and
   that is the right design.
10. *Worth?* ≈1 win point / 0.5 conceded runs per 10 points; ~8 win
    points and ~4 runs across 20→95; regret 0.5–2.9 runs/over in posed
    hard calls.
11. *Believable decisions?* Yes — conditions-aware, fatigue-aware,
    bounded errors; blind to day's figures and the tail.
12. *Unrealistic thresholds?* No cliff in behaviour: linear to 88,
    flat after. The 92 branch is dead code. The 88 ceiling means 88=99,
    worth knowing when pricing.
13. *Distinct from experience?* Fully.

**FIELDING**
14. *Elite fielding worth?* ~100 runs/50ov and an 80-point win swing v
    poor across the full scale; ~65 runs over the realistic 40→80
    band; ~14 runs per +10. Two to three times real cricket.
15. *Individual fielders?* Real and strong: posts, cordon edges,
    hidden weak men; one elite ≈ +6 win points, one liability ≈ −10.
16. *Catches realistic?* Rates and variance yes (conversion 52%→97%
    exact, unreachable chances at every skill, 95 still drops 1-in-20);
    the *team consequence* of the rates is what runs hot.
17. *Run-outs realistic?* Frequency yes (0.61/inn); the skill story is
    thin (no arm attribute, Rocket Arm mild, no deterrence).
18. *Fielding × fatigue sensible?* Only a third of it: ground yes
    (pre-match only), hands never, in-match tank never.
19. *Too weak/strong?* Too strong at team scale — the audit's largest
    cricket distortion (P1a), though internally consistently priced.

**KEEPING**
20. *Keeper quality value?* ~3–5 runs + 4–5 win pts per 10 —
    surface-coupled (stumpings on turn, biggest total slope on
    green/pace, matching the coach's evidence). Real, arguably a size
    up.
21. *Keeper workload?* Between matches yes (+7/day bill); in-match no.

**SYSTEM**
22. *Matters most:* team fielding/catching, then the pre-match fatigue
    ladder (word ≈ half a skill class), then temperament-under-
    pressure.
23. *Matters least:* the ballDist captaincy sliver (by design), then
    Rocket Arm, then experience's always-on rump.
24. *Effectively decorative:* the 36-ball longSpell term below elite
    captaincy; the `capt ≥ 92` branch; (near-) the wRO cap at 2 arms.
25. *Secretly overpowered:* team fielding — hidden in plain sight (the
    B2 weights state it; nobody had put it in cricket units). Plus the
    coach's CAPT_RUNS premium as an overpriced *valuation*.
26. *Double-counting:* experience ↔ temperament (batting composure),
    partially. Everything else clean.
27. *Five biggest realism problems:* (1) team fielding magnitude;
    (2) no intra-match rest recovery; (3) one-over spell churn;
    (4) exp/temperament duplication; (5) fatigue-immune hands/gloves —
    with the coach's captaincy price and the captain's two blind spots
    as honourable mentions.
