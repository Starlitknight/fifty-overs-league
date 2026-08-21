#!/usr/bin/env node
/* tools/roster-longrun.mjs — TEN SEASONS WITH THE REPAIR IN PLACE
 *
 * Sections 6, 7, 8 and 9 of the roster-continuity finalisation: the real
 * mobility harness from the competitive-pyramid audit, with the shipped
 * ensurePlayableSquad wired into the close season exactly where ageYouth calls
 * it, and every emergency signing counted.
 *
 * TWO ARMS, so the sporting and economic impact is a DIFFERENCE rather than an
 * assertion:
 *   --arm=old   retirement shrinks the squad and nothing refills it, which is
 *               main's law. A club under eleven forfeits rather than killing
 *               the run, and the forfeits are counted.
 *   --arm=new   ensurePlayableSquad restores eleven at the close season.
 * Everything else is identical and seeded identically, so any difference is the
 * repair and nothing else.
 *
 *   node tools/roster-longrun.mjs [--seasons=10] [--nations=8] [--arm=new]
 *
 * (adapted from tools/pyramid-mobility.mjs — CAN A CLUB RISE?)
 *
 * Sections 3, 4, 11, 12, 13 and 14 of the competitive-pyramid brief, and the
 * headline number the phase exists to produce.
 *
 * TWO THINGS THIS DOES THAT THE EARLIER ECONOMY PYRAMIDS DID NOT:
 *
 *   1. IT PLAYS THE CRICKET. Every economy phase decided a league table by
 *      sorting on the wage bill with noise, which is a fine proxy for a MONEY
 *      question and useless for a SPORTING one. Here every fixture is a real
 *      match through the shipped engine - a full double round robin in each
 *      division, every season.
 *
 *   2. IT FOLLOWS CLUBS, NOT SEATS. Section 4 names the methodological trap
 *      directly: "slot 15" after five seasons is whichever club happens to be
 *      sitting there, and measuring it tells you about the seat rather than
 *      about mobility. Every club here carries an identity from the day it is
 *      dealt, and promotion, relegation and finishing position are recorded
 *      against the CLUB.
 *
 * The squads evolve by the shipped systems between seasons - nets, ageing,
 * retirement, free agents - at the management level the arm names, so a club's
 * strength is not frozen either.
 *
 *   node tools/pyramid-mobility.mjs [--seasons=10] [--nations=4] [--style=competent]
 */
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs, tierOfClub } from '../server/init-world.mjs';
import { makeFreeAgent, valueOf } from '../server/market.mjs';
import { seasonOf } from './economy-audit.mjs';
import { foundingSeats, foundingSupport, econStature } from '../server/economy.mjs';
import { FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { academyRate, coachRate } from '../server/living.mjs';
import { RETIRE_AT, ensurePlayableSquad, ROSTER_MIN } from '../server/youth.mjs';
import { ROUNDS } from '../server/clock.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEASONS = +arg('seasons', 10);
const NAT = +arg('nations', 4);
const STYLE = arg('style', 'competent');
const ARM = arg('arm', 'new');
const EMG = { total: 0, byClub: {}, perSeason: [], wages: 0, value: 0, ovr: [] };
let forfeits = 0, minSeen = 99;
const L = s => console.log(s);
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const host = makeHost();
const cfgs = countryConfigs(host).slice(0, NAT);
const bestXI = sq => [...sq].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 11);
const xiOvr = sq => mean(bestXI(sq).map(p => p.rating / 1000));

// ---------------------------------------------------------------------------
// A SEASON OF CRICKET IN ONE DIVISION: a double round robin, real matches.
// ---------------------------------------------------------------------------
let shortSides = 0, engineFails = 0;
function playDivision(clubs, seed) {
  const pts = {}, pf = {};
  for (const c of clubs) { pts[c.id] = 0; pf[c.id] = 0; }
  let n = 0;
  for (let i = 0; i < clubs.length; i++) {
    for (let j = 0; j < clubs.length; j++) {
      if (i === j) continue;                       // home and away, both ways
      const H = clubs[i], A = clubs[j];
      // A SQUAD CAN FALL BELOW A SIDE. Retirement takes men out and a club that
      // cannot afford a replacement does not get one, so after some seasons a
      // roster can drop under eleven - and the engine, quite reasonably, cannot
      // pick an XI out of nine men. The shipped world never sees this because
      // market.mjs refuses to sell a club below SQUAD_FLOOR, but nothing stops
      // RETIREMENT doing it, so the simulation has to say what it does rather
      // than crash: a short club forfeits, which is the honest reading of
      // turning up without a side.
      if (H.squad.length < ROSTER_MIN || A.squad.length < ROSTER_MIN) {
        shortSides++; forfeits++;
        if (H.squad.length >= 11) pts[H.id] += 2;
        else if (A.squad.length >= 11) pts[A.id] += 2;
        continue;
      }
      let res = null;
      try {
        res = JSON.parse(host.runMatch(
          { name: H.id, players: H.squad }, { name: A.id, players: A.squad },
          'fair', (seed + (++n) * 7919) >>> 0, {}, 'Sunny', false));
      } catch (eM) {
        engineFails++;
        if (engineFails <= 3) console.error('  match failed: ' + H.id + ' (' + H.squad.length
          + ' men) v ' + A.id + ' (' + A.squad.length + ' men): ' + eM.message);
        continue;
      }
      if (!res) continue;
      if (res.winner === H.id) pts[H.id] += 2;
      else if (res.winner === A.id) pts[A.id] += 2;
      else { pts[H.id] += 1; pts[A.id] += 1; }
      const r0 = res.innings[0], r1 = res.innings[1];
      if (r0) pf[r0.batTeam === H.id ? H.id : A.id] += r0.runs || 0;
      if (r1) pf[r1.batTeam === H.id ? H.id : A.id] += r1.runs || 0;
    }
  }
  return clubs.slice().sort((a, b) => pts[b.id] - pts[a.id] || pf[b.id] - pf[a.id]
    || (a.id < b.id ? -1 : 1)).map((c, ix) => ({ club: c, pos: ix + 1, pts: pts[c.id] }));
}

// ---------------------------------------------------------------------------
// THE CLOSE SEASON: nets, the year, retirements, the free-agent board - with
// the budget the club actually has. Same rules as pyramid-progress.mjs.
// ---------------------------------------------------------------------------
function closeSeason(club, cfg, style, seed) {
  let sq = club.squad.map(p => JSON.parse(JSON.stringify(p)));
  let cash = club.bank;
  const rate = academyRate(2) * coachRate(1);
  for (let r = 0; r < ROUNDS; r++) {
    const xi = style === 'passive' ? null : bestXI(sq).map(p => p.name);
    const res = host.trainRound(sq, {}, rate, xi);
    if (res && res.players) sq = res.players;
  }
  sq = host.derive(sq).map(p => ({ ...p, age: (p.age || 27) + 1 }));
  const dec = host.ageDecline(sq);
  sq.forEach((p, i) => {
    const q = dec[i]; if (!q || !q.skills) return;
    for (const k in q.skills) if (typeof q.skills[k] === 'number') p.skills[k] = q.skills[k];
    if (p.baseSkills && q.baseSkills)
      for (const k in q.baseSkills) if (typeof q.baseSkills[k] === 'number') p.baseSkills[k] = q.baseSkills[k];
  });
  sq = host.derive(sq);
  const kept = sq.filter(p => (p.age || 0) < RETIRE_AT);
  const lost = sq.length - kept.length;
  sq = kept;
  if (sq.length < minSeen) minSeen = sq.length;

  // THE REPAIR, at the same point ageYouth applies it: after the ageing, before
  // anything reads the squad. The 'old' arm skips it, which is main's law.
  if (ARM === 'new') {
    const fix = ensurePlayableSquad(host, cfg.id, sq, 'lr|' + club.id + '|' + seed);
    if (fix.added.length) {
      sq = fix.squad;
      EMG.total += fix.added.length;
      EMG.byClub[club.id] = (EMG.byClub[club.id] || 0) + fix.added.length;
      EMG.perSeason.push(fix.added.length);
      for (const m of fix.added) {
        EMG.wages += (m.wage || 0);
        EMG.value += valueOf(m);
        EMG.ovr.push((m.rating || 0) / 1000);
      }
    }
  }

  const seen = style === 'elite' ? 12 : 6;
  const board = [];
  for (let i = 0; i < seen; i++) {
    const m = makeFreeAgent(host, cfg, seed + '|fa|' + i);
    if (m) board.push(host.derive([m])[0]);
  }
  board.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  const billOf = men => men.reduce((t, p) => t + (p.wage || 0), 0);
  const netAt = men => seasonOf({
    slot: club.slot, isBoss: club.isBoss, div: club.div, country: cfg.id,
    wageRound: billOf(men), pos: 4, wins: 6, bank0: cash,
    seats: foundingSeats(club.slot, club.isBoss),
    support: foundingSupport(club.slot, club.isBoss)
  }).net;
  const afford = (man, repl) => {
    const fee = Math.round(valueOf(man) * 0.7);
    if (fee > cash) return false;
    const after = repl ? sq.filter(p => p !== repl).concat([man]) : sq.concat([man]);
    return netAt(after) >= -cash / 3;
  };
  let i = 0, signed = 0;
  for (let filled = 0; filled < lost && i < board.length; i++) {
    if (!afford(board[i], null)) continue;
    cash -= Math.round(valueOf(board[i]) * 0.7); sq.push(board[i]); signed++; filled++;
  }
  if (style === 'elite') {
    for (; i < board.length; i++) {
      const w = sq.reduce((a, p) => (a == null || p.rating < a.rating ? p : a), null);
      if (!w || board[i].rating <= w.rating) break;
      if (!afford(board[i], w)) continue;
      cash += Math.round(valueOf(w) * 0.5) - Math.round(valueOf(board[i]) * 0.7);
      sq = sq.filter(p => p !== w); sq.push(board[i]); signed++;
    }
  }
  sq = host.derive(sq);
  cash += netAt(sq);
  return { squad: sq, bank: cash, signed, retired: lost };
}

// ---------------------------------------------------------------------------
// THE RUN
// ---------------------------------------------------------------------------
L('');
L('3 + 4 + 14. MOBILITY, WITH REAL CRICKET AND PERSISTENT CLUBS');
L('='.repeat(96));
L('   ' + cfgs.length + ' nations, ' + SEASONS + ' seasons, "' + STYLE + '" management,');
L('   every fixture a real match through the shipped engine');
L('');

const world = [];
for (const cfg of cfgs) {
  const clubs = cfg.clubs.map(c => {
    const tier = tierOfClub(cfg, c);
    const sq = host.derive(host.genSquad('world1|' + cfg.id + '|' + c.slot, cfg.nat,
      c.arch || cfg.arch, c.boss ? cfg.capt : 'general', 1, tier) || []);
    const st = econStature(c.slot, !!c.boss);
    return {
      id: cfg.id + '-' + c.slot, cfg, slot: c.slot, isBoss: !!c.boss,
      seat0: c.slot, tier0: tier, div: c.div || (c.slot < 8 ? 1 : 2),
      squad: sq, bank: Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000,
      xi0: xiOvr(sq),
      ups: 0, downs: 0, bestFinishD1: 99, bestPos: 99, everD1: false,
      firstUp: null, seasonsD1: 0, history: []
    };
  }).filter(c => c.squad.length);
  if (clubs.length === 16) world.push({ cfg, clubs });
}

for (const { cfg, clubs } of world) {
  for (let yr = 0; yr < SEASONS; yr++) {
    for (const dv of [1, 2]) {
      const inDiv = clubs.filter(c => c.div === dv);
      const table = playDivision(inDiv, 1000 + yr * 31 + dv);
      table.forEach(({ club, pos }) => {
        club.history.push({ yr, div: dv, pos });
        if (dv === 1) { club.seasonsD1++; club.everD1 = true; club.bestFinishD1 = Math.min(club.bestFinishD1, pos); }
        club.bestPos = Math.min(club.bestPos, dv === 1 ? pos : pos + 8);
      });
      // the two that go up and the two that come down, as tick.mjs applies it
      if (dv === 1) for (const { club, pos } of table) if (pos > 6) club._down = true;
      if (dv === 2) for (const { club, pos } of table) if (pos <= 2) club._up = true;
    }
    for (const c of clubs) {
      if (c._up) { c.div = 1; c.ups++; if (c.firstUp == null) c.firstUp = yr + 1; }
      if (c._down) c.div = 2, c.downs++;
      delete c._up; delete c._down;
    }
    for (const c of clubs) {
      const out = closeSeason(c, cfg, STYLE, 'mob|' + c.id + '|s' + yr);
      c.squad = out.squad; c.bank = out.bank;
    }
  }
}

const all = world.flatMap(w => w.clubs);
L('   BY STARTING SEAT - the club dealt that seat, followed wherever it went');
L('');
L('   seat  tier       XI s0   XI s' + SEASONS + '   promoted   ever D1   1st up   yrs D1   best finish');
L('   ' + '-'.repeat(93));
for (let s = 0; s < 16; s++) {
  const g = all.filter(c => c.seat0 === s);
  if (!g.length) continue;
  const promoted = g.filter(c => c.ups > 0).length;
  const ups = g.filter(c => c.firstUp != null).map(c => c.firstUp);
  L('   ' + String(s).padStart(4) + '  ' + g[0].tier0.padEnd(10)
    + mean(g.map(c => c.xi0)).toFixed(1).padStart(7)
    + mean(g.map(c => xiOvr(c.squad))).toFixed(1).padStart(8)
    + (promoted + '/' + g.length).padStart(11)
    + (g.filter(c => c.everD1).length + '/' + g.length).padStart(10)
    + (ups.length ? mean(ups).toFixed(1) : '-').padStart(9)
    + mean(g.map(c => c.seasonsD1)).toFixed(1).padStart(9)
    + (Math.min(...g.map(c => c.bestPos)) <= 8
      ? 'D1 ' + Math.min(...g.map(c => c.bestPos))
      : 'D2 ' + (Math.min(...g.map(c => c.bestPos)) - 8)).padStart(14));
}
L('');

// 14. MOBILITY OF THE WHOLE PYRAMID
const upClubs = new Set(all.filter(c => c.ups > 0).map(c => c.id));
const downClubs = new Set(all.filter(c => c.downs > 0).map(c => c.id));
const yoyo = all.filter(c => c.ups > 0 && c.downs > 0);
const frozen = all.filter(c => c.ups === 0 && c.downs === 0);
L('14. MOBILITY OF THE PYRAMID');
L('');
L('   clubs ever promoted    ' + upClubs.size + ' of ' + all.length);
L('   clubs ever relegated   ' + downClubs.size + ' of ' + all.length);
L('   yo-yo clubs            ' + yoyo.length);
L('   never changed division ' + frozen.length + ' of ' + all.length
  + '  (' + (100 * frozen.length / all.length).toFixed(0) + '%)');
L('   repeat promotions      ' + all.filter(c => c.ups > 1).length);
L('');
const d2bFrozen = all.filter(c => c.seat0 >= 12 && c.ups === 0).length;
const d2bAll = all.filter(c => c.seat0 >= 12).length;
L('   OF THE BOTTOM FOUR SEATS (12-15): ' + d2bFrozen + ' of ' + d2bAll
  + ' never won promotion in ' + SEASONS + ' seasons');
L('');

// 12 + 13. PROMOTED AND RELEGATED CLUBS
L('   ROSTER CONTINUITY, arm "' + ARM + '"');
L('');
const clubSeasons = all.length * SEASONS;
const users = Object.keys(EMG.byClub).length;
const repeat = Object.values(EMG.byClub).filter(n => n > 1).length;
const sorted = EMG.perSeason.slice().sort((a, b) => a - b);
const at = q => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0);
L('      club-seasons                   ' + clubSeasons);
L('      emergency recruits             ' + EMG.total);
L('      club-seasons using the repair  ' + EMG.perSeason.length
  + '  (' + (100 * EMG.perSeason.length / clubSeasons).toFixed(2) + '% of all club-seasons)');
L('      clubs receiving at least one   ' + users + ' of ' + all.length);
L('      clubs receiving in >1 season   ' + repeat);
L('      per affected club-season       median ' + at(0.5) + ', P90 ' + at(0.9)
  + ', max ' + (sorted.length ? sorted[sorted.length - 1] : 0));
L('      smallest squad after retirement, BEFORE any repair   ' + minSeen);
L('      clubs left under ' + ROSTER_MIN + ' at the end        '
  + all.filter(c => c.squad.length < ROSTER_MIN).length);
L('      fixtures forfeited for a short side                  ' + forfeits);
L('      engine failures                                      ' + engineFails);
if (EMG.ovr.length) {
  const o = EMG.ovr.slice().sort((a, b) => a - b);
  L('      emergency man OVR: median ' + o[Math.floor(o.length / 2)].toFixed(0)
    + ', worst ' + o[0].toFixed(0) + ', BEST EVER DRAWN ' + o[o.length - 1].toFixed(0));
}
L('');
L('   ECONOMIC WEIGHT');
L('      emergency wage a round         $' + Math.round(EMG.wages).toLocaleString()
  + '  (a whole season, whole world: $' + Math.round(EMG.wages * 14).toLocaleString() + ')');
L('      average per affected club      $'
  + (users ? Math.round(EMG.wages / users).toLocaleString() : 0) + ' a round');
L('      transfer value introduced      $' + Math.round(EMG.value).toLocaleString());
L('');
L('   simulation health: ' + shortSides + ' walkovers, ' + engineFails + ' engine failures');
L('');
L('12 + 13. THE PROMOTED AND THE RELEGATED');
L('');
const proms = all.filter(c => c.firstUp != null);
if (proms.length) {
  const firstD1 = proms.map(c => {
    const h = c.history.find(x => x.div === 1 && x.yr >= c.firstUp);
    return h ? h.pos : null;
  }).filter(x => x != null);
  L('   promoted clubs, first season in Division One:');
  L('      median finish ' + (firstD1.length ? firstD1.slice().sort((a, b) => a - b)[Math.floor(firstD1.length / 2)] : '-')
    + '   relegated straight back: '
    + proms.filter(c => c.downs > 0).length + ' of ' + proms.length);
} else {
  L('   NO CLUB WAS EVER PROMOTED IN THIS RUN.');
}
const rels = all.filter(c => c.downs > 0);
L('   relegated clubs: ' + rels.length + ', of which ' + rels.filter(c => c.ups > 0).length
  + ' came back up at least once');
L('');
