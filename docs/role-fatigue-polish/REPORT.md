# ROLE-SPECIFIC FATIGUE POLISH

Branch `claude/role-fatigue-polish`, built on fielding-realism main
(`57223f8`). Gameplay changes; **not merged, not deployed, goldens
held.** Instrument: `tools/role-fatigue-probe.mjs`; evidence beside
this file. Three narrow subjects — the bowling-type workload
hierarchy, the wicketkeeper's in-match workload, and fatigue's touch
on captaincy judgement — with outfield catching, the 2B fielding
slopes, captaincy's tactical model, and economy/OVR/wages untouched
by explicit scope guard (the diff proves it: the fatigue-law block,
three keeper read-sites, two judgement multipliers, and the server's
per-over constants).

## 1. The shipped picture (`ladder-baseline.json`)

A forced continuous ten-over spell, one test bowler per type,
otherwise identical cards, N=250 paired seeds:

| type | peak tank (st 50) | econ drift o1-3 → o8-10 | wkts |
|---|---|---|---|
| fast | 1.182 | +1.32 rpo | 1.43 |
| fast-medium | 1.138 | +1.36 | 1.10 |
| medium | 1.095 | +1.65 | 0.91 |
| finger spin | **1.095 (= medium)** | +0.59 | 0.62 |
| wrist spin | **1.095 (= medium)** | +0.47 | 0.88 |

The pace ladder existed (1.08/1.04/1.00); spin was TIED to medium
inside the match while the server charged it 1.5/over against pace's
flat 2.4 between matches — one physical claim made in one system and
denied in the other, and all three pace trades priced identically
between matches.

## 2. The frozen hierarchy

**In-match** (`foBowlWorkFactor`): fast 1.08 > fast-medium 1.04 >
medium 1.00 > **spin 0.90**. The spin sweep (0.94/0.90/0.85) moved
cricket outputs within noise everywhere — the tank ladder is the
point, and 0.90 is the smallest separation that is *real*: a
spinner's ten-over spell peaks 10% below a medium's (0.985 v 1.095 at
stamina 50), deterministically, at every stamina. Finger and wrist
spin measured inseparable (drift differences sub-SE) and stay one
bucket, as the brief prefers. A spinner bowling more overs still
accumulates real totals — the factor is per ball, not a discount on
the day.

**Between matches** (`server/living.mjs`): per-over loads become 2.4 ×
the same pace factors — **fast 2.6 / fast-medium 2.5 / medium 2.4 /
spin 1.5** (spin keeps its shipped value; the in-match law now
expresses the same direction at 0.90). One classification, two
scales, one ordering — §B satisfied with the engine's
`foBowlWorkFactor` as the canonical statement and the server
constants cross-referenced to it. Ten-over shifts now load 32/31/30/21
(post-match 20.8/20.2/19.5/13.7); daily-grind steady states
59.4/57.6/55.7/39.0 — the fast bowler needs his rest days first,
which is cricket. Coach projections (`foFatProject`) inherit the spin
factor automatically through the one shared law.

**Fatigue cost per 10 overs, in-match tank at stamina 50**: fast
1.18, fast-medium 1.14, medium 1.10, spin 0.99. Between matches:
fast 26, fast-medium 25, medium 24, spin 15 (plus the base 6 all
fielders pay).

## 3. The keeper works now (`keeper-evidence.json`)

Shipped: a keeper's tank read **exactly 0.000** after fifty overs
behind the stumps — he was charged 7 between matches for work the
match never noticed. Frozen law: `foFatKeepPerBall` (the batting
law's shape over divisor **550**), accrued per legal ball kept
through the existing `M.fat` — no separate glove meter — with the
keeper exempt from off-spell rest while keeping (a man behind the
stumps is working, by the rest loop's own logic; without the
exemption the Phase 2A decay ate the accrual ball for ball — the §C
interaction, audited and closed).

**Keeping first → batting second** (50 overs kept, then batting):

| stamina | tank at break | bat runs (v not-kept) | out% |
|---|---|---|---|
| 30 | 0.378 | 23.2 v 26.9 (−3.7) | +4.7pp |
| 50 | 0.326 | 25.0 v 26.7 (−1.7) | +3.1pp |
| 70 | 0.274 | 26.1 v 26.7 (≈0) | +0.3pp |
| 90 | 0.222 | 26.2 v 26.2 (0) | −0.5pp |

Fifty overs of keeping costs about **a third of a bowling shift**,
and a high-stamina keeper copes naturally through the existing law —
exactly the D-test shape. Keeper-batsmen are not disproportionately
punished (see §6).

## 4. The gloves late in the innings (`glove-evidence.json`)

`foGloveFat` = **4** quality points per unit of tank, applied at the
three live contest sites only (catch behind, stumping, byes) — never
the card, never the coach's pricing, never general outfield catching
(§F: untouched, by scope guard). At the frozen keeping law a keeper
who has kept fifty overs is **~1.3 points down**: stumping misses
+0.5pp per chance, one extra bye every ~40 innings, routine takes
essentially unmoved. Deliberately below what N=300 of simulation
resolves — the sweep table shows every event rate within noise — and
stated exactly from the contest math instead. Skill dominates by two
orders: a tired keeper-90 is a 88.7; a fresh keeper-60 is a 60.
The keeper-value regression confirms the slopes: stumpings
0.097/0.220/0.353 and byes 3.29/1.99/1.31 across keeping 50/74/95 —
the 2B guard numbers with a uniform ~+0.1-bye lift from the new work,
slope intact.

## 5. The tired mind (`captfat-evidence.json`)

`foCaptFatWiden` multiplies the three judgement channels (reading
noise, continuation anchor, field slip) by `1 + 0.4 × load`, load =
pre-match fatigue + half the in-match tank, capped at 1. The stored
skill never moves; no wicket, no team debuff, no bowling-skill
channel — decisions only, deterministic like everything the captain
does.

Measured in the difficult fixture (N=250/cell; cf=0 control confirms
fatigue words alone change nothing in decision quality):

| captain | state | off-true picks | wrong field |
|---|---|---|---|
| 70 | rested | 24.3% | 21.7% |
| 70 | exhausted | 26.6% | **28.5%** |
| 95 | rested | 18.5% | 4.8% |
| 95 | exhausted | 19.2% | 6.4% |

The same captain tired is visibly sloppier — a third more wrong
fields at 70 — while an exhausted 95 (equivalent reading error of a
fresh ~93) still beats a **rested** 70 on every column. The run/win
cost of the widening sits below simulation noise; the totals move
through the physical channel a tired player already pays, which is
the "no magical debuff" the brief ordered. The armband's between-match
+4 (`LOAD_CAPTAINCY`) is kept as-is: it adds ~7.4 steady points on a
daily grind — real, modest, verified in §6.

## 6. The double-duty men (`combos.txt`)

Per-appearance between-match loads (steady daily state ×1.857):
specialist bat + captain 12.0 (22.3); **keeper + captain 18.0
(33.4)**; keeper-batter + captain 19.0 (35.3); spinner + captain
25.5 (47.4); fast bowler + captain 36.5 (67.8). The keeper-captain
carries less than a plain fast bowler without the armband (32.5 /
60.4); the heaviest life in the game is the fast-bowler-captain,
which is cricket. In-match, keeper-captain v split duties, N=300
paired: **win −0.2±1.0 pts, his own batting +0.4±0.7 runs** — no
double punishment anywhere near unusability.

## 7. Regression (§K)

- Environment (same seeds as the fielding phase): scoring 270.1 →
  269.2/50ov, wickets 7.22 → 7.15, all-out and every phase rate
  within one SE, **pace/spin wicket split untouched** (5.14/2.08 →
  5.07/2.08 — the factor changes what a spell costs, not what it
  takes); experience/temperament/sixth values in noise.
- Fielding same-league spread: P10vP90 6.1±1.7 v 5.1±1.4 before.
- Keeper value: slopes preserved (§4).
- Captaincy: <!-- CAPT-REG -->
- Suites: <!-- SUITES -->

Not merged, not deployed, goldens held for review.
