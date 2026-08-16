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
export const OPS_BASE_ROUND = 58000;
export const OPS_PER_SEAT_ROUND = 3.1;
export const OPS_TOPFLIGHT_ROUND = 60000;
export const OPS_ASSOC = 0.88;
export function operationsPerRound(seats, div, natOps) {
  return Math.round((OPS_BASE_ROUND + (seats | 0) * OPS_PER_SEAT_ROUND
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
