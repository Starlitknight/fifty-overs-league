// economy-sim.mjs — THE CALIBRATION BENCH FOR THE ERA-2 ECONOMY.
//
//   node tools/economy-sim.mjs             # the standard bench: ~1,900 club-seasons
//   node tools/economy-sim.mjs --seasons 8 --countries 32
//
// Every constant in server/financeconfig.mjs was tuned against what this
// prints, and the claim it defends is the one the redesign was ordered to:
// a sensibly managed mid-table club roughly breaks even over a season BEFORE
// selling anybody, wages are about half of revenue, and the income mix is
// roughly 35% media / ~32% matchday / ~25% sponsor / ~8% prize.
//
// HOW IT MEASURES. It does not re-implement the economy - re-implementations
// drift, and a bench that drifts calibrates nothing. It builds a synthetic
// world in memory (clubs whose wage bills follow the tiers the generator
// actually deals, real schedules out of clock.mjs, seeded results whose odds
// follow payroll) and hands it to THE REAL computeFinance through a fake
// pool that answers its queries. The dollars below are the settlement code's
// own dollars, walked round by round like production walks them.
//
// DETERMINISM. One seed drives everything (mulberry32); the same invocation
// prints the same table forever. No transfers happen in here on purpose -
// the brief is that the BASELINE economy works without selling anybody, so
// the bench measures exactly that baseline.
import { computeFinance } from '../server/economy.mjs';
import { scheduleOf, CYCLE, ROUNDS } from '../server/clock.mjs';
import {
  SPONSOR_PACKAGES, SPONSOR_SEASON, sponsorSeasonValue, sponsorWinBonus
} from '../server/financeconfig.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? +process.argv[i + 1] : dflt;
};
const N_COUNTRIES = arg('countries', 24);
const N_SEASONS = arg('seasons', 5);
const SEED = arg('seed', 2026);

// mulberry32 — the same tiny deterministic generator the tools already use
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// THE DEALT WORLD'S PAYROLLS, per round, as measured across a founded world
// (docs/b2-evidence/economy-audit.txt): the flagship, the rest of Division
// One in two bands, Division Two in two. The bench samples around them so a
// world of 24 countries is not 24 copies of one country.
// ---------------------------------------------------------------------------
const TIER_BILL = [449000, 357000, 283000, 177000, 91000];  // flagship, d1a, d1b, d2a, d2b
const tierOfSlot = s => s === 0 ? 0 : s <= 3 ? 1 : s <= 7 ? 2 : s <= 11 ? 3 : 4;
// ten of the world's sixteen founding nations are full members; the bench
// keeps that ratio so the associate factor is measured, not assumed
const FULL_RATIO = 10 / 16;

function buildCountry(ix) {
  const r = rng(SEED * 7919 + ix * 104729);
  const full = ix < Math.round(N_COUNTRIES * FULL_RATIO);
  // associates' payrolls measure at ~0.67 of a member's (the generator deals
  // them one tier weaker)
  const natWage = full ? 1 : 0.67;
  const id = (full ? 'eng' : 'ned') + (ix === 0 ? '' : '_sim' + ix);   // isFullMember reads the prefix... no - see below
  return { ix, r, full, natWage };
}

// isFullMember() keys on real country ids, so the bench uses two real ids -
// one member, one associate - and keeps its 24 countries apart by seed alone.
const countryId = full => full ? 'eng' : 'ned';

function simCountry(ix) {
  const C = buildCountry(ix);
  const r = C.r;
  const clubs = [];
  for (let slot = 0; slot < 16; slot++) {
    const bill = Math.round(TIER_BILL[tierOfSlot(slot)] * C.natWage * (0.85 + 0.30 * r()));
    clubs.push({
      slot, name: 'C' + ix + 'S' + slot, is_boss: slot === 0,
      // computeFinance only ever sums squad[].wage - one line is a payroll
      squad: [{ wage: bill }], youth: [],
      academy: r() < 0.15 ? 3 : 2, academy_paid: 0,
      seats: null, seats_paid: 0, bill
    });
  }
  // seasonal division membership, redrawn by promotion and relegation
  let div1 = [0, 1, 2, 3, 4, 5, 6, 7], div2 = [8, 9, 10, 11, 12, 13, 14, 15];
  const seasons = [], matches = [], picks = [];
  const perSeason = [];                    // ix -> per-club outcome bookkeeping
  let mid = 0;
  const winnerOf = (h, a, round) => {
    // odds follow payroll, with a modest home edge and the odd washout -
    // close to the engine's own strength response, near enough for money
    const wh = clubs[h].bill * 1.12, wa = clubs[a].bill;
    if (r() < 0.03) return null;
    return r() < wh / (wh + wa) ? h : a;
  };
  for (let s = 1; s <= N_SEASONS; s++) {
    const startDay = 42 + (s - 1) * CYCLE;             // era 2 from the first ball
    const divisions = { 1: div1.slice(), 2: div2.slice() };
    const schedule = {
      1: scheduleOf(countryId(C.full), s, divisions[1], 1),
      2: scheduleOf(countryId(C.full), s, divisions[2], 2)
    };
    seasons.push({ season_no: s, start_day: startDay, divisions, schedule });
    const wins = Object.fromEntries(clubs.map(c => [c.slot, 0]));
    const pts = Object.fromEntries(clubs.map(c => [c.slot, 0]));
    for (let round = 1; round <= ROUNDS; round++) {
      for (const dv of [1, 2]) {
        for (const [h, a] of schedule[dv][round - 1]) {
          const w = winnerOf(h, a, round);
          if (w != null) { wins[w]++; pts[w] += 2; }
          else { pts[h]++; pts[a]++; }
          matches.push({
            id: 'm' + mid, seed: (mid++ * 2654435761) >>> 0,
            season_no: s, round, home_slot: h, away_slot: a,
            home_name: clubs[h].name, away_name: clubs[a].name,
            winner: w == null ? null : clubs[w].name
          });
        }
      }
    }
    // the top four of each division play off; the final crowns the champion
    const table = dv => (dv === 1 ? div1 : div2).slice()
      .sort((x, y) => pts[y] - pts[x] || x - y);
    const champs = {};
    for (const dv of [1, 2]) {
      const top = table(dv).slice(0, 4);
      const semi = [[top[0], top[3]], [top[1], top[2]]];
      const winners = semi.map(([h, a], i) => {
        const w = winnerOf(h, a, 15) ?? h;         // a washed-out semi goes to the table
        matches.push({
          id: 'm' + mid, seed: (mid++ * 2654435761) >>> 0,
          season_no: s, round: 15, home_slot: h, away_slot: a,
          home_name: clubs[h].name, away_name: clubs[a].name, winner: clubs[w].name
        });
        return w;
      });
      const w = winnerOf(winners[0], winners[1], 16) ?? winners[0];
      matches.push({
        id: 'm' + mid, seed: (mid++ * 2654435761) >>> 0,
        season_no: s, round: 16, home_slot: winners[0], away_slot: winners[1],
        home_name: clubs[winners[0]].name, away_name: clubs[winners[1]].name, winner: clubs[w].name
      });
      champs[dv] = { champ: w, finalist: winners[0] === w ? winners[1] : winners[0] };
    }
    perSeason.push({
      season: s, wins: { ...wins }, pts: { ...pts },
      div1: div1.slice(), div2: div2.slice(),
      table1: table(1), table2: table(2), champs
    });
    // promotion and relegation, the tick's own rule: shield winner and playoff
    // champion up, bottom two down, beaten finalist stepping in on a double
    const down = table(1).slice(-2);
    const t2 = table(2), shield = t2[0];
    let up2 = champs[2].champ === shield ? champs[2].finalist : champs[2].champ;
    if (up2 === shield) up2 = t2[1];
    const up = [shield, up2];
    div1 = div1.filter(x => !down.includes(x)).concat(up);
    div2 = div2.filter(x => !up.includes(x)).concat(down);
  }
  return { C, clubs, seasons, matches, picks, perSeason };
}

// ---------------------------------------------------------------------------
// THE FAKE POOL. Answers exactly the queries computeFinance asks, from the
// fixtures above; anything unexpected throws, so a new query in the walk
// fails the bench loudly instead of silently returning nothing.
// ---------------------------------------------------------------------------
function poolFor(world, uptoSeason) {
  const ms = world.matches.filter(m => m.season_no <= uptoSeason)
    .sort((a, b) => a.season_no - b.season_no || a.round - b.round || a.home_slot - b.home_slot);
  return {
    query(sql) {
      if (/FROM clubs/.test(sql)) return { rows: world.clubs };
      if (/FROM matches/.test(sql)) return { rows: ms };
      if (/FROM callups/.test(sql)) return { rows: [] };
      if (/FROM ticket_prices/.test(sql)) return { rows: [] };
      if (/FROM listings/.test(sql)) return { rows: [] };
      if (/FROM scouted/.test(sql)) return { rows: [] };
      if (/FROM academy_spend/.test(sql)) return { rows: [] };
      if (/FROM cup_matches/.test(sql)) return { rows: [] };
      if (/FROM seasons/.test(sql)) return { rows: world.seasons.filter(s => s.season_no <= uptoSeason) };
      if (/FROM sponsor_picks/.test(sql)) return { rows: world.picks };
      // no banked bills: the bench's payrolls are frozen, so the pre-101 and
      // post-101 laws charge the identical dollar
      if (/FROM wage_rounds/.test(sql)) return { rows: [] };
      throw new Error('the bench does not know this query: ' + sql.slice(0, 80));
    }
  };
}

const q = (xs, p) => {
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.max(0, Math.min(a.length - 1, Math.round(p * (a.length - 1))))];
};
const pct = x => (100 * x).toFixed(1) + '%';
const M = x => '$' + Math.round(x).toLocaleString('en-US');

async function main() {
  const rows = [];          // one row per club-season
  const banks = [];         // [seasonIx][clubKey] -> bank
  for (let ix = 0; ix < N_COUNTRIES; ix++) {
    const world = simCountry(ix);
    const cid = countryId(world.C.full);
    let prev = null;
    for (let s = 1; s <= N_SEASONS; s++) {
      const endMs = 42 + s * CYCLE;   // just past the season's last day
      const out = await computeFinance(poolFor(world, s), cid,
        { now: Date.UTC(2026, 7, 3) + endMs * 86400000 });
      const ps = world.perSeason[s - 1];
      for (const rrow of out) {
        const f = rrow.finance, slot = rrow.slot;
        const p0 = prev ? prev.find(x => x.slot === slot).finance : null;
        const d = k => (f[k] || 0) - ((p0 && p0[k]) || 0);
        const div = ps.div1.includes(slot) ? 1 : 2;
        const revenue = d('gate') + d('media') + d('sponsor') + d('sponsorBonus')
          + d('prize') + d('compensation');
        const expense = d('wages') + d('ops') + d('upkeep') + d('interest');
        const posInDiv = (div === 1 ? ps.table1 : ps.table2).indexOf(slot) + 1;
        rows.push({
          ix, slot, season: s, div, tier: tierOfSlot(slot),
          full: world.C.full, bill: world.clubs[slot].bill,
          academy: world.clubs[slot].academy,
          revenue, expense, op: revenue - expense,
          margin: revenue ? (revenue - expense) / revenue : 0,
          gate: d('gate'), media: d('media'),
          sponsor: d('sponsor') + d('sponsorBonus'), prize: d('prize'),
          wages: d('wages'), ops: d('ops'), upkeep: d('upkeep'), interest: d('interest'),
          wageShare: revenue ? d('wages') / revenue : 0,
          bank: rrow.bank, wins: ps.wins[slot], posInDiv,
          playoff: posInDiv <= 4,
          title: ps.champs[div].champ === slot,
          admin: f.administration
        });
        (banks[s - 1] = banks[s - 1] || []).push(rrow.bank);
      }
      prev = out.map(x => ({ slot: x.slot, finance: x.finance }));
    }
  }

  // ---- the headline distributions ------------------------------------------
  const seasoned = rows.filter(r => r.season >= 2);       // season 1 has founding noise in support
  const line = (label, xs, fmt = M) => console.log(
    label.padEnd(34),
    'p5', fmt(q(xs, 0.05)).padStart(12), 'p25', fmt(q(xs, 0.25)).padStart(12),
    'med', fmt(q(xs, 0.5)).padStart(12), 'p75', fmt(q(xs, 0.75)).padStart(12),
    'p95', fmt(q(xs, 0.95)).padStart(12));

  console.log('=== ERA-2 ECONOMY BENCH ===',
    N_COUNTRIES + ' countries x ' + N_SEASONS + ' seasons =', rows.length, 'club-seasons, seed', SEED);
  console.log('\n--- per club-season (seasons 2+) ---');
  line('operating profit', seasoned.map(r => r.op));
  line('operating margin', seasoned.map(r => r.margin), pct);
  line('revenue', seasoned.map(r => r.revenue));
  line('wage share of revenue', seasoned.map(r => r.wageShare), pct);
  line('ending bank', seasoned.map(r => r.bank));

  console.log('\n--- the income mix (median club-season, seasons 2+) ---');
  const mix = k => pct(q(seasoned.map(r => r.revenue ? r[k] / r.revenue : 0), 0.5));
  console.log('matchday', mix('gate'), '| media', mix('media'), '| sponsor', mix('sponsor'),
    '| prize', mix('prize'));

  console.log('\n--- by tier (median margin / wage share / revenue, seasons 2+) ---');
  const TIER_NAME = ['flagship', 'd1a', 'd1b', 'd2a', 'd2b'];
  for (let t = 0; t < 5; t++) {
    const g = seasoned.filter(r => r.tier === t);
    if (!g.length) continue;
    console.log(TIER_NAME[t].padEnd(9), 'margin', pct(q(g.map(r => r.margin), 0.5)).padStart(7),
      '| wages/rev', pct(q(g.map(r => r.wageShare), 0.5)).padStart(7),
      '| revenue', M(q(g.map(r => r.revenue), 0.5)).padStart(12),
      '| in div1', pct(g.filter(r => r.div === 1).length / g.length).padStart(6));
  }
  console.log('\n--- by division (median, seasons 2+) ---');
  for (const dv of [1, 2]) {
    const g = seasoned.filter(r => r.div === dv && r.full);
    console.log('div ' + dv + ' (members)  ', 'margin', pct(q(g.map(r => r.margin), 0.5)).padStart(7),
      '| wages/rev', pct(q(g.map(r => r.wageShare), 0.5)).padStart(7),
      '| revenue', M(q(g.map(r => r.revenue), 0.5)).padStart(12));
    const ga = seasoned.filter(r => r.div === dv && !r.full);
    if (ga.length) console.log('div ' + dv + ' (associates)',
      'margin', pct(q(ga.map(r => r.margin), 0.5)).padStart(7),
      '| wages/rev', pct(q(ga.map(r => r.wageShare), 0.5)).padStart(7),
      '| revenue', M(q(ga.map(r => r.revenue), 0.5)).padStart(12));
  }

  console.log('\n--- cash over the years (bank percentiles by season) ---');
  banks.forEach((bs, i) => line('after season ' + (i + 1), bs));
  const admins = rows.filter(r => r.admin).length;
  console.log('\nclub-seasons ending in administration:', admins, 'of', rows.length);

  // ---- the sponsor table: what each shape pays each kind of side -----------
  // computed from the SAME simulated outcomes, pure arithmetic on the record:
  // guaranteed + wins x winBonus + playoff/title shares where earned.
  console.log('\n--- sponsor package EV (share of headline value S, by side) ---');
  const payout = (r0, pkg) => {
    const S = sponsorSeasonValue(r0.div, r0.posInDiv0 ?? 4, 8, r0.full ? 1 : 0.70);
    const sh = SPONSOR_PACKAGES[pkg];
    let v = S * sh.guaranteed + r0.wins * sponsorWinBonus(S, pkg);
    if (r0.playoff) v += S * (sh.playoffShare || 0);
    if (r0.title) v += S * (sh.titleShare || 0);
    return v / S;
  };
  const KIND = [
    ['a struggler (bottom-quartile payroll)', r0 => r0.tier === 4],
    ['a mid-table side (middle payroll)', r0 => r0.tier === 2 || r0.tier === 3],
    ['a contender (flagship/d1a payroll)', r0 => r0.tier <= 1]
  ];
  for (const [label, sel] of KIND) {
    const g = seasoned.filter(sel);
    const cells = ['safe', 'balanced', 'contender'].map(p => {
      const xs = g.map(r0 => payout(r0, p));
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length);
      return p + ' ' + pct(mean) + '±' + pct(sd);
    });
    console.log(label.padEnd(40), cells.join('   '));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
