# The golden, before and after — and what to do about it

The frozen contract is **not re-blessed**. `engine/calibration-golden.json` and
`test/golden/` are exactly as they were, so `node --test 'test/*.test.mjs'`
reports one failure and it is the bit-for-bit replay. This file is the
comparison the brief asks for, so the decision about a new contract can be made
on evidence rather than on a diff.

## 1. The replay master — CHANGED, unavoidably

`test/replay.test.mjs` asserts that a fixed seed reproduces a recorded match
ball for ball. Any change to `ballDist` changes it. This is not a regression and
it cannot be avoided by any amount of care: the master is a hash of the old ball
model. Determinism itself is intact — the same seed still produces the same
match every time (`tools/calibration.mjs` reports `identical: true`, and
`test/the-engine-has-room-at-both-ends.test.mjs` asserts it directly).

The pinned fingerprint moved from `323/8` to `335/9`.

## 2. The calibration cells — three of four inside tolerance

Measured at 300 matches a cell, against the golden's own tolerances.

| cell | golden | now | tolerance | verdict |
|---|---:|---:|---:|---|
| international, first innings | 269.4 | 274.8 | ±13.5 | **inside** |
| flagship_clubs | 242.6 | 250.1 | ±12.1 | **inside** |
| division_two | 182.2 | 230.8 | ±9.1 | **outside, deliberately** |
| international v division_two | 224.1 | 258.6 | ±11.2 | **outside, deliberately** |

The international cell is the one `calibration-check` additionally holds to real
men's-ODI bands, because international data is the only cricket the model was
ever fitted against. It has not moved.

The two that moved are the **same defect measured twice**. Division Two scored
182 with a 75% all-out rate; that is the low-end cliff the whole B1 brief exists
to remove, and 231 with a 33% all-out rate is the intended result rather than
drift. `international_vs_division_two` is a mismatch fixture and moves for the
same reason.

## 3. Distribution shape — WIDER, which was also intended

| cell | golden sd | now |
|---|---:|---:|
| international | 53.3 | 51.8 |
| division_two | 46.1 | 40.2 |
| international v division_two | 81.3 | 89.6 |

The mismatch cell's tail is broader. The like-for-like cells are unchanged or
slightly tighter.

## 4. Extras — HIGHER, and now bowler-dependent

Golden division_two 18.7 an innings; now 27.8. This is the discipline change:
wides and no-balls used to be very nearly bowler-independent (the no-ball rate
was **identical for every bowler alive**), and a division of poorly-disciplined
quicks now leaks accordingly. The international cell is 22.5, which is inside
men's-ODI range; the divisional figure is high and is the most defensible
candidate for a further trim.

## 5. Classification

| change | class |
|---|---|
| replay master byte-identical | **expected consequence** of an authorised engine change |
| international, flagship first innings | **no material change** |
| division_two +49 runs, all-out 75% → 33% | **intended fix** — the low-end cliff |
| mismatch cell +35 runs | **intended fix**, same cause |
| division_two extras +9 | **intended mechanism**, magnitude arguable |
| pinned fingerprint | **expected consequence** |

## 6. Recommendation

Re-blessing is a separate decision and is deliberately not taken here. If it is
taken, the honest procedure is `node tools/calibration.mjs` (writing) plus
`node tools/record-masters.mjs`, in one commit that does nothing else, so the
new contract is legible as a contract rather than buried in an engine change.

Note that a new golden should probably **not** be recorded until B2 has settled
the population, since the calibration tiers are defined by rating targets and
B2 is expected to move what a rating means.
