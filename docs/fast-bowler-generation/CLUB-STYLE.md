# `world-shape` — the second red, and why it was never the economy

The final ship gate reported two server failures and attributed both to the
treasury. **That was wrong on `world-shape`, and the error is worth stating
plainly because it was an attribution made from the name of a test rather than
from its body.**

`world-shape`'s *"two clubs are two clubs, even in the same league"* has nothing
to do with money. It reads the batting lean — `vsPace − vsSpin` — of every
English club and asks that some clubs come out the pace side of nil and some
the spin side.

## What actually fails, and to what

| build | result |
|---|---|
| main (`9619a44`) | **7/7** |
| fast-bowler generation **only** (`3443c53`) | **6/7** — same failure |
| generation + valuation (head) | **6/7** — same failure |

So it is the **generation** change, not the valuation: `FO_FAST_LEAD_P` draws
one more number from the squad generator's shared stream, every club is dealt a
slightly different world, and England's sixteen clubs landed on one side of
zero.

```
main    12  5  8 -2  1  3  2 21  2  5 -1  8 -0 -1  4  6      min -2.4  -> passes
head    12 14 28  4  1  2  0  1  8 11  3  8  5  8  2  5      min +0.3  -> fails
```

The test turned over on **a third of a skill point**.

## The lean cannot see the house style at all

The obvious repair — ask the same question of all 256 clubs instead of
England's sixteen — was written, and it passed. Then it was checked against a
world with the per-club house style **deleted** (`houseTilt = natTilt` for
every club), and it passed there too. So did the original assertion's spread
check.

| statistic, 256 clubs | main | gen only | head | **house style deleted** |
|---|---|---|---|---|
| club-to-club spread of batting lean | 5.14 | 5.34 | 5.33 | **5.10** |
| clubs leaning against their own country | 28.1% | 24.2% | 25.4% | **23.8%** |
| overdispersion of club tilt vs binomial | 1.11 | — | 1.07 | **0.98** |

The house tilt swings a club's expected lean over a range of about 5 points
across `natTilt ± 0.17`; the sampling error of an eight-man average is 3.4 on
its own. The signal is real and roughly a third the size of the noise, so no
assertion built on batting lean can hold it — the last row separates by about
one standard error and nothing more.

**England is simply the worst place to ask.** It is the most pace-leaning
country in the world (club mean +7.0; next is West Indies at +5.7), so its
clubs are the least likely of anybody's to cross zero. The old test asked the
hardest nation for a coin to land heads, and had been getting heads.

## Where the house style *is* large

A club is built to one of ten **archetypes** — Kent are misers, Lancashire play
express pace, Hampshire keep wicket — and that is not subtle. Profile each club
by its squad's own attribute ratios (so style is compared, not strength) and
compare **pairs inside one league**:

| build | same archetype | different | ratio |
|---|---|---|---|
| main | 0.4299 | 0.6824 | **1.587** |
| generation only | 0.4388 | 0.6889 | **1.570** |
| head | 0.4355 | 0.6905 | **1.586** |

Three differently dealt worlds agree to one per cent, where the old statistic
disagreed by its own sign.

## The repaired test

1. English clubs' batting leans still spread (`sd > 2`) — kept, unchanged.
2. A league is built to **at least five** different house styles.
3. Inside a league, two clubs of different archetypes sit **more than 1.20×**
   further apart in profile than two of the same archetype.

Threshold 1.20 against a measured 1.57–1.59 on three builds.

### Proved by mutation, not asserted

| arm | result |
|---|---|
| head, repaired test | **7/7** |
| main, repaired test | **7/7** |
| every club forced to its country's archetype | **FAILS** — *"a league is not one club sixteen times over - its clubs are built to 1 different house styles"* |
| per-club `houseTilt` deleted, **old** test | passes its spread check (the failure it gives is the coin, not the style) |

An earlier cut of the repair compared archetype pairs **across the whole
world** and survived the one-archetype mutation, because an English club and an
Indian one differ for reasons that have nothing to do with either club. Pairing
inside a league is what makes it bite.

Neither mutation is committed; both worktrees were restored and the engine
rebuilt to `233571`, the accepted build.
