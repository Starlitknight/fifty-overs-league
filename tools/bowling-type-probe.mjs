#!/usr/bin/env node
/* tools/bowling-type-probe.mjs — WHAT DOES THE WORLD ACTUALLY BOWL?
 *
 * The generation audit's measuring instrument. It deals every side the planet
 * has, by the server's own tier rule, and tallies bowling types three ways
 * that do not agree with each other and are all worth having:
 *
 *   HEADS        every man in every squad. Includes the fourth spinner nobody
 *                picks and the part-timers, so it flatters rare styles.
 *   FRONT LINE   the five men who would actually bowl. This is the exposure a
 *                batsman meets and the number a valuation weight wants.
 *   CLUBS WITH   how many clubs own at least one of a style. "Not so common
 *                that every attack has one" is a statement about THIS number
 *                and cannot be read off either of the other two.
 *
 * It also checks the two legality properties a squad has to keep whatever the
 * style mix does: five men who can bowl (the engine refuses a sheet without
 * them) and a sixth option for when one of the five has a bad day.
 *
 *   node tools/bowling-type-probe.mjs [--json]
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeEngine } from '../test/engine-vm.mjs';

const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);
const has = k => process.argv.includes('--' + k);

const TIERS = ['newcomer', 'd2b', 'd2a', 'd1b', 'd1a', 'flagship'];
export function dealWorld() {
  const clubs = [];
  const NATS = JSON.parse(g('JSON.stringify(window.__foPlanet.nations()||[])'));
  for (const n of NATS) {
    const rid = n.id != null ? n.id : n;
    const sides = JSON.parse(g(`JSON.stringify(window.__foPlanet.sidesOf(${JSON.stringify(rid)})||[])`));
    sides.forEach((side, slot) => {
      const seed = `${rid}|${slot}`;
      const div = side.div || (slot < 8 ? 1 : 2);
      const ix = side.boss ? 5 : (div === 1 ? (slot <= 3 ? 4 : 3) : (slot <= 11 ? 2 : 1));
      const tier = TIERS[Math.max(0, Math.min(5, ix))];
      let players;
      try {
        players = JSON.parse(g(`JSON.stringify((__foGenArchetypeSquad(${JSON.stringify(seed)},`
          + `${JSON.stringify(String(rid).toUpperCase())},${JSON.stringify(side.arch || 'engine')},`
          + `null,${+side.str || 1},${JSON.stringify(tier)})||{}).players||[])`));
      } catch (e) { return; }
      if (players && players.length)
        clubs.push({ nat: rid, slot, name: side.name, arch: side.arch, div, tier, players });
    });
  }
  return clubs;
}

const REAL = ['seamFast', 'seamFastMedium', 'seamMedium', 'fingerSpin', 'wristSpin'];
const isReal = t => REAL.indexOf(t) >= 0;
const frontFive = pl => pl.filter(p => isReal(p.bowlTypeFull))
  .sort((a, b) => (b.skills.wicket + b.skills.economy) - (a.skills.wicket + a.skills.economy))
  .slice(0, 5);

export function tally(clubs) {
  const heads = {}, front = {}, clubsWith = {};
  let men = 0, legal5 = 0, sixth = 0;
  for (const c of clubs) {
    men += c.players.length;
    for (const p of c.players) {
      const t = p.bowlTypeFull || 'none';
      heads[t] = (heads[t] || 0) + 1;
    }
    const f5 = frontFive(c.players);
    for (const p of f5) front[p.bowlTypeFull] = (front[p.bowlTypeFull] || 0) + 1;
    if (f5.length >= 5) legal5++;
    // a sixth option: any further man who can turn his arm over at all
    if (c.players.filter(p => p.bowlTypeFull && p.bowlTypeFull !== 'none').length >= 6) sixth++;
    const own = new Set(f5.map(p => p.bowlTypeFull));
    for (const t of own) clubsWith[t] = (clubsWith[t] || 0) + 1;
  }
  const tot = o => Object.values(o).reduce((a, b) => a + b, 0);
  const spinOf = o => Object.entries(o).filter(([k]) => /Spin/.test(k)).reduce((a, [, v]) => a + v, 0);
  return { clubs: clubs.length, men, heads, front, clubsWith, legal5, sixth,
    frontShare: Object.fromEntries(Object.entries(front).map(([k, v]) => [k, v / tot(front)])),
    spinShare: spinOf(front) / Math.max(1, tot(front)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const clubs = dealWorld();
  const t = tally(clubs);
  const pc = (n, d) => (100 * n / Math.max(1, d)).toFixed(1).padStart(6) + '%';
  console.log(`\n=== ${t.clubs} clubs, ${t.men} cricketers ===`);
  console.log('  style              heads   front line   clubs with one');
  for (const k of REAL)
    console.log('  ' + k.padEnd(18) + String(t.heads[k] || 0).padStart(6)
      + pc(t.front[k] || 0, Object.values(t.front).reduce((a, b) => a + b, 0)).padStart(13)
      + pc(t.clubsWith[k] || 0, t.clubs).padStart(17));
  for (const k of ['partTimeSeam', 'partTimeSpin', 'none'])
    console.log('  ' + k.padEnd(18) + String(t.heads[k] || 0).padStart(6));
  console.log(`\n  spin share of the front line   ${(100 * t.spinShare).toFixed(1)}%`);
  console.log(`  clubs with five legal bowlers  ${t.legal5}/${t.clubs}`);
  console.log(`  clubs with a sixth option      ${t.sixth}/${t.clubs}`);
  // clubs owning a genuine quick, by division and by tier
  const byDiv = {}, byTier = {};
  for (const c of clubs) {
    const f = frontFive(c.players).some(p => p.bowlTypeFull === 'seamFast');
    (byDiv[c.div] = byDiv[c.div] || { n: 0, fast: 0 }).n++;
    if (f) byDiv[c.div].fast++;
    (byTier[c.tier] = byTier[c.tier] || { n: 0, fast: 0 }).n++;
    if (f) byTier[c.tier].fast++;
  }
  console.log('\n  clubs with a genuine quick, by division:',
    Object.entries(byDiv).map(([k, v]) => `d${k} ${v.fast}/${v.n}`).join('  '));
  console.log('  ...by tier:', Object.entries(byTier).map(([k, v]) => `${k} ${v.fast}/${v.n}`).join('  '));
  if (has('json')) fs.writeFileSync('docs/fast-bowler-generation/type-distribution.json', JSON.stringify(t, null, 1));
}
