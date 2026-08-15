# The one thing ageing broke that is not yet fixed

**Status: open. This is why B2 is not being called complete.**

`server/tests/world-p3.test.mjs` — *"015: watched IS recorded — the banked living
patch replays the same match"* — fails with ageing enabled and passes with it
disabled. It is the only failing test in either suite (engine 411/411, server
399/400).

## What the contract is

A spectator's broadcast does not store the match. It regenerates it: take the
club's squad **as the world serves it now**, lay the banked *living patch* over
it (form, legs, experience, talent state), and re-run the recorded seed with the
recorded orders and conditions. The same cricket must come out, ball for ball.

The contract has always been limited to the **current** round — the test's own
prose says so — because a rollover rewrites the clubs table wholesale and an old
match can no longer be rebuilt. Newcomer levelling and academy promotions were
already on that list. Ageing has joined it.

## What was measured

Round 3 of season 2, all eight fixtures, replayed from the served squads plus
their banked patches:

| ageing | fixtures replaying identically |
|---|---:|
| enabled | **5 of 8** |
| disabled | **8 of 8** |

So it is real, it is caused by the decline, and it is partial rather than total.

## What it is *not*

Ruled out by direct measurement, in this order:

1. **Not a rollover inside the test's own ticking.** Instrumented: the banking
   loop runs rounds 1–3 of season 2 and the only youth tick on record is
   `eng:youth:s1`. The season does not turn under the test. The loop was
   nevertheless bounded to `ROUNDS` so it cannot manufacture one — that fix is
   kept, and is correct on its own account.
2. **Not the stored skills.** For a failing fixture, every man in the canonical
   blob that carries a `skills` object was compared attribute by attribute
   against the same man in the `clubs` table: **22 men, 0 differences.** The
   cricketers who played and the cricketers the replay is built from have
   identical numbers.
3. **Not the baseline being left behind.** `foAgeDecline` was made to move
   `baseSkills` alongside `skills`, because the living fold rebuilds the second
   from the first (`living.mjs`: `if (p.skills[k] !== p.baseSkills[k])
   p.skills[k] = p.baseSkills[k]`) and would otherwise undo the decline
   silently. That change is right and is kept. It did not fix this.
4. **Not the JSON round trip.** `host.ageDecline` passes the squad through a vm
   and therefore through `JSON`, which drops `undefined` and coerces `NaN`.
   `ageYouth` now merges the returned *numbers* back onto the live objects
   rather than swapping the array. Also right, also kept, also not this.

## Where to look next

The divergence is total from the first delivery (`book 362/3 vs replay 376/3`;
the opener is 76 off 71 in one and 121 off 113 in the other), which is the
signature of **two different elevens, or the same eleven in a different order**,
rather than of a skill drifting by a point. Since the skills are identical, the
next suspects are the inputs to selection and ordering rather than to the ball
model:

- `autoPick` / `pickXI` rank on `rating`, which `jsDerive` recomputes inside
  `foAgeDecline`. If a rating in the table disagrees with the rating the tick
  played with — by a rounding, or because one path re-derived and another did
  not — a different XI is picked at replay.
- `mpos` and the batting order, and whether they are rebuilt or inherited.
- `applyLiving`: what it restores and, more to the point, what it leaves at
  whatever the served squad happens to carry.

The cheapest next experiment is to dump the chosen XI and batting order on both
sides of a failing fixture and diff them; that will say in one run whether this
is selection or something deeper.

## Why the decline is staying in anyway

Turning it off would make this test pass and would put the world back to one in
which a thirty-seven-year-old hits the ball exactly as he did at twenty-two.
Careers would have no shape, and the population's stationarity — which now holds
at peak-equivalent overall across twenty seasons — would be held up by
retirement alone. The defect is in the replay path, not in the ageing, and it
should be fixed there.
