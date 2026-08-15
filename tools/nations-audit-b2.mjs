#!/usr/bin/env node
/* tools/nations-audit-b2.mjs — WHO ACTUALLY PLAYS FOR THESE COUNTRIES?
 *
 * B2 retired badgeUp(): a national side's skills are no longer scaled until its
 * XI hits a declared rung. A player becomes an international because he is good,
 * and becoming an international must not make him good. Which means the
 * hierarchy between countries has to come out of the cricketers they were dealt,
 * and the only way to know whether it does is to pick every country's side off
 * the dealt world and count it.
 *
 *   node tools/nations-audit-b2.mjs
 *   node tools/nations-audit-b2.mjs --json
 *
 * THE SELECTION RULE IS THE UMPIRE'S OWN, imported rather than approximated:
 * nations.mjs selectSquad, which takes the keeper first, then a bowling attack,
 * then a batting core, then fills - at most three from any one club and never
 * leaving a club short of a side. A first draft of this audit picked the best
 * fifteen by value instead and reported five countries with no wicketkeeper,
 * which was a defect in the audit and not in the world: the naive pick is not
 * the pick. Nothing that claims to measure production may hold its own opinion
 * of what production does.
 *
 * Form is left out: it is bounded at 13.5% either way, and this is asking about
 * the players rather than about a week.
 *
 * It changes nothing: the world is dealt in a VM off the shipped build.
 */
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs, squadFor, isFullMember, FULL_MEMBERS } from '../server/init-world.mjs';
import { selectSquad, CLUB_LIMIT } from '../server/nations.mjs';

const wantJson = process.argv.includes('--json');
const host = makeHost();
const cfgs = countryConfigs(host);

const byCountry = {};
for (const cfg of cfgs) {
  const pool = [];
  for (const club of cfg.clubs) {
    const men = squadFor(host, cfg, club, 1);
    const ovrs = host.pkOvr(men);
    men.forEach((p, i) => { p.__ovr = ovrs[i]; p.__club = club.slot; p.slot = club.slot; });
    men.forEach(p => pool.push(p));
  }
  // the umpire's own selectors, on the whole country's professionals
  const squad = selectSquad(pool);
  squad.sort((a, b) => b.__ovr - a.__ovr || (a.name < b.name ? -1 : 1));
  pool.sort((a, b) => b.__ovr - a.__ovr || (a.name < b.name ? -1 : 1));
  byCountry[cfg.id] = { cfg, pool, squad };
}

const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const rows = FULL_MEMBERS.concat(cfgs.map(c => c.id).filter(id => !isFullMember(id)))
  .filter(id => byCountry[id])
  .map(id => {
    const { cfg, pool, squad } = byCountry[id];
    const sq = squad, xi = squad.slice(0, 11);
    const o = squad.map(p => p.__ovr);
    return {
      id, name: cfg.name, full: isFullMember(id),
      squadMean: mean(sq.map(p => p.__ovr)), xiMean: mean(xi.map(p => p.__ovr)),
      best: o[0], worstOfXi: xi[xi.length - 1].__ovr,
      n80: o.filter(v => v >= 80).length, n85: o.filter(v => v >= 85).length,
      n90: o.filter(v => v >= 90).length, n95: o.filter(v => v >= 95).length,
      poolBest: pool[0].__ovr,
      keepers: sq.filter(p => p.keeper || p.role === 'wicketkeeper').length,
      bowlers: sq.filter(p => p.bowlType && p.bowlType !== 'none').length,
      clubs: new Set(sq.map(p => p.__club)).size
    };
  });
rows.sort((a, b) => b.xiMean - a.xiMean);

// ---- the rarity the whole world actually holds ----------------------------
const world = cfgs.flatMap(cfg => cfg.clubs.flatMap(club => {
  const men = squadFor(host, cfg, club, 1);
  return host.pkOvr(men);
}));
const worldBand = t => world.filter(v => v >= t).length;

if (wantJson) { console.log(JSON.stringify({ rows, world: world.length }, null, 2)); }
else {
  console.log('NATIONAL SIDES, PICKED OFF THE DEALT WORLD (no badge, no boost)\n');
  console.log('  country          member  squad15    XI   best  11th   80+  85+  90+  95+  clubs  wk  bowl');
  for (const r of rows)
    console.log('  ' + (r.name + ' ').padEnd(17) + (r.full ? 'full  ' : 'assoc ').padEnd(8) +
      r.squadMean.toFixed(1).padStart(7) + r.xiMean.toFixed(1).padStart(6) +
      String(r.best).padStart(7) + String(r.worstOfXi).padStart(6) +
      String(r.n80).padStart(6) + String(r.n85).padStart(5) + String(r.n90).padStart(5) +
      String(r.n95).padStart(5) + String(r.clubs).padStart(7) +
      String(r.keepers).padStart(4) + String(r.bowlers).padStart(6));

  const full = rows.filter(r => r.full), assoc = rows.filter(r => !r.full);
  console.log('\nTHE HIERARCHY, EARNED RATHER THAN DECLARED');
  console.log('  weakest full member XI  ' + Math.min(...full.map(r => r.xiMean)).toFixed(1) +
    '   strongest associate XI  ' + Math.max(...assoc.map(r => r.xiMean)).toFixed(1));
  console.log('  full members ' + Math.min(...full.map(r => r.xiMean)).toFixed(1) + ' - ' +
    Math.max(...full.map(r => r.xiMean)).toFixed(1) +
    '   associates ' + Math.min(...assoc.map(r => r.xiMean)).toFixed(1) + ' - ' +
    Math.max(...assoc.map(r => r.xiMean)).toFixed(1));

  console.log('\nFEASIBILITY AGAINST GLOBAL RARITY (' + world.length + ' cricketers)');
  console.log('  the world holds  80+ ' + worldBand(80) + '   85+ ' + worldBand(85) +
    '   90+ ' + worldBand(90) + '   95+ ' + worldBand(95));
  const need = (t, per) => 'sixteen countries fielding ' + per + ' men of ' + t +
    '+ would need ' + (16 * per) + '; the world has ' + worldBand(t);
  console.log('  ' + need(80, 11));
  console.log('  ' + need(85, 11));
  console.log('  so a full XI of 80+ is possible for ' +
    rows.filter(r => r.n80 >= 11).length + ' of 16 countries, and of 85+ for ' +
    rows.filter(r => r.n85 >= 11).length + '.');
  console.log('  (the selected fifteen is not the best fifteen: the keeper and the' +
    ' attack are taken first, so a country spends some of its depth on shape)');
  const noKeeper = rows.filter(r => r.keepers < 1).map(r => r.id);
  const thinAttack = rows.filter(r => r.bowlers < 5).map(r => r.id);
  console.log('\nCONSTRAINTS');
  console.log('  countries whose fifteen has no keeper: ' + (noKeeper.length ? noKeeper.join(', ') : 'none'));
  console.log('  countries whose fifteen has under five bowlers: ' + (thinAttack.length ? thinAttack.join(', ') : 'none'));
  console.log('  fewest clubs represented in any fifteen: ' + Math.min(...rows.map(r => r.clubs)) +
    ' (the selectors cap at ' + CLUB_LIMIT + ' a club, so a fifteen needs at least five)');
}
