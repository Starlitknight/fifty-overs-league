# FINAL SHIP GATE — PLAYER VALUE + FAST-BOWLER GENERATION

Branch `claude/fast-bowler-generation`. Not merged, not deployed.

None of the accepted decisions was changed. `FO_FAST_LEAD_P` stays 0.25, the
accepted `FO_VAL_W` stands, field mix 1.00, keeper glove 1.80, all-rounder
0.80/0.80, experience capped and confined to current value, captaincy off the
card, immediate re-rating, no quick injection, no wage-curve change.

---

## 1. THE FOUR MARKET FAILURES

Two separate faults, both in the fixture, neither in the market.

### The listing assertion (approach B)

It demanded that one call to `openBotListings` return a **fresh** listing.
That is not a property of the market — it is a property of how much of its
allowance the umpire had already spent. Measured at the moment of the
assertion: **eight bot clubs already had a man on the open board**, every club
was at `policy.listings`, and every further call correctly returned zero. The
test failed while the thing it names was working.

It now asserts the **board**: bot clubs expose eligible surplus men, correctly,
exactly once each.

### The bidding fixture

Three dependent tests failed for an unrelated reason: they took
`ORDER BY id LIMIT 1`, the *oldest* listing, which says nothing about its
price. A county banks about two million; the board runs from twenty thousand
to past three million; and the refit moved every asking price because a fee is
a season of wages. Measured, the old pick asked **$2,582,500 against a bank of
$2,134,967** while the board held men at $180,500 — so a legitimate 1.25×
bid was refused for funds.

`biddableListing()` takes the cheapest **bot-club** listing: deterministic,
affordable by construction, still a deal between two clubs. The over-bank
refusal is still proved with nine hundred million.

## 2. WHY THE REPAIRED ASSERTION IS STRONGER

The old test checked **two** things about the men it happened to insert: the
asking price, and that the club is not managed. The new one checks **five**
about **every** man on the board, three of which it never looked at:

| checked | old | new |
|---|---|---|
| asking price > 0 | ✓ | ✓ |
| club is not managed | ✓ | ✓ |
| closes on its window | ✓ | ✓ |
| **listed man is on the books of the club selling him** | — | ✓ |
| **his club kept a legal side** (`> SQUAD_FLOOR`) | — | ✓ |
| **nobody is on the board twice** | — | ✓ |
| re-running a round adds nobody | ✓ | ✓ |

Proved by mutation rather than argued:

| arm | result |
|---|---|
| **A** current gameplay + old fragile test | **14/18** — failure reproduced |
| **B** current gameplay + repaired test | **18/18** |
| **C** bot listing disabled (`openBotListings` returns `[]`) | **FAILS** — *"bot clubs put their surplus men on the board (0 listed)"* |
| **D** same man also listed by a club that does not own him | **FAILS** — *"Mason Barker is on the books of the club selling him"* |

Neither mutation is committed; `git diff` on `market.mjs` is empty.

D is the *reachable* duplicate: `listings_one_open`, a partial unique index on
`(country_id, slot, player) WHERE status='open'`, already makes a same-club
duplicate impossible at the database, so the bug class that can actually occur
is a wrong-club listing — which is also a second board entry for one man.

### A fifth failure, found by the full suite

`world-earned-talents` — *"the engine credits a trigger only where the talent
would have fired"*. Also the fixture, and the test had warned about it itself:
three lines above, it asserts the tally is *"keyed by side, so a slot resolves
and two men sharing a name cannot be confused"*, and then flattens it into one
map by name and resolves the man out of both squads together.

The re-dealt world produced exactly that collision: **Alfie Hargreaves the
top-order batsman of one county and Alfie Hargreaves the wrist-spinner of the
other**. The engine credited `anchor` to the batsman, entirely correctly —
`foTalCount` gates on `foTalElig` at `00-core.js:1985` before it counts
anything — and the test looked the talent up against the spinner. The look-up
keeps the side now. No engine change.

## 3. RATING MIRRORS — THERE IS NO SECOND STALE ONE

Every `CREATE FUNCTION` in every migration was enumerated and reduced to its
**last definer**, which is the live one. Thirty-five functions; exactly one
reimplements the card.

| mirror | of what | keyed off | status |
|---|---|---|---|
| `world_pk_num` (SQL) | `foPlayerValue` / `foOvr` | **skills** | **updated** by migration 102 — parity **9/9** |
| `world_market_quicksell` (SQL, 098) | `foWageOf` | `rating` | **unaffected** — the wage curve did not change, and it reads the card rather than recomputing it |
| `wageFromRating` (`market.mjs`) | `foWageOf` | `rating` | **unaffected**, same reason; held to the engine by `world-fee-agrees.test.mjs` |

The two wage mirrors take a rating as input, so they pick the new cards up for
free. No SQL view embeds card arithmetic (one view exists, `public`, in 096).
`world_stretch_*` and `world_sync_*` move skills and compute no overall.

**Migration 102 is kept.** 099 is not edited — it is immutable like every
applied migration, and 102 redefines the function in a new numbered file.

One client-side reading is worth naming, though it is not a stale mirror:
`08-orders.js:424` shows a role's level through `foOvrCurve`, so it displays
**intrinsic** ability and will sit a point or two under the card for an
experienced man. That is the same deliberate split as the trade strip.

## 4. THE RE-RATING IS A RE-LABEL

| claim | proof |
|---|---|
| raw skills unchanged | **3,840 cricketers × 15 attributes byte-identical** under the old law and the new |
| engine outcomes unchanged | **36/36 seeded matches bit-identical** between the pre-valuation build and this one, compared on the whole scorecard |
| only derived surfaces move | the movement table below, and the wage line |

The physics check compares full scorecards — innings runs, wickets, legal
balls, extras, and every batsman's line — not the winner. An earlier cut of it
called `window.foSimMatch`, which does not exist, so it compared `null` against
`null` thirty-six times and reported a perfect pass; it uses `eng.sim` now and
treats a null on either side as a broken probe.

Accepted movement, unchanged: **969 / ±1 1616 / ±2 857 / ±3 314 / ±4 66 /
±5 18 / >5 none.**

## 5. ECONOMY — AND THE ONE CHECK I COULD NOT COMPLETE

**The income side never reads a rating.** Gate is seats × turnout × a fixed
ticket, the broadcast van pays by the head, and a sponsor signed a close-season
contract. So the entire effect of the re-rating on a club's season is
`(new bill − old bill) × wage rounds`, and that subtraction is exact:

| club | season cash effect | as a share of its opening bank |
|---|---|---|
| Essex | **+$582,120** | 34.6% of $1,681,754 |
| Middlesex | +$438,660 | 25.3% of $1,735,124 |
| Yorkshire | +$274,320 | 12.8% of $2,134,967 |
| Sussex | −$17,280 | −1.1% |
| Somerset | −$64,800 | −3.6% |

Wage bill per round across sixteen English clubs: **$3,616,580 → $3,739,290
(+3.4%)**; per club between −2.2% and **+8.6%** (Middlesex).

**I could not validate an absolute solvency model.** My season model puts
**ten of sixteen clubs under water on the OLD law**, which is not a world
anybody has been playing, so it is wrong somewhere — most likely in how often
wages are actually charged. It is printed in `economy-safety.txt` and
explicitly labelled as not a verdict, in either arm.

**And then the repo's own test found the problem my model could not.**
`world-p3` — *"016: the nets, the face and the money all belong to the world"* —
holds a contract I had not read when I wrote the paragraph above: after a
fortnight of cricket, **no English club may sit at or below −$1,250,000**, half
the $2,500,000 administration floor. Era 2 runs tight margins by design and a
heavy Division One payroll may lawfully dip into its overdraft; what a
fortnight must never do is drive anybody to the floor.

| build | result |
|---|---|
| main | **27/27** |
| fast-bowler generation only | **27/27** |
| generation **+ valuation** | **26/27** — slot 7 at **−$1,304,167** |

Banks after the fortnight, in millions:
`2.95 1.73 2.34 -0.22 1.00 1.69 0.25 **-1.30** 3.48 4.31 1.77 1.06 1.44 2.61 1.92 1.42`

So the **player-value re-rating is the cause**, not the generation change, and
the overshoot is **$54,167 — 4.3% past the line**, which is the size of the
payroll rise itself.

On the decision rule this is the second branch, not the first: **a genuine new
insolvency problem, reported before anything is changed.** The wage curve is
untouched, as instructed. It is the user's call whether to widen the floor,
absorb the rise, or trim the part of the re-rating that drives it — the
decomposition in `rerating-decomposition.txt` shows the weights and field mix
alone cost +1.1% against the full model's +3.9%.

## 6. FAST-BOWLER GENERATION, FINAL

`FO_FAST_LEAD_P = 0.25`, fresh representative world, 256 clubs / 3,840 men:

| style | heads | front line | clubs with one |
|---|---|---|---|
| **seamFast** | **81** | **5.8%** | **28.9%** |
| seamFastMedium | 405 | 26.0% | 85.5% |
| seamMedium | 560 | 24.5% | 82.4% |
| fingerSpin | 531 | 33.8% | 96.5% |
| wristSpin | 242 | 9.9% | 39.5% |

Clearly present; well under fast-medium (5.8% vs 26.0%) and under seam-up
combined (50.5%); **no nation with none** (14 of 16 have two or more); wrist
spin restored (6.5% → 9.9%); **256/256 clubs legal with a sixth option**;
spread evenly across divisions (d1 37, d2 37).

World strength from generation alone: mean OVR 52.78 → 52.80, intrinsic level
mean **54.14 → 54.14**, division levels 62.78/45.51 against 62.77/45.50, ages
equal, payroll from generation +0.25%. Existing players untouched; no
injection; natural free-agent intake remains the policy.

## 7. THE HOME-ADVANTAGE TEST — ACCEPTED

| arm | result |
|---|---|
| revised test on the **shipped** build (main) | **4/4 pass** |
| revised test on the **candidate** | **4/4 pass** |
| revised test with `FO_HOME_EDGE` 1.05 → **4.5** | **FAILS**: *home won **71.2%** across 5 squads (74.5, 69.7, 70.8, 69.8, 71.1)* |

Statistically stronger, not looser: one squad at N=1000 carries ~1.6 points of
error plus a squad-to-squad spread of about the same again, while the mean of
five carries ~0.7 — so `< 58` on the mean is a tighter bound than `< 58` on one
draw, and a new per-squad ceiling (`< 62`) stops one runaway squad hiding
inside an acceptable mean. The mutation is not committed; the restored build
hashes to `233571`, identical to the pre-mutation build.

## 8. THE FINAL VALUE MODEL

```js
const FO_VAL_W = {
  bat:   { vsPace: 0.169, vsSpin: 0.111, power: 0.137, rotation: 0.165, temperament: 0.104 },
  bowl:  { wicket: 0.368, economy: 0.287, discipline: 0.088, moveTurn: 0.029,
           variation: 0.042, stamina: 0.026 },
  field: { fielding: 0.077, catching: 0.029 },
  glove: { catching: 0.230, keeping: 0.021, stumping: 0.018 }
};
const FO_VAL_MIX = {
  bat:   { bat: 1.00, bowl: 0.00, field: 1.00, glove: 0.00 },
  bowl:  { bat: 0.00, bowl: 1.00, field: 1.00, glove: 0.00 },
  ar:    { bat: 0.80, bowl: 0.80, field: 1.00, glove: 0.00 },
  wk:    { bat: 1.00, bowl: 0.00, field: 0.00, glove: 1.80 }
};
// current playing value = intrinsic level + a bounded experience term
const FO_EXP_RUNS = 0.0401, FO_EXP_REF = 50, FO_EXP_RPO = 1.2, FO_EXP_CAP = 2.0;
foExpLevelBonus(p) = clamp((p.exp − 50) × 0.0401 / 1.2, ±2)
```

**Visible OVR** = `foOvrCurve(level + foExpLevelBonus(p))` — stable expected
current playing value. Includes cricket skills and bounded experience.
Excludes form, fatigue, age and captaincy.

**Intrinsic level** = raw scalable ability only. What `foFitToLevel` bisects
toward and `foLayOnTier` deals against. Experience never enters it — verified:
a man swept exp 20 → 95 holds intrinsic level 65.73 throughout while his card
moves 66 → 68.

**Market** = `rating` (the current card × 1000) → `foWageOf` → `rawWorth`,
which keeps its own `ageCurve`. Captaincy stays with selection and the
Match-Day Coach, which already know who is leading today — it is worth
+5.56 ± 2.01 runs to the man wearing the armband and **0.00 ± 0.00** to
everybody else.

---

## GATES ON THE FINAL HEAD

| gate | result |
|---|---|
| engine suite | **489: 488 pass, 0 fail, 1 skipped** |
| calibration-check | **PASS** (engineVersion v3, 300 matches/cell) |
| replay / golden masters | green (inside the engine suite) |
| Match-Day Coach suite | green (inside the engine suite) |
| SQL card parity | **9/9** |
| market tests | **18/18** |
| earned talents | **7/7** |
| bit-identical physics | **36/36** |
| build | `20260819-2344-233571`, one asset, source hash matches |
| **server suite** | **437: 435 pass, 2 fail** |

The two server failures are the **same** finding twice: `world-p3` and
`world-shape` both guard the treasury after a fortnight, and both are the
solvency contract described in §5. Neither is a fixture fault — main and the
generation-only commit pass both.

## NOT READY TO SHIP

Everything in sections 1–4 and 6–8 is green and proved. The valuation
re-rating breaks a solvency contract the repo holds, by $54,167 on one club,
and §5 of the brief says to report that before changing anything rather than
to widen a floor or normalise a curve to make it pass. **No PR is opened.**
