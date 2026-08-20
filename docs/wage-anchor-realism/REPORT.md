# Era 2 Wage Anchor Realism — audit

**Branch** `claude/wage-anchor-realism`, from `main` at `d7e935f` (Phase 4 shipped).
**Decision: A — no wage change.** Nothing is implemented. No constant moved.

The brief asked whether the absolute wage scale is now stale, and told me not to
assume the answer is to lower wages. It is not stale, and lowering it would undo
what Phase 4 shipped three days of measurement to achieve.

---

## The short version

Three findings, in the order they mattered.

**1. The era gate does not protect the wage law.** §4 called this a STOP
condition and told me not to assume otherwise. It was right to. `foWageOf` is not
an era-2 law read behind a gate — it is a global player-price function
re-evaluated for every cricketer in the world three times an hour, era-1 clubs
included. Any wage change is a live production change on the next tick.

**2. The anchor is not stale.** `FO_WAGE_R50` claims the median professional sits
at OVR 50 by the semantic ladder's own meaning. Measured over 1,920 dealt
cricketers: **51.0**. The median wage is **$9,860** against a midpoint that says
$9,290. The B2 rebasing — which restated the constant in *card* terms precisely so
it could not go stale the way it had — worked. There is no dead premise to replace.

**3. Neither lever can do the job.** The Division One deficit and the flagship
treasury sit at opposite ends of one ladder, and both `FO_WAGE_MID` and
`FO_WAGE_K` move every club at once. Any setting that closes the tail reopens the
money printer Phase 4 closed.

---

## 1. What exactly is the wage formula?

```
foWageOf(rating, talents, scar) =
    max(400, round( MID × (rating/R50)^K × (1 + 0.06 × talents) × scar / 10) × 10)

FO_WAGE_OVR50   50        the median professional, by the ladder's meaning
FO_WAGE_R50     50000     …as a rating, which is the card × 1000
FO_WAGE_MID     9290      what that median man earns a round
FO_WAGE_K       3.0       how fast the price of quality climbs
```

**What a wage *is*, architecturally** (§1): not a contract (A) and not an abstract
roster-cost proxy (C). It is **B — a dynamically derived market-rate salary**.
`server/living.mjs` calls `host.derive(squad)` for every club on every settle and
copies the derived fields back onto the player row; `wage` is in that list beside
`rating` and `bat`. A man's wage is a pure function of his *current* card,
recomputed three times an hour. Nothing negotiates it, nothing signs it, it has no
term, and there is no contract anywhere in the schema.

The one place a wage is *remembered* is `wage_rounds` (migration 101), which banks
the bill per club per round so history is not restated. That is a ledger record,
not a contract — it does not stop the next round being charged at a new price.

**This is why "change it for new signings only" is not available. There are no old
signings.**

### What each parameter controls

| | |
|---|---|
| `R50` | the midpoint's **location** on the card scale — not a level; moving it rescales every wage by `(old/new)^K` without changing any ratio |
| `MID` | the **absolute level**, and only that |
| `K` | the **shape**, and only that: it tilts the ladder about OVR 50 and cannot move the median man at all |
| `400` | a dollar floor under any professional |
| `0.06` | a multiplicative talent premium — worth more on a better man |

### 3. Where the law lives — four copies

| | |
|---|---|
| **canonical** | `engine/src/00-core.js` `foWageOf()` |
| mirror | `server/market.mjs` `wageFromRating()` — the umpire's valuations |
| mirror | `engine 55-market.js` `qsPrice()` — what the page promises |
| mirror | migrations **065 + 098**, plpgsql — what actually *moves the money* |

Migration 065 says it itself: *"If any of the four move, all four move."* And
**migrations are immutable** — a wage change needs a new numbered migration to
redefine the function. Checked on six real dealt men, the market mirror agrees
with the engine 6/6.

Downstream: `rawWorth = wage × 18 × 2.4 × ageCurve × form` → every fee;
`quickSellOf = rawWorth × 0.5`; `botMoney` reads the squad bill; `economy.mjs`
sums `p.wage`. The card, not the wage, drives selection and strength.

---

## 2–4. What R50 means, why it was calibrated there, and which assumption is stale

**"R50" means the rating of the median professional** — the point the whole curve
is relative to. It was originally measured at **25,704** against a rating formula
of `420 × (bat + 0.4 power + 0.5(threat+control) + 0.3 fielding + gloves)`.

**B2 redefined rating** as the canonical card × 1000, moving the world's median to
~50,000 and leaving the constant pointing at a landmark that had been moved.
Nothing failed — the curve went on working around the wrong point. Every wage was
multiplied by `(50000/25704)² = 3.78`, and the wage bill silently became almost
four times the share of income the economy was calibrated to carry.

That was fixed by restating the constant in **card** terms: *"the median
professional is OVR 50 by the definition of the semantic ladder, and the world is
dealt to put him there."*

**Which assumption is stale? None of them.** This is the brief's premise, and it
does not survive measurement:

| | claimed | measured |
|---|---|---|
| median professional | OVR 50 | **51.0** (1,920 men, 8 nations) |
| median wage | $9,290 | **$9,860** |
| wage / revenue | "about 65%" | **60.2%** (10 seasons, moving pyramid) |

The one thing that *is* historical is the **name**. `FO_WAGE_MID = 9290` is
$9,290 because that is what an OVR-50 man should earn; the ladder still means what
it meant. Payroll is running **below** the share it was fitted to, not above.

---

## 5. Is the problem SCALE or SHAPE?

**Neither — and this is a fact about the arithmetic, not a judgement.**

`foWageOf` is a pure power law in the card, so every ratio between two players is
`(a/b)^K` whatever the midpoint is:

| ratio | value |
|---|---|
| W95/W85 | 1.396 |
| W90/W80 | 1.424 |
| W80/W70 | 1.492 |
| W70/W60 | 1.588 |
| W60/W50 | 1.728 |
| W50/W40 | 1.953 |

No measurement of the population can move one of these, and an absolute re-anchor
cannot either. Scale and shape are cleanly separable here — which is what makes
the sweeps below decisive rather than confounded.

---

## 6–7. Today's distributions

**Visible OVR** (canonical card, 1,920 men):

| population | n | P10 | P25 | median | P75 | P90 | P95 | P99 |
|---|---|---|---|---|---|---|---|---|
| all players | 1920 | 23 | 35 | **51** | 66 | 79 | 84 | 91 |
| starting XI | 1408 | 34 | 46 | **59** | 71 | 82 | 86 | 92 |
| reserves | 512 | 12 | 19 | **30** | 40 | 48 | 51 | 61 |

By role: batters median 57, bowlers 49, all-rounders 49, keepers 44.

**Wages:**

| population | P10 | P25 | median | P75 | P90 | P95 | P99 |
|---|---|---|---|---|---|---|---|
| all players | $900 | $3,190 | **$9,860** | $22,350 | $36,640 | $45,640 | $56,010 |
| starting XI | $2,920 | $7,670 | $15,260 | $26,600 | $40,980 | $47,270 | $57,870 |
| reserves | $400 | $510 | $2,010 | $4,760 | $8,220 | $9,860 | $17,275 |

Max $69,950 a round. Division One median squad bill $300,440 a round; Division Two
$100,670.

**Which population should the anchor be read against?** The all-player median, and
it is the one the constant names. A club pays its whole roster, and reserves drag
an XI-only reading up by eight points. Read against the XI the anchor would look
low; read against what a club actually pays, it is where it says it is.

---

## 8. Payroll as a share of revenue, by seat

Ten seasons, real promotion and relegation, shipped Phase-4 operations:

| seat | yrs in D1 | annual net | 10-yr bank | wage/rev |
|---|---|---|---|---|
| 0 flagship | 10.0 | +$464,681 | $7,814,790 | 64.5% |
| 1 | 9.9 | +$365,249 | $8,085,201 | 62.1% |
| 2 | 9.9 | −$181,402 | $3,468,970 | 66.8% |
| 3 | 9.8 | −$156,594 | $4,655,916 | 66.2% |
| **4** | 7.9 | **−$1,054,032** | −$1,352,572 | **71.4%** |
| **5** | 8.3 | **−$954,838** | −$531,467 | **70.9%** |
| **6** | 6.6 | **−$1,123,085** | −$1,199,840 | **72.7%** |
| **7** | 7.7 | **−$953,081** | −$546,901 | **72.0%** |
| 8–11 | 2.1–3.1 | +$384k…+$469k | ~$6m | 50.5–51.3% |
| 12–15 | 0.0 | −$1k…+$212k | $2.7–4.4m | 40.8–42.9% |

World-wide **60.2%**. Below zero 93/256; ever in administration 77/256.

> **A correction to my own measurement.** My first burden table priced every seat
> on its *founding* coordinates and reported only four seats under water at 33–71%
> payroll — disagreeing with Phase 4's 65–82%. It was flattering the weak: founding
> support hands a minnow a crowd it never has again, and the gate money with it. The
> moving pyramid reproduces Phase 4 to the dollar (slot 4 at −$1,054,032, flagship
> P90 $16.33m, nought above $20m), and that is the basis used throughout.

**The shape of the burden is the finding.** It is not uniform: Division One's
bottom carries 71–73% and Division Two's bottom 41–43%. **Payroll is priced by the
division you are in; income is priced by the following you have.** Slots 4–7 are
dealt Division One squads and have Division One costs while carrying followings of
22–26k against slots 0–3's 28–37k. A global scalar moves the affordable and the
unaffordable club by the same proportion, so it cannot close a gap that is
*relative*.

---

## 9–11. What each candidate does

**Anchor-only sweep** (K and the ladder untouched):

| scale | MID | worst D1 seat | clubs > $20m | ever in admin | wage/rev |
|---|---|---|---|---|---|
| **1.00** | 9290 | −$1,123,085 | **0** | 77/256 | 60.2% |
| 0.90 | 8361 | −$529,425 | 9 | 34/256 | 54.1% |
| 0.80 | 7432 | −$39,504 | **27** | 20/256 | 48.1% |

**Curve-shape sweep** (§20, run because anchor-only failed):

| K | worst D1 seat | flagship 10-yr | clubs > $20m | below zero |
|---|---|---|---|---|
| 2.2 | +$69,549 | $25,363,252 | many | 25 |
| 2.6 | −$396,050 | $17,608,269 | 20 | 47 |
| **3.0** | −$1,123,085 | $7,814,790 | **0** | 93 |
| 3.4 | −$1,980,251 | $496,439 | 0 | **141** |

Lowering K is *worse* than lowering the midpoint, because the flagship holds the
best players and a flatter ladder is cheapest for exactly them. Raising K collapses
the world — median bank **−$1.65m**, 141 of 256 clubs below zero, every D1 seat at
−$2m. K = 3.0 is already near the top of its viable range.

**Both levers move the top harder than the bottom, because the top is where the
expensive men are.** There is no setting of either that closes the Division One
tail and leaves the flagship where Phase 4 put it.

### The sensitivity test that names the real cause

My pyramid holds each club's payroll fixed for ten seasons, so a relegated club
keeps a Division One squad on Division Two income. Letting payroll drift 50% a
season toward what its current division is dealt:

| | held fixed | payroll sheds |
|---|---|---|
| slot 4 | −$1,054,032 | −$338,526 |
| slot 6 | −$1,123,085 | −$70,550 |
| slots 8–11 | +$384k…+$469k | **−$739k…−$1,299k** |
| below zero | 93/256 | 114/256 |

**The deficit moves; it does not disappear.** Whichever club is in Division One
carries the squeeze. That is the diagnosis: **Division One is affordable for a club
with a big following and not for a club with a small one**, and no wage constant
knows about a club's following.

> A second correction: the first cut of this test discounted clubs *already dealt*
> a Division Two squad a second time, and Division Two duly printed $1.4m a season.
> The target is now relative to the division a club was dealt in.

---

## 12–15. Behaviour, tails, flagships

- **Remaining D1 failures**: improve under any cut, are never fixed, and the
  improvement is bought by making the whole world richer. Distinguishing global
  mis-anchor from genuinely expensive squad: these clubs are dealt squads costing
  ~$291k a round against slots 1–3's $348–366k — 84% of the payroll on 77% of the
  revenue. That is a **generated mismatch between the tier ladder and the income
  ladder**, and player generation is frozen this phase.
- **Bottom D2**: already fine after Phase 4 — slots 12–15 run +$147k…+$212k a
  season at 41–43% payroll, with administration at 1.5–7.0 rounds in ten seasons.
  Payroll is *not* the reason any of them struggles.
- **Flagships**: $7.8m at ten seasons, P90 $16.3m, **zero clubs above $20m**. Any
  meaningful cut reopens this. At ×0.80 it is 27 clubs.

---

## 16–17. The couplings

**§16 — the transfer market is priced in wages, linearly.**
`rawWorth = wage × 18 × 2.4 × ageCurve × form`. A scalar `s` on the midpoint
multiplies **every fee, every quicksell and every bot valuation** by exactly `s`.

| man | OVR | age | fee ×1.00 | ×0.90 | ×0.80 |
|---|---|---|---|---|---|
| ordinary starter | 55 | 26 | $534,000 | $480,500 | $427,000 |
| prime international | 80 | 27 | $1,742,500 | $1,568,000 | $1,394,000 |
| elite star | 92 | 28 | $2,800,000 | $2,520,000 | $2,240,000 |
| young prospect | 62 | 20 | $903,000 | $812,500 | $722,000 |
| veteran | 74 | 34 | $551,500 | $496,500 | $441,500 |

**§17 — and the part that does *not* scale is the money.** Banks, media, sponsor
and prizes are fixed in dollars. A flagship bank buys **0.81** elite men today and
**1.02** at ×0.80; a minnow goes 4.2 → 5.2 median men. Every club's purchasing
power rises by the size of the cut, having done nothing to earn it. This is the
brief's "bots endlessly buying stars" risk, stated as arithmetic.

---

## 18. Promotion and relegation

Same club, same squad, same following, same finish, one season in D1 instead of D2,
**before** any strengthening:

| scale | promotion | relegation |
|---|---|---|
| 1.00 | +$2,383,506 | −$2,383,506 |
| 0.90 | +$2,376,335 | −$2,376,335 |
| 0.80 | +$2,376,335 | −$2,376,335 |

Positive at every candidate and **invariant to the scalar** — the premium is media,
sponsor and gate against a division cost, and a wage scalar touches none of them.
(On founding coordinates; Phase 4's $1,899,801 was on the pyramid basis. The level
differs between bases, the invariance does not.)

---

## 19–20. Recommendation

**A — no wage change.** Not "no change is needed anywhere", but: *the wage law is
not the instrument for the problem that remains.*

1. The anchor's stated premise is measurably still true (median 51.0 vs a claimed 50).
2. Payroll is below the share the midpoint was fitted to (60.2% vs ~65%).
3. Every candidate that closes the D1 tail reopens the flagship printer Phase 4 closed.
4. The residual is a **relative** mismatch between the dealt tier ladder and the
   income ladder, which a global scalar cannot address.
5. A change would need a new migration, four synchronised copies, and — because of
   §4 — an era-activation mechanism, all to buy an outcome that is worse on the
   guard Phase 4 was fitted against.

### Answers to the numbered questions

| # | |
|---|---|
| 9 | **No new wage law.** Constants stay: R50 50000, MID 9290, K 3.0 |
| 10 | Unchanged: OVR 50 $9,290 · 60 $16,050 · 70 $25,490 · 80 $38,050 · 90 $54,160 |
| 11 | Unchanged: D1 $300,440 a round, D2 $100,670 |
| 12 | Unchanged (−$953k…−$1,123k). **Not** a wage problem — see the shed test |
| 13 | Unchanged and already healthy: +$147k…+$212k at 41–43% payroll |
| 14 | Unchanged: $7.8m mean, P90 $16.3m, zero clubs above $20m |
| 15 | Unchanged — fees are linear in wage, so no wage change means no fee change |
| 16 | Unchanged — bot posture reads the same bill against the same banks |
| 17 | Yes, +$2.38m, invariant to any candidate |
| 18 | Yes, −$2.38m |
| 19 | **Moot, and that is the finding.** §4's STOP condition is met: `foWageOf` is global and re-derives every settle, so a wage change is a live era-1 change on the next tick. It could be era-gated only by versioning the *player-price function itself* and teaching four copies plus a new migration about the era — and §22's display constraint then bites, because a player would show one wage while the ledger charged another. Not worth building for a change that should not be made |
| 20 | Yes — nothing was changed |
| 21 | **Close, not finished.** Playoff funding, the top-flight premium and club-scale operations are settled; the wage anchor is confirmed sound. What remains is not a *calibration* problem |
| 22 | See below |

---

## 21–22. What remains

**The real open problem, named precisely.** Division One is affordable for a club
with a large following and structurally unaffordable for one with a small
following, because payroll is set by the division a club plays in while income is
set by the following it has. Four seats (4–7) live in that gap. The instrument is
**not** the wage law — it is either the generator's tier ladder (what a Division
One club is *dealt*) or a division-scaled component of income. Both were frozen
this phase.

**The tier cliff (§25) — recorded, not solved.** Slots 12–15 were promoted 0 times
in ten seasons across all 16 nations. It is a competitive-generation question:
those seats are dealt squads at median card 33–36 against slots 8–11's 45–48, and
no amount of money changes who wins. It should be investigated as a *generation*
question — whether the d2b tier band is too far below d2a — and explicitly not
compensated with money.

**FO_WAGE_R50 (§17 of Phase 4) is now answered.** Phase 4 deferred it saying the
case was "much clearer". Measured: the case is closed the other way. It does not
need a phase.

---

## Evidence

| file | what |
|---|---|
| `era-boundary.txt` | the §4 STOP proof — asset patched, both hosts, restored byte-identical |
| `population.txt` | §6/§7/§9 distributions over 1,920 dealt men |
| `burden-founding.txt` | the founding-coordinate table, kept **because it was wrong** |
| `pyramid-scales.txt` | §11 anchor sweep, 10 seasons, real promotion/relegation |
| `pyramid-shape.txt` | §20 K sweep, both directions |
| `pyramid-shed.txt` | the sensitivity test that names the real cause |
| `coupling.txt` | §16/§17 transfer and treasury coupling |
| `law-map.txt` | §1/§2/§3/§10/§18 — the law, its four copies, the guard |

Tools: `wage-era-boundary.mjs`, `wage-population.mjs`, `wage-burden.mjs`,
`wage-pyramid.mjs`, `wage-coupling.mjs`, `wage-map.mjs`.
