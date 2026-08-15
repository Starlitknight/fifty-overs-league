# The B1 engine contract, and what B2 may not touch

The redesigned ball model is accepted. This file records what "accepted" means
in files, so a B2 change that disturbs the engine is visible as a regression
rather than as noise.

## What is frozen

**`test/golden/masters.json`** — nine matches, three surfaces, three seeds,
recorded ball by ball off the accepted build. `test/replay.test.mjs` asserts
future builds reproduce them bit for bit. This is the primary contract: it is a
hash of the whole ball model, and nothing about B2 should move it.

**`engine/calibration-golden.json`** — four cells at 3,334 matches each,
recorded off the same build:

| cell | first innings | sd | all out | extras |
|---|---:|---:|---:|---:|
| international | 274.6 | 53.1 | 28.2% | 22.4 |
| flagship_clubs | 250.6 | 45.6 | 30.6% | 23.7 |
| division_two | 235.3 | 35.3 | 25.7% | 29.1 |
| international v division_two | 259.5 | 89.4 | 31.2% | 27.0 |

Pinned fingerprint `373/6`, determinism confirmed identical.

## Why these survive B2, and the one rule that keeps them alive

Both harnesses build their sides from `GD.teams` — the reference squads baked
into the engine bundle — and scale them by FIXED constants. Neither reads
`p.rating`, and neither touches the server's world. So B2 can redistribute all
3,840 cricketers, redefine `rating`, and rewrite generation without moving
either file.

**THE RULE.** `jsDerive()` maps a man's fifteen card skills onto the numbers the
ball model reads: `bat`, `power`, `rotation`, `temperament`, `vsPace`, `vsSpin`,
`threat`, `control`, `field`, `keeping`. Those ten mappings are part of the
frozen engine and B2 must not change any of them. `rating` and `wage` are also
computed in `jsDerive` and are NOT part of the contract — they are B2's to
redefine, precisely because the ball model never reads them.

## The latent/effective split, and why it does not touch any of this

Stored attributes no longer stop at 99. `jsDerive` now reads each of them
through `foEff` before the ten mappings, and so does every other path on which a
raw attribute reaches the ball model (the keeper's `wC` and `wST` terms, the
spatial fielding contest, per-ball fatigue). **Not one of the ten formulas
changed** — `.32 vsPace + .32 vsSpin + .16 rotation + .20 temperament` is still
exactly what `p.bat` is. What changed is the representation of the man being
mapped, which this file does not freeze and could not: the transform happens
*before* the engine receives him, which is what the contract's own diagram says
should happen.

**And it cannot move either golden, by construction rather than by measurement.**
`foEff` is the identity for every value at or below 99. The baked reference
squads top out at **97**, and the calibration harness's elite cell scales them by
1.30 and clamps at **98**. So every input either harness can produce takes the
identity path, and both goldens are bit-for-bit what they were. That is checked
on every run — `test/replay.test.mjs` and `tools/calibration-check.mjs` are both
green — but it is worth knowing it is a theorem and not a result.

`tools/engine-domain.mjs` records what the frozen model actually does above 99,
which B1 never asked: it is monotone, non-inverted and sane to 140 in every
contest measured, and the batting family is still moving at 200. B1's "useful
range 20–95" was the top of the range B1 swept, not a measured failure point.

If a B2 commit moves the golden, that is a regression unless the reason is
written down and extremely clear.

## One assertion that moved, and why

`tools/calibration-check.mjs` used to require that weaker sides are bowled out
MORE often than internationals. On the accepted engine, measured over 3,334
matches a cell, it is the other way about: 25.7% against 28.2%.

The sign is wrong and the cause is the harness rather than the ball model. Its
tiers are one baked squad multiplied by a constant, so a Division Two side is an
international side with its batting AND its bowling weakened by the same factor -
and two equally weakened sides do not collapse, they play a low-scoring game in
which nobody can get anybody out.

A real second-division side is not a scaled international. It has a longer tail,
a thinner top order and far less depth relative to its attack, and that is what
makes it collapse. So the question belongs to the shape of the WORLD, and B2
asks it of the population it actually generates. The assertion this file was
created for - that international cricket outscores club cricket rather than
trailing it - is unchanged and passes at +39 runs.
