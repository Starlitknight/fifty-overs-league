#!/usr/bin/env node
/* tools/pyramid-progress.mjs — CAN A CLUB ACTUALLY GET BETTER?
 *
 * Sections 7, 8, 10 and 11 of the competitive-pyramid brief, and the one that
 * decides the whole phase. The ladder measurement says a bottom Division Two
 * club sits about 11 cards below the rung above it and wins 6% of matches
 * against it. That is only a prison if the club cannot climb, so this runs the
 * ACTUAL shipped progression systems, with no boosts of any kind, and reports
 * where a club's best XI stands after 1, 2, 3, 5 and 10 seasons.
 *
 * WHAT IS RUN, all of it the shipped code:
 *   - the nets, host.trainRound, fourteen rounds a season at the club's own
 *     academy and coach rate (living.mjs academyRate x coachRate);
 *   - the year, host.ageDecline, on the engine's own per-attribute curve;
 *   - retirement at RETIRE_AT and the free-agent replacement that walks in
 *     behind a retiring man, dealt by market.mjs makeFreeAgent from the
 *     world's own tier mix;
 *   - the card recomputed by host.derive after every step, because the card is
 *     a pure function of the skills beneath it.
 *
 * THREE MANAGEMENTS (section 8), and none of them is given a resource the
 * product would not give it:
 *   PASSIVE    - default nets plan, keeps whoever is dealt, replaces only the
 *                men who retire, and takes the first free agent offered.
 *   COMPETENT  - trains the XI, and when a man retires or a free agent is
 *                strictly better than the worst man in the squad, signs him if
 *                the club can afford the fee and the wage.
 *   ELITE      - the same rules, but looks at more of the board each season and
 *                is willing to replace the worst man in the squad rather than
 *                only fill a hole.
 *
 * node tools/pyramid-progress.mjs [--seasons=10] [--worlds=12] [--fa=6]
 */
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs, tierOfClub } from '../server/init-world.mjs';
import { makeFreeAgent, valueOf } from '../server/market.mjs';
import { seasonOf } from './economy-audit.mjs';
import { foundingSeats, foundingSupport, econStature } from '../server/economy.mjs';
import { FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { academyRate, coachRate } from '../server/living.mjs';
import { RETIRE_AT } from '../server/youth.mjs';
import { ROUNDS } from '../server/clock.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEASONS = +arg('seasons', 10);
const WORLDS = +arg('worlds', 12);
const FA_SEEN = +arg('fa', 6);          // free agents a club sees in a season
const L = s => console.log(s);
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};

const host = makeHost();
const cfgs = countryConfigs(host);
const cfgOf = id => cfgs.find(c => c.id === id);

const bestXI = sq => [...sq].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
const xiOvr = sq => mean(bestXI(sq).map(p => p.rating / 1000));

// ---------------------------------------------------------------------------
// ONE SEASON ON ONE CLUB, by the shipped systems.
// ---------------------------------------------------------------------------
function playSeason(squad, cfg, opts) {
  const { academy = 2, coach = 1, style, seed, faSeen, bank, slot, isBoss, div } = opts;
  let sq = squad.map(p => JSON.parse(JSON.stringify(p)));
  let cash = bank;

  // 1. THE NETS, every round. The XI trains when the manager says so; the
  //    default plan is what a club that never touches the page gets.
  const rate = academyRate(academy) * coachRate(coach);
  for (let r = 0; r < ROUNDS; r++) {
    const xi = style === 'passive' ? null : bestXI(sq).map(p => p.name);
    const res = host.trainRound(sq, {}, rate, xi);
    if (res && res.players) sq = res.players;
  }
  sq = host.derive(sq);

  // 2. THE YEAR. A year older, the engine's decline, then the retirements.
  sq = sq.map(p => ({ ...p, age: (p.age || 27) + 1 }));
  const declined = host.ageDecline(sq);
  sq.forEach((p, i) => {
    const q = declined[i]; if (!q || !q.skills) return;
    for (const k in q.skills) if (typeof q.skills[k] === 'number') p.skills[k] = q.skills[k];
    if (p.baseSkills && q.baseSkills)
      for (const k in q.baseSkills) if (typeof q.baseSkills[k] === 'number') p.baseSkills[k] = q.baseSkills[k];
  });
  sq = host.derive(sq);
  const kept = sq.filter(p => (p.age || 0) < RETIRE_AT);
  const lost = sq.length - kept.length;
  sq = kept;

  // 3. THE MARKET. The board a club sees this season, dealt by the shipped
  //    free-agent generator from the world's own tier mix.
  const board = [];
  for (let i = 0; i < faSeen; i++) {
    const m = makeFreeAgent(host, cfg, seed + '|fa|' + i);
    if (m) board.push(host.derive([m])[0]);
  }
  board.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  // AND EVERY MAN COSTS WHAT THE UMPIRE ASKS FOR HIM. The first cut of this
  // tool let a manager sign anybody it liked, and its "elite" arm took a
  // bottom club to best-XI 81 - above a flagship - on thirty-six free
  // transfers. That is not an elite manager, it is a manager with no budget,
  // and section 8 says plainly not to hand out free resources. A free agent is
  // listed at valueOf(man) with a reserve at 70% of it (market.mjs), so a
  // signing costs the reserve at least; the asking price is what a contested
  // one costs. The reserve is used here, which is the CHEAPEST honest reading
  // and therefore the most generous to the case that a club can climb.
  //
  // The wage is the other half, and it is the half that lasts: a man's wage is
  // charged every round for as long as he is on the books, so a club that
  // spends its bank on a squad it cannot pay simply goes under a season later.
  // The season's net is computed below off the squad the club ends up with.
  let signed = 0, spent = 0, passedOnFee = 0, passedOnWage = 0;
  const worstOf = () => sq.reduce((w, p) => (w == null || p.rating < w.rating ? p : w), null);
  const billOf = men => men.reduce((t, p) => t + (p.wage || 0), 0);
  // what the club can carry in wages: its own revenue at this seat, less the
  // other bills, is measured by the seat model - so the ceiling used here is
  // the bill at which the season's net turns negative, found by asking.
  const netAt = men => seasonOf({
    slot, isBoss, div, country: cfg.id, wageRound: billOf(men),
    pos: div === 1 ? 6 : 4, wins: 6, bank0: cash,
    seats: foundingSeats(slot, isBoss), support: foundingSupport(slot, isBoss)
  }).net;
  const canAfford = (man, replacing) => {
    const fee = Math.round(valueOf(man) * 0.7);          // the reserve
    if (fee > cash) { passedOnFee++; return false; }
    const after = replacing ? sq.filter(p => p !== replacing).concat([man]) : sq.concat([man]);
    // a club may run at a loss - that is what a bank is for - but not at a loss
    // deeper than a third of its remaining cash in one season, which is the
    // line between ambition and administration
    if (netAt(after) < -cash / 3) { passedOnWage++; return false; }
    return true;
  };
  if (style === 'passive') {
    // fills the holes retirement left, first come first served, and only if it
    // can pay - a passive club is not a reckless one
    for (let i = 0; i < lost && i < board.length; i++) {
      if (!canAfford(board[i], null)) continue;
      cash -= Math.round(valueOf(board[i]) * 0.7); spent += Math.round(valueOf(board[i]) * 0.7);
      sq.push(board[i]); signed++;
    }
  } else {
    // fill the holes with the BEST available it can pay for, then - for an
    // elite manager - upgrade on the worst man on the books while the board
    // has better AND the money lasts
    let i = 0;
    for (let filled = 0; filled < lost && i < board.length; i++) {
      if (!canAfford(board[i], null)) continue;
      cash -= Math.round(valueOf(board[i]) * 0.7); spent += Math.round(valueOf(board[i]) * 0.7);
      sq.push(board[i]); signed++; filled++;
    }
    if (style === 'elite') {
      for (; i < board.length; i++) {
        const w = worstOf();
        if (!w || board[i].rating <= w.rating) break;
        if (!canAfford(board[i], w)) continue;
        // selling the man he replaces brings in half his worth (quicksell)
        const inFee = Math.round(valueOf(w) * 0.5);
        const outFee = Math.round(valueOf(board[i]) * 0.7);
        cash += inFee - outFee; spent += outFee - inFee;
        sq = sq.filter(p => p !== w); sq.push(board[i]); signed++;
      }
    }
  }
  sq = host.derive(sq);
  // the season's money, on the squad the club actually ends up with
  const net = netAt(sq);
  cash += net;
  return { squad: sq, retired: lost, signed, spent, bank: cash, net,
    bill: billOf(sq), passedOnFee, passedOnWage };
}

// ---------------------------------------------------------------------------
// THE RUN
// ---------------------------------------------------------------------------
const SEATS = [[15, 'bottom D2 (d2b)'], [12, 'lower D2 (d2b)'], [9, 'top D2 (d2a)'], [5, 'mid D1 (d1b)']];
const STYLES = ['passive', 'competent', 'elite'];
const MARKS = [0, 1, 2, 3, 5, 10].filter(m => m <= SEASONS);

L('');
L('7 + 8. WHAT THE SHIPPED PROGRESSION SYSTEMS DO TO A CLUB');
L('='.repeat(94));
L('   ' + WORLDS + ' worlds, ' + SEASONS + ' seasons, nets + ageing + retirement + free agents');
L('   no boosts, no subsidies, no rule changes - all shipped code');
L('');

const results = {};
for (const [slot, label] of SEATS) {
  for (const style of STYLES) {
    const tracks = [];
    for (let w = 0; w < WORLDS; w++) {
      const cfg = cfgs[w % cfgs.length];
      const club = cfg.clubs[slot];
      const tier = tierOfClub(cfg, club);
      let sq = host.derive(host.genSquad('world1|' + cfg.id + '|' + slot, cfg.nat,
        club.arch || cfg.arch, 'general', 1, tier) || []);
      if (!sq.length) continue;
      const isBoss = !!club.boss, div = club.div || (slot < 8 ? 1 : 2);
      const st0 = econStature(slot, isBoss);
      let bank = Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st0) / 1000) * 1000;
      const track = [xiOvr(sq)], banks = [bank];
      let ret = 0, sig = 0, spent = 0, pf = 0, pw = 0;
      for (let s = 0; s < SEASONS; s++) {
        const out = playSeason(sq, cfg, {
          academy: 2, coach: 1, style,
          seed: 'prog|' + cfg.id + '|' + slot + '|' + style + '|s' + s,
          faSeen: style === 'elite' ? FA_SEEN * 2 : FA_SEEN,
          bank, slot, isBoss, div
        });
        sq = out.squad; ret += out.retired; sig += out.signed; spent += out.spent;
        pf += out.passedOnFee; pw += out.passedOnWage; bank = out.bank;
        track.push(xiOvr(sq)); banks.push(bank);
      }
      tracks.push({ track, banks, ret, sig, spent, pf, pw });
    }
    results[slot + '|' + style] = tracks;
  }
}

for (const [slot, label] of SEATS) {
  L('   seat ' + slot + ' - ' + label);
  L('      management   ' + MARKS.map(m => ('s' + m).padStart(9)).join('')
    + '     gain/yr   retired   signed');
  for (const style of STYLES) {
    const tracks = results[slot + '|' + style];
    if (!tracks || !tracks.length) continue;
    const at = m => mean(tracks.map(t => t.track[m]));
    const gain = (at(SEASONS) - at(0)) / SEASONS;
    L('      ' + style.padEnd(12)
      + MARKS.map(m => at(m).toFixed(1).padStart(9)).join('')
      + gain.toFixed(2).padStart(12)
      + mean(tracks.map(t => t.ret)).toFixed(1).padStart(10)
      + mean(tracks.map(t => t.sig)).toFixed(1).padStart(9)
      + ('$' + Math.round(mean(tracks.map(t => t.banks[t.banks.length - 1])) / 1000) + 'k').padStart(12)
      + (mean(tracks.map(t => t.pf)) + mean(tracks.map(t => t.pw))).toFixed(0).padStart(9));
  }
  L('');
}

L('   THE RUNG ABOVE, for reference: d2a sits at best-XI 56.6 and d1b at 67.3.');
L('   A bottom club needs to reach roughly 52 to be a live promotion candidate');
L('   (the -4 gap that wins 30% of matches) and roughly 56 to be level.');
L('');

// ---------------------------------------------------------------------------
// 10. WHAT THE WORLD OFFERS - the quality of new entrants
// ---------------------------------------------------------------------------
L('10. PLAYER SUPPLY - what walks into the world after founding');
L('='.repeat(94));
L('');
const fa = [];
for (let i = 0; i < 600; i++) {
  const m = makeFreeAgent(host, cfgOf('eng'), 'supply|' + i);
  if (m) fa.push(host.derive([m])[0]);
}
const faC = fa.map(p => p.rating / 1000);
L('   free agents, ' + fa.length + ' dealt from the world\'s own tier mix:');
L('      P10 ' + pct(faC, 0.1).toFixed(1) + '   P25 ' + pct(faC, 0.25).toFixed(1)
  + '   median ' + pct(faC, 0.5).toFixed(1) + '   P75 ' + pct(faC, 0.75).toFixed(1)
  + '   P90 ' + pct(faC, 0.9).toFixed(1) + '   max ' + Math.max(...faC).toFixed(1));
L('');
for (const th of [50, 56, 60, 67, 70]) {
  const n = faC.filter(c => c >= th).length;
  L('      OVR ' + th + '+ : ' + (100 * n / faC.length).toFixed(1) + '% of the board ('
    + n + ' of ' + faC.length + ')');
}
L('');
L('   A bottom club\'s worst man is around OVR 30 and its best around 50. Every');
L('   free agent above its own worst man is an upgrade IT CAN MAKE, so supply');
L('   is not obviously the binding constraint - the question the sections above');
L('   answer is whether taking those upgrades actually moves the best XI.');
L('');
