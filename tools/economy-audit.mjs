#!/usr/bin/env node
/* tools/economy-audit.mjs — THE ERA 2 CLUB ECONOMY, SEAT BY SEAT
 *
 * ERA 2 ECONOMY REALISM AUDIT. Measurement only: nothing here writes, and no
 * constant it reads is defined here. Every number comes from the shipped
 * economy - `financeconfig.mjs` for the tunables, `economy.mjs` for the laws -
 * and every squad comes from the shipped engine's own generator priced through
 * the shipped wage curve. If a figure below is wrong, the model is wrong;
 * the game is not being second-guessed.
 *
 * WHY A MODEL AND NOT THE SETTLE. computeFinance needs a settled Postgres
 * world and a p3-style run takes twenty minutes, which buys ONE world - and
 * one world cannot separate a SEAT effect from the luck of a deal. This walks
 * the same laws in the same order over as many synthetic worlds as asked for,
 * which is what makes a distribution per seat possible. It is validated
 * against a real settled world (--validate), and the validation is printed,
 * because a model nobody checked is a rumour.
 *
 * THE SEASON IT WALKS, exactly as economy.mjs settles one:
 *
 *   every league round a club plays   media installment, sponsor guarantee,
 *                                     a win bonus if it won, wages, club
 *                                     operations, academy upkeep, overdraft
 *                                     interest, and the administration floor
 *   home rounds only                  the gate, banked at MATCHDAY_NET
 *   the last league round             prize money by final position
 *
 *   node tools/economy-audit.mjs [--worlds=8] [--validate]
 */
import vm from 'node:vm';
import {
  stature, econStature, foundingSeats, foundingSupport, foundingBankFor,
  moodOf, supportTarget, gateSale, gateHeat, academyUpkeep, weatherOf,
  DIV2_CROWD, DEBT_LIMIT, DEBT_ROUND, MAX_SEATS
} from '../server/economy.mjs';
import {
  MEDIA_SEASON, SPONSOR_PACKAGES, SPONSOR_DEFAULT, sponsorSeasonValue,
  sponsorWinBonus, operationsPerRound, prizeFor, isFullMember, ASSOC_POOL, OPS_ASSOC,
  MATCHDAY_NET, PRIZE_PLAYOFF_CHAMP, centralInstallment
} from '../server/financeconfig.mjs';
import { EPOCH, DAY, dayOfRound, ROUNDS } from '../server/clock.mjs';
import { makeEngine } from '../test/engine-vm.mjs';

export const HOUR = 14 * 3600000;
export const SEASON_ROUNDS = ROUNDS;               // the schedule's own count
const MOOD_MULT = m => 0.55 + m * (0.39 / 8);
const DRAW = (oppBoss, oppPos) => (oppBoss ? 1.22 : 1) * (oppPos <= 3 ? 1.09 : 1);

// ---------------------------------------------------------------------------
// THE SQUAD, AND WHAT IT COSTS. Dealt by the shipped generator for the seat's
// own tier and strength, then priced through the shipped card and the shipped
// wage curve - so a seat's payroll is the payroll the world actually deals it,
// not a number invented here.
// ---------------------------------------------------------------------------
const TIERS = ['newcomer', 'd2b', 'd2a', 'd1b', 'd1a', 'flagship'];
export function tierOf(slot, isBoss, div) {
  if (isBoss) return TIERS[5];
  const ix = div === 1 ? (slot <= 3 ? 4 : 3) : (slot <= 11 ? 2 : 1);
  return TIERS[Math.max(0, Math.min(5, ix))];
}
export function makeSquadShop() {
  const eng = makeEngine();
  const g = k => vm.runInContext(k, eng.ctx);
  const nations = JSON.parse(g('JSON.stringify(window.__foPlanet.nations()||[])'))
    .map(n => (n.id != null ? n.id : n));
  const sidesOf = rid => JSON.parse(g(`JSON.stringify(window.__foPlanet.sidesOf(${JSON.stringify(rid)})||[])`));
  const deal = (seed, rid, arch, str, tier) => JSON.parse(
    g(`JSON.stringify((__foGenArchetypeSquad(${JSON.stringify(seed)},${JSON.stringify(String(rid).toUpperCase())},`
      + `${JSON.stringify(arch || 'engine')},null,${+str || 1},${JSON.stringify(tier)})||{}).players||[])`));
  const wageOf = players => players.reduce((t, p) => t + (+p.wage || 0), 0);
  return { eng, g, nations, sidesOf, deal, wageOf };
}

// ---------------------------------------------------------------------------
// ONE CLUB, ONE SEASON. `pos` is where it finishes, `posLast` where it
// finished last summer (the sponsor reads that one), `wins` how many league
// wins it took. Everything else is the shipped law.
// ---------------------------------------------------------------------------
export function seasonOf(opts) {
  const {
    slot, isBoss = false, div, country = 'eng', wageRound, academy = 2,
    pos, posLast = pos, wins, clubsInDiv = 8, rounds = SEASON_ROUNDS,
    homeRounds = Math.floor(SEASON_ROUNDS / 2), bank0, seats: seatsIn,
    support: supIn, pkg = SPONSOR_DEFAULT, statOverride = null,
    gateMult = 1, mediaMult = 1, sponsorMult = 1, opsMult = 1,
    seed = 1, bossOpponents = 1, topOpponents = 3,
    playoffRounds = 0, playoffWin = false, playoffHome = null
  } = opts;

  const member = isFullMember(country);
  const natF = member ? 1 : ASSOC_POOL, natOps = member ? 1 : OPS_ASSOC;
  const stat = statOverride == null ? econStature(slot, isBoss) : statOverride;
  const seats = seatsIn == null ? foundingSeats(slot, isBoss) : seatsIn;
  let support = supIn == null ? foundingSupport(slot, isBoss) : supIn;
  let bank = bank0 == null ? foundingBankFor(slot, isBoss, true) : bank0;

  // the sponsor signs on last summer's standing, this club's stature and its
  // nation's band; the shape is the manager's, and the bots sign BALANCED
  const spV = sponsorSeasonValue(div, posLast, clubsInDiv, natF, stat);
  const shape = SPONSOR_PACKAGES[pkg] || SPONSOR_PACKAGES[SPONSOR_DEFAULT];
  const spG = Math.round(spV * shape.guaranteed);
  const spWin = sponsorWinBonus(spV, pkg);
  const mediaSeason = Math.round((MEDIA_SEASON[div] || MEDIA_SEASON[2]) * natF * mediaMult);
  const ops = Math.round(operationsPerRound(seats, div, natOps) * opsMult);
  const up = academyUpkeep(academy);

  // the mood a club of this standing carries: the shipped reading, from a
  // form record consistent with its finish rather than from a guess
  const winRate = clubsInDiv > 1 ? (clubsInDiv - pos) / (clubsInDiv - 1) : 0.5;
  const last5 = [0, 1, 2].map(() => 0).concat([]);   // rebuilt each round below

  const out = {
    slot, div, stat, seats, support0: support, bank0: bank, spV, spG, spWin,
    media: 0, sponsor: 0, sponsorBonus: 0, gate: 0, prize: 0,
    wages: 0, ops: 0, upkeep: 0, interest: 0, writtenOff: 0,
    att: [], minBank: bank, adminRounds: 0
  };
  let mood = moodOf([], pos, clubsInDiv);
  const form = [];
  for (let r = 1; r <= rounds; r++) {
    // a result consistent with the finish: wins spread evenly through the year
    const won = ((r * wins) % rounds) < wins;
    form.push(won ? 2 : (r % 5 === 0 ? 1 : 0));
    while (form.length > 5) form.shift();
    mood = moodOf(form, pos, clubsInDiv);
    support = Math.round(support + (supportTarget(mood, pos, clubsInDiv, stat) - support) * 0.25);

    // HOME ROUNDS TAKE A GATE. Who visits matters, so the flagship and the
    // leaders are spread across the home fixtures rather than averaged away.
    const isHome = r <= homeRounds;
    if (isHome) {
      const oppBoss = (r % Math.max(1, Math.round(homeRounds / Math.max(1, bossOpponents)))) === 1;
      const oppTop = !oppBoss && (r % Math.max(2, Math.round(homeRounds / Math.max(1, topOpponents)))) === 0;
      const w = weatherOf(seed * 1000 + r);
      const demand = support * MOOD_MULT(mood) * DRAW(oppBoss, oppTop ? 2 : 8) * w.mult
        * (div === 2 ? DIV2_CROWD : 1);
      const matchMs = EPOCH + (dayOfRound(r) || (r - 1)) * DAY + HOUR;
      const sale = gateSale(demand, seats, matchMs, null, null,
        gateHeat(oppBoss ? 1 : oppTop ? 0.6 : 0, mood, r));
      const banked = Math.round(sale.take * MATCHDAY_NET * gateMult);
      out.gate += banked; out.att.push(sale.sold);
      bank += banked;
    }
    // the stable centre, by cumulative rounding exactly as the walk pays it
    // the SHIPPED law, called rather than copied - a model with its own copy
    // of an installment rule is a model that can quietly disagree with the game
    const med = centralInstallment(mediaSeason, r, rounds);
    const gIn = Math.round(centralInstallment(spG, r, rounds) * sponsorMult);
    out.media += med; out.sponsor += gIn; bank += med + gIn;
    if (won && spWin) { const wb = Math.round(spWin * sponsorMult); out.sponsorBonus += wb; bank += wb; }
    // and the bills
    out.wages += wageRound; bank -= wageRound;
    out.ops += ops; bank -= ops;
    out.upkeep += up; bank -= up;
    if (bank < 0) { const i = Math.round(-bank * DEBT_ROUND); out.interest += i; bank -= i; }
    if (bank < -DEBT_LIMIT) { out.writtenOff += (-DEBT_LIMIT) - bank; bank = -DEBT_LIMIT; }
    if (bank <= -DEBT_LIMIT) out.adminRounds++;
    if (bank < out.minBank) out.minBank = bank;
    // the final league round pays the table
    if (r === rounds) {
      const pz = prizeFor(div, pos, natF);
      out.prize += pz; bank += pz;
      if (pos <= 4 && shape.playoffShare) {
        const b = Math.round(spV * shape.playoffShare); out.sponsorBonus += b; bank += b;
      }
    }
  }
  // THE PLAYOFF ROUNDS ARE UNFUNDED, AND THAT IS THE LAW AND NOT A GAP IN THIS
  // MODEL. economy.mjs charges wages, club operations and the academy for
  // EVERY round a club plays - `for (const slot of playing)` - and pays the
  // media installment and the sponsor's guarantee only for LEAGUE rounds
  // (`rdNo >= 1 && rdNo <= curR`, and curR is 14). Rounds 15 and 16 are the
  // semi-final and the final. A club that reaches them pays two more rounds of
  // its entire cost base out of a season's income that has stopped.
  //
  // Read off the settled world rather than off the source: Surrey banked club
  // operations for all 23 of its rounds at exactly its Division One rate while
  // its media came to 2,750,000 + 7/14 x 2,750,000 to the dollar. Sixteen
  // rounds played in season one; fourteen of them paid.
  // WHO HOSTS A PLAYOFF. tick.mjs fixturesFor: the semi-finals are 1v4 and 2v3
  // with the HIGHER SEED HOSTING, and the final is the two winners with the
  // higher table seed hosting again. So the club that tops the fourteen hosts
  // both, the runner-up hosts its semi and travels to the final, and the third
  // and fourth seeds travel. A playoff gate is a real line in the settle - the
  // walk counts every match in `matches`, playoff rounds included - and an
  // earlier cut of this model left it out, which overstated the playoff
  // penalty by two of the biggest home gates a club takes all year.
  const poHome = playoffHome != null ? playoffHome
    : (pos === 1 ? playoffRounds : pos === 2 ? Math.min(1, playoffRounds) : 0);
  for (let r = 1; r <= playoffRounds; r++) {
    if (r <= poHome) {
      // a full house occasion against the best side left in the division
      const w = weatherOf(seed * 1000 + rounds + r);
      const demand = support * MOOD_MULT(mood) * DRAW(false, 1) * w.mult * (div === 2 ? DIV2_CROWD : 1);
      const matchMs = EPOCH + (dayOfRound(rounds + r) || (rounds + r - 1)) * DAY + HOUR;
      const sale = gateSale(demand, seats, matchMs, null, null, gateHeat(1, mood, rounds + r));
      const banked = Math.round(sale.take * MATCHDAY_NET * gateMult);
      out.gate += banked; out.att.push(sale.sold); bank += banked;
    }
    const pmed = centralInstallment(mediaSeason, rounds + r, rounds);
    const pspn = Math.round(centralInstallment(spG, rounds + r, rounds) * sponsorMult);
    out.media += pmed; out.sponsor += pspn; bank += pmed + pspn;
    out.wages += wageRound; out.ops += ops; out.upkeep += up;
    bank -= wageRound + ops + up;
    if (bank < 0) { const i = Math.round(-bank * DEBT_ROUND); out.interest += i; bank -= i; }
    if (bank < -DEBT_LIMIT) { out.writtenOff += (-DEBT_LIMIT) - bank; bank = -DEBT_LIMIT; }
    if (bank <= -DEBT_LIMIT) out.adminRounds++;
    if (bank < out.minBank) out.minBank = bank;
    if (r === playoffRounds && playoffWin) {
      const pz = Math.round((PRIZE_PLAYOFF_CHAMP[div] || 0) * natF);
      out.prize += pz; bank += pz;
      if (shape.titleShare) { const b = Math.round(spV * shape.titleShare); out.sponsorBonus += b; bank += b; }
    }
  }
  out.playoffRounds = playoffRounds;
  out.bank = bank;
  out.support = support;
  out.revenue = out.media + out.sponsor + out.sponsorBonus + out.gate + out.prize;
  out.cost = out.wages + out.ops + out.upkeep + out.interest;
  out.net = out.revenue - out.cost;
  out.avgAtt = out.att.length ? Math.round(out.att.reduce((a, b) => a + b, 0) / out.att.length) : 0;
  return out;
}

export const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.max(0, Math.min(s.length - 1, Math.floor(q * (s.length - 1))))]; };
export const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const $ = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
export const k = n => (n < 0 ? '-' : '') + Math.round(Math.abs(n) / 1000) + 'k';
