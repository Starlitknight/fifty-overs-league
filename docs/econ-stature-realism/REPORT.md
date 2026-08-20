# Era 2 Economic Stature Realism — audit

Branch `claude/econ-stature-realism`, from `main` at `ae4172c` (Phase 2 shipped).
**No shipped law is changed by this phase.** Everything below is `tools/` and
`docs/`. The candidate coordinate lives in `tools/stature-laws.mjs` and is
reachable only from the measurement tools.

---

## Before anything else: the tool was wrong, and it was wrong about Division Two

Every seat measurement in the last two audits came out of `seasonOf()` in
`tools/economy-audit.mjs`. Checking it against a freshly settled world found
four ways it disagreed with the walk it claims to model, and **all four move
money in the same direction, which is Division Two**:

| # | Quantity | Shipped law | What the model did | Bias |
|---|---|---|---|---|
| 1 | `supportTarget` stature argument | **raw** `stature` (`economy.mjs:641`, `:1020`) | floored `econStature` | inflates D2 |
| 2 | position basis for support and mood | **national**, all 16 clubs, `N = clubs.length` | divisional, 8 clubs | inflates D2 |
| 3 | support drift | 0.18 a round, clamped `[4000, 60000]` | 0.25, unclamped | over-converges |
| 4 | a non-win | a loss | a tie every fifth round | inflates weak clubs |

None of it was visible because the only validation that existed
(`tools/economy-validate.mjs`) compared **three Division One clubs** — slots 3,
6 and 7 — against a transcript from a world that predates both Phase 2 laws.
Every one of those clubs sits above the floor, and for every one the divisional
and national ranks nearly coincide. That validation set could not have caught
either thing this phase turns on.

`tools/econ-oracle.mjs` now settles a real world through the shipped
`computeFinance` for all sixteen seats and both divisions, and
`tools/econ-model-check.mjs` compares. After the fix:

- media, sponsor, sponsor bonus, prize, operations and wages agree **to the
  dollar** at every one of the sixteen seats;
- supporters within **4.7%**, revenue within **6.3%**;
- net inherits the revenue miss and nothing else.

**The model's honest resolution is ±6.3% of revenue.** Enough to tell a seat
running +$1.8m from one running −$1.6m; *not* enough to call break-even. Every
arm-against-arm number below is far tighter than that, because the residual is
a property of the seat and cancels between arms.

One consequence to state plainly: **the "$10.7m of D2 accumulation" this phase
was asked about came from the broken tool**, and it does not survive the fix
plus a working pyramid. See Q6.

---

## 1. What exactly is econStature?

```js
stature(slot, isBoss)                       // economy.mjs:78
  isBoss or slot 0  ->  1
  slots 1-7         ->  0.86 - 0.035 * (s - 1)      division one
  slots 8-15        ->  0.62 - 0.022 * (s - 8)      division two

econStature(slot, isBoss) = Math.max(0.62, stature(slot, isBoss))
```

**The intended concept, in one sentence:** *the club's underlying commercial
size — the crowd it draws, the ground it fills and the capital its board
carries — as a property of its seat in the league, independent of any one
season's finish.* The architecture supports that reading: it is derived from
the slot, never stored, and it feeds only founding coordinates and the sponsor's
scale factor, while finish-linked money runs through separate position terms.

### The dependency map — every consumer, and which value it reads

| Consumer | Reads | Era | What it sets |
|---|---|---|---|
| `foundingBank` | **floored** | era 1 only | era-1 starting capital |
| `foundingBankEra2` (via `foundingBankFor`) | **floored** | era 2 only | era-2 starting capital |
| `foundingSeats` | **floored** | both | the ground it opens with |
| `foundingSupport` | **floored** | both | the following it opens with |
| `sponsorSeasonValue` | **floored** | era 2 only | the deal's stature factor |
| `ambitionOf` (`botfinance.mjs`) | **floored** | era 2 only in effect | a bot board's risk appetite |
| `supportTarget` | **RAW** | both | what the crowd drifts *to* |

There are no other call sites anywhere in the repo — engine, server, SQL,
generation, tests or presentation.

**The split in that table is the finding the whole phase turns on.** The
recurring channel — the one that pays every season for ever — is handed the
**raw** stature and has been ignoring the floor all along. The floor reaches a
club's founding coordinates, its sponsor factor, and its crowd only through
where the crowd *starts*.

`ambitionOf` is worth a line of its own: it computes
`-(0.02 + 0.16 * Math.max(0, (s - 0.62) / 0.38))`, whose `Math.max(0, ...)`
already clamps everything below the floor. Measured across all sixteen slots,
the floored and raw arms are **identical to fifteen decimal places**. The floor
does nothing here.

## 2. What is the exact current floor?

`Math.max(0.62, ...)`. It binds on **slots 9–15 and nowhere else**: slot 8 is
already exactly 0.62, and Division One's lowest value is slot 7 at 0.650. Seven
of sixteen seats.

Lift, by seat: +3.7%, +7.6%, +11.9%, +16.5%, +21.6%, +27.0%, **+33.0%** at slot 15.

## 3. Why was that floor originally introduced?

Its own comment, above `econStature`, states the case as an empirical claim:

> mean squad rating over four nations runs 36,064 at the flagship down to
> 25,773 by slot four — and then STOPS, sitting between 23,000 and 24,300 for
> every slot from six to fifteen. The generator has a floor on how bad a
> professional gets. The income ladder had none, so it kept descending past the
> point the squads did, and the bottom club was asked to pay a slot-eight wage
> bill on slot-fifteen money: 115% of income, bankrupt for being poor rather
> than for being weak.

So: it was preventing **bankruptcy-by-coordinate** — a club whose costs had
stopped falling while its income kept falling.

## 4. Which assumption is now dead?

Both of them, and the second matters more.

**Re-measured with the shipped generator over all sixteen nations**
(`tools/stature-ladder.mjs`):

| slot | mean squad rating | payroll/round | step |
|---|---|---|---|
| 0 | 70,904 | $449,573 | — |
| 1–3 | 65,608 / 65,500 / 65,175 | ~$368,000 | −7.5% then flat |
| 4–7 | 59,450 / 59,296 / 58,858 / 58,579 | ~$292,000 | −8.8% then flat |
| 8–11 | 48,421 / 49,071 / 48,792 / 48,554 | ~$179,000 | −17.3% then flat |
| 12–15 | 37,858 / 37,779 / 37,438 / 37,783 | ~$96,000 | −22.0% then flat |

**Dead assumption 1:** slots 6–15 do not sit in a 23,000–24,300 band. They run
**37,438 to 58,858 — a 57.2% spread**. (The brief's slot 6 ≈ 66,818 / slot 15 ≈
45,000 are of the same shape; the absolute levels differ because those look at
best-XI rather than whole-squad, which I report alongside.)

**Dead assumption 2, and the real one:** the strength ladder was never a smooth
descent that "stops" at a point. It is a **staircase of five tiers** — the
generator's own `tierOf` map. Inside a tier nothing moves more than 1.5%;
between tiers the steps are −7.5%, −8.8%, −17.3%, −22.0%. A single hard floor
at slot 8 mirrors **none** of those cliffs. The income coordinate is a straight
line through a step function.

## 5. How much commercial information does the floor destroy?

- top:bottom stature ratio, all sixteen seats: raw **2.146** → floored **1.613**
- top:bottom inside Division Two: raw **1.330** → floored **1.000**
- **100% of the coordinate spread inside Division Two is erased**; 29% across
  the world.
- Rank correlation against payroll, all 256 clubs: raw **0.952**, floored **0.915**.
- Rank correlation against payroll **inside Division Two**: raw **0.769**,
  floored **constant — no information at all**.

What that is worth, pushed through every consumer (`docs/…/coordinate-map.txt`):

| | across all eight D2 seats |
|---|---|
| founding capital | **$806,000** one-off in total (max $202,000, slot 15) |
| sponsor | **$182,669 a season** in total (max $45,667, slot 15) |
| founding support | up to **+3,295** at slot 15 — but it decays toward a raw-stature target |
| recurring support target | **$0** — the floor never reaches it |
| bot ambition | **$0** — already clamped |

The same-division fairness picture (§6 of the brief), and it is the sharpest
single line in the audit:

> **Division Two: payroll ladder ×1.82, floored founding-support ladder ×1.00.**
> Slot 8 pays 82% more in wages than slot 15 out of exactly the same founding crowd.

## 6. What percentage of D2 excessive accumulation is caused by it?

**At the biggest accumulator, 0.0% — exactly.** Slot 8's raw stature *is* 0.62.
It sits on the knee; the floor never lifts it. Every line of its books is
identical to the dollar with the floor on and off.

Across Division Two as a whole, over five seasons: treasury $2,139,479 with the
floor against $1,814,235 without — the floor is worth **$325,244**, of which
$100,750 is a one-off capital transfer and **$224,494 is operating**.

But the premise of the question does not survive the pyramid. **`stature-arms`
froze every club in the division it was dealt**, and that is where "$10m+ D2
accumulation" came from: a club winning Division Two five years running. There
is no such club — `rollSeasons` sends D1's bottom two down and D2's top two up
every year. Running the swap (`tools/stature-pyramid.mjs`):

| | frozen divisions | live pyramid |
|---|---|---|
| slot 8, 5-season bank | $8,841,372 | **$3,538,927** |
| slot 7, annual net | −$2,184,351 | **−$966,834** |

Over **ten** seasons with the pyramid running, the largest accumulations in the
world are the flagships (slot 0: $11.2m mean, $20.3m P90), not Division Two.
The D2 seats that do accumulate — slots 8–11, ~$5.0–5.7m — do it partly *in
Division One*, where they spend 2–3 of the ten seasons.

## 7. What percentage of remaining D1 fragility is caused by it?

**0.0%, at every Division One seat, exactly.** The floor is a `max()` and no D1
seat's raw stature is below it. Both arms are identical to the dollar.

Slot 7, the most fragile top-flight seat, decomposed:

| | per year |
|---|---|
| revenue | $4,845,266 |
| wages | $4,038,143 — **83% of revenue** |
| operations | $2,171,288 |
| overdraft interest | $624,187 |
| **annual net** | **−$2,184,351** |
| the floor's contribution | **$0** |

## 8. What happens if we simply remove the floor?

| | current | no floor |
|---|---|---|
| D1, every seat | — | **identical to the dollar** |
| D2 annual net (mean) | +$19,789 | −$52,889 |
| D2 5-season treasury (mean) | $2,139,479 | $1,814,235 |
| slot 15 annual | −$766,562 | −$923,073 |
| slot 15 rounds in administration (of 70) | 6.3 | 9.1 |
| clubs playing to a ground under 15% full | 0/256 | **16/256** |

The floor is not enriching the bottom of Division Two — slot 15 loses
three-quarters of a million a year *with* it. It is slowing the drowning.
Removing it drowns them faster and empties sixteen grounds.

## 9. What new law, if any, should replace it?

The coordinate should be given **the shape the cost ladder actually has**: one
value per generator tier, no floor, no cliffs except where the squads cliff.

I recommend this as the correct coordinate **and recommend against shipping it
on its own.** See Q19 — it is a coherence fix, not an economy fix, and by itself
it makes the world modestly poorer.

## 10. Exact formula and constants

```js
// tools/stature-laws.mjs — NOT SHIPPED
const TIER_OF = slot => slot === 0 ? 'flagship'
  : slot <= 3 ? 'd1a' : slot <= 7 ? 'd1b' : slot <= 11 ? 'd2a' : 'd2b';

const TIER_STAT = {
  flagship: 1.000,   // slot 0
  d1a:      0.825,   // mean of 0.860, 0.825, 0.790
  d1b:      0.7025,  // mean of 0.755, 0.720, 0.685, 0.650
  d2a:      0.587,   // mean of 0.620, 0.598, 0.576, 0.554
  d2b:      0.499    // mean of 0.532, 0.510, 0.488, 0.466
};

econStature(slot, isBoss, era2) =
  era2 ? (isBoss ? 1.000 : TIER_STAT[TIER_OF(slot)])
       : Math.max(0.62, stature(slot, isBoss));     // era 1: EXACTLY as today
```

Each tier value is the **mean of the current raw stature over that tier's
seats**, so the world's existing commercial scale stays exactly where it is
while the within-tier gradient — which nothing in the game pays for — is
removed. No new magnitude is invented.

**Adjacent-seat smoothness** (§11 of the brief). The rule is that a step needs a
structural reason; payroll is the structure:

| step | payroll | current | nofloor | soft | **tierflat** |
|---|---|---|---|---|---|
| 0→1 | −17.8% | −14.0% | −14.0% | −14.0% | **−17.5%** |
| 1→2 | −0.1% | −4.1% | −4.1% | −4.1% | **0.0%** |
| 3→4 | −18.8% | −4.4% | −4.4% | −4.4% | **−14.8%** |
| 7→8 | −38.9% | −4.6% | −4.6% | −4.6% | **−16.4%** |
| 11→12 | −45.6% | **0.0%** | −4.0% | −1.9% | **−15.0%** |

The current law puts a step at every seat regardless and **0.0% across the
whole of Division Two**, including the −45.6% payroll cliff at 11→12. `tierflat`
steps only where the cost steps, and always by less than the cliff it mirrors.

## 11. What happens to supporters?

| arm | P10 | P50 | P90 | grounds under 15% full |
|---|---|---|---|---|
| current | 10,113 | 19,757 | 33,458 | 0/256 |
| nofloor | 8,133 | 19,074 | 33,458 | 16/256 |
| soft | 9,096 | 19,413 | 33,458 | 0/256 |
| tierflat | 8,290 | 19,243 | 32,823 | 16/256 |

No arm produces absurd attendance. Median ground occupancy is 48–49% under all
four. Sixteen clubs playing to a 14–15% ground under `nofloor`/`tierflat` is the
honest consequence of letting the bottom coordinate fall, and it is believable
for a struggling small club — but it is a real change and I flag it rather than
bury it.

## 12. What happens to grounds and stadiums?

No stadium constant is touched. Consequences only: biggest ground stays 29,000
under every arm; `tierflat` gives all four seats in a tier the same founding
ground, removing the current 1,000-seat steps between seats with identical
squads. Clubs over 90% full: **32/256 under every arm, unchanged** — that is a
pre-existing property of the gate model, not something any candidate creates.

**Club identity survives** (§12 of the brief). Revenue P90/P10 is ×2.96
(current), ×3.13 (nofloor), ×3.05 (soft), **×3.10 (tierflat)** — `tierflat`
gives a *wider* commercial spread than today, because the tiers are properly
separated. The trade is fewer distinct scales: 9 today, **5** under `tierflat`,
16 under nofloor. Giants, middling clubs and minnows all remain; what goes is a
gradient between clubs that are the same club.

## 13. Five-season Division One finances

Identical under `current`, `nofloor` and `soft` — to the dollar, at every seat.
Under `tierflat`, redistributed within the `d1b` tier and roughly neutral
overall: slot 7 improves (−$457,449 → −$229,329 five-season bank; administration
rounds 10.1 → 8.9), slot 4 worsens (−$877,446 → −$1,119,117; 7.8 → 9.1).
World "ever in administration" 50/256 → 52/256.

## 14. Five-season Division Two finances

| seat | current | nofloor | soft | tierflat |
|---|---|---|---|---|
| 8 | $3,538,927 | $3,538,927 | $3,538,927 | $3,416,917 |
| 12 | $1,648,226 | $1,151,832 | $1,508,451 | $1,107,690 |
| 15 | $1,466,383 | $709,061 | $1,081,712 | $960,258 |

World median treasury: $1,586,212 (current) → $1,380,178 (nofloor) →
$1,494,255 (soft) → $1,494,479 (tierflat).

**Does D2 still trend toward $10m+?** No — and it never did once the ladder
moves. At ten seasons the D2 seats reach $5.0–5.7m mean, and the clubs above
$10m are flagships.

## 15. Does promotion remain positive?

**Yes, under every arm.** Two different quantities, both reported because
quoting either alone misleads:

**17A — the structural premium (the guard).** Same club, same squad, same
finish, one season in D1 instead of D2:

| arm | promotion | relegation |
|---|---|---|
| current | **+$1,900,732** | −$1,900,732 |
| nofloor | +$1,879,993 | −$1,879,993 |
| soft | +$1,890,211 | −$1,890,211 |
| **tierflat** | **+$1,880,079** | −$1,880,079 |

This is the figure Phase 2 fitted against (+$1.96m) and it is intact.

**17B — what a promoted club actually banks**, year after against year before,
in a live pyramid: **−$343,353** (current). Not a contradiction: a club is
promoted by *winning* Division Two, on a champion's sponsor, prize and crowd,
and arrives in Division One as the weakest side in it. The division premium is
still positive; the club has stopped being a champion.

## 16. Does relegation remain negative?

Yes — **−$1,880,079 to −$1,900,732** structurally, under every arm.

Separately, and worth knowing: **relegation is +$249,270 in the live pyramid**,
for the mirror-image reason. A club relegated from D1 was finishing last there
and arrives as one of the strongest sides in D2.

## 17. Is Era 1 exactly unchanged?

**Only if the change is era-gated, and this is the most important implementation
finding of the phase.**

`econStature` is **not** an era-2 coordinate. `foundingBank` (era 1),
`foundingSeats` and `foundingSupport` (both eras) all call it, and the books are
a pure derivation replayed from genesis on every settle — a club's founding
capital is not written down once, it is recomputed every time the walk runs.
**Production is season 1, `start_day` 14, against `ERA2_DAY = 42`: all 256 live
clubs are era 1.** An ungated change lands on every one of them.

Measured (`tools/stature-era-boundary.mjs`):

| arm | era-1 seats whose founding capital moves | worst |
|---|---|---|
| nofloor | 7/16 | −$366,000 |
| soft | 7/16 | −$183,000 |
| tierflat | **14/16** | −$288,000 |

The gate must be in the coordinate itself — `econStature(slot, isBoss, era2)`,
returning today's law whenever `era2` is false — so every era-1 call site keeps
its number **by construction rather than by inspection**. The seam is the
*season*, not the club, and `economy.mjs` already carries exactly that
distinction (`foundedEra2` for the founding line, `curEra2` for the season being
walked).

**The transition (§21) is financially quiet.** A club crossing into its first
era-2 season sees its sponsor stature factor move by at most **±1.3%**, and its
founding capital is not re-read at all — it is history. There is no
discontinuity created by the mechanism.

## 18. After correcting stature, is FO_WAGE_R50 still a problem?

**Yes. Correcting stature does not touch it.**

| arm | D1 wages/revenue | D1 seats over 70% of revenue on wages |
|---|---|---|
| current | 68.7% | 53/128 |
| nofloor | 68.7% | 53/128 |
| soft | 68.7% | 53/128 |
| tierflat | **68.6%** | **53/128** |

A tenth of a percentage point. The wage anchor still needs its own phase.

Management archetypes are likewise unmoved, which is the reassurance that
matters — **ambition can still ruin you** under every arm:

| archetype | D1 annual (current) | D1 ever in administration |
|---|---|---|
| FRUGAL (80% of dealt payroll) | +$856,020 | 9/128 |
| NORMAL (100%) | −$224,488 | 39/128 |
| AGGRESSIVE (135%) | **−$2,292,688** | **104/128** |

`tierflat` moves NORMAL to −$227,139 and AGGRESSIVE to −$2,302,585.

## 19. What economic problem remains after this phase?

**The flat cost of being a club, and the wage anchor. Neither is stature.**

Sweeping the coordinate for each failing seat and reading off where its annual
result crosses zero (`tools/stature-breakeven.mjs`):

| seat | coordinate today | coordinate needed to break even |
|---|---|---|
| slot 15 (D2, 8th) | 0.620 | **1.118 — above the flagship** |
| slot 11 (D2, 4th) | 0.620 | **1.008 — above the flagship** |
| slot 7 (D1, 8th) | 0.650 | **1.615 — above the flagship** |
| slot 6 (D1, 7th) | 0.685 | **1.264 — above the flagship** |
| slot 14 (D2, 7th) | 0.620 | 0.910 |
| slot 4 (D1, 5th) | 0.755 | 0.885 |

**Four of the six failing seats would need a commercial scale larger than their
nation's flagship to break even.** No placement of any floor can reach them. The
reason is a cost that does not scale with the club:

```
operations = $58,000 + seats × $3.1 (+ the top-flight premium), every round
```

| seat | revenue | operations | as % of revenue | + wages |
|---|---|---|---|---|
| slot 8 | $5,901,187 | $1,853,600 | 31% | 73% |
| slot 12 | $3,973,679 | $1,853,600 | 47% | 81% |
| slot 15 | $3,144,973 | $1,853,600 | **59%** | **102%** |

The bottom of Division Two spends 59% of everything it earns on the privilege of
existing, before it pays a player. That is the next problem, and it is an
operations problem.

Two more, recorded and not touched:

- **The tier cliff makes the bottom of Division Two a holding pen.** Slots 12–15
  were promoted **0.00 times in five seasons across all sixteen nations** — 0 of
  64 club-seasons. The −45.6% payroll cliff between slot 11 and slot 12 means
  the bottom four can never out-rank the top four. That is a *generation* issue
  (`tierOf`), not an economy one.
- **Flagships compound without limit.** Slot 0 reaches $11.2m mean and $20.3m
  P90 over ten seasons, and 34/256 clubs pass $10m. If anything in this world is
  a money printer it is the top of Division One, not Division Two.

---

## Recommendation

1. **The diagnosis is confirmed:** the floor's stated premise is dead, it erases
   100% of Division Two's coordinate spread, and the coordinate is the wrong
   *shape* — a straight line through a five-step staircase.
2. **The prosecution case is not.** The floor causes **0%** of Division One
   fragility and **0%** of the largest Division Two accumulation. It is not
   over-funding cheap clubs; at the bottom it is keeping them from drowning.
3. **`tierflat`, era-gated, is the right coordinate** — smallest coherent
   formula, derived from the measured distribution, steps only where costs step,
   keeps promotion positive and ambition dangerous.
4. **I recommend not shipping it alone.** By itself it makes the world modestly
   poorer (world median treasury −$92k over five seasons; ever-in-administration
   50→52 of 256; sixteen grounds under 15% full) because it withdraws an
   accidental subsidy without addressing why the bottom needs one. It belongs
   with, or after, an operations re-fit.

Per §26 the candidate law is **not committed to `server/`**. It exists only in
`tools/stature-laws.mjs`, reachable from the measurement tools.

## Evidence

| file | what |
|---|---|
| `model-vs-world.txt` | the model against a settled world, sixteen seats |
| `coordinate-map.txt` | every consumer, raw against floored |
| `ladder.txt` | the re-measured strength ladder, correlations, fairness |
| `arms-5season.txt` | floor on/off, frozen divisions |
| `attribution.txt` | line-by-line attribution per seat |
| `pyramid-5season.txt`, `pyramid-10season.txt` | the live pyramid, four arms |
| `candidates.txt` | smoothness, identity, supporters, grounds, archetypes, wages |
| `era-boundary.txt` | the era-1 leak and the gate needed |
| `breakeven.txt` | the coordinate sweep and the operations floor |

**ERA 2 ECONOMIC STATURE REALISM COMPLETE — AWAITING REVIEW.**
