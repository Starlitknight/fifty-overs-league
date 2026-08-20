// wage-population.mjs — WHAT THE WORLD ACTUALLY LOOKS LIKE, AND WHAT IT COSTS.
//
// Sections 6, 7 and 9 of the wage-anchor brief. The whole phase turns on one
// factual question the brief is careful not to answer for me:
//
//   FO_WAGE_R50 says "the median professional is OVR 50, by the ladder's own
//   meaning, and the world is dealt to put him there". Is he still there?
//
// The constant was rebased once already (B2) from a measured rating of 25,704
// to a CARD-stated 50, precisely so it could not go stale again the way it had.
// Whether that worked is measurable, not arguable: deal every seat of many
// nations through the shipped generator and look.
//
// Distributions are reported for the population the ECONOMY sees, which is not
// the population the generator makes. A club pays its whole roster, so squad
// wages are what a payroll is; but the XI is what the semantic ladder is about
// ("50 means a legitimate career professional") and reserves drag any
// all-players median down by construction. Both are printed, separately, and
// the report says which one an anchor should be read against.
//
//   node tools/wage-population.mjs [--nations=N]
//
// Reads the shipped generator and the shipped wage law. Changes nothing.
import { makeHost } from '../server/enginehost.mjs';
import { tierOfClub, countryConfigs } from '../server/init-world.mjs';

const arg = k => (process.argv.find(a => a.startsWith('--' + k + '=')) || '').split('=')[1];
const NAT = Math.max(1, parseInt(arg('nations') || '8', 10));
const $ = n => '$' + Math.round(n).toLocaleString();
const L = s => console.log(s);

const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const row = (label, xs, fmt) => {
  const f = fmt || (n => String(Math.round(n)));
  L('   ' + label.padEnd(16)
    + String(xs.length).padStart(7)
    + f(pct(xs, 0.10)).padStart(10) + f(pct(xs, 0.25)).padStart(10)
    + f(pct(xs, 0.50)).padStart(10) + f(pct(xs, 0.75)).padStart(10)
    + f(pct(xs, 0.90)).padStart(10) + f(pct(xs, 0.95)).padStart(10)
    + f(pct(xs, 0.99)).padStart(10));
};
const head = what => {
  L('   ' + what.padEnd(16) + 'n'.padStart(7) + 'P10'.padStart(10) + 'P25'.padStart(10)
    + 'median'.padStart(10) + 'P75'.padStart(10) + 'P90'.padStart(10)
    + 'P95'.padStart(10) + 'P99'.padStart(10));
  L('   ' + '-'.repeat(83));
};

// THE XI IS PICKED THE WAY THE UMPIRE PICKS IT, near enough: the eleven best
// cards. The real selector weighs role and balance, but for a DISTRIBUTION the
// top eleven by card is the same population to within a man or two, and it
// does not need a match to exist.
const xiOf = sq => [...sq].sort((a, b) => b.rating - a.rating).slice(0, 11);

const host = makeHost();

// the REAL configs, not an approximation of them: each club carries its own
// archetype and its own seat, and tierOfClub reads the same fields the world
// does when it deals a season.
const nations = countryConfigs(host).slice(0, NAT);
const all = [], xi = [], res = [], byRole = { bat: [], bowl: [], ar: [], wk: [] };
const wAll = [], wXi = [], wRes = [];
const seats = [];   // one entry per club: its squad bill and its XI bill

for (const cfg of nations) {
  for (const club of cfg.clubs) {
    const slot = club.slot;
    const tier = tierOfClub(cfg, club);
    const sq = host.genSquad('world1|' + cfg.id + '|' + slot, cfg.nat,
      club.arch || cfg.arch, club.boss ? cfg.capt : 'general', 1, tier) || [];
    if (!sq.length) continue;
    const men = host.derive(sq);
    const eleven = xiOf(men), elevenIds = new Set(eleven.map(p => p.pid));
    for (const p of men) {
      const card = p.rating / 1000, w = p.wage || 0;
      all.push(card); wAll.push(w);
      if (elevenIds.has(p.pid)) { xi.push(card); wXi.push(w); }
      else { res.push(card); wRes.push(w); }
      const cls = p.keeper ? 'wk' : (p.role === 'allRounder' ? 'ar'
        : (p.bowlTypeFull && p.bowlTypeFull !== 'none' ? 'bowl' : 'bat'));
      byRole[cls].push(card);
    }
    seats.push({
      nat: cfg.id, slot, div: club.div || (slot < 8 ? 1 : 2), tier,
      squadBill: men.reduce((a, p) => a + (p.wage || 0), 0),
      xiBill: eleven.reduce((a, p) => a + (p.wage || 0), 0),
      medCard: pct(men.map(p => p.rating / 1000), 0.5),
      xiMedCard: pct(eleven.map(p => p.rating / 1000), 0.5)
    });
  }
}

L('');
L('THE WORLD AS DEALT, AND WHAT IT COSTS');
L('='.repeat(90));
L('   ' + nations.length + ' nations x 16 seats = ' + seats.length + ' clubs, '
  + all.length + ' cricketers, shipped generator and shipped wage law');
L('');

L('6. VISIBLE OVR (the canonical card)');
L('');
head('population');
row('all players', all);
row('starting XI', xi);
row('reserves', res);
L('');
head('by role');
row('batters', byRole.bat);
row('bowlers', byRole.bowl);
row('all-rounders', byRole.ar);
row('keepers', byRole.wk);
L('');
L('   THE ANCHOR\'S OWN CLAIM: FO_WAGE_R50 states the median professional at');
L('   OVR 50. Measured here:');
L('      all players   median ' + pct(all, 0.5).toFixed(1));
L('      starting XI   median ' + pct(xi, 0.5).toFixed(1));
L('      reserves      median ' + pct(res, 0.5).toFixed(1));
L('');

L('7. WAGES, AT THE SHIPPED LAW');
L('');
head('population');
row('all players', wAll, n => $(n));
row('starting XI', wXi, n => $(n));
row('reserves', wRes, n => $(n));
L('   max ' + $(Math.max(...wAll)) + ' a round');
L('');

L('   by division (whole-squad bill a round)');
L('');
for (const dv of [1, 2]) {
  const bills = seats.filter(s => s.div === dv).map(s => s.squadBill);
  L('      Division ' + dv + '   median ' + $(pct(bills, 0.5))
    + '   P10 ' + $(pct(bills, 0.1)) + '   P90 ' + $(pct(bills, 0.9)));
}
L('');
L('   by seat (median across nations)');
L('');
L('      slot  div  tier                squad bill      XI bill   squad med OVR');
for (let slot = 0; slot < 16; slot++) {
  const at = seats.filter(s => s.slot === slot);
  if (!at.length) continue;
  L('      ' + String(slot).padStart(4) + String(at[0].div).padStart(5) + '  '
    + String(at[0].tier).padEnd(16)
    + $(pct(at.map(s => s.squadBill), 0.5)).padStart(13)
    + $(pct(at.map(s => s.xiBill), 0.5)).padStart(13)
    + pct(at.map(s => s.medCard), 0.5).toFixed(1).padStart(16));
}

// ---------------------------------------------------------------------------
// 9. SCALE vs SHAPE. The brief's central distinction, and the one place where
// the answer is arithmetic rather than measurement: foWageOf is a pure power
// law in the card, so every one of these ratios is (a/b)^K and NOTHING about
// the population can move them. Printing them anyway is the point - it shows
// the shape question is answered by K alone, and that a scale problem cannot
// be diagnosed from them.
// ---------------------------------------------------------------------------
L('');
L('9. SCALE vs SHAPE - the ladder of relative price');
L('');
const wageAt = c => {
  const p = host.derive([{ ...{ rating: c * 1000, talents: [], skills: {}, role: 'batter',
    bowlTypeFull: 'none', hand: 'R' } }]);
  return p[0] && p[0].wage;
};
L('      ratio        value    what it means');
const pairs = [[95, 85], [90, 80], [80, 70], [70, 60], [60, 50], [50, 40]];
for (const [hi, lo] of pairs) {
  const r = Math.pow(hi / lo, 3);
  L('      W' + hi + '/W' + lo + '      ' + r.toFixed(3).padStart(7)
    + '    (' + hi + '/' + lo + ')^K, K=3');
}
L('');
L('   These are FIXED BY K AND NOTHING ELSE. foWageOf is FO_WAGE_MID x');
L('   (card/50)^3, so every ratio between two cards is (a/b)^3 whatever the');
L('   midpoint is. An absolute re-anchor cannot change one of them, and no');
L('   measurement of the population can either. That is what makes SCALE and');
L('   SHAPE genuinely separable here: FO_WAGE_MID moves the level, K moves the');
L('   ladder, and they do not interact.');
L('');
L('   the ladder in dollars at the shipped midpoint:');
L('      OVR   wage a round     vs a median man');
for (const c of [20, 30, 40, 50, 60, 70, 80, 90, 95, 100]) {
  const w = 9290 * Math.pow(c / 50, 3);
  const shown = Math.max(400, Math.round(w / 10) * 10);
  L('      ' + String(c).padStart(3) + $(shown).padStart(15)
    + (shown / 9290).toFixed(2).padStart(16) + 'x');
}
L('');
