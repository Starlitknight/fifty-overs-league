# THE YOUTH ACADEMY — the third great shape

Every club runs one. It is the only place in the world where a cricketer can be
had who was not bought, and it is expensive, slow, and mostly a waste of money.
That is the point: an academy is a bet a manager makes with his own bank against
the transfer market, and most of the bets lose.

This document is the single authority for the build. Where the code and this
file disagree, one of them is wrong on purpose and the tests say which.

Everything here obeys the world's founding constraint: **a manager who is not
online must never be surprised by a rule.** Every number below is a pure
function of things a manager can see before he decides.

---

## 1. The boy

A recruit is aged **16 to 20**. He is a cricketer generated exactly as every
other cricketer in the world is generated — the same fifteen skills, the same
engine deriving his rating and his wage from them. Nothing about him is special
cased.

**There is no potential attribute.** A boy's ceiling is not stored, not hidden,
and not revealed later, because it does not exist. What he becomes is what the
ordinary training curve does to the skills he already has, and the training
curve is the one that is already shipped and already fixed: younger men gain
faster. A sixteen-year-old improves quickly from a low base; a twenty-year-old
improves slowly from a higher one.

**And that curve is slow on purpose.** Measured against the shipped law
(`pts = 24 × ageFactor × potFactor × freshness × academyRate`, against a
threshold that rises with the skill), four seasons of nets move a cricketer by
roughly a tenth of his rating. So the nets **confirm** a signing rather than
transform it: a boy who arrives forty per cent short of your first XI is still
short of it when he turns twenty-one. That is not a limitation being worked
around — it is what makes a dud readable at the moment you sign him, which is
the whole game the academy plays.

So a manager judges a boy the only way there is: **by his starting skills and
his starting rating, against his age.** A 17-year-old at OVR 44 is a serious
prospect. A 20-year-old at OVR 44 is a man who has already had his gains. That
judgement is the whole game of the academy, and it is made in full view.

The quality of what turns up is a lottery weighted by academy level:

| tier | share of recruits | what he becomes |
|------|-------------------|-----------------|
| jewel | under 1% | a first-XI cricketer inside a season |
| good | under 5% | a first-XI cricketer in one to two seasons |
| average | ~45% | useful in three to four seasons |
| poor | ~50% | never useful |

A higher academy level shifts that distribution toward the top. It does not
change the training curve, the wage law, or anything else — it changes only
what walks through the door. The headline rates above are what a **level three**
academy turns out; the ladder is:

| level | jewel | good | average | never useful |
|-------|-------|------|---------|--------------|
| 1 | 0.2% | 2.0% | 38% | 59.8% |
| 2 | 0.5% | 3.5% | 43% | 53.0% |
| 3 | 0.9% | 5.0% | 47% | 47.1% |
| 4 | 1.5% | 7.0% | 51% | 40.5% |
| 5 | 2.5% | 10.0% | 55% | 32.5% |
| 6 | 3.5% | 12.5% | 57% | 27.0% |
| 7 | 4.8% | 15.0% | 58.5% | 21.7% |
| 8 | 6.2% | 17.8% | 59.5% | 16.5% |
| 9 | 7.8% | 20.6% | 60.1% | 11.5% |
| 10 | 9.5% | 23.5% | 60.5% | 6.5% |

**What a tier is worth**, measured against a real generated senior squad whose
median man rates about 41,000:

| tier | at 16 | at 18 | at 20 |
|------|-------|-------|-------|
| jewel | ~99% of the senior median | ~111% | ~122% |
| good | ~86% | ~96% | ~108% |
| average | ~71% | ~80% | ~88% |
| never useful | ~55% | ~62% | ~68% |

Read down a column and the tiers separate; read across a row and age does. A
sixteen-year-old jewel rates about the same as an eighteen-year-old good boy
and **better than a twenty-year-old average one** — which is why the card in
front of you only means something read against his age.

## 2. Scouting

**A button, pressed by a manager.** Nothing is scouted automatically for a club
that has a human in charge.

- **Once every rest day.** A rest day is a day-in-season on which the world
  stages no club cricket at all. There are exactly **eleven** — di
  {2,5,9,12,16,19,23,26,27,30,33} — and `isRestDay()` derives them from the
  calendar rather than listing them, so the cadence cannot drift from the
  season it is counted in.
- **The manager chooses the nation.** All sixteen are open from the first day.
- **A nation tilts what turns up, never how good it is.** South Africa is
  markedly more likely to produce a quick, India a spinner or a wristy batsman,
  England a seamer who bats. The tilt is strong enough to travel for. The odds
  of a jewel are identical in all sixteen. You go abroad for a *type*, never
  for a better shop — so every nation stays worth visiting forever.
- **Home is free; abroad costs a scouting fee**, paid whether or not you sign
  him. Nothing else follows from a boy's nationality: no overseas limit, no bar
  on him playing for the country he now lives in.

The trip produces **one boy**, shown in full — every skill, his rating, his age,
his wage demand. The manager then does one of two things:

- **Sign him.** He joins the academy and goes onto the club's wage bill that
  round, and every round after, until he leaves.
- **Release him.** He is gone. There is no shortlist, no bed, no queue.

## 3. The academy list

A signed boy lives on a **youth list, separate from the senior squad**. He is
not selectable for the first XI, he does not count against the 20-man senior
squad cap, and there is no limit on how many boys a club may hold. The only
thing that stops you signing everybody is the wage bill, which is the intended
brake.

He trains **exactly as a senior does** — same nets, same fixed gain law, same
age scaling. Nothing about being a colt changes how he improves.

### He leaves at 21

At the turning of the year, a boy who has reached 21 and has not been given a
senior contract **leaves the club and the world**. He is not listed, not sold,
not placed elsewhere. He is simply gone, and the wages you paid him were the
price of finding out.

**The manager is warned before he goes.** In practice the academy carries a
standing notice naming every boy who will walk at the next turning of the year —
shown from the day he turns twenty, not for a week at the end. A warning on a
page a manager may not open that week is not a warning at all.

This makes his age at signing part of the bet: a 16-year-old gives you five
seasons of academy, a 20-year-old gives you one.

### The senior contract

A manager may promote a boy **at any time, at any age**, by paying a **flat fee**
— the same number for every boy in the world. From that day he is on the senior
squad (subject to the 20-man cap), selectable, and on a senior wage.

## 4. The levels

Ten (058; it was five until then). Bought outright from the Books with a single
large payment per step, and the steps get steeper. Once bought it is yours
forever; the round-by-round upkeep rises with it, so a club that overbuilds and
is then relegated carries a stone.

**One to five have never moved and never will.** Clubs have stood on them,
banks were settled at them and rounds were worked at them, and the whole world
recomputes from genesis — so re-pricing a rung anybody has already climbed
would rewrite money and cricket that are already in the record.

| level | to build | upkeep, a round | the nets |
|-------|----------|-----------------|----------|
| 1 | — | 6,000 | ×0.92 |
| 2 | 400,000 | 14,000 | ×1.00 |
| 3 | 900,000 | 26,000 | ×1.08 |
| 4 | 1,800,000 | 44,000 | ×1.16 |
| 5 | 3,200,000 | 70,000 | ×1.24 |
| 6 | 3,600,000 | 90,000 | ×1.29 |
| 7 | 4,200,000 | 112,000 | ×1.34 |
| 8 | 4,900,000 | 136,000 | ×1.39 |
| 9 | 5,700,000 | 162,000 | ×1.44 |
| 10 | 6,600,000 | 190,000 | ×1.49 |

("to build" is the price of the step INTO that level, so climbing from two to
ten costs the sum of rows three to ten: 31,000,000.)

**Why the top of the ladder is a project and not a purchase.** A founding club
clears about 138,000 a round — roughly 150,000 of gate and sponsor against a
22,000 wage bill — and a strong one with a full ground about four times that.
So twenty-five million to climb from five to ten is three or four seasons of a
good club's entire surplus. But the fee is the smaller brake. The UPKEEP is the
real one: a level ten academy costs 190,000 a round, which is more than a
founding club takes in a round at all. Overbuild and it is not a slow season,
it is administration.

A club is founded at level two. Note that the books **recompute from genesis**:
buying a level does not only cost the lump, it re-charges every round already
played at the dearer rate. Building late in a season is dearer than building
early, and the statement shows it.

**The other two prices.** A scouting trip abroad costs **45,000**, paid whether
or not you sign him; scouting at home is free. A senior contract costs a flat
**250,000** for any boy, whatever he has become. A club in the red does none of
the three — the same floor that already stops it building a stand.

A level does three things and no more:

1. it shifts the quality lottery of §1 toward the top;
2. it raises the rate of every session in the nets, for the whole senior squad
   and the boys alike — one academy, one building, both jobs;
3. it raises the upkeep the Books take every round.

The rate is banked with the plan in `training_rounds` every round, which is the
only reason a building may touch training at all and a squad still be a pure
function of the record.

## 5. The Colts Cup

The boys' competition, played in its own week, and **picked by the manager** —
with the umpire's autopick as the fallback, so an offline club still fields a
side.

### Qualification

A club must be able to name a squad of **15 to 18 men, every one of them under
21**, counting the academy list and any under-21s on the senior squad. A club
that cannot name fifteen **forfeits its tie**, and the forfeit is public.

Every club in the world is founded with fifteen boys, so the first Colts Cup is
a real competition. Thereafter **the umpire keeps unmanaged clubs topped up to
fifteen** — they are the world's furniture and must keep turning up. **A club
with a human manager is never topped up.** You scout, you sign, you pay, and if
you let the list fall to fourteen you forfeit and everyone sees it.

A named squad is an option, not a duty. If a manager names one it is used; if
he does not, the umpire names the youngest men who qualify, in a fixed order,
so an offline club still walks out. A squad named earlier that has since fallen
below fifteen — a boy sold, promoted, or turned twenty-one — is **topped up**
from the youngest available rather than refused: he named a side, and the world
does not punish him for the calendar.

If neither club in a tie can raise fifteen, the one closer to a side goes
through, and an exact tie falls to the club drawn first. A rule, not a coin, so
every device agrees without asking the server.

### The draw

All sixteen clubs of a nation — both divisions in one hat. **The draw is made
once**, at the last sixteen, and the bracket holds from there: the winners of
ties 2k and 2k+1 meet in the next round, so a manager can see his side's path
to the final on the Monday morning. No byes — sixteen clubs always divide.
Four days:

| day | round |
|-----|-------|
| Colts Week Monday | round of 16 |
| Colts Week Tuesday | quarter-finals |
| Colts Week Thursday | semi-finals |
| Colts Week Friday | **the final**, at the boss's ground |

The ties bank in `cup_matches` under `comp = 'colts:<nation>'`, the same table
and the same laws as the FA Cup and the Champions Cup: results immutable,
stages idempotent, the bracket derived rather than remembered.

### The purse

| finishing | purse |
|-----------|-------|
| winners | £750,000 |
| beaten finalist | £300,000 |
| losing semi-finalists | £120,000 each |

A level-three academy costs £26,000 a round, £364,000 over a season, so a club
that wins its cup has run its academy for nothing that year. That is the point:
it gives a poor club a way of funding itself that isn't selling its best
player.

**The purse is derived, not paid.** The books read the bracket out of
`cup_matches` and credit the money on the day of the final; nothing records
that it has been paid, so recomputing the books pays it once and paying it
twice is impossible.

---

## 6. What this replaces

The old academy — automatic intake, `2 + level` beds, promotion at 21 whether
you liked it or not, and a Colts Cup played entirely by the umpire on league
match days — is retired. `server/youth.mjs` keeps its generator and its record
computation; everything about beds, automatic intake and automatic promotion
goes.

---

## 7. The head coach (051)

A hired man, not a building — the lever From the Pavilion runs its nets on.
Five levels, bought upward only and never let go for a lesser man. What a
level buys is the RATE: every session, every man, every programme is worth
seven per cent more per level, multiplied with the academy's own rate. The
level in force is banked with the plan in force in `training_rounds`, so
history never re-rates when the coach changes.

| To level | Hire cost | Wages a round |
| -------- | --------- | ------------- |
| 1        | $120,000  | $2,000        |
| 2        | $260,000  | $5,000        |
| 3        | $450,000  | $9,000        |
| 4        | $700,000  | $14,000       |
| 5        | $1,000,000| $20,000       |

`server/migrations/051-head-coach.sql` prices the button; `server/economy.mjs`
prices the books; the tests hold the two to the same numbers.

## 8. Match-day nets (051)

The rule Battrick built its training on: on a round where an XI took the
field, the eleven on the banked teamsheet bank the full session and the men
left out train at half pace. On rest days — and for any club that filed no
sheet — the whole squad trains in full. The XI is banked per round in
`training_rounds.xi`; every round banked before 051 carries null and replays
exactly as it always did.
