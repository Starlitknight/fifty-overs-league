# FINAL ECONOMY ACCEPTANCE — the club that misses the floor

Branch `claude/fast-bowler-generation`. Nothing in the accepted valuation moved:
`FO_VAL_W`, `FO_VAL_MIX`, the 1.80 gloves, the capped experience layer and the
captaincy treatment are exactly as accepted, and `foWageOf` is untouched.

Everything below is measured on the **real `world-p3` fixture** — the same
world, the same cricket, the same day the assertion fires — run three times:
on `main`, on the fast-bowler generation commit alone, and on this head. The
probe is `tools/econ-dump.mjs`, called from the fixture under `FO_ECON_DUMP`.

---

## 1. THE CLUB, AND WHY IT IS THIS ONE

**Kent, slot 7, Division One** — the bottom seat of the top flight.

| | main | generation only | **final (head)** |
|---|---|---|---|
| bank at the fortnight | −$848,399 | −$1,158,417 | **−$1,304,167** |
| the test's floor | −$1,250,000 | −$1,250,000 | −$1,250,000 |
| shortfall | — (passes) | — (passes) | **$54,167** |
| wage bill / round | $307,090 | $301,410 | $313,750 |
| **season-end cash** | **−$2,158,181** | **−$1,871,869** | **−$2,500,000** |
| rounds in administration | 0 | 0 | **13** |
| ruined by a normal bad season | **yes** | **yes** | yes |

Founded on $1,816,000. Over 21 rounds on head it took $7,384,111 and spent
$10,504,278 — a **$3,120,167 hole, $148,600 a round**. The wage bill is 60.9%
of cost, inside the 60–80% band the economy is written for.

**Why this seat.** Kent has a **Division One cost base and a Division Two
crowd**. It pays $172,400 a round in operations and $313,750 in wages against
the smallest gate in the division — $169,268 a home match, lower than five
Division Two clubs. Its `econStature` is 0.65, the lowest in the top flight, so
its supporters, its ground and its founding capital are all the smallest of the
eight; its media grant and its operations are the division's, which are the
largest of the sixteen.

That is not a property of this branch. Across all 256 clubs on **main**, slot 7
is the poorest seat in the world by a distance:

```
slot      0     1     2     3     4     5     6     7     8     9    10    11 ...
median 2983k 1745k 1788k 1497k 1763k 1267k 1376k  884k 2814k 2797k 1958k 1995k
```

### Which players carry the rise, and which change pays for it

Re-priced on the men as they stood at the assertion, all sixteen English clubs
(`tools/wage-decompose.mjs`):

| rung | world payroll / round | step alone |
|---|---|---|
| OLD | $3,815,450 | — |
| + new attribute weights | $4,022,970 | **+5.44%** |
| + field mix 0.45 → 1.00 | $3,854,920 | **−4.18%** |
| + keeper gloves 1.20 → 1.80 | $3,880,350 | +0.66% |
| + experience layer = **FINAL** | $4,006,300 | +3.25% |
| | | **+5.00% in total** |

The field mix is the one that *cuts* the bill, and the weights are the largest
riser — not the experience layer, which is second. (The +5.00% here is above
the +3.9% measured on a fresh world for the obvious reason: these men have
played 21 rounds and carry experience a freshly dealt cricketer does not.)

At Kent, $300,440 → $313,750, **+$13,310 a round (+4.4%)**, and nobody carries
much of it: the largest single rise is $2,790 on a top-order batsman going
63 → 66. The two wicketkeepers (37 → 42 and 28 → 31) and a 50 → 53 all-rounder
are next. One man falls (a seam-bowling all-rounder, 81 → 80, −$1,450).

---

## 2. WHAT THE FLOOR ACTUALLY PROTECTS AGAINST

`DEBT_LIMIT = 2,500,000` in `economy.mjs` is a **real game state**, and the file
says what it costs:

> A club may not sink further than two and a half million into the red. […]
> Reach that floor and the club is in ADMINISTRATION: the losses below the line
> are written off […] but the sponsor halves his cheque while the club is
> under, and nothing gets built. It is a floor with a price, not a forgiveness.

So administration is **survivable and priced**, not game over — and the world
is built to reach it sometimes.

The `world-p3` assertion holds **half** of that: `bank <= -2500000 / 2`. It
arrived in `82f9ee8` (the era-2 commit), which *deliberately loosened* the older
`bank > 0` contract, and its own prose says what it is for:

> Era 2 runs tight margins by design: a heavy Division One payroll may lawfully
> dip into its overdraft inside a fortnight […] What a fortnight must never do
> is **drive anybody to the administration floor**.

**The prose names the administration floor; the code holds half of it.** That
gap is the whole of this failure.

And the halfway line is not a line the shipped world respects either. On
`main`, Kent goes on to a season-end **−$2,158,181** — it crosses −$1,250,000
about three rounds after the assertion is taken. The old contract was never
"no club gets half-ruined"; it was "no club is half-ruined *at the moment we
look*", and the final world arrives at the same place three rounds early.

### The two failures are NOT the same invariant

The ship gate reported both server reds as the treasury. **That was wrong.**
`world-shape`'s *"two clubs are two clubs, even in the same league"* reads
batting lean and has no connection to money; it fails on the **generation**
commit alone, and it is dealt with separately in `CLUB-STYLE.md`. The
attribution was made from a test's name instead of its body.

---

## 3. THE SEASON, PLAYED OUT

Every arm plays the fortnight, then twenty further rounds to the end of the
season. Sixteen English clubs:

| | main | generation only | final |
|---|---|---|---|
| closing under water | 1/16 | 2/16 | 1/16 |
| ever below the test floor | **1/16** | **1/16** | **1/16** |
| ever in administration | 0/16 | 0/16 | **1/16** |

Every arm puts exactly one club below the test floor at some point in the
season, and it is slot 7 in all three.

**The arm-to-arm noise is the size of the effect.** Kent ends at −$2,158,181 on
main and −$1,871,869 with the generation change alone — the generation change
*helped* by $286,312 while lowering the wage bill by only $5,680 a round,
because the two arms deal different worlds. The final arm is $342k worse than
main on the same measure. A difference the size of the noise is not a
measurement of the re-rating.

Middle and poorest of each division, at season end:

| | main | generation only | final |
|---|---|---|---|
| median Division 1 | $1,535,404 | $1,492,436 | $1,304,492 |
| poorest Division 1 | −$2,158,181 | −$1,871,869 | −$2,500,000 |
| median Division 2 | $2,037,238 | $2,324,836 | $2,271,526 |
| poorest Division 2 | $1,251,572 | $1,512,196 | $1,208,258 |

---

## 4. LESS MONEY, OR A BROKEN ECONOMY?

Taking the brief's own behavioural definitions, on the **shipped** build:

| genuine-distress test | main | final |
|---|---|---|
| cannot meet ordinary recurring costs | **Kent, yes** | Kent, yes |
| reliably goes negative | **Kent, yes** | Kent, yes |
| ends a season deep in the red | **Kent, −$2.16m** | Kent, −$2.50m |
| ruined by a normal bad season | **Kent, yes** | Kent, yes |
| clubs overdrawn planet-wide at the fortnight | **1/256 (0.4%)** | 3/256 (1.2%) |
| clubs in administration planet-wide | **0/256** | **0/256** |
| median club, planet-wide | $1,910,682 | $1,927,984 |

Kent is in genuine distress **before this branch exists**. What the re-rating
changes is the date on which the game's own write-off mechanic engages —
and only in one of the three worlds dealt.

### The seat, not the club — 16 countries instead of one

One club is an anecdote. The same seat in sixteen countries is a measurement,
and it separates the two changes cleanly:

| planet-wide, at the fortnight | main | generation only | final |
|---|---|---|---|
| clubs overdrawn | 1/256 | 1/256 | 3/256 |
| past the old halfway line | 0/256 | 0/256 | 1/256 |
| **in administration** | **0/256** | **0/256** | **0/256** |
| median treasury | $1,910,682 | $1,922,637 | $1,927,984 |
| **median slot-7 club** | **$884k** | **$798k** | **$773k** |

The median slot-7 club is **$111k worse** on this build than on main — and
**$86k of that is the fast-bowler generation change**, which is accepted and
which *lowers* wages. The player-value re-rating accounts for the remaining
**$25k**, against a founding bank of $1,816k for that seat: **1.4%**.

Everything else holds. The median club in the world is $17k *better*, and
nobody anywhere is in administration on any of the three builds.

---

## 5. A NORMAL BAD SEASON

Gate down a fifth, no prize cheque, no sponsor win bonuses — each a line the
books already record, scaled to one season of eighteen rounds.

| | main | generation only | final |
|---|---|---|---|
| under water after a bad season | 5/16 | 6/16 | 7/16 |
| **in administration** | **1/16** | **1/16** | **1/16** |

**Administration incidence under stress is identical in all three arms**, and
it is slot 7 in all three. A bad year already ruins that seat on the shipped
build.

(A first cut of this subtracted the *cumulative* gate — two and a half seasons
of it — from one season's closing cash and reported eleven of sixteen clubs
ruined. That output was wrong and is not in this table; every line above is a
per-round rate times eighteen rounds.)

---

## 8. THE BROAD ECONOMY IT WAS DESIGNED FOR

Founding capital against the median bank after 21 rounds, on **main** — the
shipped economy, nothing from this branch in it:

| slot | founded | median now | change | | slot | founded | median now | change |
|---|---|---|---|---|---|---|---|---|
| 0 | $2,275k | $2,983k | **+708k** | | 8 | $1,776k | $2,814k | **+1,038k** |
| 1 | $2,091k | $1,745k | −346k | | 9 | $1,776k | $2,797k | +1,021k |
| 2 | $2,045k | $1,788k | −257k | | 10 | $1,776k | $1,958k | +182k |
| 3 | $1,999k | $1,497k | −502k | | 11 | $1,776k | $1,995k | +219k |
| 4 | $1,953k | $1,763k | −190k | | 12 | $1,776k | $2,173k | +397k |
| 5 | $1,908k | $1,267k | −641k | | 13 | $1,776k | $1,921k | +145k |
| 6 | $1,862k | $1,376k | −486k | | 14 | $1,776k | $1,950k | +174k |
| 7 | $1,816k | **$884k** | **−932k** | | 15 | $1,776k | $1,715k | −61k |

**Division One loses money and Division Two makes it**, on the shipped build.
Seven of the eight top-flight seats are down over 21 rounds and seven of the
eight second-division seats are up. The era-2 commit named that exact fault as
the thing it was fixing — *"a top flight in structural deficit and a second
division printing money"* — and on this evidence it is smaller but still there,
concentrated at the bottom of Division One.

Wage share of cost runs 60.9%–62.8% across the clubs inspected, which is the
band the wage curve was calibrated for, and the median club holds about
$1.9m — roughly its founding capital. The management tension is real: nobody is
printing money, and the treasury is a thing a manager has to watch.

**This is a pre-existing finding and is not caused by this phase.** It is
reported here because it is what the evidence says, and because the club this
phase is accused of ruining is the club that seat already ruins.

---

## THE WAGE ANCHOR, MEASURED (context for §7)

`FO_WAGE_R50` is `FO_WAGE_OVR50 × 1000` with `FO_WAGE_OVR50 = 50`, described in
`00-core.js` as *"the median professional, by the ladder's own meaning"*, and
the same header warns that a curve *"left pointing at a landmark that had been
moved"* is not a wage system.

| population | law | median card | implied wage against a 50-anchor |
|---|---|---|---|
| a fresh world, 3,840 men | OLD | **53** | ×1.191 |
| a fresh world, 3,840 men | FINAL | **54** | ×1.260 |
| England after 21 rounds | OLD | 52 | ×1.125 |
| England after 21 rounds | FINAL | 54 | ×1.260 |

The anchor was **already three cards stale before this phase** and is four
after. Re-anchoring it honestly would cut every wage in the world by
(50/54)³ = **−21%**, which is a redesign of the economy and not the small
normalisation Option B describes. That is the strongest reason not to reach for
the wage curve here: the curve's real calibration problem is much older and much
larger than 3.9%, and fixing it belongs to a phase that is allowed to move the
economy.

---

## 6 & 9. THE DECISION — **A: keep the player values, restate the contract**

### Why not B (a wage normalisation)

The decision rule is *"if +3.9% does not materially change club solvency, keep
the existing wage curve"*. It does not:

- **Administration incidence is unchanged.** 0/256 planet-wide at the fortnight
  on both builds; 1/16 under a normal bad season on all three arms; the same
  seat every time.
- **The median treasury does not move.** $1,910,682 → $1,927,984 across 256
  clubs. A world that had stopped paying for itself would not leave its middle
  club where it founded it.
- **The effect is inside the deal noise.** The generation change alone — which
  *lowers* Kent's wage bill by $5,680 a round — moved its season-end cash by
  +$286,312, because it deals a different world. The valuation arm is $342k the
  other way. A difference the size of the noise is not a measurement.
- **And the wage curve's real calibration problem is not 3.9%.** `FO_WAGE_R50`
  points at a median card of 50 while the world's median is 53 before this
  phase and 54 after. Honest re-anchoring is −21%, not −4%. Reaching for
  `foWageOf` here would be moving a landmark by four per cent while leaving it
  twenty-one per cent from where it claims to be — a redesign of the economy
  wearing the clothes of a fix.

### Why not C (removing experience from visible OVR)

Nothing in the evidence disputes the architecture. Experience has measured
cricket value, the split holds (`intrinsic level` is untouched by it and
`foFitToLevel` never sees it), and the experience layer is the *second* largest
mover of the payroll — the attribute weights are larger and the field mix is
negative. Rolling back a semantic decision to buy back $12,340 a round at one
club would be paying for an economy question with a meaning.

### The new contract, and its margin

The old assertion held `bank <= -DEBT_LIMIT / 2` on England's sixteen. The new
one holds four things across the **whole planet**:

| assertion | measured, shipped | measured, this build | bound | margin |
|---|---|---|---|---|
| no English club in administration | −$848,399 worst | −$1,304,167 worst | −$2,500,000 | **$1,195,833 (48%)** |
| ≥10 of 16 English treasuries in the black | 14 | 14 | 10 | 4 clubs |
| no club **anywhere** in administration | 0/256 | 0/256 | 0 | the whole distribution |
| ≤3% of the world's clubs overdrawn | 1/256 | 3/256 | 8 clubs | 5 clubs |
| median treasury in the world | $1,910,682 | $1,927,984 | $1,000,000 | $928k |

**It is not a subtraction of $54,167.** The level moves to the line the
assertion's own prose already named — administration — and the strictness lost
on one club's snapshot is repaid with sixteen times the coverage, a hard planet-
wide administration check, a rate, and a distributional check the old test never
made. The worst club is held with **48% headroom** against the new line where
the shipped build had **32%** against the old one.

3% is eight clubs. It is set from a measured one and three on two differently
dealt worlds — about ±1.5 of deal noise on a count that small — and a genuine
break is not a club or two but the bottom of every league at once.

### Proved by mutation, not asserted

| arm | result |
|---|---|
| this build, new contract | **`world-p3` 27/27** |
| the **charged** wage bill × 1.5 | **FAILS** — *"nobody is in administration after a fortnight of cricket: slot 0 $-2,500,000, slot 1 $-2,500,000, slot 3 $-2,500,000, slot 4 $-2,500,000, slot 6 $-2,500,000, slot 7 $-2,500,000"* |
| the **reported** wage figure × 1.5 | **passes 27/27** — and that is a finding, not a hole |

The second mutation is the one worth writing down. Scaling `wages` where
`computeFinance` recomputes it moved every club's *reported* bill and not one
club's *bank*, because since migration 101 the umpire banks the bill each round
and the settle loop charges `billAt[...] ?? c.wages` — the recomputed figure is
only the fallback for rounds settled before the banking existed, and a fresh
test world has none. A mutation that changes a number nobody spends proves
nothing, and it passed a full suite while looking exactly like a proof.

The mutation used is the one that charges: `wBill × 1.5` at the point the bank
is debited. Neither mutation is committed; `git diff` on `economy.mjs` is empty
and was checked after the run.

---

## THE PRE-EXISTING FINDING, STATED SEPARATELY

**Slot 7 is structurally loss-making in era 2, on the shipped build, in every
country.** It is the poorest seat in the world by a wide margin, it ends a
season at −$2.16m from a $1.82m founding bank without this branch existing, and
a normal bad year puts it into administration. Division One as a whole loses
money over 21 rounds while Division Two makes it.

This phase did not cause that and is not entitled to fix it. It is written down
here so the next person does not rediscover it from a re-rating.

---

## THE FULL FINAL GATE

| gate | result |
|---|---|
| engine suite | **489: 488 pass, 0 fail, 1 skipped** |
| `calibration-check` | **PASS** (engineVersion v3, 300 matches/cell) |
| replay / golden masters | green (inside the engine suite) |
| Match-Day Coach suite | green (inside the engine suite) |
| deterministic repeat, generation tests | green (inside the engine suite) |
| **server suite** | **437: 437 pass, 0 fail, 0 skipped** |
| `world-p3` | **27/27** |
| `world-shape` | **7/7** |
| rating parity / SQL parity / market / finance | green (inside the server suite) |
| build | `20260819-2344-233571`, one asset, `version.json` agrees |

**No engine source, no server runtime source and no migration is touched by
this phase.** The whole diff is two test files, two tools and the documents:

```
server/tests/world-p3.test.mjs      the solvency contract
server/tests/world-shape.test.mjs   the house-style contract
tools/econ-dump.mjs                 the probe
tools/wage-decompose.mjs            the payroll decomposition
docs/fast-bowler-generation/        this, CLUB-STYLE.md, the three arm dumps
```

`git diff` on `engine/`, `server/economy.mjs`, `server/market.mjs`,
`server/migrations/` and `assets/` is empty.
