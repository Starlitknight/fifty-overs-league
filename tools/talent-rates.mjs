/* tools/talent-rates.mjs — set the earned-talent thresholds from measurement.
 *
 * Run after any change to what a talent's condition is, or to the cricket the
 * engine plays, and paste the printed table into FO_TAL_T in
 * engine/src/00-core.js:
 *
 *     ./build.sh && node tools/talent-rates.mjs
 *
 * A threshold guessed by eye is a talent that takes four seasons or four
 * matches; this makes every one of them the same span of regular play.
 */
// Triggers per ELIGIBLE MAN-MATCH. A fielder who got no chance all afternoon
// still played the match; counting only the men who triggered would say a
// rocket arm is earned ten times faster than it is.
import { makeHost } from '/home/user/fifty-overs-league/server/enginehost.mjs';
import { countryConfigs, squadFor } from '/home/user/fifty-overs-league/server/init-world.mjs';
const host = makeHost();
const cfgs = countryConfigs(host);
const eng = cfgs.find(c => c.id === 'eng');
const squads = eng.clubs.slice(0, 8).map(c => ({
  name: c.name, ground: c.ground, players: squadFor(host, eng, c, 4)
}));
const tot = {};        // talent -> total triggers
const seen = {};       // talent -> eligible man-matches
const ever = {};       // talent -> Set(names that ever triggered it) => the eligible set
let matches = 0;
const cards = [];
for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
  if (a === b) continue;
  const res = JSON.parse(host.runMatch(squads[a], squads[b], 'balanced', (a * 31 + b * 7 + 1), null, 'Sunny'));
  cards.push({ a, b, tal: res.tal || {} });
  matches++;
  for (const nm of Object.keys(res.tal || {}))
    for (const t of Object.keys(res.tal[nm])) (ever[t] || (ever[t] = new Set())).add(nm);
}
// second pass: now that the eligible set per talent is known, every match those
// men played counts as a man-match whether or not they triggered
const xiNames = {};    // club index -> Set of squad names
squads.forEach((s, i) => { xiNames[i] = new Set(s.players.map(p => p.name)); });
for (const c of cards) for (const t of Object.keys(ever)) {
  for (const nm of ever[t]) {
    if (!xiNames[c.a].has(nm) && !xiNames[c.b].has(nm)) continue;
    seen[t] = (seen[t] || 0) + 1;
    tot[t] = (tot[t] || 0) + ((c.tal[nm] || {})[t] || 0);
  }
}
console.log('matches: ' + matches + '   (each club plays 14, a real season)\n');
console.log('talent'.padEnd(20) + 'per man-match'.padStart(14) + '   threshold (2.5 seasons x 14)');
const out = {};
for (const t of Object.keys(tot).sort()) {
  const rate = tot[t] / seen[t];
  const T = Math.max(25, Math.round(rate * 14 * 2.5 / 25) * 25);
  out[t] = T;
  console.log(t.padEnd(20) + rate.toFixed(1).padStart(14) + '   ' + T);
}
console.log('\nconst FO_TAL_T=' + JSON.stringify(out).replace(/"/g, '') + ';');
