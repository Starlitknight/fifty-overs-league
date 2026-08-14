# Phase B1 evidence — the engine's strength response

Raw measurement output, kept in the repo because it is expensive to reproduce
(about ninety minutes of simulation) and because the container it was made in
does not survive the session. Regenerate any of it with
`tools/strength-response.mjs`; the exact command is in each file's header line.

`L` is the harness's LEVEL coordinate — a squad's mean raw skill, with every
man's and every skill's offset from that mean preserved. It is **not** display
OVR and no claim is made that it is. See the header of
`tools/strength-response.mjs`.

## The files

| file | what it is |
|---|---|
| `matrix-shape.txt` | the baseline 25-cell matrix, n=200/cell |
| `bisect-shipped.txt` | reduced 13-cell matrix, n=300, shipped constants |
| `bisect-soft15/30/100.txt` | same, with `skill_soft` raised from 10 |
| `bisect-nomm.txt` | same, with the mismatch term disabled (`mismatch_scale`→1e9) |
| `bisect-nostd.txt` | same, with the standard-of-cricket terms zeroed |
| `sweep-shape.json` / `sweep-cal.json` | level-against-itself, additive vs production's multiplicative calibrate() |

## The causal verdict these establish

**`mm` (the mismatch term) owns the low-end score collapse, and owns it
completely.** Disabling it takes a level-25 side facing level-70 from 65.6 all
out to 234.8, and its wickets from 9.95 to 7.77. Nothing else moved that number:
tripling `skill_soft` made it *worse* (54.5), and zeroing the standard terms made
it worse still (31.1). This is the "55 all out every match" defect, and it has
exactly one cause.

**`std` (the standard-of-cricket terms) owns the scoring level.** Zeroing them
collapses every level of cricket to about 180 with eight wickets down and an
all-out rate above half — including elite cricket. They are what makes better
cricket score more, and they are load-bearing.

**Nothing tested owns the high-end saturation.** Across six configurations the
85→95 win rate moved only between 52.3% and 60.7%, against a sampling error of
about 2.9 points at n=300. `skill_soft` is *partially* responsible — 52.3 → 56.3
→ 60.0 as it goes 10 → 15 → 30 — but the effect is weak, it is not monotone
(soft100 gives 55.7, worse than soft30), and the price is ruinous: at soft30
elite cricket scores 357 instead of 318, and at soft100 it scores 417 with 1.9
wickets down.

The honest reading is that high-end saturation is **not a coefficient defect at
all**. At 85 v 85 the environment has already run out of headroom — about three
wickets an innings and a total pinned near 320 — so there is no room left for
relative advantage to express itself, whatever the skill terms say. That is a
property of the whole ball model near its ceiling, not of one term in it.

**`skill_soft` does NOT cause the low-end cliff.** 25→35 measures 86.7% shipped,
88.3% at soft15, 87.7% at soft30 and 93.0% at soft100 — flat or worse. The
hypothesis that it did was mine, from algebra, and the bisect refutes it.
