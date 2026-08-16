// economy-longrun.mjs — THE LONG RUN: can clubs actually LIVE in this economy?
//
//   node tools/economy-longrun.mjs                          # 30 seasons, 8 countries, seeds 1..3
//   node tools/economy-longrun.mjs --seasons 40 --seeds 1,2,3,4,5
//   node tools/economy-longrun.mjs --dumb                   # bots with no money sense (the old AI)
//   node tools/economy-longrun.mjs --parachute 0.35         # one-season parachute experiment
//
// tools/economy-sim.mjs answers "does a season's baseline break even" - six
// seasons, no transfers, payrolls frozen. This bench answers the questions
// that only appear at thirty seasons with the market switched on:
//
//   WEALTH INFLATION / COLLAPSE   does the ecosystem's money run away in
//                                 either direction?
//   RICH-GET-RICHER               do the same clubs end up holding all of it?
//   RELEGATION TRAPS              is D1 -> D2 a shock or a death spiral?
//   BOT BANKRUPTCY                do AI clubs hit administration because
//                                 nothing tells them to trim payroll?
//   TRANSFER DISTORTION           does the market create, destroy or
//                                 concentrate money unexpectedly?
//
// HOW IT MEASURES - the same law as the calibration bench, taken further: it
// re-implements NOTHING it can import. The settlement is the real
// computeFinance walked over a fake pool; player values, fees, surplus and
// need, the bot's bid arithmetic and its money sense are the real exported
// functions from market.mjs and botfinance.mjs; founding squads and free
// agents are dealt by the real engine (makeHost -> genSquad), and ageing is
// the engine's own decline curve (host.ageDecline), wage riding the card.
//
// What IS synthetic, and why it is acceptable here:
//   - match RESULTS are seeded draws whose odds follow squadStrength (the
//     engine's own XI valuation) - the cricket itself is not replayed,
//     because thirty seasons of ball-by-ball would prove nothing extra
//     about money;
//   - the auction is settled in one step at the second price plus a lawful
//     raise, instead of iterating the open-outcry rounds - same winner,
//     within a step of the same fee;
//   - the market is NATIONAL (production also lets the world's eight
//     richest clubs read every board; that channel is small and excluded);
//   - fatigue is not modelled, so the nets run a shade warmer than a
//     played season's would - a few percent on the development rate,
//     nothing on the money's structure.
//
// The nets are REAL: every club trains every round through host.trainRound
// with the empty plan a bot files (the engine defaults every man to his
// trade's programme), at its academy's real rate - so squads develop, age,
// decline and retire on the shipped curves with wages riding the card, and
// retirees are replenished from the real free-agent distribution.
//
// THE SECOND SET OF FIGURES: WAGES AS A TRUE LEDGER. The walk charges wages
// "at the bill as it stands" - today's bill, applied to every round ever
// played. Over a six-season horizon that is the documented slight revision;
// over thirty seasons of bills that genuinely move it becomes a force of its
// own (a club whose payroll falls re-prices decades of history cheaper and
// its bank jumps; a club that improves is charged back-wages). So next to
// every walked bank this bench also reports the CORRECTED bank - the same
// walk with each season's wages frozen at the bill that season actually
// carried - which is what the economy DESIGN does, separated from what the
// settlement LAW compounds.
//
// DETERMINISM. Everything keys off (--seed, country index, season, round),
// through mulberry32 or the game's own seedOf. The same invocation prints
// the same world forever.
import { computeFinance, DEBT_LIMIT } from '../server/economy.mjs';
import { scheduleOf, CYCLE, ROUNDS, dayOfRound, seedOf } from '../server/clock.mjs';
import { MEDIA_SEASON, SPONSOR_PACKAGES } from '../server/financeconfig.mjs';
import {
  valueOf, surplusRank, botBid, bidStep, makeFreeAgent,
  MIN_BID_PCT, SQUAD_FLOOR, FREE_AGENT_SLOT
} from '../server/market.mjs';
import { botFinanceView, postureOf, ambitionOf, POSTURE_POLICY } from '../server/botfinance.mjs';
import { squadStrength } from '../server/ratings.mjs';
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs } from '../server/init-world.mjs';
import { RETIRE_AT } from '../server/youth.mjs';
import { academyRate } from '../server/living.mjs';
import { writeFileSync } from 'node:fs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const has = name => process.argv.indexOf('--' + name) >= 0;
const N_COUNTRIES = +arg('countries', 8);
const N_SEASONS = +arg('seasons', 30);
const SEEDS = String(arg('seeds', arg('seed', '1'))).split(',').map(Number);
const DUMB = has('dumb');                    // the pre-money-sense AI, for comparison
const OLDWAGES = has('oldwages');            // pre-101 law: every round at today's bill
const PARACHUTE = +arg('parachute', 0);      // share of the lost media difference, one season
const FA_PER_ROUND = 2;                      // the board's pulse, in round units
const QUIET = has('quiet');

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const q = (xs, p) => {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.max(0, Math.min(a.length - 1, Math.round(p * (a.length - 1))))];
};
const pct = x => (100 * x).toFixed(1) + '%';
const M = x => '$' + Math.round(x / 1000).toLocaleString('en-US') + 'k';
const Mm = x => '$' + (x / 1e6).toFixed(2) + 'm';
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

// the world's shape: ten of sixteen founding nations are full members
const FULL_RATIO = 10 / 16;
const tierOfSlot = (slot, full) => {
  let ix = slot === 0 ? 5 : slot <= 3 ? 4 : slot <= 7 ? 3 : slot <= 11 ? 2 : 1;
  if (!full) ix -= 1;
  return ['newcomer', 'd2b', 'd2a', 'd1b', 'd1a', 'flagship'][ix];
};

const host = makeHost();
const CFGS = countryConfigs(host);
const cfgOf = cid => CFGS.find(c => c.id === cid);

// ---------------------------------------------------------------------------
// ONE COUNTRY, THIRTY SUMMERS. Everything below is per (seed, country).
// ---------------------------------------------------------------------------
async function simCountry(seed, ix) {
  const full = ix < Math.round(N_COUNTRIES * FULL_RATIO);
  const cid = full ? 'eng' : 'ned';
  const cfg = cfgOf(cid);
  const r = rng(seed * 7919 + ix * 104729);
  const wageOf = c => (c.squad || []).reduce((s, p) => s + (p.wage || 0), 0);

  // the founding deal: real squads on the real tiers
  const clubs = [];
  for (let slot = 0; slot < 16; slot++) {
    const men = host.genSquad('lr' + seed + '|' + ix + '|' + slot, cfg.nat, 'rock', slot === 0 ? cfg.capt : 'general', 1, tierOfSlot(slot, full)) || [];
    clubs.push({
      slot, name: 'C' + ix + 'S' + slot, is_boss: slot === 0,
      squad: men, youth: [], academy: 2, academy_paid: 0, seats: null, seats_paid: 0,
      bankEst: 0, avgAtt: 0, supPrev: 0, sponsorPackage: 'balanced'
    });
  }

  let div1 = [0, 1, 2, 3, 4, 5, 6, 7], div2 = [8, 9, 10, 11, 12, 13, 14, 15];
  const seasons = [], matches = [], deals = [], picks = [], wageRounds = [];
  const events = [];                                  // relegations, promotions, per-season club rows
  let mid = 0, dealId = 0;
  let openListings = [];                              // {seller, man, ask, reserve, round}
  const totals = { faLeak: 0, parachute: 0, feesMoved: 0, salesN: 0 };

  // strength decides the odds, with a modest home edge and the odd washout
  const oddsWin = (h, a) => {
    const sh = squadStrength(clubs[h].squad) + 900;    // the home edge, in rating points
    const sa = squadStrength(clubs[a].squad);
    if (r() < 0.03) return null;
    const p = 1 / (1 + Math.pow(10, -(sh - sa) / 20000));
    return r() < p ? h : a;
  };

  const moneyOf = (c, div, roundsLeft) => {
    if (DUMB) return { posture: 'healthy', policy: POSTURE_POLICY.healthy, perRoundIncome: 0 };
    const view = botFinanceView({
      country: cid, slot: c.slot, isBoss: c.is_boss, div,
      bank: c.bankEst, wageBill: wageOf(c), seats: c.seats || undefined,
      academy: c.academy, avgAttendance: c.avgAtt, supporters: c.supPrev,
      sponsorPackage: c.sponsorPackage, roundsLeft, roundsTotal: ROUNDS
    });
    const posture = postureOf(view, ambitionOf(c.slot, c.is_boss));
    return { posture, policy: POSTURE_POLICY[posture], perRoundIncome: view.perRoundIncome, view };
  };

  for (let s = 1; s <= N_SEASONS; s++) {
    const startDay = 42 + (s - 1) * CYCLE;
    const divisions = { 1: div1.slice(), 2: div2.slice() };
    const divOfSlot = {}; div1.forEach(x => divOfSlot[x] = 1); div2.forEach(x => divOfSlot[x] = 2);
    const schedule = {
      1: scheduleOf(cid, s, divisions[1], 1),
      2: scheduleOf(cid, s, divisions[2], 2)
    };
    seasons.push({ season_no: s, start_day: startDay, divisions, schedule });
    const wins = Object.fromEntries(clubs.map(c => [c.slot, 0]));
    const pts = Object.fromEntries(clubs.map(c => [c.slot, 0]));
    const seasonDeals = Object.fromEntries(clubs.map(c => [c.slot, { soldN: 0, boughtN: 0, feesIn: 0, feesOut: 0 }]));

    for (let round = 1; round <= ROUNDS; round++) {
      const day = startDay + (dayOfRound(round) ?? (round - 1));

      // ---- the market, in round time -------------------------------------
      // 1. yesterday's board goes under the hammer
      const closing = openListings.filter(L => L.round < round);
      openListings = openListings.filter(L => L.round >= round);
      for (const L of closing) {
        const caps = [];
        for (const c of clubs) {
          if (c.slot === L.seller) continue;
          const money = moneyOf(c, divOfSlot[c.slot], ROUNDS - round + 1);
          const cap = botBid(
            { id: 'lr' + seed + '|' + ix + '|' + L.id, asking: L.ask, buyerKey: cid + ix + ':' + c.slot },
            c.squad, Math.max(0, c.bankEst), L.man, DUMB ? undefined : money);
          if (cap > 0) caps.push({ slot: c.slot, cap });
        }
        const live = caps.filter(b => b.cap >= L.reserve).sort((a, b) => b.cap - a.cap || a.slot - b.slot);
        if (!live.length) continue;                       // unsold; the man stays (or the FA walks off)
        const top = live[0], second = live[1];
        const floor = Math.round(L.ask * MIN_BID_PCT);
        const fee = Math.max(L.reserve, Math.min(top.cap,
          second ? second.cap + bidStep(second.cap) : floor));
        const buyer = clubs[top.slot];
        if (L.seller >= 0) {
          const sc = clubs[L.seller];
          const ixMan = sc.squad.findIndex(p => p && p.name === L.man.name);
          if (ixMan < 0 || sc.squad.length <= SQUAD_FLOOR) continue;
          sc.squad.splice(ixMan, 1);
          sc.bankEst += fee;
          seasonDeals[L.seller].soldN++; seasonDeals[L.seller].feesIn += fee;
        } else {
          totals.faLeak += fee;                           // a free agent's fee leaves the ecosystem
        }
        if (buyer.squad.some(p => p.name === L.man.name)) continue;   // a name collision: no doubles
        buyer.squad.push(JSON.parse(JSON.stringify(L.man)));
        buyer.bankEst -= fee;
        seasonDeals[top.slot].boughtN++; seasonDeals[top.slot].feesOut += fee;
        totals.feesMoved += fee; totals.salesN++;
        deals.push({ settled_day: day, s_country: L.seller >= 0 ? cid : cid, s_slot: L.seller,
                     b_country: cid, b_slot: top.slot, fee, id: dealId++ });
      }
      // 2. free agents walk on (the real generator, the world's own mix)
      for (let k = 0; k < FA_PER_ROUND; k++) {
        const man = makeFreeAgent(host, cfg, 'lrfa|' + seed + '|' + ix + '|s' + s + '|r' + round + '|' + k);
        if (!man) continue;
        if (clubs.some(c => c.squad.some(p => p.name === man.name))) continue;
        const ask = valueOf(man);
        openListings.push({ id: 'fa' + s + ':' + round + ':' + k, seller: FREE_AGENT_SLOT,
          man, ask, reserve: Math.round(ask * 0.7), round });
      }
      // 3. bot clubs shed, on their posture's coin (the market's own seed law)
      for (const c of clubs) {
        if (c.squad.length <= SQUAD_FLOOR) continue;
        const money = moneyOf(c, divOfSlot[c.slot], ROUNDS - round + 1);
        const policy = money.policy;
        const flip = seedOf('lrlist|' + seed + '|' + ix + '|' + c.slot + '|s' + s + '|r' + round) / 4294967296;
        if (flip > policy.sell) continue;
        if (openListings.filter(L => L.seller === c.slot).length >= policy.listings) continue;
        const cand = surplusRank(c.squad)[0];
        if (!cand) continue;
        if (openListings.some(L => L.seller === c.slot && L.man.name === cand.p.name)) continue;
        const ask = valueOf(cand.p);
        openListings.push({ id: 'cl' + s + ':' + round + ':' + c.slot, seller: c.slot,
          man: cand.p, ask, reserve: Math.round(ask * policy.reserve), round });
      }

      // ---- the cricket ---------------------------------------------------
      for (const dv of [1, 2]) {
        for (const [h, a] of schedule[dv][round - 1]) {
          const w = oddsWin(h, a);
          if (w != null) { wins[w]++; pts[w] += 2; } else { pts[h]++; pts[a]++; }
          matches.push({
            id: 'm' + mid, seed: (mid++ * 2654435761) >>> 0,
            season_no: s, round, home_slot: h, away_slot: a,
            home_name: clubs[h].name, away_name: clubs[a].name,
            winner: w == null ? null : clubs[w].name
          });
        }
      }
      // the nets: the empty plan every bot files, at the club's academy rate
      // - the engine trains each man on his trade's default programme, and
      // jsDerive keeps rating and wage riding the card
      for (const c of clubs) {
        try {
          const worked = host.trainRound(c.squad, {}, academyRate(c.academy), null);
          if (worked && Array.isArray(worked.players)) c.squad = worked.players;
        } catch (e) { /* a squad the nets cannot read trains nothing */ }
      }
      // the umpire banks the bill each round was played under (migration
      // 101); --oldwages leaves the table empty, which IS the pre-101 law
      if (!OLDWAGES) {
        for (const c of clubs) {
          wageRounds.push({ season_no: s, round, slot: c.slot, bill: wageOf(c) });
        }
      }
      // the recurring drift on the estimated bank, so mid-season bids answer
      // to roughly the money the walk will settle
      for (const c of clubs) {
        const v = botFinanceView({
          country: cid, slot: c.slot, isBoss: c.is_boss, div: divOfSlot[c.slot],
          bank: 0, wageBill: wageOf(c), seats: c.seats || undefined, academy: c.academy,
          avgAttendance: c.avgAtt, supporters: c.supPrev,
          sponsorPackage: c.sponsorPackage, roundsLeft: 1, roundsTotal: ROUNDS
        });
        c.bankEst += v.perRoundOp;
      }
    }

    // ---- the playoffs ----------------------------------------------------
    const table = dv => (dv === 1 ? div1 : div2).slice().sort((x, y) => pts[y] - pts[x] || x - y);
    const champs = {};
    for (const dv of [1, 2]) {
      const top = table(dv).slice(0, 4);
      const semi = [[top[0], top[3]], [top[1], top[2]]];
      const winners = semi.map(([h, a]) => {
        const w = oddsWin(h, a) ?? h;
        matches.push({ id: 'm' + mid, seed: (mid++ * 2654435761) >>> 0, season_no: s, round: 15,
          home_slot: h, away_slot: a, home_name: clubs[h].name, away_name: clubs[a].name, winner: clubs[w].name });
        return w;
      });
      const w = oddsWin(winners[0], winners[1]) ?? winners[0];
      matches.push({ id: 'm' + mid, seed: (mid++ * 2654435761) >>> 0, season_no: s, round: 16,
        home_slot: winners[0], away_slot: winners[1], home_name: clubs[winners[0]].name,
        away_name: clubs[winners[1]].name, winner: clubs[w].name });
      champs[dv] = { champ: w, finalist: winners[0] === w ? winners[1] : winners[0] };
    }

    // ---- the walk: the REAL books, from genesis --------------------------
    const world = { clubs, seasons, matches, deals, picks, wageRounds };
    const finRows = await walk(world, cid, s);
    events.push({
      season: s, div1: div1.slice(), div2: div2.slice(),
      table1: table(1), table2: table(2), wins: { ...wins }, champs,
      clubs: finRows.map(row => {
        const c = clubs[row.slot], f = row.finance;
        // sync the estimator to the settled truth, and remember the crowd
        c.bankEst = row.bank;
        c.avgAtt = f.avgAttendance || 0;
        c.supPrev = f.supporters || 0;
        return {
          slot: row.slot, div: divOfSlot[row.slot],
          pos: (divOfSlot[row.slot] === 1 ? table(1) : table(2)).indexOf(row.slot) + 1,
          bank: row.bank, bill: wageOf(c), strength: squadStrength(c.squad),
          squadN: c.squad.length, admin: !!f.administration, roundsCum: f.rounds,
          cum: { gate: f.gate, media: f.media, sponsor: f.sponsor + f.sponsorBonus, prize: f.prize,
                 wages: f.wages, ops: f.ops, upkeep: f.upkeep, interest: f.interest,
                 writtenOff: f.writtenOff, feesIn: f.feesIn, feesOut: f.feesOut },
          ...seasonDeals[row.slot],
          posture: DUMB ? 'dumb' : moneyOf(c, divOfSlot[row.slot], null).posture
        };
      })
    });

    // ---- the turning of the year -----------------------------------------
    const down = table(1).slice(-2);
    const t2 = table(2), shield = t2[0];
    let up2 = champs[2].champ === shield ? champs[2].finalist : champs[2].champ;
    if (up2 === shield) up2 = t2[1];
    const up = [shield, up2];
    div1 = div1.filter(x => !down.includes(x)).concat(up).sort((a, b) => a - b);
    div2 = div2.filter(x => !up.includes(x)).concat(down).sort((a, b) => a - b);
    events[events.length - 1].relegated = down.slice();
    events[events.length - 1].promoted = up.slice();

    // the parachute experiment: one season's cheque, a share of the media
    // money relegation takes away, injected as a non-transfer credit
    if (PARACHUTE > 0 && s < N_SEASONS) {
      const natF = full ? 1 : 0.70;
      const cheque = Math.round(PARACHUTE * (MEDIA_SEASON[1] - MEDIA_SEASON[2]) * natF);
      for (const slot of down) {
        deals.push({ settled_day: startDay + CYCLE + 1, s_country: cid, s_slot: slot,
                     b_country: 'void', b_slot: 0, fee: cheque, id: dealId++ });
        clubs[slot].bankEst += cheque;
        totals.parachute += cheque;
      }
    }

    // ageing: a year on every man, the engine's own decline, the oldest retire
    for (const c of clubs) {
      let squad = c.squad.map(p => ({ ...p, age: (p.age || 27) + 1 }));
      squad = squad.filter(p => p.age < RETIRE_AT);
      if (squad.length) {
        try {
          const agedMen = host.ageDecline(squad);
          squad.forEach((p, i2) => {
            const q2 = agedMen[i2]; if (!q2 || !q2.skills) return;
            for (const k in q2.skills) if (typeof q2.skills[k] === 'number') p.skills[k] = q2.skills[k];
            ['bat', 'power', 'rotation', 'temperament', 'vsPace', 'vsSpin', 'threat',
             'control', 'bowl', 'field', 'keeping', 'rating', 'wage'
            ].forEach(k => { if (typeof q2[k] === 'number' && isFinite(q2[k])) p[k] = q2[k]; });
          });
        } catch (e) { /* a squad the curve cannot read ages without declining */ }
      }
      c.squad = squad;
    }
    // the board between summers: stale listings die with the season
    openListings = [];
  }
  return { cid, full, ix, clubs, events, totals };
}

// the real settlement, over a fake pool that answers the walk's own queries
function walk(world, cid, uptoSeason) {
  const ms = world.matches.filter(m => m.season_no <= uptoSeason)
    .sort((a, b) => a.season_no - b.season_no || a.round - b.round || a.home_slot - b.home_slot);
  const soldRows = world.deals.map(d => ({
    settled_day: d.settled_day, s_country: d.s_country, s_slot: d.s_slot,
    b_country: d.b_country, b_slot: d.b_slot, fee: d.fee
  }));
  const pool = {
    query(sql) {
      if (/FROM clubs/.test(sql)) return { rows: world.clubs };
      if (/FROM matches/.test(sql)) return { rows: ms };
      if (/FROM callups/.test(sql)) return { rows: [] };
      if (/FROM ticket_prices/.test(sql)) return { rows: [] };
      if (/FROM listings/.test(sql)) return { rows: soldRows };
      if (/FROM scouted/.test(sql)) return { rows: [] };
      if (/FROM academy_spend/.test(sql)) return { rows: [] };
      if (/FROM cup_matches/.test(sql)) return { rows: [] };
      if (/FROM seasons/.test(sql)) return { rows: world.seasons.filter(s2 => s2.season_no <= uptoSeason) };
      if (/FROM sponsor_picks/.test(sql)) return { rows: world.picks };
      if (/FROM wage_rounds/.test(sql)) return { rows: world.wageRounds.filter(w => w.season_no <= uptoSeason) };
      throw new Error('the bench does not know this query: ' + sql.slice(0, 80));
    }
  };
  const endMs = Date.UTC(2026, 7, 3) + (42 + uptoSeason * CYCLE) * 86400000;
  return computeFinance(pool, cid, { now: endMs });     // async: await at the call site
}

// ---------------------------------------------------------------------------
// THE RUN, AND WHAT IT PRINTS.
// ---------------------------------------------------------------------------
async function main() {
  const perSeason = [];        // [season-1] -> array of club rows across all seeds/countries
  const cohorts = [];          // relegation cohorts: {seed, ix, slot, season, path: [...5 rows]}
  const allTotals = [];
  const persistence = [];      // D1 membership overlap, first vs last quarter

  for (const seed of SEEDS) {
    for (let ix = 0; ix < N_COUNTRIES; ix++) {
      const sim = await simCountry(seed, ix);
      // WAGES AS A TRUE LEDGER, walked per club: each season's rounds charged
      // at the bill that season actually carried. correctedBank strips the
      // walk's retroactive restatement out of the settled figure.
      const trueWages = {};                // slot -> running Σ bill_s × rounds_s
      const prevRounds = {};
      for (const e of sim.events) {
        for (const c of e.clubs) {
          const dR = (c.roundsCum || 0) - (prevRounds[c.slot] || 0);
          trueWages[c.slot] = (trueWages[c.slot] || 0) + c.bill * dR;
          prevRounds[c.slot] = c.roundsCum || 0;
          c.trueWageSeason = c.bill * dR;
          c.correctedBank = c.bank + (c.cum.wages - trueWages[c.slot]);
        }
      }
      for (const e of sim.events) {
        (perSeason[e.season - 1] = perSeason[e.season - 1] || []).push(
          ...e.clubs.map(c => ({ ...c, seed, ix, full: sim.full, season: e.season })));
      }
      // relegation cohorts: follow each relegated club five seasons
      for (const e of sim.events) {
        if (!e.relegated || e.season + 1 > sim.events.length) continue;
        for (const slot of e.relegated) {
          const path = [];
          for (let k = 1; k <= 5 && e.season + k <= sim.events.length; k++) {
            const later = sim.events[e.season + k - 1];
            const row = later.clubs.find(c => c.slot === slot);
            path.push({
              k, div: later.div1.includes(slot) ? 1 : 2,
              bank: row.bank, correctedBank: row.correctedBank,
              bill: row.bill, strength: row.strength,
              admin: row.admin, soldN: row.soldN, boughtN: row.boughtN,
              feesIn: row.feesIn, feesOut: row.feesOut, posture: row.posture
            });
          }
          if (path.length) cohorts.push({ seed, ix, slot, season: e.season, path });
        }
      }
      allTotals.push(sim.totals);
      const firstQ = new Set(sim.events[Math.min(4, sim.events.length - 1)].div1);
      const lastD1 = sim.events[sim.events.length - 1].div1;
      persistence.push(lastD1.filter(x => firstQ.has(x)).length / 8);
    }
  }

  const label = (DUMB ? 'DUMB BOTS' : 'MONEY-SENSE BOTS')
    + (OLDWAGES ? ' + PRE-101 WAGE LAW' : ' + banked wage rounds (101)')
    + (PARACHUTE ? ' + parachute ' + pct(PARACHUTE) : '');
  console.log('=== LONG-RUN ECONOMY BENCH ===', label);
  console.log(N_COUNTRIES + ' countries x ' + N_SEASONS + ' seasons x seeds [' + SEEDS.join(',') + ']');

  console.log('\n--- treasury by season (all clubs, all seeds) ---');
  console.log('walked = the settled figure (wages restated at today\'s bill, production\'s law);');
  console.log('true-ledger = the same walk with each season\'s wages frozen at its own bill');
  console.log('(approximate: the interest/write-off cascade is not re-walked).');
  console.log('season'.padEnd(7),
    'walked p25'.padStart(11), 'med'.padStart(9), 'p75'.padStart(10), 'total'.padStart(10),
    '| true p25'.padStart(11), 'med'.padStart(9), 'p75'.padStart(10), 'total'.padStart(10),
    'admin'.padStart(6), 'crit'.padStart(5));
  const step = N_SEASONS <= 12 ? 1 : Math.ceil(N_SEASONS / 15);
  const perCountry = xs => xs.reduce((a, b) => a + b, 0) / (SEEDS.length * N_COUNTRIES);
  for (let s = 0; s < perSeason.length; s++) {
    if (s % step && s !== perSeason.length - 1) continue;
    const g = perSeason[s], banks = g.map(c => c.bank), corr = g.map(c => c.correctedBank);
    console.log(String(s + 1).padEnd(7),
      M(q(banks, 0.25)).padStart(11), M(q(banks, 0.5)).padStart(9), M(q(banks, 0.75)).padStart(10),
      Mm(perCountry(banks)).padStart(10),
      M(q(corr, 0.25)).padStart(11), M(q(corr, 0.5)).padStart(9), M(q(corr, 0.75)).padStart(10),
      Mm(perCountry(corr)).padStart(10),
      String(g.filter(c => c.admin).length).padStart(6),
      String(g.filter(c => c.posture === 'critical').length).padStart(5));
  }

  console.log('\n--- season-on-season operating result (true-ledger wages, seasons 2+) ---');
  const opRows = [];
  for (let s = 1; s < perSeason.length; s++) {
    for (const c of perSeason[s]) {
      const p0 = perSeason[s - 1].find(x => x.seed === c.seed && x.ix === c.ix && x.slot === c.slot);
      if (!p0) continue;
      const d = k => (c.cum[k] || 0) - (p0.cum[k] || 0);
      const rev = d('gate') + d('media') + d('sponsor') + d('prize');
      // wages at the bill THIS season carried - the walk's cumulative delta
      // would smuggle the whole history's restatement into one season
      const exp = c.trueWageSeason + d('ops') + d('upkeep') + d('interest');
      opRows.push({ season: c.season, div: c.div, margin: rev ? (rev - exp) / rev : 0,
        wageShare: rev ? c.trueWageSeason / rev : 0, rev, op: rev - exp,
        transfersNet: d('feesIn') - d('feesOut'), c });
    }
  }
  const line = (lbl, xs, fmt = M) => console.log(lbl.padEnd(30),
    'p5', fmt(q(xs, 0.05)).padStart(10), 'p25', fmt(q(xs, 0.25)).padStart(10),
    'med', fmt(q(xs, 0.5)).padStart(10), 'p75', fmt(q(xs, 0.75)).padStart(10),
    'p95', fmt(q(xs, 0.95)).padStart(10));
  line('operating margin', opRows.map(x => x.margin), pct);
  line('wage share of revenue', opRows.map(x => x.wageShare), pct);
  line('net transfer flow / season', opRows.map(x => x.transfersNet));
  for (const dv of [1, 2]) {
    const g = opRows.filter(x => x.div === dv);
    console.log('  div ' + dv.toString().padEnd(26),
      'margin med', pct(q(g.map(x => x.margin), 0.5)).padStart(7),
      '| wages/rev med', pct(q(g.map(x => x.wageShare), 0.5)).padStart(7),
      '| net transfers med', M(q(g.map(x => x.transfersNet), 0.5)).padStart(9));
  }

  console.log('\n--- the whole-run flows (per country, averaged) ---');
  const n = allTotals.length;
  console.log('transfer fees moved between clubs', Mm(allTotals.reduce((a, t) => a + t.feesMoved, 0) / n),
    'across', Math.round(allTotals.reduce((a, t) => a + t.salesN, 0) / n), 'sales');
  console.log('paid out of the world for free agents', Mm(allTotals.reduce((a, t) => a + t.faLeak, 0) / n));
  if (PARACHUTE) console.log('parachute money injected', Mm(allTotals.reduce((a, t) => a + t.parachute, 0) / n));

  console.log('\n--- concentration and mobility ---');
  const last = perSeason[perSeason.length - 1];
  const bySeedCountry = {};
  last.forEach(c => (bySeedCountry[c.seed + ':' + c.ix] = bySeedCountry[c.seed + ':' + c.ix] || []).push(c));
  const topShare = Object.values(bySeedCountry).map(g => {
    const pos = g.map(c => Math.max(0, c.bank)), tot = pos.reduce((a, b) => a + b, 0) || 1;
    return pos.sort((a, b) => b - a).slice(0, 4).reduce((a, b) => a + b, 0) / tot;
  });
  console.log('final-season share of positive cash held by top 4 of 16:',
    'med', pct(q(topShare, 0.5)), ' p95', pct(q(topShare, 0.95)));
  console.log('D1 members still in D1 from season 5 to season ' + N_SEASONS + ':',
    'mean', pct(mean(persistence)));
  const strengths = last.map(c => c.strength);
  console.log('final-season XI strength: ', 'p5', q(strengths, 0.05), 'med', q(strengths, 0.5), 'p95', q(strengths, 0.95));
  const s1 = perSeason[0].map(c => c.strength);
  console.log('first-season  XI strength: ', 'p5', q(s1, 0.05), 'med', q(s1, 0.5), 'p95', q(s1, 0.95));

  console.log('\n--- relegation cohorts (' + cohorts.length + ' relegations followed up to 5 seasons) ---');
  for (let k = 1; k <= 5; k++) {
    const g = cohorts.map(c => c.path[k - 1]).filter(Boolean);
    if (!g.length) continue;
    console.log('  +' + k + ':',
      'backInD1', pct(g.filter(x => x.div === 1).length / g.length).padStart(6),
      '| true bank med', M(q(g.map(x => x.correctedBank), 0.5)).padStart(9),
      '/ p5', M(q(g.map(x => x.correctedBank), 0.05)).padStart(9),
      '| bill med', M(q(g.map(x => x.bill), 0.5)).padStart(8),
      '| XI med', String(q(g.map(x => x.strength), 0.5)).padStart(6),
      '| admin', pct(g.filter(x => x.admin).length / g.length).padStart(6),
      '| selling', (mean(g.map(x => x.soldN))).toFixed(1) + '/yr');
  }
  const everBack = cohorts.filter(c => c.path.some(x => x.div === 1)).length;
  const everAdmin = cohorts.filter(c => c.path.some(x => x.admin)).length;
  console.log('  within 5 seasons: back in D1 at least once', pct(everBack / (cohorts.length || 1)),
    '| touched administration', pct(everAdmin / (cohorts.length || 1)));

  // the raw rows, for questions this printout did not anticipate
  const dump = arg('dump', null);
  if (dump) {
    writeFileSync(dump, JSON.stringify({
      label, seeds: SEEDS, countries: N_COUNTRIES, seasons: N_SEASONS,
      perSeason: perSeason.map(g => g.map(c => ({
        seed: c.seed, ix: c.ix, slot: c.slot, season: c.season, div: c.div, pos: c.pos,
        bank: c.bank, correctedBank: c.correctedBank, bill: c.bill,
        strength: c.strength, squadN: c.squadN, admin: c.admin, posture: c.posture,
        soldN: c.soldN, boughtN: c.boughtN, feesIn: c.feesIn, feesOut: c.feesOut
      }))),
      cohorts
    }));
    console.log('\nrows dumped to ' + dump);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
