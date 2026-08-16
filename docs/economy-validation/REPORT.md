# Economy era 2 — validation phase 2: can clubs LIVE in it?

The first phase (commit 82f9ee8) proved the era-2 economy's **baseline year**:
a sensibly run mid-table club breaks even before selling anybody (median
operating margin +2.4%, wages 49.6% of median revenue on the frozen bench,
`tools/economy-sim.mjs`). This phase asked the questions that only appear at
thirty seasons with the market switched on, and it froze every economy
constant while asking them. **No tuning constant moved.** One structural
failure was found, proved, and repaired — and it was not a constant.

The instrument is `tools/economy-longrun.mjs`: the REAL `computeFinance`
walked over thirty seasons of synthetic fixtures, with the real market
arithmetic (`valueOf`, `surplusRank`, `botBid`), the real engine dealing
squads and free agents, the real nets (`host.trainRound`, the empty plan
every bot files) and the real ageing (`host.ageDecline`), across 8 countries
x 3 seeds = 24 sixteen-club worlds per configuration. Evidence files sit
beside this report.

## 1. The structural failure: wages "at the bill as it stands"

The walk charged every round the club ever played at TODAY'S wage bill. At a
season's horizon that is the documented "revises its own history slightly".
At thirty seasons it is the dominant force in the books:

- a club that buys a player or trains upward is retro-charged its new bill
  across its whole history — after ~90 settled rounds, signing a $30k/round
  man costs his fee plus ~$2.7m of instant retroactive wages;
- a club whose stars decay is minted the same money in reverse.

Measured (pre-fix, `longrun-pre101-smart.txt` vs the true-ledger columns):
walked treasuries ran 35–80% away from a true ledger of the same seasons;
the clubs pinned at the administration floor in the walked books had a
**true-ledger median bank of +$8.5m** — the books were driving genuinely
cash-positive, improving clubs into administration while quietly-decaying
clubs banked paper fortunes. 341 of 384 simulated clubs spent a median of 6
seasons wrongly pinned at some point. Most of the "rich-get-richer" signal
and most "administrations" in the walked books were THIS, not economics.

**The repair (migration 101, the smallest that closes it):** when the umpire
settles a round he banks the bill that round was played under
(`wage_rounds`, one row per club-round, written once), and the walk charges
a banked round its banked bill forever — and the migration itself **freezes
all pre-cutover history at the standing bill**, the figure the old law was
charging at that instant. (The first cut left pre-101 rounds falling back to
the standing bill forever — the original bug preserved for all history that
predated the migration; review caught it.) The cutover rule: a round counts
as charged if it has match rows, because that is the walk's own charging
condition — `computeFinance` reads the matches table with no settlement cut,
so the backfilled set is exactly the set the old law was already pricing.
Three laws hold, each test-proved (`world-wage-cutover.test.mjs`, executing
the migration's backfill statement verbatim):

1. deploy moves no bank by one dollar (banks, wage totals and ledgers
   byte-identical across the cutover);
2. no wage event afterwards — transfer in, transfer out, development
   repricing up, decline repricing down — moves a pre-cutover wage line, the
   historical wage total, or the bank;
3. every post-cutover round banks its real bill at settle (after the fold,
   so nets-derived wages are included), is immutable in its turn, and a tick
   that crashes between the match rows and the banking heals to exactly one
   authoritative bill with no duplicates.

The walk stays a pure derivation: the banked bill is a fact of the record,
like a match card. The standing-bill fallback survives only for a round in
its prebank window (charged as the old law would until its day settles), a
crash-heal in flight, and fabricated test worlds.

## 2. Bot financial intelligence (`server/botfinance.mjs`)

**Before:** bots never read money. A club listed a surplus man on a 22%
coin, bought anybody who improved the side (capped only by "a quarter of
the bank, no overdraft"), and a relegated bot carried its Division One
payroll to the debt floor because nothing told it not to.

**After:** each unmanaged club keeps the sheet a treasurer keeps — bank,
bill, recurring income (the published media grant, its sponsor guarantee,
the gate its own crowds suggest), recurring costs, projected end-of-season
and next-season cash. No future results: the budget prices the NEUTRAL
season. The sheet reduces to a posture — healthy / tight / dangerous /
critical — with ambition scaling by stature (the flagship tolerates the
priced-in -15% squeeze; the bottom of Division Two starts trimming at -6%),
and the posture leans on the market's existing dials only
(`POSTURE_POLICY`): sell-coin 0.22→0.85, reserve 0.80→0.60, buys
any→need-only→none, a wage guard on what a tight club will sign. A healthy
club is byte-identical to the founding market; an era-1 world is untouched.
Eight proof obligations in `server/tests/world-botfinance.test.mjs`.

Macro effect: modest by design (cohort administration touch and cash
concentration a few points better; distressed clubs sell ~30% more often and
stop buying entirely). The dominant long-run forces were the wage law above
and market liquidity — money sense cannot fix either, and was not allowed to
pretend to.

## 3. Relegation (the stress test)

1,392 relegations followed for five seasons each, under the repaired wage
law (`longrun-post101-smart.txt`; `-dumb` is the retain-the-old-behaviour
control):

- **+1 season:** 0% back (by construction), bank median +$1.6m, payroll
  already shed toward D2 rates (~$162k/round);
- **+2:** 54% back in Division One; **within 5 seasons 81% return at least
  once** (dumb control: 82% — the bounce is structural, not AI);
- **administration touched by 2.1% of relegated club-seasons** (dumb
  control: 2.9% — the money sense trims distress by about a third
  relative); under the PRE-101 law the same cohorts read 15–17%, which is
  how much of "relegation ruin" was the wage-law artifact;
- squads hold their quality through the drop (XI ~53k throughout).

**Verdict: painful but recoverable — A, not B.** The D1→D2 income loss
(~$2.2m central) is a real sporting shock; the promoted-class sponsor
re-rating, D2's cheaper cost base and the still-flat media grant carry a
sensibly-run club back. **No parachute payment is needed, so none was
added** (the 25/35/50/65% ladder was specified only "if needed"; adding one
to a league where half the relegated bounce straight back would make
relegation financially comfortable, which the brief forbids).

## 4. The 30-season ecosystem (post-101 law, money-sense bots)

See `longrun-post101-smart.txt` (and `-dumb` for the AI-off control):

- **Wealth:** a founding transient (seasons 3–9: the dealt star-heavy
  squads decay toward the market's stationary mix, league payroll $3.35m →
  ~$2.6m per round-country; the flagship squeeze bites, administrations
  peak at 13 of 384) and then a stable, mildly prosperous middle age:
  treasuries p25 $1.4m / median $3.6m / p75 $8.5m, country totals rising to
  ~$103m by season 17 and then FLAT (~$110–115m to season 30). No collapse,
  no runaway inflation. What accumulation there is exists because bots
  never SPEND capital (no stands, no academies) — a bot-world property.
- **Administration:** effectively eradicated at maturity — 0–2 clubs of 384
  in administration in any late season, 3.2% of late club-rows below zero,
  1.1% below −$1.5m. Failure is rare, real, and recoverable.
- **Transfers:** ~36 sales per country-season, $509m moved per country over
  the run; net flows are small against operating budgets (median club
  −$0.3m a season, financed by operating surplus) — the market
  redistributes without destabilising. Free-agent signings are a real money
  SINK (~$9.5m per country-season leaves the ecosystem), the main brake on
  accumulation.
- **Competitive balance:** rank correlation between cash and XI strength
  0.55 — money helps but does not decide; top-4 share of a country's cash
  60% median (69% p95); D1 membership overlap seasons 5→30 is ~71% — sticky
  but not locked (roughly two of eight seats turn over); the strength
  spread compresses (p95 XI 73k → 66k) rather than concentrating.

## 5. Sponsor lock-in

`world_set_sponsor` was already safe server-side: the target season is
computed inside the RPC from the match record — while the latest season has
no match banked, a pick binds it and may be changed freely (the close-season
window); from the first banked match (and round one is banked before its
broadcast opens, so no result is ever visible while the pen still works)
every pick binds NEXT season. `server/tests/world-sponsor-lock.test.mjs`
drives the RPC as a hostile client and proves the running season's signature
is unreachable, the walk pays each season under the deal signed for it, and
re-picking moves no settled dollar.

## 6. MATCHDAY_NET and the ops line (The Books)

- The umpire now SERVES the net share he banks (`finance.matchdayNet`) and
  the client prefers it to its mirrored `TK.NET`; the mirror remains as a
  fallback and `test/matchday-net-mirror.test.mjs` holds source, built asset
  and server constant equal — a future retune cannot make The Books disagree
  with the treasury.
- "Club operations" stays ONE ledger line; the walk now serves its
  composition (`finance.opsBreakdown`: base + ground-by-the-seat +
  top-flight premium, summing to the charged rate to the dollar — proved in
  the economy suite) and the week's books show one muted sub-line under the
  row: what the money broadly is, then the arithmetic. No new categories, no
  mobile clutter.

## 7. What was NOT changed

Media grants, MATCHDAY_NET, sponsor EV/packages, operations constants, the
wage curve, prize money, academy upkeep, founding capital: all frozen, and
`tools/economy-sim.mjs` reprints the shipped calibration to the same figures
(+2.4% median margin, 49.6% wage share, 33.6/35.2/24.1/6.1 income mix).
`tools/calibration-check.mjs` passes against the golden file.
