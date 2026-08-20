// financeconfig.mjs — EVERY TUNABLE THE ECONOMY RUNS ON, IN ONE FILE.
//
// The books (economy.mjs) are a pure derivation: the whole financial history
// of a country is rebuilt from the match record on every settle. That law is
// what makes the money trustworthy, and it is also what makes changing a
// formula dangerous - a constant moved here moves every bank in the world the
// next time the umpire settles. So the constants live in one place, each one
// says what it is calibrated against, and none of them hides inside a
// settlement loop.
//
// THE ERA LINE. Because the books replay from genesis, "changing the economy"
// would ordinarily mean rewriting every settled season and jumping every bank
// to a figure nobody ever held. It does not. A season is settled under the
// rules that were in force when it was played: any season whose start_day is
// before ERA2_DAY settles under the founding economy exactly as it always
// did, to the pound, and any season starting on or after it settles under the
// rules below. History is preserved not by storing it but by keeping the old
// law alive for the seasons it governed - the same way the walk already keeps
// pre-073 ticket arithmetic for pre-073 gates.
//
// WHY THE ECONOMY CHANGED AT ALL. The founding economy paid a club almost
// entirely by the head: two thirds of the gate, a third of everyone else's
// gate, and a broadcaster paying $7.50 a spectator - roughly 87% of a median
// club's income walked through a turnstile. Meanwhile the B2 wage curve
// (wage = 9290 x (OVR/50)^3) made a Division One squad cost 4-6m a season
// against ~3.3m of income, while a Division Two squad cost 1.3m against the
// same income - measured across a founded world, wage/revenue ran from 91%
// at a flagship down to 24% at the bottom, which is a top flight in
// structural administration and a second division printing money. Neither
// number was a decision anybody made. The redesign gives every club a stable
// centre (an equal media distribution and a sponsor's guaranteed cheque),
// makes the wage bill the biggest thing a manager controls, and prices the
// rest so that a sensibly run mid-table club roughly breaks even before it
// ever sells a player.
//
// UNITS AND CADENCE, so nobody has to reverse-engineer them:
//   - every figure is in the game's dollars;
//   - "per season" figures are divided by the season's own league round
//     count (read off the seasons row's schedule - NOT a hardcoded 14) and
//     paid as equal installments on each league round;
//   - matchday money arrives with the home fixture it belongs to;
//   - prize money and sponsor milestone bonuses land when the record shows
//     the milestone: table prizes with the final league round, playoff and
//     title money with the playoff final.
//
// CALIBRATION. tools/economy-sim.mjs drives the real computeFinance over
// thousands of seeded club-seasons and prints the distribution every number
// below was tuned against: median operating margin, wage/revenue share, and
// the income mix. Change a constant here and run it before believing
// anything about what the change did.

// ---------------------------------------------------------------------------
// THE ERA LINE. World day 42: the first day on which no founding nation's
// first season could still be running when this shipped (production was
// founded in the world's first fortnight; day 42 is the earliest any of its
// SECOND seasons can open). A season is era 2 iff its start_day >= ERA2_DAY,
// and a season is all one era - installments and round counts cannot
// straddle a rule change mid-summer.
// ---------------------------------------------------------------------------
export const ERA2_DAY = 42;
export const era2Season = startDay => (startDay | 0) >= ERA2_DAY;

// ---------------------------------------------------------------------------
// FULL MEMBERS AND ASSOCIATES. The generator deals an associate's clubs one
// tier weaker than a full member's, so an associate's wage bills run at about
// two thirds of a member's (measured 0.67 across a founded world). Income
// has to follow the bills or every associate club runs a structural surplus
// and every member a deficit for no reason either could act on. This is the
// same two-band law init-world.mjs states for seeding; it is restated here
// because init-world imports economy and the config cannot import it back.
// world-economy tests hold the two lists identical.
// ---------------------------------------------------------------------------
export const FULL_MEMBERS = ['eng', 'aus', 'sub', 'pak', 'rsa', 'nzl', 'slk', 'bgd', 'win', 'zim'];
const FULL = new Set(FULL_MEMBERS);
export const isFullMember = id => FULL.has(id);
// what an associate's central money runs at, against a member's. Wages run at
// 0.67; the pools run a shade above it because associate crowds (which do not
// scale down - a following is a following) already lag their members' less
// than the wages do, and the sim showed 0.67 flat left associate D1 too rich.
export const ASSOC_POOL = 0.70;

// ---------------------------------------------------------------------------
// 1. CENTRAL MEDIA DISTRIBUTION - the league's broadcast money, paid to every
// club in the division equally, by the round, and never counted by the head.
// The old broadcaster paid $7.50 a spectator, which tied the most stable
// income in football to the least stable number in the game and paid a
// popular club twice for being popular (once at the gate, again on TV).
// The grant is per club per season; a round's installment is grant / rounds.
// Division One's deal is bigger than Division Two's, as every real pyramid's
// is - and that gap, with the sponsor and prize gaps below, is most of what
// relegation costs.
// ---------------------------------------------------------------------------
export const MEDIA_SEASON = { 1: 2750000, 2: 1650000 };

// ---------------------------------------------------------------------------
// 1b. HOW A SEASON'S CENTRAL MONEY REACHES A ROUND - one function, because
// there are two of these grants (the media distribution and the sponsor's
// guarantee) and they must arrive on the same terms or a club's year does not
// add up.
//
// A LEAGUE ROUND takes its share by CUMULATIVE rounding: installment r is
// round(G*r/R) - round(G*(r-1)/R), so a season of any length banks its grant to
// the exact dollar and never a rounding penny more.
//
// A PLAYOFF ROUND IS A ROUND, AND UNTIL NOW IT WAS NOT PAID FOR. The settle
// charges wages, club operations and the academy for every round a club PLAYS,
// and paid the central money only for rounds 1..R. Rounds R+1 and R+2 are the
// semi-final and the final, so a club that reached them paid two more weeks of
// its entire cost base out of a season's income that had stopped. Measured on
// the audit's model, a strong Division One side: each playoff round billed
// $577,500 and banked nothing central, against a champions' cheque of
// $300,000 - so WINNING THE TITLE LEFT A CLUB $855,000 POORER than topping the
// table and going home. It is visible in the settled world too: Surrey banked
// operations for all 23 of its rounds while its media came to exactly
// 2,750,000 + 7/14 x 2,750,000.
//
// So a round played is a round funded, at the ordinary round rate. This is not
// a playoff jackpot and no prize, bonus or gate multiplier moves: the club gets
// one further ordinary installment for one further ordinary week of being a
// club, which is the same principle the fourteen league rounds already run on.
// The season POOL therefore grows only for clubs that earn extra rounds, which
// is exactly the thing a broadcaster pays extra to televise.
export function centralInstallment(seasonTotal, round, leagueRounds) {
  const G = Math.round(seasonTotal || 0), R = Math.max(1, leagueRounds | 0);
  if (round < 1) return 0;
  if (round <= R) return Math.round(G * round / R) - Math.round(G * (round - 1) / R);
  return Math.round(G / R);
}

// ---------------------------------------------------------------------------
// 2. MATCHDAY. The home club keeps the gate its own pricing earned - the
// two-thirds/one-third away split is retired for era 2. The split moved a
// third of every club's biggest income line onto fixtures it had no lever
// over, and with a balanced double round robin it netted out to nearly
// nothing anyway; what it mostly did was blur whose decision the gate was.
// The ticket mechanic (073/074: the club prices its own gate, elasticity,
// the affordability cliff, advance sale) is untouched - and what the books
// bank is the NET of that sale: every gate dollar carries its matchday
// costs (stewards, turnstiles, the catering's cost of sales), so the club
// nets a documented share of the gross the board shows. The share is a
// constant, so the price lever works exactly as before - a dearer ticket
// nets proportionally more - and the bench measured why it exists: at gross,
// matchday was 41% of a median club's income against a 30-35% brief, and
// the whole economy ran a +12% median margin. One knob brought matchday,
// the wage share and the margin onto their targets together.
// ---------------------------------------------------------------------------
export const MATCHDAY_NET = 0.72;

// ---------------------------------------------------------------------------
// 3. THE SPONSOR - a contract with a shape, chosen by the club.
//
// The sponsor's headline season value is set by the division the club plays
// in and where it finished last summer - mildly: 0.78x for finishing bottom
// of the division to 1.22x for topping it, so standing is worth money
// without compounding into a dynasty.
//
// The SHAPE is the manager's call, once a close season (sponsor_picks; bots
// and the undecided sign BALANCED):
//
//   SAFE       ~90% guaranteed, ~10% on results. The win bonus is priced at
//              a modest side's par, so a club that expects a hard summer
//              banks nearly the same money either way.
//   BALANCED   ~70% guaranteed, ~30% on results, priced at a mid-table par.
//   CONTENDER  ~45% guaranteed, ~55% on results - a per-win rate priced at a
//              strong side's par, plus real money for making the playoffs
//              and for the title. Signed by a mid-table club it is simply a
//              worse deal; signed by a genuine contender it pays the same
//              expected money as SAFE pays a survivor, with the variance to
//              match.
//
// The guaranteed component pays by the round like the media money. A win
// bonus pays in the round the win was recorded; the playoff bonus when the
// table seals a top-four finish; the title bonus when the playoff final is
// won. Every trigger is a fact in the match record, which is what makes the
// whole contract re-derivable.
//
// The expected values were simulated (tools/economy-sim.mjs prints the
// package EV table): for the kind of side each package is written for the
// three land within a few percent of each other, and no package dominates.
// ---------------------------------------------------------------------------
export const SPONSOR_SEASON = { 1: 1900000, 2: 1150000 };
export const SPONSOR_POS_FLOOR = 0.78;      // finishing bottom of the division
export const SPONSOR_POS_SPAN = 0.44;      // ...to +44% of that for topping it
export const SPONSOR_PACKAGES = {
  safe:      { guaranteed: 0.90, winShare: 0.10, winsPar: 7.0, playoffShare: 0,    titleShare: 0 },
  balanced:  { guaranteed: 0.70, winShare: 0.30, winsPar: 7.0, playoffShare: 0,    titleShare: 0 },
  contender: { guaranteed: 0.45, winShare: 0.40, winsPar: 7.0, playoffShare: 0.12, titleShare: 0.22 }
};
export const SPONSOR_DEFAULT = 'balanced';
// A FLAGSHIP'S SHIRT IS WORTH MORE THAN ITS LEAGUE POSITION SAYS. Without
// this the biggest payroll in every nation ran a structurally deeper deficit
// than any squad below it - the bench measured the flagship class at -22%
// median margin while d1a sat at -9% - because its crowd is capped by its
// ground while its wage bill is not capped by anything. Stature moves the
// sponsor a little (1.005x at the floor to 1.10x for a flagship); the wage
// squeeze on a star-heavy squad stays real, it just stops being a death
// sentence handed out by the seating chart.
export const SPONSOR_STAT_BASE = 0.85, SPONSOR_STAT_SPAN = 0.25;
// the season value a club signs for: division tier x last summer's standing
// x the club's own stature x its nation's band
export function sponsorSeasonValue(div, posInDiv, clubsInDiv, natFactor, stat) {
  const base = SPONSOR_SEASON[div] || SPONSOR_SEASON[2];
  const posF = clubsInDiv > 1 ? (clubsInDiv - posInDiv) / (clubsInDiv - 1) : 0.5;
  const statF = SPONSOR_STAT_BASE + SPONSOR_STAT_SPAN * (stat == null ? 0.62 : stat);
  return Math.round(base * (SPONSOR_POS_FLOOR + SPONSOR_POS_SPAN * posF) * statF * natFactor);
}
// what one win pays under a package signed for value S
export function sponsorWinBonus(S, pkg) {
  const p = SPONSOR_PACKAGES[pkg] || SPONSOR_PACKAGES[SPONSOR_DEFAULT];
  return Math.round(S * p.winShare / p.winsPar);
}

// ---------------------------------------------------------------------------
// 5. CLUB OPERATIONS - the one recurring cost of BEING a club: coaches and
// physios, ground staff, administration, travel, kit and the electric bill.
// One ledger line, charged every round the club plays, composed of a base
// every club pays, a per-seat term (a bigger ground costs more to run, which
// is what keeps a stand from being a free multiplier), and a top-flight
// premium (Division One operates to a dearer standard and travels heavier).
// It is only MILDLY scaled by the nation (an associate's staff market is
// cheaper, but a groundsman is not two-thirds of a groundsman): a flat cost
// is most of what stops an associate's identical crowds (followings do not
// know about membership) turning its cheaper wages into a structural
// surplus, and the mild discount is what stopped the same flat cost sinking
// an associate's second division at -7% a season - both halves measured on
// the bench.
// ---------------------------------------------------------------------------
// THE BASE WAS CARRYING WORK IT COULD NOT DO, AND NINE CLUBS PAID FOR IT.
//
// This line was written as a fixed base plus a per-seat term, which reads as
// though a giant and a minnow were charged differently for being different
// sizes. They were not. The per-seat term reads CAPACITY, and capacity is
// dealt almost flat on purpose - foundingSeats was deliberately never
// steepened with standing (economy.mjs, and steepening it broke stadium
// building) - so every seat from 7 down is dealt exactly 24,000 seats and
// charged exactly $132,400 a round. For nine of the sixteen clubs in a nation
// the "variable" half was a second flat charge, and not one dollar of their
// operations responded to anything about the club.
//
// MEASURED over all sixteen nations with the generator's own squads
// (tools/ops-burden.mjs): a club earning 3.28x what another earns, and paying
// 4.63x the wages, was charged 1.11x to operate. The bottom club spent 63% of
// its revenue on operations and 111% on operations and wages together, and
// there was no way to manage it into solvency - even a frugal minnow lost
// $189,809 a year.
//
// The base is not really the culprit and lowering it alone would not have
// helped: the COORDINATE was. tools/ops-sweep.mjs ran that as a control -
// lower the base, steepen the existing per-seat term, hold the median - and
// it moved the under-water count not at all, 10/16 before and 10/16 after,
// because a term nine clubs pay identically moves all nine together.
//
// So operations now scales on the FOLLOWING, which is the one existing
// quantity that means "how large an organisation is this": it is not revenue
// and not payroll, so it cannot be bought by spending; it spans 5.14x across
// the same ladder the old coordinate spanned 1.21x; and it already moves with
// success, so a club that grows gradually costs more to run. It is also a
// stabiliser rather than a spiral - a club that falls loses following and its
// operations fall with it, which is negative feedback on exactly the tail
// this was about.
//
// THE BASE IS WHAT IS LEFT WHEN THE OTHER TWO TERMS DO THEIR OWN WORK: the
// travelling party and the fixtures a club has to fulfil, whatever its size.
// It is small because the staff and the match-day operation moved to the term
// that actually describes them. The per-seat term is UNCHANGED at $3.10 -
// halving it would have paid for the supporter term just as well and is
// identical for every club on 24,000 seats, but it would have quietly halved
// what a stand costs to run, and stadium economics were not this phase's to
// move.
//
// Fitted in tools/ops-sweep.mjs against an anchor that binds: the base is
// SOLVED, not swept, so that the median club's operations are held at what
// they are today and a candidate cannot pass by being an across-the-board
// cost cut. Chosen on behaviour (docs/operations-scale-realism/): the bottom
// of Division Two becomes survivable rather than doomed (seat 15, -$212,844 a
// year -> +$160,524; a frugal minnow -$189,809 -> +$179,598) without becoming
// rich; the flagship stays much the richest club in its world at 2.8x the
// median treasury but stops compounding absurdly (three clubs above $20m over
// ten seasons -> none); administration falls from 87 clubs in 256 to 73; and
// the division premium Phase 2 fitted is untouched, so promotion is still
// worth $1.90m on the same club at the same finish, to within a tenth of a
// percent.
export const OPS_BASE_ROUND = 11700;
export const OPS_PER_SEAT_ROUND = 3.1;
// what the organisation a following requires costs to run, per supporter per
// round: the staff, the match-day operation, the commercial department
export const OPS_PER_SUPPORTER_ROUND = 2.0;
// THE TOP-FLIGHT PREMIUM, RE-FITTED - AND IT IS A MAGNITUDE, NOT A PRINCIPLE.
// Division One still costs more to run than Division Two, and should: dearer
// staff, heavier travel, a higher standard of match operations. What was wrong
// was the size of it, and the size was never fitted against the income the
// division actually guarantees.
//
// MEASURE IT AGAINST WHAT THE DIVISION GUARANTEES, which is the comparison
// nobody had made. Promotion brings a club $1,100,000 of extra media and
// $520,704 of extra sponsor guarantee - $1,620,704 that arrives whatever the
// crowd does and wherever the club finishes. At $60,000 a round the division
// took $840,000 of that back in operations before a ball was bowled: a
// guaranteed premium of only 1.93x its guaranteed cost, while the squads the
// top flight is DEALT cost 2.5x to 4.6x a second-division squad. The
// commercial premium covered the wage premium almost exactly and the
// operations premium was the whole of what was left over - which is why seven
// of eight top-flight seats drained and four of sixteen clubs reached
// administration inside five seasons.
//
// $30,000 puts the guaranteed premium at 3.86x its guaranteed cost, inside the
// 2.5-4.6x band the payroll ladder spans. Swept 0 to 60,000 in
// tools/economy-arms.mjs --sweep and fitted on BEHAVIOUR rather than on parity
// (docs/economy-realism-phase2/): Division One stops draining on aggregate
// (mean -$919k -> -$41k a season) without printing; administration falls from
// four seats in sixteen to two, and both survivors are the two weakest seats,
// which is what a minnow is for; a normal club is sustainable (+$275k at a
// mid-table finish, -$43k on its own seat's payroll against a $1.95m bank);
// an aggressive contender still burns $1.59m a season; promotion is worth
// MORE (+$1.53m -> +$1.96m) and relegation hurts MORE (-$176k -> -$596k);
// and Division Two does not move by one dollar, which is the control.
//
// It is deliberately not the value that equalises the two divisions. Parity is
// not the target - a top flight that costs nothing extra to run is not a top
// flight, and the seats that still lose money here lose it for finishing low
// with an expensive dealt squad, which is the stale econStature floor's
// business and not this line's.
export const OPS_TOPFLIGHT_ROUND = 30000;
export const OPS_ASSOC = 0.88;
// `support` is the club's following as it stood when the round began. The
// walk updates c.sup at the END of its round loop, after every bill is taken,
// which is the reading this wants: a club is not billed this week for
// supporters this week's result won it.
export function operationsPerRound(seats, div, natOps, support) {
  return Math.round((OPS_BASE_ROUND + (seats | 0) * OPS_PER_SEAT_ROUND
    + (support | 0) * OPS_PER_SUPPORTER_ROUND
    + (div === 1 ? OPS_TOPFLIGHT_ROUND : 0)) * (natOps == null ? 1 : natOps));
}

// ---------------------------------------------------------------------------
// 7. PRIZE MONEY - paid on the final league table, by division, with a
// separate cheque for winning the playoff final. Deliberately the smallest
// pool in the game: the champion's whole prize year is worth about a seventh
// of its revenue, so winning is worth real money and buys nobody a dynasty.
// Both arrays run top to bottom of an eight-club division.
// ---------------------------------------------------------------------------
export const PRIZE_TABLE = {
  1: [850000, 700000, 600000, 520000, 450000, 400000, 360000, 320000],
  2: [470000, 385000, 330000, 285000, 250000, 220000, 200000, 175000]
};
export const PRIZE_PLAYOFF_CHAMP = { 1: 300000, 2: 165000 };
export function prizeFor(div, posInDiv, natFactor) {
  const t = PRIZE_TABLE[div] || PRIZE_TABLE[2];
  return Math.round((t[Math.max(0, Math.min(t.length - 1, posInDiv - 1))] || 0) * natFactor);
}

// ---------------------------------------------------------------------------
// 11. FOUNDING CAPITAL, ERA 2. A club founded under the new economy starts
// with working capital - roughly a third of a season's turnover, enough to
// ride out a bad run or make one real move, not several seasons of free
// money (the founding-era banks were over half a season's OLD turnover, and
// the old turnover was smaller). Clubs founded in era 1 keep the banks they
// were founded with: a founding line is history, and history is not revised.
// ---------------------------------------------------------------------------
export const FOUNDING_BANK_ERA2 = 1750000;
export function foundingBankEra2(econStat) {
  return Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * econStat) / 1000) * 1000;
}
