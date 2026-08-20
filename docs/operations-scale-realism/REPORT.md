# Era 2 club-scale operations

**Phase 4.** Audit, fit, and one implemented law. Branch
`claude/operations-scale-realism`, from `main` at `ae4172c`.

The short version: the operations line was written as though it scaled with
club size, and it did not. Its "variable" term reads stadium **capacity**, and
capacity is dealt almost flat on purpose — so nine of the sixteen clubs in a
nation were charged an identical bill and nothing about the club could move it.
Operations now carries a term on the club's **following**, the base falls to pay
for it, and the median club's bill is unchanged.

What that fixes is the bottom of Division Two and the top of the wealth
distribution. What it does **not** fix — and this is the honest headline —
is Division One's failing seats. They were never small clubs. They are
large-following clubs carrying payrolls of 70–82% of revenue, and the next
phase is the wage anchor.

## The evidence

| file | what it holds |
|---|---|
| `ops-map-prior-law.txt` | §1–§5, measured **before** the change: the exact prior formula, its consumers, and the ladder it was charged on |
| `burden-prior-law.txt` | §3–§4, **before**: revenue/ops/wages per seat over all 16 nations, and the unmovable share |
| `sweep.txt` | §5, §6, §20: the anchored candidate sweep and the control arm |
| `pyramid-10season.txt`, `pyramid-5season.txt` | §11, §12, §13: ten and five seasons with real promotion and relegation |
| `behaviour.txt` | §7, §14, §15: growth smoothness and the archetype grid |
| `aftermath.txt` | §16, §17: tierflat and the wage anchor, re-asked after the fix |

Tools: `ops-map`, `ops-burden`, `ops-laws`, `ops-sweep`, `ops-pyramid`,
`ops-behaviour`, `ops-aftermath`. The seat model is Phase 3's corrected
`economy-audit.mjs`, validated against a real settled Postgres world by
`econ-model-check.mjs` (worst seat within 6.3% of revenue).

---

## 1. What is the exact current operations formula?

Before this phase:

```
operationsPerRound(seats, div, natOps) =
  round( ($58,000 + seats × $3.10 + (div 1 ? $30,000)) × natOps )
```

No cap, no floor, no academy term — academy upkeep is its own ledger line
beside operations, not part of it. Charged once per round the club **plays**,
home and away alike, play-off rounds included since Phase 2. `natOps` is 0.88
for associate nations, applied to the whole line.

Every runtime consumer:

| site | role | era |
|---|---|---|
| `server/economy.mjs:922` | the settle walk — **charges the ledger** | inside `if (curEra2)` |
| `server/economy.mjs:1054` | the decomposition served to the client | `opsBreakdown: curEra2 ? …` |
| `server/botfinance.mjs:99` | bot posture projection | `botMoney` returns `healthy` first in era 1 |
| `engine/src/league/43-finance.js:1257` | **renders** the served breakdown | owns no copy of the constants |

Division premium and club-scale cost are cleanly separable: the premium is a
flat `div === 1` term, everything else is the club's.

## 2. How much of a small club's cost is fixed?

**All of it.** This is the finding, and it is larger than "the base is too big".

The naive reading says the base is $58,000 of $132,400 — 44%. The honest
reading asks how much of a seat's bill responds to anything about that seat,
and the answer for the bottom nine clubs is **zero dollars**:

| slot | ops/round | varies with own size | share that responds |
|---|---|---|---|
| 0 | $177,900 | $15,500 | 8.7% |
| 3 | $168,600 | $6,200 | 3.7% |
| 7 | $162,400 | $0 | **0%** |
| 8 | $132,400 | $0 | **0%** |
| 15 | $132,400 | $0 | **0%** |

Because `foundingSeats` deliberately does **not** steepen with standing —
`economy.mjs` says so outright, steepening it broke stadium building and p3's
ledger test caught it as a club that could not afford its own first stand —
every seat from 7 down is dealt exactly 24,000 seats. A per-seat term is only a
size term if the seats differ.

Measured over all sixteen nations with the generator's own squads:

```
revenue          $9,292,154 -> $2,829,187   3.28x
wages            $6,294,024 -> $1,358,026   4.63x
operations, club half                       1.11x
```

A club earning 3.28× what another earns, and paying 4.63× the wages, was
charged 1.11× to operate. The bottom club spent 63% of revenue on operations
and 111% on operations and wages together.

## 3. What should operations conceptually scale with?

From the code's own description — "coaches and physios, ground staff,
administration, travel, kit and the electric bill":

- **travel and core administration** are genuinely flat: a squad of fifteen
  travels to an away fixture whatever the club's size;
- **ground running** scales with **capacity** — a stand costs the same to light
  and steward whoever sits in it;
- **staff, match-day operations and the commercial department** scale with the
  size of the organisation, which is to say with the **following**.

The prior law had the first two and not the third, so the ground term was doing
two jobs and could only do one.

## 4. What coordinate best represents club operational footprint?

**Supporters.** Tested against capacity, supporters and raw `econStature`:

| coordinate | spread across the ladder | verdict |
|---|---|---|
| capacity (seats) | 1.21× dealt | flat by design; nine clubs share one value |
| raw `econStature` | 1.61× | static — never moves, so growth costs nothing |
| **supporters** | **5.14×** measured | not revenue, not payroll, moves with success |

Supporters is not circular in a damaging way. It is driven by mood and league
position, never by revenue or payroll, so **spending cannot buy a discount** —
which is exactly why an aggressive manager still meets the bill he ran up. And
it is a stabiliser rather than a spiral: a club that falls loses following and
its operations fall with it, which is negative feedback on the failing tail.

**The control settles this.** If the trouble were only a too-large base, then
lowering it and steepening the existing per-seat term would do the same work.
Measured, holding the median: it moved the under-water count **not at all**,
10/16 before and 10/16 after. Every no-supporter arm scores the same 10/16,
because a term nine clubs pay identically moves all nine together.

## 5. What exact new formula and constants?

```js
export const OPS_BASE_ROUND = 11700;           // was 58000
export const OPS_PER_SEAT_ROUND = 3.1;         // unchanged
export const OPS_PER_SUPPORTER_ROUND = 2.0;    // new
export const OPS_TOPFLIGHT_ROUND = 30000;      // unchanged (Phase 2)

operationsPerRound(seats, div, natOps, support) =
  round( ($11,700 + seats × $3.10 + support × $2.00
          + (div 1 ? $30,000)) × natOps )
```

`support` is the following as it stood when the round **began**. The walk
updates `c.sup` at the end of its round loop, after every bill — a club is not
billed this week for supporters this week's result won it.

Two fitting decisions worth stating:

- **The base is solved, not swept.** It is added to every club alike, so the
  base holding the median at today's value is one subtraction. A first cut swept
  it as a free third parameter and measured almost nothing: nearly every
  combination charged the median far less than today, so the arms differed
  mostly in how large an across-the-board **cost cut** they were, and both tails
  "improved" because the whole world had been handed money.
- **The per-seat term stays at $3.10.** Halving it pays for the supporter term
  equally well and is identical for every club on 24,000 seats — nine of
  sixteen. It differs only for clubs off that capacity, and it would quietly
  halve what a stand costs to run. Stadium economics were not this phase's to
  move.

## 6–8. What a club pays, old against new

| | seats | following | prior | now | change |
|---|---|---|---|---|---|
| **bottom D2** | 24,000 | 12,675 | $132,400 | **$111,450** | −$20,950 |
| **median club** | 24,000 | ~15,000 | $132,400 | ~$118,000 | held by construction |
| **flagship** | 29,000 | 37,176 | $177,900 | **$205,952** | +$28,052 |

Club-scale spread (excluding the division premium) goes from **1.11× to 1.58×**.

## 9. What happens to the remaining D1 failures?

They improve, and they are **not fixed** — because operations was never their
problem. Ten seasons, real pyramid:

| slot | prior annual | now | admin rounds |
|---|---|---|---|
| 4 | −$1,191,180 | −$1,054,032 | 33.5 → 29.1 |
| 5 | −$1,117,908 | −$954,838 | 34.0 → 29.4 |
| 6 | −$1,291,354 | −$1,123,085 | 38.7 → 33.7 |
| 7 | −$1,169,335 | −$953,081 | 35.5 → 29.6 |

Every one of them carries a payroll of 65–82% of revenue. This is the same
conclusion Phase 3 reached from the other direction — four of six failing seats
would need a commercial scale larger than their nation's flagship to break even
— and it is why no seat-specific subsidy was added.

## 10. What happens to the bottom of Division Two?

This is what the phase fixes. Ten seasons, real pyramid:

| slot | prior annual | now |
|---|---|---|
| 12 | −$137,073 | **+$211,860** |
| 13 | −$237,745 | **+$146,546** |
| 14 | −$434,270 | −$1,071 |
| 15 | −$212,844 | **+$160,524** |

And the archetype grid, which is the test §10 actually asked for — *survivable
under frugal or normal management, rather than structurally underwater
regardless of decisions*:

| minnow D2 | prior | now |
|---|---|---|
| FRUGAL | −$189,809 | **+$179,598** |
| NORMAL | −$529,316 | −$159,908 |
| AGGRESSIVE | −$808,157 | −$487,289 |

Under the prior law even a frugal minnow lost money — there was no way to
manage the bottom of Division Two into solvency. Now a frugal one survives, a
normal one is pressured but viable, and an aggressive one still fails. It does
not become rich: that is why $2.00 was chosen over $3.00, which made the bottom
comfortably profitable instead.

## 11. What happens to flagship wealth?

| | prior | now |
|---|---|---|
| annual net | $888,361 | $464,681 |
| 5-season bank | $6,731,190 | $4,983,367 |
| 10-season bank | $11.19m | $7.81m |
| 10-season P90 | $20,310,897 | $16,333,033 |
| richest club in the world | $20,945,097 | $17,153,309 |
| clubs above $20m | **3** | **0** |
| world median bank | $1.44m | $2.82m |

The flagship remains much the richest club in its world — 2.8× the world median
treasury — and is still comfortably profitable under normal management
($676,389 a year). It is no longer compounding at a rate nothing checks: its
operations now grow as its following grows, $187,431 a round in season one to
$196,381 by season ten.

Over five seasons the same shape holds: the flagship's bank goes $6,731,190 →
$4,983,367, the world's richest club $11,943,593 → $10,175,245, clubs above
$10m 9 → 2, and clubs ever in administration 50/256 → 41/256.

The prior arm reproduces Phase 3's reported $20.3m P90 to the dollar, which is
the control working.

## 12–13. Promotion and relegation

Same club, same squad, same finishing position, Division One instead of
Division Two:

| | promotion | relegation |
|---|---|---|
| prior | $1,900,732 | −$1,900,732 |
| now | **$1,899,801** | **−$1,899,801** |

A tenth of a percent. The division premium is the only thing that differs
between those two seasons and this phase did not touch it.

## 14. Does aggressive management still lose money?

Yes, at every size — and slightly more than before at the top, because a big
club now pays for being big:

| | prior | now |
|---|---|---|
| flagship AGGRESSIVE | −$2,256,316 | −$2,528,743 |
| large D1 AGGRESSIVE | −$924,716 | −$1,083,881 |
| minnow AGGRESSIVE | −$808,157 | −$487,289 |

## 15. Is Era 1 cent-identical?

**Yes, and structurally so rather than by luck.** The walk charges operations
inside `if (curEra2)`; `botMoney` returns `healthy` before reaching the
projection in era 1; the served `opsBreakdown` is `curEra2 ? … : null`. A world
settling under the founding law never reaches the line at all.

`world-economy` test 19 holds it: an era-1 world pays `ops === 0` and is served
no breakdown — and it first asserts the clubs carry a **real following**, so
that the silence is the era gate and not an empty world.

All 256 production clubs are era 1 today (season 1, `start_day` 14, against
`ERA2_DAY = 42`), so nothing in production is restated by this change. That is
also why this was the right moment: the era-2 books are a pure derivation
replayed from genesis, and there are no era-2 seasons yet to restate.

## 16. Does tierflat econStature still deserve to exist?

**No. Drop it.** Re-measured after the operations fix, with both stature
coordinates pinned correctly:

- largest single-seat movement: **−$28,622**;
- it makes 11 of 16 seats slightly **worse**;
- it hurts the bottom of Division Two by $18k–$29k a seat — precisely where it
  was supposed to help.

Phase 3 found the floor's 23,000–24,300 premise dead but the candidate
economically small. Correcting operations shrank it further. A dead premise does
not by itself require a replacement mechanic.

## 17. Does FO_WAGE_R50 still require a phase?

**Yes, and the case is now much clearer**, because operations is no longer
masking it. Every seat still under water is under water on payroll:

| slot | net | wages/revenue | ops/revenue |
|---|---|---|---|
| 3 | −$534,821 | 73% | 32% |
| 5 | −$554,246 | 70% | 36% |
| 6 | −$798,608 | 73% | 38% |
| 7 | −$1,272,797 | **82%** | 40% |
| 11 | −$368,261 | 64% | 40% |

Division One's mean is 70% of revenue on wages; wages are 68% of the two big
costs. That is the next phase.

## 18. The tier cliff

Recorded, not solved, and **not to be solved with money**. Phase 3 found slots
12–15 promoted 0 times in five seasons across all sixteen nations. That is a
competitive-generation problem: those seats are dealt squads 22% weaker than
slot 11's, so they cannot win Division Two. Worth investigating: whether the
`d2b` tier's strength is set too far below `d2a`, and whether the four-tier
staircase should have a shallower bottom step. An economic change must not
manufacture promotion chances.

---

## What remains after this phase

1. **The wage anchor** (`FO_WAGE_R50`) — now the binding constraint on every
   failing seat. The clear next phase.
2. **The tier cliff** — a generation question, not an economic one.
3. **Slot 11** — dealt a `d2a` squad but expected to finish 4th; it is the one
   seat whose payroll and expected finish disagree by construction.
