# ERA 2 ECONOMY REALISM — PHASE 2

Branch `claude/economy-realism-phase2`, from `e5657fd`. Two changes to
`server/financeconfig.mjs` and one to the settle loop in `server/economy.mjs`.
Nothing else moves: no player valuation, no wage curve, no wage, no match
physics, no attendance model, no sponsor merit logic, no media merit
distribution, no `econStature` floor, no starting bank, no transfer economy.
`git diff` on `engine/`, `assets/` and `index.html` is empty.

---

## A CORRECTION TO THE AUDIT, FIRST

**The Phase 1 audit overstated the playoff defect, and one of its headline
numbers was wrong.** It reported that winning the title left a club $855,000
poorer than topping the table and going home. That figure came from a model
that did not give the playoff rounds a **gate** — and the settle does: the walk
counts every match in `matches`, playoff rounds included, and `tick.mjs`
`fixturesFor` seeds the ties 1v4 and 2v3 **with the higher seed hosting**, then
the final with the higher seed hosting again. The club that tops the table
hosts both.

Measured with the gate where it belongs, on the shipped law:

| | audit said | actually |
|---|---|---|
| champion vs topping the table and going home | −$855,000 | **+$155,880** |
| a playoff round, for the club that hosts | −$577,500 | **−$72,060** |
| **a playoff round, for the club that travels** | — | **−$577,500** |
| D1 mean season net | −$919,381 | **−$720,481** |

The defect is real, but it is not where the audit put it. **It bites the club
that travels.** The semi-finals are 1v4 and 2v3 with the higher seed hosting,
so the third and fourth seeds play their extra week entirely away from home — a
full round of wages, operations and academy against nothing at all — and on the
shipped law:

- **qualifying fourth cost that club $507,660** for the privilege;
- **reaching the final as runner-up cost $649,560**.

Everything below is measured against the corrected baseline.

---

## 1. THE FROZEN BASELINE (shipped `main`)

Run from a worktree at `origin/main` with the identical model, so the only
difference between this and every arm below is the law
(`tools/economy-arms.mjs`, `docs/economy-realism-phase2/arm-baseline.txt`):

| seat | finish | revenue | cost | NET | after 1 | after 3 | after 5 | admin |
|---|---|---|---|---|---|---|---|---|
| D1/0 | 1 | $11,275,436 | $10,654,080 | +$621,356 | $2,896,356 | $4,139,068 | $5,381,780 | — |
| D1/1 | 2 | $9,350,647 | $9,240,000 | +$110,647 | $2,201,647 | $2,422,941 | $2,644,235 | — |
| D1/2 | 3 | $8,119,601 | $8,739,900 | −$620,299 | $1,424,701 | $184,103 | −$1,292,811 | — |
| D1/3 | 4 | $7,369,852 | $8,722,800 | −$1,352,948 | $646,052 | −$2,500,000 | −$2,500,000 | **s3** |
| D1/4 | 5 | $6,644,687 | $7,107,240 | −$462,553 | $1,490,447 | $565,341 | −$453,782 | — |
| D1/5 | 6 | $6,225,589 | $6,967,240 | −$741,651 | $1,166,349 | −$376,293 | −$2,100,000 | **s5** |
| D1/6 | 7 | $5,466,933 | $7,000,355 | −$1,533,422 | $328,578 | −$2,140,000 | −$2,140,000 | **s3** |
| D1/7 | 8 | $5,140,486 | $6,925,465 | −$1,784,979 | $31,021 | −$2,180,000 | −$2,180,000 | **s3** |
| D2/0 | 1 | $6,630,836 | $5,228,320 | +$1,402,516 | $3,178,516 | $5,983,548 | $8,788,580 | — |
| D2/1 | 2 | $5,780,029 | $5,258,720 | +$521,309 | $2,297,309 | $3,339,927 | $4,382,545 | — |
| D2/2 | 3 | $4,894,034 | $4,885,500 | +$8,534 | $1,784,534 | $1,801,602 | $1,818,670 | — |
| D2/3 | 4 | $4,530,400 | $4,932,750 | −$402,350 | $1,373,650 | $568,950 | −$251,667 | — |
| D2/4 | 5 | $4,093,113 | $3,408,720 | +$684,393 | $2,460,393 | $3,829,179 | $5,197,965 | — |
| D2/5 | 6 | $3,824,455 | $3,382,400 | +$442,055 | $2,218,055 | $3,102,165 | $3,986,275 | — |
| D2/6 | 7 | $3,393,828 | $3,322,060 | +$71,768 | $1,847,768 | $1,991,304 | $2,134,840 | — |
| D2/7 | 8 | $3,234,261 | $3,391,780 | −$157,519 | $1,618,481 | $1,303,443 | $988,405 | — |

**D1 mean −$720,481 · D2 mean +$321,338 · administration 4/16 · 6 of 8 D1
seats losing.**

The audit's other findings all survive the correction and are re-measured here:
promotion held fixed **+$1,540,392**; relegation **−$176,077**; slot 7 the
hardest seat (−$1,784,979, administration in season 3); the top-flight
operations premium the principal division-level problem; the wage re-rating not
the cause.

---

## 2 & 3. THE PLAYOFF FIX

### What was wrong

`economy.mjs` charges wages, club operations and the academy for **every round
a club plays** — `for (const slot of playing)` — and paid the media installment
and the sponsor's guarantee only for **league** rounds:

```js
} else if (rdNo >= 1 && rdNo <= curR) {     // curR is 14
```

Rounds 15 and 16 are the semi-final and the final. A club that reached them
bought two more weeks of its entire cost base out of a season's income that had
stopped.

### The law now

One function, because there are two of these grants and they must arrive on the
same terms or a club's year does not add up:

```js
// financeconfig.mjs
export function centralInstallment(seasonTotal, round, leagueRounds) {
  const G = Math.round(seasonTotal || 0), R = Math.max(1, leagueRounds | 0);
  if (round < 1) return 0;
  if (round <= R) return Math.round(G * round / R) - Math.round(G * (round - 1) / R);
  return Math.round(G / R);                      // a play-off round is a round
}
```

and the settle's gate becomes `} else if (rdNo >= 1) {`, calling it for both the
media and the sponsor's guarantee. The ledger labels the extra line
*"Media distribution · play-off round"* so a statement reads honestly.

**No jackpot was invented.** No prize, no sponsor bonus, no gate multiplier
moves. A club that earns an extra week takes one ordinary week's central money
for it — the same principle the fourteen league rounds already run on. Win
bonuses stay league-only, which was already a deliberate decision (*"playoff
wins are paid through the title bonus instead, so the same run is never sold to
the sponsor twice"*). The season **pool** grows only for clubs that earn extra
rounds, which is the thing a broadcaster pays extra to televise.

The fourteen league installments still sum to the grant **to the exact dollar**;
that property is not weakened, it is asserted separately.

### 4. What the fix returns, decomposed

The same club, the same league season, payroll fixed — the club that tops the
table and therefore hosts both ties:

| outcome | media | sponsor | gate | prize | cost | NET | step |
|---|---|---|---|---|---|---|---|
| tops the table, no playoff | $2,750,000 | $1,728,069 | $2,964,967 | $850,000 | $8,085,000 | +$1,371,836 | — |
| loses the semi-final | $2,946,429 | $1,851,503 | $3,470,407 | $850,000 | $8,662,500 | +$1,619,639 | **+$247,803** |
| loses the final | $3,142,858 | $1,974,937 | $3,975,847 | $850,000 | $9,240,000 | +$1,867,442 | **+$247,803** |
| **wins the final** | $3,142,858 | $1,974,937 | $3,975,847 | $1,150,000 | $9,240,000 | **+$2,167,442** | **+$300,000** |

**Champion vs topping the table and going home: +$155,880 → +$795,606.**

And by seat, Arm A against the baseline (only the eight playoff seats move; the
other eight are identical to the dollar, which is the control):

| seat | baseline NET | Arm A NET | returned |
|---|---|---|---|
| D1/0 champion | +$621,356 | +$1,269,194 | **+$647,838** |
| D1/1 finalist | +$110,647 | +$737,653 | **+$627,006** |
| D1/2 semi-finalist | −$620,299 | −$314,065 | +$306,234 |
| D1/3 semi-finalist | −$1,352,948 | −$1,053,879 | +$299,069 |
| D2/0 champion | +$1,402,516 | +$1,779,232 | +$376,716 |
| D2/1 finalist | +$521,309 | +$890,759 | +$369,450 |
| D2/2, D2/3 | +$8,534, −$402,350 | +$189,627, −$224,889 | +$181,093, +$177,461 |
| **D1/4–7, D2/4–7** | | | **$0 — unchanged** |

### 5. The regression test

`server/tests/world-economy.test.mjs`, *"a play-off week costs a club exactly
what an ordinary week costs it"*. It deliberately does **not** assert
`champion bank > runner-up bank` — two clubs with different squads, crowds and
finishes can land either way for reasons that have nothing to do with this. It
asserts an **incremental invariant about one club**:

> the central money that arrives in a club's play-off week — which does not
> depend on the crowd or the result — must equal the central money that arrives
> in any of its league weeks

plus the other half of the symmetry, that the costs really were charged for
those weeks, so the test cannot go vacuous.

Run against the shipped law it fails with the plainest possible message:

```
not ok 7 - a play-off week costs a club exactly what an ordinary week costs it
  error: 'slot 0, round 15: a play-off week banked $0 of central money against
          $323919 in an ordinary league week - the round was charged and not funded'
```

Three existing assertions were **strengthened rather than relaxed** to state the
new law: the fourteen league installments still sum to the grant exactly *and*
each playoff installment must equal one ordinary round. An end-to-end
champion/runner-up sanity check is kept alongside.

On the shipped law the file fails **4 of 16**; on this branch it passes 16/16.

### 6. ARM A — the economy with the playoff fix only

| | baseline | **Arm A** | change |
|---|---|---|---|
| D1 mean net | −$720,481 | **−$485,463** | +$235,018 |
| D2 mean net | +$321,338 | **+$459,428** | +$138,090 |
| D1 seats losing | 6/8 | 6/8 | — |
| administration in five seasons | 4/16 | **4/16** | — |
| champion vs going home | +$155,880 | **+$795,606** | +$639,726 |
| runner-up reaching the final | −$649,560 | **−$22,554** | +$627,006 |
| fourth seed, semi away | −$507,660 | **−$209,448** | +$298,212 |

**The defect alone fixes the defect and not the pyramid.** It returns about a
third of Division One's structural deficit and moves no seat out of
administration, because the four seats that fail are the four that never reach a
playoff. That is the measurement §6 asked for, and it is why the second change
is needed.

---

## 7–9. THE TOP-FLIGHT OPERATIONS PREMIUM

### Current value

`OPS_TOPFLIGHT_ROUND = 60000` — $60,000 a round, **$840,000 a season**, a flat
line every top-flight club pays that buys it nothing and answers to nothing.

### The anchor nobody had measured

Promotion brings a club **$1,620,704 of guaranteed money**: $1,100,000 of extra
media and $520,704 of extra sponsor guarantee (the 70% guaranteed share of a
$743,863 sponsor premium). Both arrive whatever the crowd does and wherever the
club finishes.

At $60,000 a round the division takes $840,000 of that back before a ball is
bowled — a guaranteed premium of **1.93×** its guaranteed cost, while the squads
the top flight is *dealt* cost **2.5× to 4.6×** a second-division squad.

### The sweep

Swept 0 → $60,000 with the playoff law fixed, five seasons, sixteen seats
(`tools/economy-arms.mjs --sweep`):

| $/round | $/season | D1 mean | D1 losing | D2 mean | D2 losing | admin | normal D1 club |
|---|---|---|---|---|---|---|---|
| **$60k** | $840k | −$485,463 | 6/8 | +$459,428 | 2/8 | **4/16** | −$145,393 |
| $50k | $700k | −$336,864 | 6/8 | +$459,428 | 2/8 | 3/16 | −$5,393 |
| $40k | $560k | −$188,850 | 6/8 | +$459,428 | 2/8 | 3/16 | +$134,607 |
| $35k | $490k | −$115,100 | 5/8 | +$459,428 | 2/8 | **2/16** | +$204,607 |
| **$30k** | $420k | **−$41,350** | **5/8** | **+$459,428** | **2/8** | **2/16** | **+$274,607** |
| $25k | $350k | +$32,400 | 4/8 | +$459,428 | 2/8 | 2/16 | +$344,607 |
| $10k | $140k | +$253,650 | 4/8 | +$459,428 | 2/8 | 2/16 | +$554,607 |
| $0 | $0 | +$401,150 | 3/8 | +$459,428 | 2/8 | 2/16 | +$694,607 |

**Division Two does not move by one dollar at any candidate** — +$459,428 and
2/8 losing throughout. That is the control, and it holds exactly, because the
premium is a Division One line only.

And the invariants that must not break:

| $/round | promotion worth | relegation worth | frugal D1 | normal D1 | aggressive D1 | slot 7, 8th |
|---|---|---|---|---|---|---|
| $60k | +$1,540,392 | −$176,077 | +$887,317 | −$145,393 | −$2,026,563 | −$1,784,979 |
| $40k | +$1,820,392 | −$456,077 | +$1,167,317 | +$134,607 | −$1,730,909 | −$1,492,994 |
| **$30k** | **+$1,960,392** | **−$596,077** | **+$1,307,317** | **+$274,607** | **−$1,586,709** | **−$1,352,994** |
| $25k | +$2,030,392 | −$666,077 | +$1,377,317 | +$344,607 | −$1,514,609 | −$1,282,994 |
| $10k | +$2,240,392 | −$876,077 | +$1,587,317 | +$554,607 | −$1,304,271 | −$1,072,994 |

### The recommendation: $30,000 a round

**Fitted from behaviour, not parity** — deliberately *not* the value that
equalises the divisions, and deliberately *not* a removal.

- **The guaranteed premium now covers its guaranteed cost 3.86×**, up from
  1.93×, which sits inside the 2.5–4.6× band the payroll ladder spans. That is
  the principled anchor; the behaviour below is the confirmation.
- **Division One stops draining without printing**: mean −$720,481 → −$41,350,
  which is break-even on aggregate rather than a slope.
- **Administration halves, 4/16 → 2/16**, and both survivors are the two weakest
  seats — which is what a minnow is for.
- **Normal management is sustainable**: a normal top-flight club makes
  **+$274,607** at a mid-table finish; on its own seat's dealt payroll (D1/4,
  fifth of eight) it runs −$42,553 a season against a $1,953,000 bank — 46
  seasons of runway, and $1,740,235 still in hand after five.
- **Aggressive spending still burns $1,586,709 a season** and reaches the floor.
- **Promotion is worth MORE** (+$1,540,392 → +$1,960,392) and **relegation hurts
  MORE** (−$176,077 → −$596,077). Sustainability was not bought by making
  relegation attractive; it was bought by making the top flight worth reaching.
- **Division Two is untouched**, to the dollar.

$25,000 — the audit's indicative figure — also passes, and gives a *profitable*
normal club (+$344,607) and a D1 mean of +$32,400. It was rejected as more
change than the criteria need: at $30,000 the top flight still costs $420,000 a
season more to run, which is the point of a top flight.

---

## 10. SLOT 7

Re-tested with both changes. **Not rescued, and not subsidised** — no
slot-specific anything was added:

| slot 7 | payroll/rd | net | bank after 5 | administration |
|---|---|---|---|---|
| 8th, its own payroll | $287,420 | −$1,352,994 | −$2,180,000 | **season 3** |
| 8th, trims 20% | $229,936 | −$548,218 | −$1,368,719 | **never** |
| 5th, its own payroll | $287,420 | **+$226,564** | $2,948,820 | never |
| 5th, spends 35% more | $388,017 | −$1,181,794 | −$2,050,000 | season 3 |

- **normal management can survive it** — a mid-table finish is profitable, and
  even finishing last is survivable if the manager trims a fifth off the wage
  bill;
- **bad management can fail** — overspending from a mid-table finish ruins it;
- **administration is possible but not predetermined** — it needs both a bottom
  finish *and* no adjustment.

That is the §10 target met. **The residual is reported rather than fixed**: the
seat still loses $1.35m if it finishes last on its dealt payroll, because it is
dealt a `d1b` squad and always finishes last. So is D1/3 — a `d1a` payroll
finishing fourth, −$603,879. **Those are payroll-against-position mismatches,
which is the stale `econStature` floor's business and not this line's.**

---

## 11. FIVE SEASONS

| | baseline | **final** |
|---|---|---|
| D1 median treasury after 5 | −$1,696,406 | **+$1,018,486** |
| D2 median treasury after 5 | $3,060,558 | $3,355,205 |
| clubs reaching administration | 4/16 | **2/16** |
| poorest after 5 | −$2,500,000 | −$2,180,000 |
| richest after 5 | $8,788,580 | $11,020,970 |

**Division One no longer steadily drains**: five of eight seats end season five
in the black, against two of eight on the baseline, and the two that fail are
the two weakest.

**Division Two still compounds, and this phase cannot fix that.** D2/0 reaches
$10,672,160 and D2/4 $5,197,965 over five seasons. It is unchanged by the
premium at every candidate because the premium is a Division One line. The
cause is the one the audit named and this phase was told not to touch: all eight
Division Two seats have *identical* income because `econStature` is floored at
0.62 across the whole division, while their payrolls differ by 1.9×. Reported,
not fixed.

*(The five-season columns hold each seat in place. They are what a SEAT does if
nothing else changes, not a club's career — a Division Two champion would in
fact be promoted.)*

## 12. PROMOTION AND RELEGATION

**Promotion**, the same club, same squad, same finish, one division apart:
**+$1,960,392** (was +$1,540,392).

| promoted club then does | payroll/rd | net |
|---|---|---|
| nothing | $180,370 | **+$1,234,402** |
| normal strengthening +25% | $225,463 | +$603,100 |
| aggressive strengthening +60% | $288,592 | −$280,706 |

**Relegation**: **−$596,077** (was −$176,077), and $1,599,263 of guaranteed
money lost — media −$1,100,000, sponsor −$499,263. The shock is now meaningful,
and it got worse rather than better, which is the right direction.

---

## THE ONE RESIDUAL, STATED EXACTLY

A **fourth seed** plays both its ties away — the semi at the first seed's ground
and, if it wins, the final at the higher seed's ground. Its playoff run:

| | net | step |
|---|---|---|
| missed out | +$569,841 | — |
| lost the semi | +$390,393 | −$179,448 |
| lost the final | +$210,945 | −$179,448 |
| **won the title** | +$510,945 | +$300,000 |
| | | **−$58,896 vs missing out** |

**That is not a playoff penalty. It is the away-round asymmetry every away week
has, and it is now exact to the dollar:**

```
an ordinary AWAY LEAGUE round for the same club:  central in $298,212  cost out $477,660  NET -$179,448
an AWAY PLAY-OFF round for the same club:                                            NET -$179,448
```

A club's income is weighted to its home fixtures; seven home gates pay for seven
away rounds. A knockout run adds away rounds without adding home ones for the
lower seed, which is how a knockout works. And on a **contender** sponsor deal —
the deal a side chasing a title actually signs, and which the architecture
already provides — winning the title from fourth is **+$316,246** rather than
−$58,896.

So the §4 hard requirement holds for the club that hosts (+$855,606), for the
runner-up (+$37,446) and for a fourth seed on a contender deal (+$316,246). It
misses by $58,896 for a fourth seed on a survival-shaped deal that wins both
ties away from home. **Reported rather than papered over**: closing it would
mean inventing the playoff jackpot §3 forbids.

---

## 13 & 14 & 15. WHAT WAS DELIBERATELY NOT TOUCHED

- **Wages.** `FO_WAGE_R50` is stale — it points at a median card of 50 while the
  world's median is 53–54, so every wage in the world is about 21% above what
  the curve's own documentation implies. It is real and it is **not** responsible
  for the division inversion, because it raises costs uniformly across the
  pyramid and changes no ratio between two seats. Recorded as future economy
  work. Not touched.
- **The `econStature` floor.** Provably stale — its stated justification is that
  squad ratings flatten from slot six down, and today slot 6 is 66,818 and slot
  15 is 45,000. It is the cause of the *within-division* inversion and of the
  two seats that still fail here. Not touched, by instruction, and it is the
  right order: the base economy has to be correct before the coordinate that
  spreads it is re-fitted.
- **Attendance, media merit, sponsor merit, starting banks, transfers, player
  valuation, the wage curve, match physics.** Untouched. No revenue line was
  invented to compensate for a cost coefficient.

---

## GATES

| gate | result |
|---|---|
| **server suite** | **439: 439 pass, 0 fail, 0 skipped** |
| `world-economy` (finance) | 16/16 — two new tests, three strengthened |
| `world-p3` | green |
| `world-shape` | green |
| `world-market` | green |
| `world-botfinance` | green |
| **engine suite** (control) | **489: 488 pass, 0 fail, 1 skipped** |
| **`calibration-check`** (control) | **PASS** (engineVersion v3, 300 matches/cell) |
| build | untouched; `assets/` and `index.html` unchanged |

**No golden was rewritten.** The economy movement is asserted by the tests
directly — the three strengthened assertions state the new installment law in
full and would fail if it drifted.

---

## THE ANSWERS

1. **What exactly was wrong with playoff funding?** `economy.mjs` charged
   wages, club operations and the academy for every round a club *plays* and
   paid the media installment and the sponsor's guarantee only for league rounds
   1–14. Rounds 15 and 16 — the semi-final and the final — were billed and not
   funded. **The audit put the harm in the wrong place**: because the higher
   seed hosts both ties, the table-topper takes two big gates and was only
   $72,060 a round down. The club that *travels* took the full $577,500. On the
   shipped law, qualifying fourth cost that club **$507,660** and reaching the
   final as runner-up cost **$649,560**.
2. **How much did the fix return?** Per playoff round, one ordinary round's
   central money — $196,429 of media plus the sponsor's guaranteed installment.
   By seat: champion **+$647,838**, beaten finalist **+$627,006**, semi-finalists
   +$306,234 and +$299,069; in Division Two +$376,716, +$369,450, +$181,093,
   +$177,461. Champion vs topping the table and going home: **+$155,880 →
   +$795,606**.
3. **The economy with only that fix?** D1 mean −$720,481 → **−$485,463**;
   D2 mean +$321,338 → +$459,428; **administration unchanged at 4/16**; 6 of 8
   D1 seats still losing. It fixes the defect and about a third of the deficit,
   and moves nobody out of administration — the four that fail are the four that
   never reach a playoff.
4. **Current `OPS_TOPFLIGHT_ROUND`?** **$60,000 a round, $840,000 a season.**
5. **Recommended value?** **$30,000 a round, $420,000 a season.** The premium
   is halved, not removed.
6. **Why that value?** Because the guaranteed top-flight premium ($1,620,704 of
   media and sponsor guarantee) then covers the guaranteed top-flight cost
   **3.86×** instead of 1.93×, which sits inside the 2.5–4.6× band the payroll
   ladder spans — and because, swept 0–$60,000, it is the largest premium at
   which Division One stops draining (mean −$41,350), administration halves to
   2/16 with both survivors the weakest seats, a normal club is sustainable, an
   aggressive one still burns $1.59m, promotion is worth more and relegation
   hurts more. $25,000 also passes and was rejected as more change than the
   criteria need.
7. **An average D1 club now?** Mean season net **−$41,350** (was −$720,481).
   A *normal* club — mid-table finish, par payroll — makes **+$274,607**.
8. **An average D2 club?** **+$459,428**, unchanged by the premium at every
   candidate. That is the control, and it held to the dollar.
9. **Slot 7?** Still the hardest seat and not rescued. A mid-table finish is
   **+$226,564**; finishing last on its dealt payroll is −$1,352,994 and reaches
   administration in season 3; **trimming a fifth off the wage bill survives even
   a last-place finish**. Normal management can survive it, bad management can
   fail, administration is possible but not predetermined.
10. **Is promotion still profitable before strengthening?** Yes, and by more:
    **+$1,960,392** (was +$1,540,392). A promoted club that spends nothing makes
    +$1,234,402; +25% still makes +$603,100; +60% loses $280,706.
11. **Is relegation still harmful?** Yes, and by more: **−$596,077** (was
    −$176,077), losing $1,599,263 of guaranteed money. Sustainability was not
    bought by making relegation attractive.
12. **Over five seasons?** D1 median treasury −$1,696,406 → **+$1,018,486**;
    five of eight D1 seats end in the black against two; administration 4/16 →
    2/16. Division Two's median is unchanged at ~$3.1–3.4m, **and its champion
    still compounds to $10.7m** — which this phase cannot fix and was not asked
    to.
13. **How often does administration occur?** **2 of 16 seats within five
    seasons**, down from 4. Both are the two weakest top-flight seats, and both
    need a bottom finish *and* no adjustment to get there.
14. **Did you need to touch wages or revenue?** **No.** No wage, no wage curve,
    no valuation, no attendance, no sponsor merit, no media merit, no starting
    bank. The two changes are one settlement law and one cost constant.
15. **What remains for the `econStature` follow-up?** The *within-division*
    inversion, which this phase deliberately leaves standing: all eight Division
    Two seats have identical income because the floor holds stature at 0.62
    across the whole division, while their payrolls differ 1.9× — so D2/0 and
    D2/4 compound without limit. The same mismatch explains the two D1 seats
    that still fail here: D1/3 carries a `d1a` payroll and finishes fourth
    (−$603,879), D1/7 a `d1b` payroll and finishes last. Those are
    payroll-against-position mismatches, not division-cost problems, and the
    coordinate that should express them is the one that is provably stale.

---

## 16. THE FINAL CANDIDATE ON A REAL SETTLED WORLD

Everything above is the model. This is the `world-p3` fixture — a real
Postgres world, a full season plus a fortnight, settled by the real
`computeFinance` — run on this branch and compared with the same fixture
recorded on current `main`
(`docs/fast-bowler-generation/econ-dump-final.txt`).

**The books replay from genesis, so both changes RESTATE every settled bank.**
That is what these numbers are:

| slot | club | on `main` | on this branch | change |
|---|---|---|---|---|
| 0 | Essex | $2,954,638 | $4,292,476 | **+$1,337,838** |
| 1 | Yorkshire | $1,734,419 | $2,707,922 | +$973,503 |
| 2 | Lancashire | $2,341,451 | $3,307,685 | +$966,234 |
| 3 | Surrey | −$216,512 | $1,080,833 | **+$1,297,345** |
| 4 | Middlesex | $997,474 | $1,627,474 | +$630,000 |
| 5 | Warwickshire | $1,693,464 | $2,323,464 | +$630,000 |
| 6 | Nottinghamshire | $245,201 | $665,201 | +$420,000 |
| 7 | **Kent** | **−$1,304,167** | **−$766,566** | **+$537,601** |
| 8 | Orange Club | $3,477,724 | $3,666,082 | +$188,358 |
| 9 | Somerset | $4,311,579 | $4,891,029 | +$579,450 |
| 10 | Glamorgan | $1,771,183 | $2,343,369 | +$572,186 |
| 11 | Sussex | $1,063,652 | $1,241,113 | +$177,461 |
| 12–15 | Glos, Hants, Derbys, Leics | | | **$0 — unchanged to the dollar** |

The four seats that never reached a playoff and play in Division Two move by
**nothing at all**. That is the control holding in a real world, not a model.

Planet-wide at the same moment, 256 clubs in 16 countries:

| | `main` | this branch |
|---|---|---|
| overdrawn | 3/256 | **1/256** |
| past the `world-p3` floor | 1/256 | **0/256** |
| in administration | 0/256 | 0/256 |
| median treasury | $1,927,984 | $2,128,382 |
| p05 treasury | $572,582 | $1,082,674 |

**Kent — the club whose $54,167 overshoot blocked the previous phase's ship
gate — clears the floor by $483,434.**

The per-round lines confirm the two laws separately: Essex's operations fall
$207,900 → $177,900 (exactly $30,000) and its media rises $179,348 → $196,429
(the two playoff weeks it played). Kent's operations fall only $20,000 a round,
because seven of its rounds were played in Division Two where the premium never
applied — which is the right answer and a good check that the change is a
Division One line.

*(That run reports one failure, `020: the books are a ledger`, which is the
known artefact of the `FO_ECON_DUMP` probe playing twenty further rounds after
the assertion — the same artefact recorded in the previous phase. In the clean
gate run `world-p3` is green, all 27 tests, including `016`.)*
