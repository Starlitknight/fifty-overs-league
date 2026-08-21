# Competitive Pyramid Realism — tier cliff / club mobility audit

**Branch** `claude/competitive-pyramid-audit`, from `main` at `d7e935f`.
**Audit only. No sporting change was made.** The diff against main over
`server/`, `engine/`, `assets/`, `index.html`, `client/` and `test/` is empty.

---

## The answer in one paragraph

**Yes — the bottom of the pyramid is a hard holding pen.** Across 8 nations and
10 seasons of real cricket, **31 of 32** clubs dealt the bottom four seats never
won promotion, and their best finish was overwhelmingly third in their own
division. The cause is not the economy, the market, or the AI. It is that the
generator's tier bands **do not overlap at all** — P(a random lower-tier club is
stronger than a random upper-tier club) is **0.0% at all five boundaries** — and
the progression systems move a club about **0.2 cards a year** against a gap of
**10 to 12**. A caste that cannot be crossed by playing well is a caste.

---

## 1. How large are the actual tier gaps?

Measured over 128 clubs in 8 nations, best XI (mean of the eleven best cards):

| tier | P10 | median | P90 | step down |
|---|---|---|---|---|
| flagship | 77.0 | **78.2** | 79.0 | |
| d1a | 71.3 | **72.5** | 73.8 | −5.7 |
| d1b | 66.3 | **67.3** | 68.3 | −5.2 |
| d2a | 55.8 | **56.6** | 57.8 | **−10.7** |
| d2b | 44.3 | **45.1** | 46.2 | **−11.5** |
| newcomer | 35.5 | **36.9** | 38.7 | −8.2 |

**The ladder is a staircase with flat treads.** Seats *inside* a tier differ by
noise (±0.5 cards); the entire drop happens at a tier boundary. Slot 11 → 12 is
−12.2 cards in one step; slot 7 → 8 is −10.7.

## 2. How much do adjacent tiers overlap?

**They do not.**

| boundary | P(lower > upper) | best lower vs worst upper |
|---|---|---|
| newcomer / d2b | **0.0%** | 38.9 vs 43.5 |
| d2b / d2a | **0.0%** | 46.8 vs **51.8** |
| d2a / d1b | **0.0%** | 59.3 vs 61.3 |
| d1b / d1a | **0.0%** | 69.0 vs 70.5 |
| d1a / flagship | **0.0%** | 74.0 vs 76.9 |

The strongest club in the bottom tier is **five cards weaker than the weakest
club in the tier above it**, with nothing in between. This is the single most
important number in the audit. Real pyramids overlap — the best second-division
side beats the worst first-division side — and this one cannot, by construction.

## 3. Promotion probability by starting seat

8 nations × 10 seasons, real double round robins, clubs tracked by identity:

| seat | tier | promoted | first up | best finish |
|---|---|---|---|---|
| 8–11 | d2a | **6–8 of 8** | 1.4–3.0 | D1 4th |
| 12 | d2b | 0 of 8 | — | D2 3rd |
| 13 | d2b | **1 of 8** | 9.0 | D1 5th |
| 14 | d2b | 0 of 8 | — | D2 3rd |
| 15 | d2b | 0 of 8 | — | D2 3rd |

**Bottom four seats: 1 of 32 over ten seasons (~3%).** One rung up it is a
near-certainty. The boundary is the d2a/d2b line, not the divisional one.

> **Method note (§4).** Clubs carry an identity from the day they are dealt.
> "Slot 15" after five seasons is whoever is sitting there; the table above
> follows the *club*.

## 4. Can slots 12–15 ever realistically climb?

**No — not on any path the systems currently provide.** They did not merely fail
to finish top two; their best finish in ten seasons was **third**. To be a live
promotion candidate a club needs roughly the −4 gap, which wins 31% of matches
and takes 9 points from a season. At −12 it wins 9.5% and takes 2.7. Promotion
needs about 17.

## 5. How quickly can a competent manager improve a weak squad?

Running the shipped nets, ageing, retirement and free-agent board with an honest
budget (fees at the shipped reserve price, wages tested for sustainability):

| management | seat 15, s0 → s10 | gain/yr |
|---|---|---|
| passive | 43.0 → 44.9 | +0.20 |
| competent | 43.0 → 44.7 | +0.17 |
| elite | 43.0 → **50.9 in season one**, peak 51.2, decays to 48.1 | +0.52 |

**Training and ageing roughly cancel.** The market is the only real lever: an
elite manager gains **eight cards in one season** by buying, then stalls —
86 signings passed on affordability. The rung above is 56.6.

## 6. Can the transfer market bridge the gap?

**Partly, then it stops.** Fees are the club's binding constraint, not supply.
The +8 in season one is real; the plateau at ~51 and the decay afterwards are
also real. It gets a bottom club most of the way to "live underdog" and never to
parity.

## 7. Does player supply reproduce the hierarchy?

**No — supply is not the problem, and this is worth stating clearly because it
would be the intuitive culprit.** Free agents are dealt from the world's own tier
mix (`FA_TIER_MIX`), deliberately, after an earlier version was found draining
both tails into the middle. Of 600 dealt: median 51, P90 80, max 93, and **42.8%
are OVR 56+** — above the entire d2a rung. The players a bottom club would need
exist and appear regularly.

## 8. Are promoted clubs competitive?

**No. 56 of 58** promoted clubs were relegated straight back, median finish
**7th of 8**. The tier gap seen from the other side.

## 9. Are relegated clubs too dominant?

**Yes, symmetrically: 56 of 58** relegated clubs came straight back up. Division
Two's top half is a waiting room for Division One's bottom half.

## 10. Is there a yo-yo problem?

Severe. Of 128 clubs: 58 ever promoted, 58 ever relegated, **56 yo-yo**, 46
repeat promotions, and **68 (53%) never changed division at all**. Two frozen
ends with a revolving door between them.

## 11–12. Attribution

| cause | share | evidence |
|---|---|---|
| **A. initial tier gaps** | **dominant** | 10–12 card steps; 0.0% overlap; −12 wins 9.5% of matches |
| **B. within-tier variance too small** | **major, and the same defect** | tier spread ≈ 2 cards, so a tier is one club repeated |
| **C. progression too weak** | contributory | +0.2/yr closes ~25% of the gap in a decade |
| **D. market supply** | **not a cause** | 42.8% of the board is above the rung above |
| **E. AI roster behaviour** | not a cause | passive/competent/elite all frozen at the bottom |
| **F. promoted-club transition** | a *consequence* | 56/58 bounce straight back |

**Roughly: the tier gap and its missing variance account for the immobility;
progression is too weak to overcome it; the market can move a club two-thirds of
the way and then runs out of money.**

## 13. Is the hierarchy too deterministic?

Yes at the boundaries, no within a tier. A +4 card edge wins **76%** of matches.
Since the within-tier spread is ~2 cards, inside a tier the cricket decides the
table; across a boundary the generator does.

## 14. Can a skilled human take the weakest club to D1 in five seasons?

**No.** The one club that climbed did it in **year nine**. In five seasons an
elite manager reaches best-XI ~51 against a d2a rung of 56.6 — enough to be
competitive in its own division, not enough to finish top two. What prevents it,
precisely: the club starts ~11 cards down; training and ageing cancel; the market
closes ~8 cards in one season and then the wage bill caps further buying.

## 15. What ONE underlying law should change?

**Give the tier bands real overlap.** Not smaller gaps between tier *means* —
the hierarchy should stay — but wider *within-tier variance*, so the
distributions cross.

Today `TIER_XI_BAND` produces a ~2-card spread inside each tier and a 5-card
empty corridor between tiers. That single property produces every symptom above:
the frozen bottom, the automatic promotion one rung up, the 56-of-58 bounce-back,
and the 53% that never move.

The virtue of this as the single lever: it is *already* the coordinate the
generator works in, it does not touch the match engine, player valuation, wages,
the economy or the promotion rules, and it changes the **shape** of the
distribution rather than its centre — so flagships stay flagships.

## 16. Recommended Phase 2 implementation

**Widen the tier bands so adjacent tiers overlap at the tails, holding every tier
mean where it is.**

- Target: **P(random lower-tier club > random upper-tier club) ≈ 10–15%** at each
  boundary. Not 50% — that would flatten the pyramid, which §18 forbids.
- Concretely, that means a within-tier best-XI spread of roughly **±6 cards**
  instead of today's ±1, with tier medians unchanged at 78.2 / 72.5 / 67.3 /
  56.6 / 45.1 / 36.9.
- Then the best d2b club sits near 51 against a d2a median of 56.6 — the −4 to
  −6 band that wins 20–31% of matches, which is a genuine underdog with a path.
- **Success test**: bottom-four promotion over ten seasons rises from 3% to
  roughly 15–25% under competent management, promoted clubs stop being relegated
  56 times in 58, and the flagship stays top.
- **Guard**: re-run this audit's three tools. The overlap must be non-zero, the
  tier *medians* must not move, and a +4 card edge must still win ~76%.

**Do not** combine this with a progression buff or a market subsidy. If overlap
alone gets the bottom-four promotion rate into the target band, the other knobs
stay where they are.

---

## Corrections made during this audit

Recorded because two of them changed conclusions I had already written down.

1. **The "elite manager" arm was cheating.** Its first version signed 36 free
   agents with no fee and no wage test, reaching best-XI 81 — above a flagship.
   §8 forbids free resources. Rebuilt against the shipped `valueOf` reserve price
   and a wage-sustainability test, it plateaus at 51.2 instead.

2. **I over-claimed that management level matters.** At 3 nations the arms were
   0/12, 1/12 and 2/12 — and *passive* beat *competent*. Those are
   indistinguishable, and I asserted a real difference in a commit message before
   checking the sample. The 8-nation re-run is what the report uses.

3. **The engine crashed the first mobility run.** A club whose men retire and
   which cannot afford replacements falls under eleven players; `market.mjs`
   refuses to sell below a floor but nothing stops *retirement* crossing it.
   Short sides now forfeit and engine failures are counted (54 walkovers, 0
   failures at n=8). **Whether the live world can reach the same state is worth
   its own investigation** and is recorded, not fixed here.

4. **The cliff was re-run at 200 matches a cell** after the 120-match sample gave
   0.8% and 5.8% for the two smallest cells — effects too small for that sample.
   At 200: 3.0% and 9.5%.

## Evidence

| file | what |
|---|---|
| `ladder.txt` | §2, §5, §6, §17 — the ladder, the overlap, and real matches at controlled gaps |
| `progress.txt` | §7, §8, §10 — the progression systems with an honest budget |
| `mobility-competent-n8.txt` | §3, §4, §12, §13, §14 — **the headline run**, 8 nations |
| `mobility-competent.txt`, `mobility-elite.txt`, `mobility-passive.txt` | the three management arms at 3 nations |

Tools: `pyramid-ladder.mjs`, `pyramid-progress.mjs`, `pyramid-mobility.mjs`.
