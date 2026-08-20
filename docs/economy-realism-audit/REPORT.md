# ERA 2 ECONOMY REALISM AUDIT

Branch `claude/economy-realism-audit`, from `e5657fd`. **Audit only — no economy
constant, no wage, no valuation and no line of match physics is changed.** The
whole diff is three measurement tools and this directory.

Every figure comes from the shipped laws: `server/financeconfig.mjs` for the
tunables, `server/economy.mjs` for the settlement, the shipped engine's own
generator for every squad and the shipped wage curve for every payroll.

## How this was measured, and how far to trust it

`computeFinance` needs a settled Postgres world, and a `world-p3` run takes
twenty minutes — which buys **one** world, and one world cannot separate a
SEAT effect from the luck of a deal. So `tools/economy-audit.mjs` walks the
same laws in the same order over all 256 seats the planet actually seats, with
the payroll each is actually dealt.

**It is validated against a real settled world** (`tools/economy-validate.mjs`,
against the `main`-arm dump in `docs/fast-bowler-generation/econ-dump-main.txt`).
Surrey — the one probe club that stayed in Division One all year — matches on
every fixed law exactly:

| line | model | settled world | error |
|---|---|---|---|
| club operations / round | $198,600 | $198,600 | **0.0%** |
| academy upkeep / round | $14,000 | $14,000 | **0.0%** |
| seats | 26,000 | 26,000 | **0.0%** |
| wages / round | $359,420 | $359,442 | **−0.0%** |
| sponsor / round | $96,385 | $97,522 | −1.2% |
| revenue / round | $504,933 | $476,115 | +6.1% |

The residual is the **trajectory** — support, mood and crowd, which the model
grows rather than reads, and which in the real world depend on a club's own
history. Kent's revenue is +31% out because the real Kent was **relegated**
mid-record: its ops came to exactly 21 rounds minus seven at the Division Two
rate, and its media to `2,750,000 + 7/14 × 1,650,000` to the dollar. The laws
are exact; the trajectories are indicative. Every conclusion below rests on
**differences between arms of the same model**, where the trajectory cancels.

---

## 1. THE MAP — every source and every sink

| line | D1 vs D2 | stature | position | supporters | opponent | fixed/variable | cadence |
|---|---|---|---|---|---|---|---|
| **media distribution** | **$2,750,000 vs $1,650,000** | no | no | no | no | fixed | equal installment, each of 14 **league** rounds |
| **sponsor, guaranteed** | base $1,900,000 vs $1,150,000 | ×0.85–1.10 | last summer's finish, ×0.78–1.22 | no | no | fixed | installment, each league round |
| sponsor, win bonus | via the base | via the base | per win | no | no | variable | the round the win happens |
| sponsor, playoff/title | contender package only | — | top four / champions | no | no | variable | final league round / playoff final |
| **gate** | crowd ×0.80 in D2 | seats, support | mood + position | **directly** | flagship ×1.22, top-3 ×1.09 | variable | home rounds only, net of `MATCHDAY_NET` 0.72 |
| prize money | $320k–$850k vs $175k–$470k | no | **the whole line** | no | no | fixed | final league round |
| playoff champions | $300,000 vs $165,000 | no | winners only | no | no | variable | playoff final |
| transfers, callup fees | no | no | no | no | no | variable | on the day |
| — | | | | | | | |
| **player wages** | dealt squad, ×4.6 across the world | no | no | no | no | the manager's | **every round played** |
| **club operations** | **+$60,000 a round in D1** | via seats | no | no | no | fixed | **every round played** |
| academy upkeep | no | no | no | no | no | fixed | **every round played** |
| overdraft interest | no | no | no | no | no | variable | every round in the red |
| academy building, stands | no | seat price ladder | no | no | no | the manager's | on purchase |

Two cadence facts matter more than any price, and neither is written down
anywhere but the loop:

- **club operations, wages and the academy are charged for every round a club
  PLAYS**; media and the sponsor's guarantee are paid only for **league**
  rounds 1–14. Rounds 15 and 16 are the playoff semi-final and final.
- the crowd multiplier `DIV2_CROWD` reads the **home club's** division, so
  promotion is worth +25% at the turnstile immediately.

---

## 2. THE SEAT TABLE

What the world deals each seat (full members, median of 10 nations):

| seat | tier | econStat | seats | support | bank0 | payroll/rd | ops/rd | media | sponsor |
|---|---|---|---|---|---|---|---|---|---|
| D1/0 | flagship | 1.00 | 29,000 | 24,240 | $2,275,000 | **$443,980** | $207,900 | $2,750,000 | $2,024,314 |
| D1/1 | d1a | 0.86 | 27,000 | 20,421 | $2,091,000 | $361,800 | $201,700 | $2,750,000 | $1,959,904 |
| D1/2 | d1a | 0.82 | 27,000 | 19,508 | $2,045,000 | $366,960 | $201,700 | $2,750,000 | $1,943,802 |
| D1/3 | d1a | 0.79 | 26,000 | 18,612 | $1,999,000 | $368,920 | $198,600 | $2,750,000 | $1,927,699 |
| D1/4 | d1b | 0.76 | 26,000 | 17,734 | $1,953,000 | $295,060 | $198,600 | $2,750,000 | $1,911,597 |
| D1/5 | d1b | 0.72 | 25,000 | 16,873 | $1,908,000 | $288,160 | $195,500 | $2,750,000 | $1,895,494 |
| D1/6 | d1b | 0.68 | 25,000 | 16,032 | $1,862,000 | $290,460 | $195,500 | $2,750,000 | $1,879,392 |
| D1/7 | d1b | 0.65 | 24,000 | 15,209 | $1,816,000 | $287,420 | $192,400 | $2,750,000 | $1,863,289 |
| D2/0–3 | d2a | **0.62** | 24,000 | 14,520 | $1,776,000 | ~$180,000 | $132,400 | $1,650,000 | $1,119,426 |
| D2/4–7 | d2b | **0.62** | 24,000 | 14,520 | $1,776,000 | **~$95,000** | $132,400 | $1,650,000 | $1,119,426 |

**Every one of the eight Division Two seats is commercially identical.** Same
stature, same ground, same following, same founding bank, same media, same
sponsor — and payrolls that differ by 1.9×.

### The season as the world actually plays it

Giving every club a mid-table finish isolates the seat but is not the world: a
seat's strength decides its finish, and position is worth up to $4m a season.
With each seat finishing where its strength puts it (D1/0 first … D1/7 eighth):

| seat | finish | payroll/rd | revenue | cost | NET | after 1 | after 3 | after 5 | ruined |
|---|---|---|---|---|---|---|---|---|---|
| D1/0 | 1 | $443,980 | $10,189,676 | $10,654,080 | −$464,404 | $1,810,596 | $881,788 | −$57,431 | — |
| D1/1 | 2 | $361,800 | $8,845,207 | $9,240,000 | −$394,793 | $1,696,207 | $906,621 | $117,035 | — |
| D1/2 | 3 | $366,960 | $8,119,601 | $8,739,900 | −$620,299 | $1,424,701 | $184,103 | −$1,292,811 | — |
| D1/3 | 4 | $368,920 | $7,369,852 | $8,722,800 | **−$1,352,948** | $646,052 | −$2,500,000 | −$2,500,000 | **season 3** |
| D1/4 | 5 | $295,060 | $6,644,687 | $7,107,240 | −$462,553 | $1,490,447 | $565,341 | −$453,782 | — |
| D1/5 | 6 | $288,160 | $6,225,589 | $6,967,240 | −$741,651 | $1,166,349 | −$376,293 | −$2,100,000 | **season 5** |
| D1/6 | 7 | $290,460 | $5,466,933 | $7,000,355 | **−$1,533,422** | $328,578 | −$2,140,000 | −$2,140,000 | **season 3** |
| D1/7 | 8 | $287,420 | $5,140,486 | $6,925,465 | **−$1,784,979** | $31,021 | −$2,180,000 | −$2,180,000 | **season 3** |
| D2/0 | 1 | $180,370 | $5,935,164 | $5,228,320 | **+$706,844** | $2,482,844 | $3,896,532 | **$5,310,220** | — |
| D2/1 | 2 | $182,270 | $5,348,870 | $5,258,720 | +$90,150 | $1,866,150 | $2,046,450 | $2,226,750 | — |
| D2/2 | 3 | $179,300 | $4,894,034 | $4,885,500 | +$8,534 | $1,784,534 | $1,801,602 | $1,818,670 | — |
| D2/3 | 4 | $182,450 | $4,530,400 | $4,932,750 | −$402,350 | $1,373,650 | $568,950 | −$251,667 | — |
| D2/4 | 5 | $97,080 | $4,093,113 | $3,408,720 | **+$684,393** | $2,460,393 | $3,829,179 | **$5,197,965** | — |
| D2/5 | 6 | $95,200 | $3,824,455 | $3,382,400 | +$442,055 | $2,218,055 | $3,102,165 | $3,986,275 | — |
| D2/6 | 7 | $90,890 | $3,393,828 | $3,322,060 | +$71,768 | $1,847,768 | $1,991,304 | $2,134,840 | — |
| D2/7 | 8 | $95,870 | $3,234,261 | $3,391,780 | −$157,519 | $1,618,481 | $1,303,443 | $988,405 | — |

**Every Division One seat loses money. Four of eight reach administration
inside five seasons.** Division Two's champion and its mid-table both compound
past $5m.

This reproduces the ordering of the live world: on `main` after 21 rounds, the
median bank by seat across 16 countries ran $2,983k, $1,745k, $1,788k, $1,497k,
$1,763k, $1,267k, $1,376k, **$884k** — monotone down the top flight, exactly as
here.

---

## 3. THE D1 − D2 WATERFALL

The same club, the same squad, the same finish, one division apart:

| line | change on promotion | running |
|---|---|---|
| media | **+$1,100,000** | +$1,100,000 |
| sponsor (guaranteed) | +$514,856 | +$1,614,856 |
| sponsor bonuses | +$220,654 | +$1,835,510 |
| prize money | +$200,000 | +$2,035,510 |
| gate (the ×0.80 crowd lifts) | +$331,343 | +$2,366,853 |
| wages | $0 | +$2,366,853 |
| **club operations** | **−$840,000** | +$1,526,853 |
| academy | $0 | +$1,526,853 |
| **NET OF PROMOTION** | **+$1,531,482** | (P10 +$1,526,853, P90 +$1,541,069) |

**Top-flight membership is worth about +$1.53m a season before a club spends a
penny on its squad.** Promotion is not a punishment.

### So what makes the top flight lose money?

Not the division. The **seat**. Compare the divisions in aggregate:

| | mean D1 | mean D2 | difference |
|---|---|---|---|
| revenue | $7.25m | $4.41m | **+$2.84m** |
| wages | $4.73m | $1.93m | **−$2.80m** |
| operations | $2.77m | $1.85m | **−$0.92m** |
| **net** | **−$0.92m** | **+$0.18m** | −$1.10m |

The commercial premium of the top flight (+$2.84m) covers its **wage** premium
(−$2.80m) almost exactly. What it does not cover is the **top-flight operations
premium** — $60,000 a round, $840,000 a season — and that is the whole of the
division gap.

---

## 4. PROMOTION

Holding the club fixed and comparing like with like (§3) gives **+$1,531,482**.
Playing it realistically — D2 champion one year, bottom of D1 the next — the
position loss eats most of it:

| line | D2, champion | D1, 8th | change |
|---|---|---|---|
| media | $1,650,000 | $2,750,000 | +$1,100,000 |
| sponsor | $987,010 | $1,630,713 | +$643,703 |
| sponsor bonuses | $664,719 | $299,520 | −$365,199 |
| prize | $470,000 | $320,000 | −$150,000 |
| gate | $1,998,435 | $1,228,949 | −$769,486 |
| ops | $1,853,600 | $2,693,600 | +$840,000 |
| **NET** | **+$1,195,384** | **+$814,402** | **−$380,982** |

Attendance falls 15,251 → 9,378: the +25% division crowd is swamped by going
from champion to last. **Both numbers are true and they answer different
questions** — the division is worth +$1.53m, and coming last is worth −$1.9m,
and a newly promoted club usually comes last.

Then the squad decision, which is the manager's:

| promoted club does | payroll/rd | net | vs staying in D2 |
|---|---|---|---|
| nothing | $180,370 | +$814,402 | −$380,982 |
| **sensible +25%** | $225,463 | +$183,100 | −$335,242 |
| aggressive +60% | $288,592 | −$700,706 | −$1,219,048 |
| buy a D1-standard squad | $287,420 | −$684,298 | −$1,202,640 |

**Over five seasons a club that goes up and does not overspend prospers**
(§17): bank $2.14m → $2.68m → $3.03m → $3.03m → $3.65m → **$4.18m** across a
promotion, a relegation and a second promotion. The backwards loop the brief
feared — profitable only when relegated — **is not present**.

## 5. RELEGATION

Same club, same squad, one division down: **net −$176,077**, and the guaranteed
money falls $1.6m (media −$1,100,000, sponsor −$499,263). Relegation is a
commercial hit, correctly. It is a *small* hit only because a relegated club
promptly starts winning: its gate rises +$580,359 on the better position, which
offsets most of the central loss. The mechanism is right; the magnitude is
soft.

---

## 6. SLOT 7 — difficult by design, broken by arithmetic

Slot 7 is **not** the victim of compounding accidental penalties. Everything it
gets is one coherent step below slot 6: stature 0.65, 24,000 seats, 15,209
supporters, a $1,816,000 bank. As a *minnow* it is constructed exactly as
intended.

What breaks it is that its **payroll is not a minnow's**. Slot 7 is dealt a
`d1b` squad — mean XI OVR 66.0, $287,420 a round — which is 97% of slot 4's
payroll on 77% of slot 4's revenue, because it also always finishes last.

And it is not alone: D1/3 and D1/6 reach administration in the same season, and
D1/5 in season five. **Slot 7 is the first to fall, not the only one.**

## 7. ECON STATURE — five jobs, and one it cannot do

`econStature` sets, all at once: the **ground** (`foundingSeats`), the
**following** (`foundingSupport`), the **founding bank**, the **sponsor's
stature factor**, and — through the seats — part of **club operations**.

| stature | seats | support | bank0 | sponsor | gate/yr | ops/yr | revenue | net |
|---|---|---|---|---|---|---|---|---|
| 0.62 | 24,000 | 14,520 | $1,776,000 | $1,849,487 | $1,603,872 | $2,693,600 | $6,653,361 | −$367,079 |
| 0.74 | 26,000 | 17,363 | $1,934,000 | $1,904,696 | $1,821,737 | $2,780,400 | $6,926,434 | −$180,806 |
| 0.86 | 27,000 | 20,421 | $2,091,000 | $1,959,904 | $2,056,167 | $2,823,800 | $7,216,072 | +$65,432 |
| 0.98 | 29,000 | 23,679 | $2,249,000 | $2,015,113 | $2,305,855 | $2,910,600 | $7,520,968 | +$283,528 |

Doing five jobs is not the problem — they all point the same way and the curve
is gentle ($651k of net across its whole range). **The problem is the sixth job
it cannot do at all**: it is floored at 0.62, so it is *constant across all
eight Division Two seats*, and the largest single drop in the entire world
happens inside that floor.

```
slot  stature  econStat   mean XI ovr   payroll/rd   payroll x slot15
   0    1.000     1.000          77.4     $443,980              x4.63
   1    0.860     0.860          72.5     $361,800              x3.77
   4    0.755     0.755          67.2     $295,060              x3.08
   7    0.650     0.650          66.0     $287,420              x3.00
   8    0.620     0.620          56.8     $180,370              x1.88   <- floor begins
  11    0.554     0.620          56.4     $182,450              x1.90
  12    0.532     0.620          45.3      $97,080              x1.01   <- and the big drop
  15    0.466     0.620          45.0      $95,870              x1.00      is INSIDE it
```

The floor was calibrated on a measurement the file states plainly: *"mean squad
rating … STOPS, sitting between 23,000 and 24,300 for every slot from six to
fifteen."* **That is no longer true.** Slot 6 is 66,818 and slot 15 is 45,000.
The B2 wage curve and the realism phases re-spread the strength ladder and the
floor was never re-measured. It is stale, not wrong-headed.

## 8. WAGE BURDEN

| seat | wages / revenue | wages / cost |
|---|---|---|
| D1/0 | **81.7%** | 66.7% |
| D1/1–3 | 70.2–73.1% | 62.6–63.4% |
| D1/4–7 | 58.2–59.9% | 57.9–58.2% |
| D2/0–3 | 58.2–59.1% | 55.1–55.5% |
| D2/4–7 | **29.3–31.5%** | 38.3–39.9% |

The brief the economy was written to is 60–80%. The flagship is above it; the
bottom half of Division Two is at **half** the bottom of it. That gap is the
inversion, and it is a *tier* boundary inside a division where income is flat.

**The `FO_WAGE_R50` mismatch is not the explanation.** The anchor points at a
median card of 50 while the world's median is 53–54, so every wage in the world
is about 21% higher than the curve's own documentation implies. But it is
**uniform** — it multiplies D1 and D2 payrolls alike — so it moves the level of
every club's wage bill and not the *ratio* between two seats. It makes the
whole world poorer; it does not make Division One poorer than Division Two.

## 9. THE COUNTERFACTUAL SWITCHES

A mid-table D1/1 club (net −$868,928) and a D2/0 club (net −$235,128):

| arm | D1/1 net | D2/0 net |
|---|---|---|
| A current | −$868,928 | −$235,128 |
| B D1 wages on D2 commercial | −$3,273,419 | — |
| C D2 wages on D1 commercial | +$1,671,092 | +$1,924,985 |
| **D top-flight ops premium removed** | **−$28,928** | — |
| E D1 club on D2 central money | −$2,810,127 | +$1,594,930 |

**Arm D is the finding.** Removing one $840,000 line takes a mid-table
top-flight club from a $869k loss to $29k of it — break-even. Across all eight
D1 seats as played, it moves the mean from −$919,381 to −$32,769 and halves the
administrations (4/16 → 2/16).

## 10. ATTENDANCE

| lever | effect |
|---|---|
| finishing 1st vs 8th | **20,824 vs 7,985** (×2.6) |
| the same club, D1 vs D2 | 14,120 vs 11,296 (+25%) |
| the flagship visiting every home game vs never | 13,831 vs 13,778 (+0.4%) |
| 26,000 seats vs 45,000 | 14,120 vs 14,120 (**no effect — the ground never fills**) |
| **opponent strength** | **not read at all** |

Attendance answers position and mood almost exclusively. It does **not** read
who the opponent actually is beyond a flat ×1.22 for the flagship and ×1.09 for
the top three — so a promoted minnow playing famous clubs draws essentially the
crowd its own league position earns it, and its ground is never the binding
constraint. The +25% division uplift is real but small next to the ×2.6 that
position swings.

## 11 & 12. MEDIA AND SPONSORSHIP

| | D1 | D2 | premium |
|---|---|---|---|
| media | $2,750,000 | $1,650,000 | **+$1,100,000** |
| sponsor (mid-table) | $1,863,289 | $1,119,426 | +$743,863 |
| prize (5th) | $450,000 | $250,000 | +$200,000 |
| crowd multiplier | ×1.00 | ×0.80 | ≈ +$331,000 |
| **top-flight operations** | | | **−$840,000** |

The guaranteed part of the premium — media plus the sponsor's 70% guarantee —
is **+$1,620,704** against a guaranteed cost premium of **$840,000**. So
guaranteed top-flight value is **+$780,704**: positive, but only 1.9× the cost
it carries, where the squads the top flight is dealt cost 2.5–4.6× a Division
Two squad. **Media rights are not too weak in the abstract; they are too weak
relative to what the top flight is required to pay its players.**

Sponsorship responds to division (×1.65), to last summer's finish (×0.78–1.22)
and to stature (×0.85–1.10). It is the most responsive central line and it is
still only ~26% of a D1 club's income.

## 13. WHAT SUCCESS IS WORTH — and the one place it is punished

A strong D1 club, payroll fixed:

| finish | prize | sponsor bonus | net | vs 8th |
|---|---|---|---|---|
| 8th of 8 | $320,000 | $135,286 | −$2,612,898 | — |
| 4th of 8 | $520,000 | $626,129 | −$568,009 | +$2,044,889 |
| **1st, no playoff run** | $850,000 | $1,163,800 | **+$1,371,836** | +$3,984,734 |
| 1st + lose the semi | $850,000 | $1,163,800 | +$794,336 | +$3,407,234 |
| 1st + lose the final | $850,000 | $1,163,800 | +$216,836 | +$2,829,734 |
| **1st + CHAMPIONS** | $1,150,000 | $1,163,800 | **+$516,836** | +$3,129,734 |

League success is worth a fortune — nearly $4m between first and last. But
**the playoffs are a pure cost**. Each playoff round bills a club's entire cost
base — $577,500 for this club — and pays **nothing**, because `economy.mjs`
charges wages, operations and the academy for every round `playing` while media
and the sponsor's guarantee are gated to `rdNo <= curR` and `curR` is 14.

**Winning the championship leaves a club $855,000 poorer than topping the table
and not turning up to the playoffs.** This is confirmed in the settled world,
not just the source: Surrey banked operations for all 23 of its rounds while
its media came to exactly `2,750,000 + 7/14 × 2,750,000`.

## 14. MANAGEMENT ARCHETYPES

| division | style | payroll/rd | net | end bank |
|---|---|---|---|---|
| D1 | frugal ×0.75 | $221,295 | +$887,317 | $2,840,317 |
| D1 | **normal ×1.00** | $295,060 | **−$145,393** | $1,807,607 |
| D1 | aggressive ×1.45 | $427,837 | −$2,026,563 | −$73,563 |
| D2 | frugal ×0.75 | $135,278 | +$396,160 | $2,172,160 |
| D2 | **normal ×1.00** | $180,370 | **−$235,128** | $1,540,872 |
| D2 | aggressive ×1.45 | $261,537 | −$1,371,466 | $404,534 |

The shape is right — frugal survives, aggressive burns — but **normal
competent management is mildly loss-making in both divisions**, and for the
seats that finish low it is severely so. The game currently requires frugality
of an ordinary club, which the brief names as the thing it should not require.

## 15. A NORMAL BAD SEASON

Bottom of the division, no cup run, payroll unchanged:

| seat | good year (2nd) | bad year (8th) | swing | end bank after the bad year |
|---|---|---|---|---|
| D1/1 | +$760,207 | −$2,612,898 | −$3,373,105 | **−$521,898** |
| D1/7 | +$1,353,004 | −$1,784,979 | −$3,137,983 | +$31,021 |
| D2/0 | +$813,889 | −$1,330,240 | −$2,144,129 | +$445,760 |
| D2/7 | +$1,957,090 | −$157,519 | −$2,114,609 | +$1,618,481 |

A single bad year swings a club by **two to three and a half million** — more
than its entire founding bank. One bad season should hurt; it should not
consume a club's whole capital.

## 16 & 19. THE LONG RUN — capital against cashflow

Five seasons, mid-table finish every year, payroll unchanged:

| seat | bank0 | after 1 | after 3 | after 5 | administration |
|---|---|---|---|---|---|
| D1/0 | $2,275,000 | $560,665 | −$1,306,108 | −$2,050,000 | **season 3** |
| D1/1 | $2,091,000 | $1,222,072 | −$596,588 | −$2,050,000 | **season 5** |
| D1/4 | $1,953,000 | $1,807,607 | $1,516,821 | $1,226,035 | — |
| D1/7 | $1,816,000 | $1,622,564 | $1,235,692 | $848,820 | — |
| D2/0 | $1,776,000 | $1,540,872 | $1,070,616 | $600,360 | — |
| **D2/4** | $1,776,000 | $2,682,408 | $4,495,224 | **$6,308,040** | — |

**Division One drains and the bottom half of Division Two accumulates without
limit.** The slope is −$1.71m a season at the flagship and **+$906,408 a
season** at D2/4, forever, with no mechanism that ever brings it back.

Every club in this game looks healthy for its first season or two purely
because it is founded with roughly a third of a season's turnover. **Founding
capital is masking a structural operating deficit in the entire top flight**,
and the seat table's "after 1" column is why the live world has not shown it
yet: it is 21 rounds old.

## 17. THE PROMOTION LOOP

| season | revenue | cost | net | end bank |
|---|---|---|---|---|
| D2, 3rd | $4,941,601 | $4,574,780 | +$366,821 | $2,142,821 |
| D2, 1st — promoted | $5,764,962 | $5,228,320 | +$536,642 | $2,679,463 |
| D1, 8th — relegated | $5,768,701 | $5,414,780 | +$353,921 | $3,033,384 |
| D2, 2nd | $4,896,741 | $4,901,550 | −$4,809 | $3,028,575 |
| D2, 1st — promoted | $5,850,069 | $5,228,320 | +$621,749 | $3,650,324 |
| D1, 7th | $5,942,462 | $5,414,780 | +$527,682 | $4,178,006 |

A yo-yo club that keeps its cheap squad **makes money in every season including
the ones in Division One**. There is no backwards loop. The trap is not
promotion; it is being **dealt** a top-flight payroll.

## 18. TRANSFERS

To break even on baseline operations, the as-played seats would need this much
**net** player trading every season:

| seat | needed |
|---|---|
| D1/7 | $1,784,979 |
| D1/6 | $1,533,422 |
| D1/3 | $1,352,948 |
| D1/5 | $741,651 |
| D1/2 | $620,299 |
| D1/0 | $464,404 |

A mid-table D1 squad costs $4,130,840 of wages a season, so **the bottom of
Division One would have to trade at 43% of its payroll, profitably, every year,
just to stand still.** Transfer skill must be an advantage, not a subsidy;
today it is a subsidy.

---

## 20. WHAT HEALTHY WOULD LOOK LIKE, IN NUMBERS

Proposed after the measurement, not before:

| property | measurable target | today |
|---|---|---|
| top-flight membership has positive commercial value | promotion, club held fixed, ≥ +$0.5m | **+$1.53m ✓** |
| promotion before strengthening does not reduce expected operating cashflow | ≥ $0 | **−$0.38m ✗** (position, not division) |
| relegation is a commercial hit | ≤ −$0.5m | −$0.18m ✗ (too soft) |
| a normal club, normal management, mid-table | −$0.2m … +$0.4m a season | D1 −$0.15m ✓, weak D1 seats −$1.5m ✗ |
| aggressive spending is risky | ×1.45 payroll ⇒ negative, recoverable | −$2.0m ✓ |
| minnows are under pressure but not doomed | worst seat ≥ −$0.5m a season | **−$1.78m ✗** |
| administration is exceptional | ≤ 1 club in 16 per 5 seasons | **4 in 16 ✗** |
| neither division prints money | best seat ≤ +$0.5m a season sustained | **+$0.91m ✗** |
| sporting success pays | champions ≥ runners-up | **−$0.85m ✗** |

## 21. ROOT-CAUSE ATTRIBUTION

Two distinct problems and one contained bug. Percentages are of the gap each
explains, measured by the switch arms in §9 and §22.

**The division gap (mean D1 −$0.92m against mean D2 +$0.18m):**

| cause | contribution |
|---|---|
| **E operating costs** — the $840,000 top-flight premium | **~100%** |
| A wages | ~0% — the +$2.84m commercial premium covers the +$2.80m wage premium |
| B media / C sponsorship | 0% as a *gap* — they are what covers the wages |
| G starting capital | 0% — it delays the reckoning, it does not cause it |

**The within-division spread (why D1/7 dies and D2/4 compounds):**

| cause | contribution |
|---|---|
| **F econStature / seat construction** — a wealth coordinate that is *constant* across the 1.9× payroll split inside Division Two | **~55%** |
| **D gate/attendance** — 42% of a club's revenue is contingent on a finish that its dealt squad predetermines | **~35%** |
| H interaction — weak seat ⇒ last place ⇒ small crowd ⇒ shrinking support ⇒ weaker still | **~10%** |

**And separately: the playoff rounds bill the full cost base and pay nothing.**
Worth −$577,500 per round to the four best clubs in each division, and −$855,000
to the champions. Not a percentage of the pyramid problem — a bug of its own.

## 22. THE SMALLEST COHERENT FIX

Measured, not implemented. All arms are as-played positions, five seasons,
sixteen seats:

| arm | income ladder | ruined | mean D1 net | mean D2 net |
|---|---|---|---|---|
| current law | ×3.15 | **4/16** | −$919,381 | +$180,484 |
| media re-divided by merit, pool-neutral (^0.7) | ×3.75 | 5/16 | — | — |
| stature re-derived from the payroll ladder (^0.65) | ×3.48 | 4/16 | — | — |
| **B: no top-flight operations premium** | ×3.15 | **2/16** | **−$32,769** | +$180,484 |
| C: playoff rounds funded | ×3.06 | 4/16 | −$500,514 | +$405,538 |
| **B + C** | ×3.06 | **2/16** | **+$341,099** | **+$405,538** |

Two things are worth saying about the arms that *failed*. Re-dividing the media
pool by merit made things **worse** (5/16 ruined) because within a division the
clubs that fail are not the ones with small payrolls — they are the ones that
finish low. And re-deriving stature from the payroll ladder barely moved the
income ladder at all (×3.15 → ×3.48), because the single largest line in a
club's year is media and **media does not read stature by design**.

### The recommendation

**One law: the top flight's guaranteed commercial premium must exceed its
guaranteed cost premium by enough to carry the squad the top flight is dealt.**

Today that ratio is $1,620,704 of guaranteed income against $840,000 of
guaranteed cost — 1.93× — while the squads span 2.5–4.6×. The cheapest way to
move it is the side that is a pure decree with no gameplay attached:
`OPS_TOPFLIGHT_ROUND`. It is a flat $60,000 a round that buys the club nothing,
answers to nothing, and is almost exactly the size of the deficit it creates.

**Phase 2, in order:**

1. **Fund the playoff rounds** (or stop charging them). This is a contained
   correctness fix, not a tuning change: pay the media and sponsor installment
   for rounds 15–16 as for any other round, or exclude non-league rounds from
   the wages/ops/upkeep charge. Either makes winning better than not winning.
   Worth +$418k to the mean D1 club and +$225k to the mean D2 club, and it costs
   nothing to anyone.
2. **Re-measure `OPS_TOPFLIGHT_ROUND` against the guaranteed premium** rather
   than removing it. A premium that leaves guaranteed top-flight value at 2.5×
   rather than 1.9× — roughly $60,000 → $25,000 a round — is the smallest change
   that makes an ordinary top-flight club sustainable under ordinary management.
   Do not remove it: the top flight *should* cost more to run.
3. **Then re-measure the `econStature` floor**, which is provably stale, and let
   it express the five rungs the generator actually deals rather than two. This
   is the fix for the *within-division* inversion, and it should be done after
   (1) and (2) because it changes the ground, the following, the founding bank
   and the sponsor simultaneously and needs its own calibration pass.

**Do not** reach for +10% sponsor / +7% gate / −6% cost adjustments. Every one
of the three findings above is a single named law with a measured size.

## 23. THE 351-OFFER SPIKE

| tick | build | market line |
|---|---|---|
| 997 | pre-deploy | *(none — no offers)* |
| 998 | pre-deploy | 35 offers from bot clubs |
| **999** | **first post-deploy** | **21 free agents, 351 offers from bot clubs** |
| 1000 | post-deploy | *(none — no offers, gazette "unchanged")* |
| 1001 | post-deploy | *(none — no offers, gazette "unchanged")* |

**It settled on the very next tick, and stayed settled on the one after.** The explanation is the expected one: the
re-rating moved every asking price and every wage in the world at once, so every
bot club re-read the entire board on the first tick after and then had nothing
left to re-read. Pre-deploy ticks already ranged from 0 to 35, so the baseline
is bursty by nature. **Documented as one-time re-rating churn and closed** — no
MARKET OFFER CHURN item is raised, and nothing about it belongs in the economy
work.

---

## THE ANSWERS

1. **Why does Division One lose money?** Its commercial premium (+$2.84m)
   covers its wage premium (−$2.80m) and not the **$840,000 top-flight
   operations premium**. That single line is ~100% of the division gap.
2. **Why does Division Two make money?** Only its bottom half does. All eight
   D2 seats have *identical* income — stature is floored at 0.62 across the
   whole division — while slots 12–15 are dealt squads at half the payroll of
   slots 8–11. They net ~+$900k a season, forever.
3. **Is promotion financially harmful?** **No.** Holding the club fixed it is
   worth **+$1,531,482** a season. A promoted club that does not overspend
   makes money in Division One, and a yo-yo club's bank rises every season.
4. **Is relegation financially beneficial?** No — it costs $176,077, and $1.6m
   of guaranteed money. But that is a *soft* hit, blunted because a relegated
   club immediately starts winning and its gate recovers.
5. **Is slot 7 intentionally difficult or accidentally broken?** Intentionally
   difficult, and then broken by arithmetic. Its stature, ground, following and
   bank are one coherent step below slot 6. What kills it is a `d1b` payroll on
   last-place revenue — and D1/3 and D1/6 die in the same season, so it is the
   first to fall, not the only one.
6. **What percentage comes from wages?** Of the division gap, ~0% — the wage
   premium is fully covered. Of the *within-division* spread it is the whole
   mechanism, but as a **mismatch with income**, not as a level: the
   `FO_WAGE_R50` anchor being 3–4 cards stale raises every club's bill uniformly
   and changes no ratio.
7. **What percentage comes from commercial revenue?** ~35% of the
   within-division spread, through the gate: 42% of a club's revenue rides on a
   finish its dealt squad already determined.
8. **Are media rights too weak?** Not absolutely — $2.75m is 39% of a D1 club's
   income. They are too weak **relative to the top flight's mandatory cost
   base**: guaranteed income premium 1.93× the guaranteed cost premium, against
   squads that cost 2.5–4.6×.
9. **Is attendance scaling wrong?** It is scaling on the wrong things. Position
   moves it ×2.6, division +25%, the flagship visiting +0.4%, and **opponent
   strength not at all**. The ground never fills, so capacity is inert. A
   promoted minnow gets almost no crowd reward for playing famous opponents.
10. **Is econStature doing too much?** Five jobs is fine — they agree and the
    curve is gentle. The fault is the **0.62 floor**, which makes it constant
    across the biggest payroll step in the world (slot 11 → 12, ×1.9), and whose
    stated justification — squads flattening from slot six down — is measurably
    no longer true.
11. **What does a normal club earn or lose per season?** Mid-table, normal
    management: **D1 −$145,393**, **D2 −$235,128**. As actually played, the mean
    D1 seat loses **$919,381** and the mean D2 seat makes **$180,484**.
12. **What does a promoted club gain commercially before strengthening?**
    **+$1,531,482** — media +$1.10m, sponsor +$0.74m, prize +$0.20m, gate
    +$0.33m, against operations −$0.84m.
13. **What long-term wealth pattern emerges?** Division One drains at up to
    −$1.71m a season and reaches administration in 4 of 16 seats within five
    seasons; the bottom half of Division Two compounds at +$906,408 a season
    without limit. Founding capital hides it for two seasons, which is why the
    live world (21 rounds old) has not shown it yet.
14. **What ONE underlying law should change first?** The **playoff rounds
    billing a club's full cost base while paying no central money**. It is the
    only finding here that is a plain defect rather than a calibration, it
    punishes the one thing a manager is trying to do, and it costs nothing to
    fix. The pyramid itself is then a two-step calibration: re-measure
    `OPS_TOPFLIGHT_ROUND` against the guaranteed premium, then re-measure the
    stale `econStature` floor.
15. **What exact Phase 2 do you recommend?** (1) Pay rounds 15–16 their media
    and sponsor installment, or exempt non-league rounds from wages/ops/upkeep —
    with a test that a champion finishes richer than a runner-up. (2) Re-measure
    `OPS_TOPFLIGHT_ROUND` so guaranteed top-flight value is ~2.5× the guaranteed
    top-flight cost (indicatively $60,000 → ~$25,000 a round), keeping the
    premium in place. (3) Separately, and afterwards, re-measure the
    `econStature` floor against today's five-rung strength ladder. No
    percentage-tweaking of sponsor, gate or media.
16. **Did the 351 bot-offer spike settle?** **Yes** — the next two ticks
    produced no market line at all. Pre-deploy ticks already ranged 0–35, so the
    baseline is bursty; the spike was every bot club re-reading a board whose
    every price had just moved. One-time re-rating churn, closed, and kept out
    of the economy work.
