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
what walks through the door.

## 2. Scouting

**A button, pressed by a manager.** Nothing is scouted automatically for a club
that has a human in charge.

- **Once every rest day.** A rest day is a day-in-season on which the club has
  no fixture of any kind. The season has roughly a dozen.
- **The manager chooses the nation.** All nineteen are open from the first day.
- **A nation tilts what turns up, never how good it is.** South Africa is
  markedly more likely to produce a quick, India a spinner or a wristy batsman,
  England a seamer who bats. The tilt is strong enough to travel for. The odds
  of a jewel are identical in all nineteen. You go abroad for a *type*, never
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

**A week before he goes, the manager is told.** The warning fires on the seventh
day before the turning of the year, naming every boy who will walk.

This makes his age at signing part of the bet: a 16-year-old gives you five
seasons of academy, a 20-year-old gives you one.

### The senior contract

A manager may promote a boy **at any time, at any age**, by paying a **flat fee**
— the same number for every boy in the world. From that day he is on the senior
squad (subject to the 20-man cap), selectable, and on a senior wage.

## 4. The levels

Five. Bought outright from the Books with a single large payment per step, and
the steps get steeper. Once bought it is yours forever; the round-by-round
upkeep rises with it, so a club that overbuilds and is then relegated carries a
stone.

A level does two things and no more:

1. it shifts the quality lottery of §1 toward the top;
2. it raises the upkeep the Books take every round.

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

### The draw

All sixteen clubs of a nation — both divisions in one hat. A fixed bracket, no
byes, no seeding beyond last season's finishing order. Four days:

| day | round |
|-----|-------|
| Colts Week Monday | round of 16 |
| Colts Week Tuesday | quarter-finals |
| Colts Week Thursday | semi-finals |
| Colts Week Friday | **the final** |

### The purse

Substantial. Winners take a sum on the order of a season's academy upkeep, the
beaten finalist rather less, and the losing semi-finalists a token. A well-run
academy roughly pays for itself in a good year, and a club that wins twice can
afford the next level — which gives a poor club a way of funding itself that
isn't selling its best players.

---

## 6. What this replaces

The old academy — automatic intake, `2 + level` beds, promotion at 21 whether
you liked it or not, and a Colts Cup played entirely by the umpire on league
match days — is retired. `server/youth.mjs` keeps its generator and its record
computation; everything about beds, automatic intake and automatic promotion
goes.
