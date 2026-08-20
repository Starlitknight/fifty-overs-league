# PHASE 3 §1 — WHO CONSUMES PLAYER VALUE, AND WHAT BREAKS IF IT MOVES

Written **before** any weight is touched, because the brief is right that
this is the critical step: `foPlayerValue()` is not only the card, it is
also the generator's target function.

Read this first. Everything after it in the phase is constrained by §4
below.

---

## 1. THE PIPELINE, END TO END

```
p.skills (15 latent attributes)
   |
   |  foEff(k, v)            latent -> effective; identity below 99, log above
   v
foValFamilies(p)             4 family scores: bat / bowl / field / glove
   |                         weights = FO_VAL_W  (runs-per-point)
   |
   |  foValLevel(fam, role)  role mixture FO_VAL_MIX, normalised by FO_VAL_C
   v
foPlayerValue(p) = { fam, levels, role, level, ovr }
   |                         .level  = best role's level (+ all-rounder premium)
   |                         .ovr    = foOvrCurve(.level)
   |
   +---> foOvr(p) ------> round/clamp 0..100 ------> THE CARD
   |         |
   |         +---> p.rating = foOvr(p) * 1000        (jsDerive, :6516)
   |                  |
   |                  +---> p.wage = foWageOf(rating, talents, scar)   (:6517)
   |                  |         |
   |                  |         +---> market.mjs wageFromRating (MIRROR)
   |                  |                  |
   |                  |                  +---> rawWorth = wage x 18 x 2.4
   |                  |                          x ageCurve(age) x form
   |                  |                          |
   |                  |                          +---> valueOf()  = fee
   |                  |                          +---> quickSell  = 0.5 x
   |                  |                          +---> scoutFee    = pct
   |                  |
   |                  +---> squadStrength() = mean rating of the fieldable XI
   |                  +---> classOf(rating) = the scouting impression band
   |                  +---> market.mjs surplus/need scoring (:150-184, :422)
   |                  +---> AI bid gate: "better = rating > mine.best x 1.04"
   |
   +---> foStars(ovr) -------> ten half-stars, presentation only
   +---> foOvrLabel(ovr) ----> the twelve-rung vocabulary, presentation only
   |
   +---> foFitToLevel(p, target)     GENERATION. binary-searches ONE factor
   |         over FO_FIT_KEYS until .level hits target
   |
   +---> foLayOnTier(...)            peakOvr = foOvrCurve(.level) - foAgePhase(age)
             ranks a squad and deals each man a mark on the tier's curve
```

## 2. EVERY CONSUMER, CLASSIFIED

`A` intrinsic ability · `B` current playing value · `C` market/economic ·
`D` presentation only.

| # | consumer | site | reads | class | note |
|---|---|---|---|---|---|
| 1 | `foFitToLevel` | `00-core.js:1209` | `.level` | **A** | the generator's target function — see §4 |
| 2 | `foLayOnTier` | `:1383` | `.level` via `peakOvr` | **A** | ranks + deals a squad across a tier |
| 3 | save migration | `:419` | `.level` via `foOvrCurveV1` | A | reads the ladder a save was written against |
| 4 | `foOvr` | `:917` | `.ovr` | **B** | the card |
| 5 | `p.rating` | `:6516` (`jsDerive`) | `foOvr(p) x 1000` | B→C | the world's currency; **the hinge** |
| 6 | `foWageOf` | `:6432`, called `:6517`, `:7041`, `:7074` | `rating`, talents, scarcity | **C** | `r^3` curve |
| 7 | `market.mjs wageFromRating` | `market.mjs:99` | `rating` | C | a deliberate MIRROR of #6; `world-fee-agrees.test.mjs` holds them equal |
| 8 | `rawWorth` / `valueOf` | `market.mjs:114,104` | wage x 18 x 2.4 x age x form | **C** | transfer fee |
| 9 | quicksell / `scoutFee` | `market.mjs:123,779` | `rawWorth` | C | halved / percentage |
| 10 | `squadStrength` | `ratings.mjs` | mean `rating` of fieldable XI | B | club strength, world rankings |
| 11 | `classOf` | `market.mjs:742` | `rating/1000` | D | the scouting impression band |
| 12 | AI surplus scoring | `market.mjs:150-169` | `rating`, `wage`, age | C | who a bot club lists |
| 13 | AI need / bid gate | `market.mjs:182-184, 422` | `rating` | C | `rating > mine.best x 1.04` |
| 14 | AI wage guard | `market.mjs:428-430` | `wage` | C | refuses to tip income into deficit |
| 15 | founder draft pricing | `:7041-7074` | `rating`, own `specialty()` | C | **a second opinion** — see §3 |
| 16 | `foStars` | `:1119` | `ovr` | **D** | ten half-stars |
| 17 | `foOvrLabel` | `:931` | `ovr` | D | twelve rungs |
| 18 | `enginehost.mjs` | `:449,453` | whole object, `foStars` | — | exposes all of the above to the server |
| 19 | Match-Day Coach | `13-matchday-coach.js` | **nothing** | — | reads SKILLS directly; not a value consumer |
| 20 | training | `:5157`, `:7485+` | **nothing** | — | mutates skills, then `jsDerive` re-derives |
| 21 | ageing `foAgeDecline` | `:660` | **nothing** | — | mutates skills, then `jsDerive` re-derives |

**Findings that matter.**

- Training, ageing and the Match-Day Coach are *downstream*. They move
  skills and let the value model re-read them. Nothing in Phase 3 can
  break them by construction, which is worth knowing before worrying
  about them.
- Everything economic funnels through **one scalar**: `p.rating =
  foOvr(p) x 1000`. Wages, fees, quicksell, scout fees, AI listing, AI
  bidding, squad strength and the world rankings are all functions of it.
  A change to OVR is a change to the whole economy, amplified: `foWageOf`
  is `r^3`, so **a +1 OVR at 70 is about +4.3% wage, and a +5 OVR is
  about +23%**; the fee is linear in the wage, so it moves with it.
- `foStars` and `foOvrLabel` are pure functions of the card. They need no
  work of their own — they move when OVR moves, and that is correct.

## 3. THE ONE SECOND OPINION

`foDraftPool` (`:7041-7074`) prices the founder's draft with its **own**
`specialty()` formula — `aggBat + 0.15 x power` for a batsman,
`0.62 x keeping + 0.55 x bat` for a keeper — and bands the pool by
within-role percentile. It then sets `p.wage = foWageOf(p.rating, ...)`,
so the *wage* is canonical but the *fee* is not.

The keeper line is the loud one: it prices a gloveman at 0.62 x keeping,
and the measured value of keeping is **0.016 runs a point**. That formula
is a survivor of an older universe. It is in scope for this phase as a
consumer to reconcile, not as a physics change.

## 4. THE HAZARD, PROVEN RATHER THAN ASSUMED

`foFitToLevel` scales **only** `FO_FIT_KEYS` — the fifteen skills — and
re-reads `foPlayerValue(p).level` after each trial. It never touches
`exp` or `capt`.

Therefore **any attribute added to `.level` that the fitter cannot scale
becomes a tax on the attributes it can**. Concretely: if experience
entered the value map, a veteran (exp 85) fitted to a target level of 70
would be handed *materially worse batting and bowling* than a 20-year-old
fitted to the same 70, because his experience already paid part of the
bill. Generation would quietly make veterans worse cricketers the more
experienced they were — exactly the corruption §3 of the brief warns
against, and it would never show up in a match test, only in the world.

The same applies to captaincy.

`foLayOnTier` compounds it: it deals marks by `peakOvr` and then calls the
fitter, so a veteran would be ranked *up* by his experience and then
*fitted down* in raw skill to pay for it. Both halves of the error point
the same way.

One precedent already exists in the code for treating a family
differently here: `FO_HAND_SCALE = 0.5` scales the hand skills at half
rate during fitting — an existing acknowledgement that not every family
should track raw level one-for-one.

## 5. WHAT THIS DICTATES FOR PHASE 3

The brief's optional separation is **required**, not optional:

- **INTRINSIC LEVEL** (`foPlayerValue().level`) — raw abilities only, the
  thing `foFitToLevel` and `foLayOnTier` target. Re-weighting *within*
  the skills is safe here; adding non-scalable attributes is not.
- **CURRENT OVR** — what the card shows. May legitimately include
  stable current-value attributes the fitter does not scale, provided it
  is computed *outside* the fitting loop.
- **MARKET VALUE** — current contribution plus age/career/leadership;
  the input to wages and fees.

On the brief's §3 menu this makes **B** safe by construction, **A**
safe only if the experience term is added after fitting and the fitter
keeps targeting the raw-skill level, and any option that puts experience
inside `.level` unsafe. That is a conclusion from the code, not from
measurement; the measurement decides how *large* the term should be, not
whether it may exist.

Everything below in this phase respects that split.
