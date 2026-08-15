# Does a 95 mean the same thing whoever he is?

The question came out of `top-end-proof.txt`, which reports each man's own
figures. At OVR 95 it shows:

```
  strikeQuick          14.89 avg    2.88 econ    31.0 SR    1.93 w/inn
  mystery              26.26 avg    2.79 econ    56.5 SR    1.06 w/inn
```

A bowling average 76% worse at the same card, which reads like the mystery
spinner is being robbed.

**He is not. Measured properly he is worth slightly MORE than the strike quick.**

## Why that table cannot answer it

A bowler's average is `economy x strike rate / 6`. It is a statement about the
overs he bowled and nothing else, and it cannot distinguish

* a legitimate trade-off — worse average, better economy, the containing bowler
  a side needs at the other end — from
* a straight loss — worse average, same economy, a man who is simply weaker.

Worse, it is not the right *unit*. Every front-line bowler bowls the same ten
overs. What a side gets from him is the runs he prevents AND the wickets he
takes, and in fifty-over cricket those substitute for one another: the wickets a
containing bowler does not take are largely taken at the other end. None of that
is in his average.

And it is measured on ONE pitch, which for a spinner is the whole argument.

## What was measured instead

`tools/archetype-value.mjs`. One man is swapped into the opening-bowler slot of
an otherwise fixed XI — the same fixed world `attribute-value.mjs` and
`top-end-proof.mjs` use — and 900 matches are played against a fixed opposition
on fixed seeds. **NET is his side's run differential per fifty overs**: the
currency the value weights were fitted in, and the only one in which a strike
quick and a finger spinner can be compared at all. His personal figures are
reported beside it to show the style.

Full output: `archetype-value.txt`.

## The first cut, and the trap in it

```
  AT OVR 95, BALANCED PITCH
  archetype            NET      avg    econ      SR   w/inn
  strike quick       30.11    15.69    2.90    32.5    1.84
  workhorse          29.25    19.20    2.57    44.7    1.34
  controller         27.76    18.39    2.86    38.6    1.55
  wild quick         26.96    20.13    2.81    42.9    1.40
  swing/seam         26.60    16.85    2.89    35.0    1.71
  wrist/mystery      25.63    25.45    2.76    55.3    1.08
  big-turning spin   22.98    25.66    2.72    56.6    1.06
  finger spinner     21.28    39.78    2.98    80.2    0.75
```

Already the flagged gap is nothing like what the average implied: 62% worse
average, 15% less worth, and the BETTER economy of the two. But three spinners
sit at the bottom and the finger spinner is 8.8 runs adrift on both axes at
once, which is not a trade-off and did look like a defect.

It was the pitch. Every row above is a `balanced` pitch, and spin's value is
pitch-dependent by design.

## The same men on a dry pitch

```
  AT OVR 95, DRY PITCH
  archetype            NET      avg    econ      SR   w/inn
  wrist/mystery      34.66    13.36    2.45    32.8    1.82
  big-turning spin   32.70    12.57    2.37    31.9    1.88
  workhorse          31.15    19.57    2.53    46.4    1.29
  finger spinner     29.66    19.86    2.65    44.9    1.33
  strike quick       28.60    16.29    2.93    33.4    1.79
  controller         27.24    18.98    2.81    40.5    1.48
  wild quick         27.17    20.42    2.78    44.1    1.36
  swing/seam         26.11    17.47    2.87    36.5    1.64
```

The seamers barely move — strike quick 30.11 to 28.60. The spinners move
enormously: the mystery spinner goes from 25.63 to 34.66 and from a 25.45
average to 13.36. The table inverts.

## Taken together

```
  archetype                 balanced     dry    mean
  workhorse                    29.25   31.15   30.20
  wrist/mystery spinner        25.63   34.66   30.14
  strike quick                 30.11   28.60   29.36
  big-turning spinner          22.98   32.70   27.84
  controller (seam)            27.76   27.24   27.50
  wild quick                   26.96   27.17   27.07
  swing/seam specialist        26.60   26.11   26.36
  finger spinner               21.28   29.66   25.47

  spread across the two pitches: 4.73 runs (balanced alone: 8.83)
```

Eight archetypes at the same card, inside a five-run band, and the mystery
spinner the flagged observation was worried about finishes SECOND — above the
strike quick. Averaging two pitch types is crude and is not the world's real
mix, but it is enough to show which way the omission cut: measuring spin on a
balanced pitch and calling the result unfairness is measuring the pitch.

**Equal OVR buys approximately equal total role value, and the styles are
genuinely different.** That is exactly the requirement. Nothing is changed.

## What is still true, and worth keeping in view

A cricketer's worth in this engine is CONDITIONAL, and much more so for a
spinner than for a quick. A mystery spinner is a 25-run bowler on a green top
and a 35-run bowler on a dust bowl; a strike quick is a 29-run bowler wherever
he plays. One number on a card cannot say that, and should not try to — the card
is a claim about a cricketer, not about a fixture.

Two consequences a later session may want:

1. **The card is a fair average over conditions, not a promise about Tuesday.**
   If the world's pitch mix ever skews hard one way, the elite tail's real value
   skews with it, and this measurement should be re-run against the mix
   `condFor` actually deals rather than two hand-picked pitches.
2. **`FO_VAL_W` weights skills, not types.** Two men with identical skills and
   different `bowlTypeFull` get the same OVR by construction, so if a type ever
   IS shown to be mispriced across the real pitch mix, the skill weights are the
   wrong lever — it would need a type term in `foOvr`, which does not exist
   today. The ball model is frozen B1 and is not the place to equalise
   archetypes.

## Reproducing

```bash
node tools/archetype-value.mjs --n=900 --ovrs=75,85,95
node tools/archetype-value.mjs --n=900 --ovrs=95 --pitch=dry
```

It changes nothing: every number is read out of the built `index.html` in a VM.
