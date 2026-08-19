# PHASE 3 §1 — WHO CONSUMES PLAYER VALUE, AND WHAT BREAKS IF IT MOVES

Written **before** any weight is touched, because the brief is right that
this is the critical step: `foPlayerValue()` is not only the card, it is
also the generator's target function.

## The one function, three jobs

`foPlayerValue(p)` returns `{ fam, levels, role, level, ovr }`.
`level` is the internal coordinate; `ovr` is `foOvrCurve(level)`.

| consumer | site | what it uses | what it does |
|---|---|---|---|
| **`foFitToLevel`** | `00-core.js:1209` | `.level` | **binary-searches a scale factor over `FO_FIT_KEYS` (the SKILLS) until `.level` hits a target** — this is player generation |
| **`foLayOnTier`** | `:1383` | `.level` via `foOvrCurve(...) − foAgePhase(age)` | ranks and deals a club's squad across a tier's OVR curve |
| **save migration** | `:419` | `.level` via `foOvrCurveV1` | reads the ladder a save was written against |
| **`foOvr`** | `:917` | `.ovr` | the card number |
| **`p.rating`** | `:6516` | `foOvr(p) × 1000` | the world's rating currency |
| **`foWageOf`** | via `rating` | — | wages, and through them transfer fees |
| **server** | `enginehost.mjs:449` | whole object | exposes it to the living world |

## The hazard, proven rather than assumed

`foFitToLevel` scales **only** `FO_FIT_KEYS` — the skills — and re-reads
`foPlayerValue(p).level` after each trial. It never touches `exp` or
`capt`.

Therefore **any attribute added to `.level` that the fitter cannot scale
becomes a tax on the attributes it can**. Concretely: if experience
entered the value map, a veteran (exp 85) fitted to a target level of 70
would be handed *materially worse batting and bowling* than a 20-year-old
fitted to the same 70, because his experience already paid part of the
bill. Generation would quietly make veterans worse cricketers the more
experienced they were — exactly the corruption §2 of the brief warns
against, and it would never show up in a match test, only in the world.

The same applies to captaincy.

One precedent already exists in the code for treating a family
differently here: `FO_HAND_SCALE = 0.5` scales the hand skills at half
rate during fitting — an existing acknowledgement that not every family
should track raw level one-for-one.

## What this dictates for Phase 3

The brief's optional separation is **required**, not optional:

- **INTRINSIC LEVEL** (`foPlayerValue().level`) — raw abilities only, the
  thing `foFitToLevel` and `foLayOnTier` target. Re-weighting *within*
  the skills is safe here; adding non-scalable attributes is not.
- **CURRENT OVR** — what the card shows. May legitimately include
  stable current-value attributes the fitter does not scale, provided it
  is computed *outside* the fitting loop.
- **MARKET VALUE** — current contribution plus age/career/leadership;
  the input to wages and fees.

Everything below in this phase respects that split.
