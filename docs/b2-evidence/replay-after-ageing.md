# The replay invariant, and what ageing exposed in it

**Status: closed.** The defect was in the replay path's ownership of match-time
state, exactly where the last note guessed it would be, and not in the ageing.
`server/tests/a-banked-match-is-not-revised.test.mjs` now holds the invariant
directly rather than as a side effect of the spectator contract.

## What the contract is

A spectator's broadcast does not store the match. It regenerates it: take the
club's squad **as the world serves it now**, lay the banked *living patch* over
it, and re-run the recorded seed with the recorded orders and conditions. The
same cricket must come out, ball for ball.

That makes the patch a contract. It has to own **everything the engine reads
that the world is later entitled to change**. For a long time it owned form,
legs, experience, absence and talent state — and quietly did not own the two
things ageing moves.

## How the first difference was found

The previous note listed four things the divergence was not, and guessed that
selection or ordering was next. Guessing was the problem. The measurement that
settled it wraps `host.runMatch` and keeps a deep copy of **the exact team
objects the umpire handed the engine**, ages the world, rebuilds the same
fixtures the way a broadcast does, and diffs every field capable of reaching a
delivery — seed, pitch, weather, orders, roster, and thirty-odd fields a man.

Round 3 banked, then one year laid over it:

```
=== BEFORE ageing ===   8 of 8 fixtures replay identically
=== AFTER  ageing ===   0 of 8 fixtures replay identically
   fields that differ, by how many men:
      age  240        skills.power     91        skills.vsPace   74
      skills.fielding  91              skills.stamina  90        skills.wicket  69
```

Two inputs, not one, and both of them upstream of everything the last note was
about to investigate. The XI and the batting order were downstream symptoms:
selection ranks on numbers derived from skills, so of course a different eleven
came out.

## The two ownership errors

**1. Skills were a delta against a mutable reference.** The patch recorded only
the skills that had moved off `baseSkills`, and `applyLiving` rebuilt the rest
*from today's* `baseSkills`. That was sound while nothing edited the baseline.
`foAgeDecline` edits it deliberately — a thirty-four-year-old's decline is what
he IS, not a debuff sitting on top of the boy he was — so from the day ageing
shipped, every skill a man had **not** trained was rebuilt at his aged value.
The patch now writes the whole skill map out (`sk`) and `applyLiving` takes it
wholesale, consulting nothing about today's cricketer.

**2. Age was not recorded at all.** The ball model reads it directly:
`foAgeTireFactor` scales what a day in the field costs a man, and the
late-innings terms ask whether the batsman is over thirty or under twenty-six.
The year turns for the whole world at once, so every banked match on the planet
was being replayed by men a year older than the ones who played it. The patch
now carries `g`.

## The same defect wearing different clothes

Once the rule was written down — *a historical match belongs to its historical
match state* — the roster was obviously breaking it too. The replay took the
**squad** from the live club, so a transfer cost two fixtures of eight: the
selling club turned out an eleven with a hole in it, and the buying club picked
from a squad containing a man who was somewhere else that afternoon. Retirement
is the same thing without a destination.

The patch already named every man on the books that afternoon, so it was already
the team sheet; it simply was not being read as one. It now also carries each
man's identity card (`i` — role, hands, bowling type, captaincy, nation,
talents), which is what lets a man who has since left be **put back on the
field** rather than merely missed. The same fields are restored for the men who
are still there, so a role change or a re-typed bowler cannot leak either.

## What it costs

Fifteen small integers and an identity card per man. Measured on a founded
world: **30 kB of living patch against 159 kB of scorecards** for a round of
eight fixtures, and the almanack already drops `living` from every match more
than two rounds old. No migration — the blob is opaque to SQL, which only ever
merges it per club.

`applyLiving` exists twice on purpose, once in `server/living.mjs` and once in
`engine/src/league/38-world-theatre.js`, because the phone replays the same
match the world does. Both were changed together; the client's copy had in fact
never had the baseline reset at all, so the change closes a parity gap as well.

## Compatibility

A patch banked before this carries `s` (the old delta) and no `sk`, `g` or `i`.
Those keep exactly the behaviour they have always had — the baseline path is
still there, unchanged, for them — and roster ownership is gated on `i` being
present, because a record that never described a man cannot rebuild him and
guessing would be worse than the honest gap. Such records are at most two rounds
from being dropped in any case.

## What holds it now

`a-banked-match-is-not-revised.test.mjs` banks a round and then does to the
world every violent thing the world does to a cricketer, demanding the same
cricket after each: **a year and its decline, a club training hard, a transfer,
and a retirement.** It also checks the negative — that today's squads *without*
the patch play a different match — so it cannot pass vacuously.
