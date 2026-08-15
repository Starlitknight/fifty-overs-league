#!/usr/bin/env node
/* tools/career-arc.mjs — DOES A CAREER HAVE A SHAPE, AND DOES IT BALANCE?
 *
 * A living population with ageing in it is held stationary by one equation the
 * lifecycle audit can only see the answer to, never the working:
 *
 *     what a man gains before his peak  ==  what he loses after it
 *
 * If the left side is smaller the world drains, which is what twenty seasons of
 * the first ageing curve did - 80+ from 273 men to 126 - and the audit reported
 * it as a number with no cause attached. This runs ONE cricketer from entry to
 * retirement through the two mechanisms that shape him, the shipped nets
 * (enginehost trainRound) and the shipped ageing curve (foAgeDecline), and
 * prints the arc a season at a time.
 *
 * It is the instrument the ageing rates and the youth development curve were
 * set against; re-run it after touching either.
 *
 *   node tools/career-arc.mjs               # four representative careers
 *   node tools/career-arc.mjs --skills      # and the attributes underneath
 *
 * IT CHANGES NOTHING. Every number comes out of the built index.html in a VM.
 */
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs, tierOfClub, squadFor } from '../server/init-world.mjs';
import { ROUNDS } from '../server/clock.mjs';
import { RETIRE_AT } from '../server/youth.mjs';

const has = k => process.argv.includes('--' + k);
const host = makeHost();
const cfgs = countryConfigs(host);

// A POOL OF REAL DEALT CRICKETERS to pick representatives out of, so the arcs
// are arcs of men the world actually produces rather than of hand-built ones.
const pool = [];
for (const cfg of cfgs.slice(0, 6))
  for (const club of cfg.clubs) {
    const men = squadFor(host, cfg, club, 1);
    const ovrs = host.pkOvr(men);
    men.forEach((p, i) => { p.__ovr = ovrs[i]; p.__tier = tierOfClub(cfg, club); });
    pool.push(...men);
  }

const roleOf = p => (p.keeper || p.role === 'wicketkeeper') ? 'keeper'
  : p.role === 'allRounder' ? 'all-rounder'
  : (p.bowlType && p.bowlType !== 'none') ? 'bowler' : 'batsman';

// one representative per trade, taken near the middle of the professional band
// so the arc is the ordinary case and not a freak's
// ordinary professionals AND the elite, because the two are not the same
// question: decline scales with what a man has and development slows down as
// he climbs, so the top of the world can drain while the middle holds still.
const WANT = [['batsman', 62], ['bowler', 62], ['all-rounder', 62], ['keeper', 62],
              ['batsman', 86], ['bowler', 86], ['batsman', 92], ['bowler', 92]];
const SK = ['power', 'vsPace', 'vsSpin', 'rotation', 'temperament',
  'wicket', 'economy', 'discipline', 'moveTurn', 'variation', 'stamina', 'fielding'];

console.log('A CAREER, FROM ENTRY TO RETIREMENT');
console.log('the shipped nets (' + ROUNDS + ' rounds a season, no plan filed, level-two academy)');
console.log('and the shipped ageing curve, on one cricketer at a time.\n');

const summary = [];
for (const [want, band] of WANT) {
  const src = pool.filter(p => roleOf(p) === want && !summary.some(x => x.name === p.name))
    .sort((a, b) => Math.abs(a.__ovr - band) - Math.abs(b.__ovr - band))[0];
  if (!src) continue;
  let men = [JSON.parse(JSON.stringify(src))];
  men[0].age = 19;                       // everybody's arc starts at the same place
  men = host.derive(men);

  const row = [];
  let peak = { age: 19, ovr: host.pkOvr(men)[0] };
  row.push([19, host.pkOvr(men)[0], JSON.parse(JSON.stringify(men[0].skills))]);
  for (let age = 19; age < RETIRE_AT; age++) {
    for (let r = 0; r < ROUNDS; r++) {
      const res = host.trainRound(men, {}, 1, null);
      if (res && res.players) men = res.players;
    }
    men.forEach(p => { p.age = (p.age || 27) + 1; });
    men = host.ageDecline(men);
    const o = host.pkOvr(men)[0];
    if (o > peak.ovr) peak = { age: men[0].age, ovr: o };
    row.push([men[0].age, o, JSON.parse(JSON.stringify(men[0].skills))]);
  }
  const entry = row[0][1], end = row[row.length - 1][1];
  const mean = row.reduce((a, r) => a + r[1], 0) / row.length;
  summary.push({ trade: want, name: src.name, entry, peak, end, mean });

  console.log(`  ${src.name} — ${want}, ${src.__tier} (dealt ${src.__ovr})`);
  console.log('    age ' + row.map(r => String(r[0]).padStart(4)).join(''));
  console.log('    ovr ' + row.map(r => String(r[1]).padStart(4)).join(''));
  if (has('skills')) {
    for (const k of SK) {
      if (row[0][2][k] == null) continue;
      console.log('    ' + k.slice(0, 4).padEnd(4) + row.map(r => String(r[2][k]).padStart(4)).join(''));
    }
  }
  console.log(`    entry ${entry} at 19, peak ${peak.ovr} at ${peak.age}, ` +
    `retires at ${end}, career mean ${mean.toFixed(1)}\n`);
}

// ---------------------------------------------------------------------------
// THE BALANCE, which is the whole reason this file exists.
//
// A population is stationary when the average cricketer, over the whole of his
// career, is worth what the world deals him as. The world deals a man onto his
// tier's mark; if his CAREER MEAN sits well below that mark the population
// drains however sensible each individual arc looks, and if it sits well above
// it the population inflates.
// ---------------------------------------------------------------------------
console.log('THE BALANCE');
console.log('  trade          entry   peak  (age)   retires   career mean   rise   fall');
for (const s of summary)
  console.log('  ' + s.trade.padEnd(14) + String(s.entry).padStart(5) +
    String(s.peak.ovr).padStart(7) + ('(' + s.peak.age + ')').padStart(7) +
    String(s.end).padStart(10) + s.mean.toFixed(1).padStart(14) +
    ('+' + (s.peak.ovr - s.entry)).padStart(7) +
    ('-' + (s.peak.ovr - s.end)).padStart(7));
console.log('\n  A career mean near the entry mark is what keeps the world stationary:');
console.log('  the rise before the peak has to pay for the fall after it.');
