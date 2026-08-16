// botfinance.mjs — WHAT A BOT CLUB KNOWS ABOUT ITS OWN MONEY.
//
// The era-2 economy made the wage bill the biggest thing a manager controls,
// and the flagship class runs a deliberate squeeze (about -15% operating
// margin) that a HUMAN answers by selling somebody, trimming wages or riding
// a big bank. The bots had no answer at all: market.mjs listed a surplus man
// on a 22% coin-flip and bought anybody who improved the side, and not one
// line of it ever read the bank against the bill. The economy was strategic
// and the AI clubs were financially irrational - a relegated bot carried its
// Division One payroll to the debt floor because nothing told it not to.
//
// This file is the MINIMUM correction, deliberately. It is not a squad
// planner and it does not rebuild the bot AI: it computes the projection a
// competent treasurer would keep on one sheet of paper, reduces it to a
// POSTURE, and market.mjs lets that posture lean on the decisions it was
// already making (how often to shed a man, what reserve to accept, whether
// to bid at all, how much wage to take on).
//
// WHAT A BOT IS ALLOWED TO KNOW - only what a manager reading his own club
// could know:
//
//   the bank            its own settled figure
//   the wage bill       its own squad, summed - paid every round played
//   recurring income    the division's media grant and the sponsor guarantee
//                       (both published law in financeconfig.mjs), plus the
//                       gate its own recent attendance suggests
//   recurring costs     wages, club operations, academy upkeep - all of them
//                       knowable a season in advance by construction
//
// It knows NOTHING about future results: the projection budgets the NEUTRAL
// season - the gate its recent crowds suggest, half the sponsor's win pot,
// the middle of the prize table - which is how a board actually plans, and
// never a match more. Everything here is a pure function of the club's own
// state, so the market stays deterministic and a re-settled day reads the
// same posture.
//
// AMBITION IS RISK TOLERANCE. A title contender rationally runs a temporary
// deficit - the squeeze on a flagship is priced into the economy and its
// bank is founded to carry it. A bottom club maintaining a champion's
// payroll while losing money is not ambition, it is a slow administration.
// So the deficit a club will tolerate scales with its economic stature: the
// flagship shrugs at a season 18% under water, the bottom of Division Two
// starts trimming at 6%. Nobody here is OPTIMAL - the posture bands are
// coarse and the estimates rounded - which is deliberate: bots should react
// to money the way a sensible board does, not price the market perfectly.
import {
  MEDIA_SEASON, SPONSOR_PACKAGES, SPONSOR_DEFAULT, sponsorSeasonValue,
  operationsPerRound, isFullMember, ASSOC_POOL, OPS_ASSOC, MATCHDAY_NET, prizeFor
} from './financeconfig.mjs';
import { academyUpkeep, econStature, foundingSupport, DEBT_LIMIT, TICKET, DIV2_CROWD } from './economy.mjs';
import { ROUNDS } from './clock.mjs';

// the four words the market understands, in order of trouble
export const POSTURES = ['healthy', 'tight', 'dangerous', 'critical'];

// ---------------------------------------------------------------------------
// THE SHEET OF PAPER. Per-round recurring income and expense, the projected
// end-of-season bank, and roughly where next season lands if nothing changes.
// All of it from the club's own row and the published config - no results.
// ---------------------------------------------------------------------------
export function botFinanceView(c) {
  const R = c.roundsTotal || ROUNDS;
  // roundsLeft null means "between seasons": the projection looks across the
  // whole season ahead, which is exactly the close-season question
  const left = c.roundsLeft == null ? R : Math.max(0, Math.min(R, c.roundsLeft));
  const natF = isFullMember(c.country) ? 1 : ASSOC_POOL;
  const natOps = isFullMember(c.country) ? 1 : OPS_ASSOC;
  const div = c.div === 2 ? 2 : 1;
  // the stable centre: the division grant, by the round
  const media = Math.round((MEDIA_SEASON[div] || MEDIA_SEASON[2]) * natF) / R;
  // the sponsor's guarantee. A bot cannot be assumed to remember where it
  // finished, so it budgets the deal a MID-TABLE club of its stature signs -
  // conservative for a champion, mildly generous for the bottom club, and
  // within a few percent of the truth for everybody (the position factor
  // spans 0.78-1.22 and mid-table is ~1.0).
  const stat = econStature(c.slot, c.isBoss);
  const spV = sponsorSeasonValue(div, 4, 8, natF, stat);
  const shape = SPONSOR_PACKAGES[c.sponsorPackage] || SPONSOR_PACKAGES[SPONSOR_DEFAULT];
  // KNOWING NO RESULTS IS NOT PRICING RESULTS AT ZERO. A board budgets the
  // neutral season: half the deal's win pot (par wins would pay the whole
  // pot, and par is what the pot is priced against) and the middle of the
  // prize table. Without this the sheet read a flagship at -27% when the
  // economy's own bench measures the squeeze at -15%, and every flagship in
  // the world read one band more frightened than its actual books.
  const sponsor = Math.round(spV * (shape.guaranteed + 0.5 * (shape.winShare || 0))) / R;
  const prize = prizeFor(div, 5, natF) / R;
  // the gate: the crowd the club has actually been drawing, at the standing
  // ticket, banked net - and only every OTHER round is at home. A club with
  // no gates on its books yet (a fresh world, an unplayed season) budgets
  // off its following at an ordinary Sunday's walk-up (~70%, thinner in the
  // second division), capped by the ground - and a following it has never
  // counted is the one its standing was founded with.
  const sup = c.supporters > 0 ? c.supporters : foundingSupport(c.slot, c.isBoss);
  const att = c.avgAttendance > 0 ? c.avgAttendance
    : Math.min(c.seats || 15000, Math.round(sup * 0.7 * (div === 2 ? DIV2_CROWD : 1)));
  const gate = att * (c.ticket || TICKET) * MATCHDAY_NET * 0.5;
  const income = media + sponsor + prize + gate;
  // the costs, at their stated rates
  const ops = operationsPerRound(c.seats || 15000, div, natOps);
  const upkeep = academyUpkeep(c.academy || 2);
  const expense = (c.wageBill || 0) + ops + upkeep;
  const perRoundOp = income - expense;
  const seasonRevenue = income * R;
  return {
    perRoundIncome: Math.round(income),
    perRoundExpense: Math.round(expense),
    perRoundOp: Math.round(perRoundOp),
    // where the season leaves the bank if nothing changes
    projectedEndBank: Math.round((c.bank || 0) + left * perRoundOp),
    // and roughly where ANOTHER season of the same shape leaves it - the
    // "approximate next-season position" a board actually argues about
    projectedNextBank: Math.round((c.bank || 0) + (left + R) * perRoundOp),
    seasonOp: Math.round(R * perRoundOp),
    margin: seasonRevenue > 0 ? (R * perRoundOp) / seasonRevenue : 0,
    wageShare: seasonRevenue > 0 ? ((c.wageBill || 0) * R) / seasonRevenue : 9
  };
}

// ---------------------------------------------------------------------------
// AMBITION: the operating deficit a board will knowingly carry, as a share
// of revenue. econStature runs 1.0 at the flagship down to a 0.62 floor, so
// this maps the same ladder onto risk: the flagship tolerates the priced-in
// squeeze (-18%), mid Division One about half of it, and the second
// division very little - a small club has no bank to burn.
// ---------------------------------------------------------------------------
export function ambitionOf(slot, isBoss) {
  const s = econStature(slot, isBoss);
  return -(0.02 + 0.16 * Math.max(0, (s - 0.62) / 0.38));
}

// ---------------------------------------------------------------------------
// THE POSTURE. Four bands, judged on two things a treasurer actually fears:
// where the cash RUNS OUT (against the administration floor, which is the
// one hard line in the game) and whether the deficit is beyond what the
// club's ambition excuses.
//
//   healthy    projection acceptable - behave as the market always did
//   tight      a real deficit beyond tolerance, or next season goes under -
//              buy only real needs, cheaply, and shed a little sooner
//   dangerous  this season ends below zero, or next season is headed for
//              the floor - stop buying, sell the surplus properly
//   critical   the floor is in sight (or already reached) - shed payroll
//              while SQUAD_FLOOR still guarantees a viable side
// ---------------------------------------------------------------------------
export function postureOf(view, ambition) {
  const floor = -DEBT_LIMIT;
  if (view.projectedEndBank <= floor * 0.5) return 'critical';
  if (view.projectedEndBank < 0 || view.projectedNextBank <= floor * 0.5) return 'dangerous';
  if (view.margin < (ambition == null ? -0.05 : ambition) || view.projectedNextBank < 0) return 'tight';
  return 'healthy';
}

// one call for the market: a club row (+ context) straight to its posture,
// its policy and the sheet behind them. `finance` on the row is the club's
// own settled document, when it has one - the attendance the projection
// budgets from. An era-1 world gets 'healthy' unconditionally: the founding
// economy has different flows, no bot ever went under in it, and this
// layer's law is written against era 2.
export function botMoney(row, ctx) {
  if (ctx && ctx.era2 === false) {
    return { posture: 'healthy', policy: POSTURE_POLICY.healthy, perRoundIncome: 0, view: null };
  }
  const fin = row.finance || {};
  const squad = row.squad || [];
  const wageBill = squad.reduce((s, p) => s + ((p && p.wage) || 0), 0)
    + (Array.isArray(row.youth) ? row.youth : []).reduce((s, p) => s + ((p && p.wage) || 0), 0);
  const view = botFinanceView({
    country: (ctx && ctx.country) || row.country_id,
    slot: row.slot, isBoss: !!row.is_boss,
    div: ctx && ctx.div, bank: Number(row.bank || 0), wageBill,
    seats: row.seats || fin.seats, academy: row.academy,
    avgAttendance: fin.avgAttendance, supporters: fin.supporters,
    ticket: fin.ticket, sponsorPackage: fin.sponsorPackage,
    roundsLeft: ctx ? ctx.roundsLeft : null,
    roundsTotal: ctx && ctx.roundsTotal
  });
  const posture = postureOf(view, ambitionOf(row.slot, !!row.is_boss));
  return { posture, policy: POSTURE_POLICY[posture], perRoundIncome: view.perRoundIncome, view };
}
export function botPosture(row, ctx) { return botMoney(row, ctx).posture; }

// ---------------------------------------------------------------------------
// WHAT EACH POSTURE DOES TO THE MARKET'S EXISTING DIALS. Stated here in one
// table rather than scattered through market.mjs, so the whole policy can be
// read (and simulated) at a glance.
//
//   sell        the per-round chance a bot puts its most surplus man up
//               (healthy keeps the founding 0.22 exactly)
//   listings    how many of its men it will have on the board at once
//   reserve     the share of the asking price it will let him go for -
//               a distressed seller accepts a distressed price
//   buys        whether it bids at all, and on what: 'any' is the founding
//               behaviour (a hole OR an upgrade), 'need' is holes only
//   appetite    a multiplier on the founding bid appetite
//   wageGuard   a buy must leave the wage bill under this share of
//               recurring income (null: the founding no-guard behaviour)
// ---------------------------------------------------------------------------
export const POSTURE_POLICY = {
  healthy:   { sell: 0.22, listings: 2, reserve: 0.80, buys: 'any',  appetite: 1.00, wageGuard: null },
  tight:     { sell: 0.30, listings: 2, reserve: 0.75, buys: 'need', appetite: 0.88, wageGuard: 0.95 },
  dangerous: { sell: 0.50, listings: 3, reserve: 0.68, buys: 'none', appetite: 0,    wageGuard: 0 },
  critical:  { sell: 0.85, listings: 3, reserve: 0.60, buys: 'none', appetite: 0,    wageGuard: 0 }
};
