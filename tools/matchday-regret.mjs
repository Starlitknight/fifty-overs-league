/* tools/matchday-regret.mjs — DOES THE COACH PICK THE SIDE THAT ACTUALLY WINS?
 *
 * The controlled contests (tools/matchday-allrounder.mjs) are hand-built: one
 * man changed, everything else held. They are the right way to isolate a term
 * and the wrong way to find out whether the selector is any good, because real
 * squads are not controlled and the choices a coach actually faces are between
 * elevens that differ in several ways at once.
 *
 * So this takes REAL generated squads from across the world's strength
 * distribution, lets the coach pick, and then asks the only question that
 * matters: of the near-miss elevens it rejected, would any of them have won
 * more often? Each near-miss is one swap away from the coach's side, which is
 * exactly the margin where a selector's errors live.
 *
 * THE THREE SWAPS, chosen to put role bias where it can be seen:
 *
 *     a selected SPECIALIST   out, the best omitted ALL-ROUNDER in
 *     a selected ALL-ROUNDER  out, the best omitted specialist BATSMAN in
 *     a selected ALL-ROUNDER  out, the best omitted specialist BOWLER in
 *
 * If the coach has no role bias, its mistakes should be symmetric: about as
 * often wrong for leaving an all-rounder out as for leaving one in, and the
 * runs it gives away by being wrong should be about the same size either way.
 * A selector that systematically over-values one shape shows up as a lopsided
 * regret table, and THAT is the number this file exists to print.
 *
 * WHAT IS MEASURED
 *   agreement   how often the coach's XI beat the alternative it rejected
 *   regret      when it was wrong, by how many win-points (paired)
 *   by class    the same two numbers split by which swap was tried, so a bias
 *               toward all-rounders and a bias against them are separable
 *
 * Every comparison is PAIRED - the two candidate elevens play the same
 * opponent from the same seeds, home and away - so squad strength, ground and
 * conditions cancel and what is left is the one swap.
 *
 *   node tools/matchday-regret.mjs                 # 24 squads, 40 pairs a test
 *   node tools/matchday-regret.mjs --squads 40 --n 120
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const argv = process.argv.slice(2);
const num = (flag, dflt) => { const i = argv.indexOf(flag); return i >= 0 ? parseInt(argv[i + 1], 10) : dflt; };
const SQUADS = num('--squads', 24);
const N = num('--n', 40);

const eng = makeEngine();
eng.setTuning(true);

const NAT = ['England', 'Australia', 'India', 'South Africa', 'New Zealand', 'Pakistan'];
const ARCH = ['rock', 'express', 'blade', 'greybeard', 'engine', 'miser', 'balanced', 'finisher'];
const CONDS = [
  { pitch: 'balanced', weather: 'Sunny' },
  { pitch: 'green', weather: 'Overcast' },
  { pitch: 'dry', weather: 'Sunny' },
  { pitch: 'cracked', weather: 'Sunny' },
  { pitch: 'flat', weather: 'Sunny' }
];

vm.runInContext(`
globalThis.__rgPlan = function (reqJson) { return JSON.stringify(planMatchDay(JSON.parse(reqJson))); };
// a man's trade, as the coach itself classifies him: front is "a real bowling
// option", and rpd is what he is worth with the bat. Used only to LABEL a swap,
// never to score one.
globalThis.__rgCards = function (squadJson, pitch, weather) {
  var sq = JSON.parse(squadJson);
  var refs = foMdcRefs(sq);
  var ctx = foMdcCtx(weather, FO_KQ_PAR, 50, false);
  var out = {};
  sq.forEach(function (p) {
    var c = foMdcCard(p, refs, ctx, pitch, 0.62);
    out[p.name] = { front: !!c.front, rpd: c.rpd,
                    bowlCost: isFinite(c.bowlCost) ? c.bowlCost : null,
                    canKeep: !!c.canKeep };
  });
  return JSON.stringify(out);
};
globalThis.__rgLegal = function (squadJson, namesJson, pitch, weather) {
  var sq = JSON.parse(squadJson), names = JSON.parse(namesJson);
  var by = {}; sq.forEach(function (p) { by[p.name] = p; });
  var xi = names.map(function (n) { return by[n]; }).filter(Boolean);
  if (xi.length !== 11) return 'false';
  var refs = foMdcRefs(sq);
  var ctx = foMdcCtx(weather, FO_KQ_PAR, 50, false);
  var cards = xi.map(function (p) { return foMdcCard(p, refs, ctx, pitch, 0.62); });
  return foMdcLegal(cards) ? 'true' : 'false';
};
globalThis.__rgPlay = function (aJson, bJson, oppJson, pitch, weather, seed) {
  var mk = function (nm, ps) { return { name: nm, players: ps }; };
  var sheet = function (ps) {
    var o = ps.slice().sort(function (x, y) { return (y.bat || 0) - (x.bat || 0); });
    return { xi: ps.map(function (p) { return p.name; }),
             batOrder: o.map(function (p) { return p.name; }) };
  };
  var A = mk('AAA', JSON.parse(aJson)), O = mk('OPP', JSON.parse(oppJson));
  var om = { AAA: sheet(A.players), OPP: sheet(O.players) };
  var r = window.__foGame.simWorld(A, O, pitch, weather, (seed >>> 0) || 1, om, true);
  if (!r || !r.result) return null;
  return r.result.winner === 'AAA' ? 1 : (r.result.winner === 'OPP' ? 0 : 0.5);
};
`, eng.ctx);

const planIn = vm.runInContext('__rgPlan', eng.ctx);
const cardsIn = vm.runInContext('__rgCards', eng.ctx);
const legalIn = vm.runInContext('__rgLegal', eng.ctx);
const playIn = vm.runInContext('__rgPlay', eng.ctx);

// squads spread across the world's strength, by using the real generator and
// the real archetypes rather than anything invented here
const squads = [];
for (let i = 0; i < SQUADS; i++) {
  const g = eng.genSquad(21000 + i * 401, NAT[i % NAT.length], ARCH[i % ARCH.length]);
  if (g && g.players && g.players.length >= 14) squads.push({ name: 'S' + i, players: g.players });
}

// one fixed, ordinary opponent so every comparison is against the same wall
const oppSquad = eng.genSquad(99001, 'England', 'balanced');
const OPP = JSON.stringify(oppSquad.players.slice(0, 11));

function pairedWin(xiA, xiB, cond, tag) {
  // A and B each play the SAME opponent from the SAME seeds, home and away.
  let aW = 0, bW = 0, n = 0;
  for (let i = 0; i < N; i++) {
    const seed = 310000 + i * 37;
    const a1 = playIn(JSON.stringify(xiA), null, OPP, cond.pitch, cond.weather, seed);
    const b1 = playIn(JSON.stringify(xiB), null, OPP, cond.pitch, cond.weather, seed);
    if (a1 == null || b1 == null) continue;
    aW += a1; bW += b1; n++;
  }
  return n ? { a: aW / n, b: bW / n, n } : null;
}

const rows = [];
for (const sq of squads) {
  const squadJson = JSON.stringify(sq.players);
  for (const cond of CONDS) {
    const plan = JSON.parse(planIn(JSON.stringify({
      team: { name: sq.name, players: sq.players }, pitch: cond.pitch, weather: cond.weather })));
    if (!plan || !plan.xi || plan.xi.length !== 11) continue;
    const cards = JSON.parse(cardsIn(squadJson, cond.pitch, cond.weather));
    const picked = new Set(plan.xi);
    const by = {}; sq.players.forEach(p => { by[p.name] = p; });
    // WHO COUNTS AS AN ALL-ROUNDER IS RELATIVE TO THIS SQUAD, not an absolute
    // number of runs. A fixed threshold (rpd >= 38) classified almost every
    // frontline bowler in a strong squad as an all-rounder and almost none in a
    // weak one, so two of the three swaps never fired at all. A man is an
    // all-rounder here if he is a real bowling option AND bats in the better
    // half of his own squad - which is what the word means to a selector.
    const rpds = Object.keys(cards).map(n => cards[n].rpd).sort((a, b) => a - b);
    const midRpd = rpds[Math.floor(rpds.length / 2)] || 0;
    const isAR = n => cards[n] && cards[n].front && cards[n].rpd >= midRpd;
    const isBowl = n => cards[n] && cards[n].front && !isAR(n);
    const isBat = n => cards[n] && !cards[n].front;
    const omitted = sq.players.map(p => p.name).filter(n => !picked.has(n));
    const best = (names, key) => names.slice().sort((x, y) => key(y) - key(x))[0] || null;

    // the three swaps
    const trials = [];
    const inAR = best(omitted.filter(isAR), n => cards[n].rpd);
    const outSpec = best([...picked].filter(n => isBowl(n) || isBat(n)), n => -cards[n].rpd);
    if (inAR && outSpec) trials.push({ cls: 'specialist -> all-rounder', out: outSpec, in: inAR });

    const inBat = best(omitted.filter(isBat), n => cards[n].rpd);
    const outAR1 = best([...picked].filter(isAR), n => -cards[n].rpd);
    if (inBat && outAR1) trials.push({ cls: 'all-rounder -> batsman', out: outAR1, in: inBat });

    const inBowl = best(omitted.filter(isBowl), n => -(cards[n].bowlCost == null ? 99 : cards[n].bowlCost));
    const outAR2 = best([...picked].filter(isAR), n => -cards[n].rpd);
    if (inBowl && outAR2) trials.push({ cls: 'all-rounder -> bowler', out: outAR2, in: inBowl });

    // THE BAT-v-FIELD CROSSOVER (Phase 2B): the picked batsman with the worst
    // hands out, the omitted batsman with the best hands in. This is the swap
    // FIELD_RUNS prices, and the one the fielding recalibration re-priced -
    // if the coach at 0.95 is over- or under-selecting fielders on real
    // squads, this row's agreement is where it shows.
    const fldOf = n => { const p = by[n]; if (!p) return 50;
      return ((p.field || (p.skills && p.skills.fielding) || 50)
            + ((p.skills && p.skills.catching) || 50)) / 2; };
    const inFld = best(omitted.filter(isBat), n => fldOf(n));
    const outFld = best([...picked].filter(isBat), n => -fldOf(n));
    if (inFld && outFld && fldOf(inFld) > fldOf(outFld) + 4)
      trials.push({ cls: 'bat-v-field crossover', out: outFld, in: inFld });

    for (const t of trials) {
      const alt = plan.xi.filter(n => n !== t.out).concat([t.in]);
      if (alt.length !== 11) continue;
      if (legalIn(squadJson, JSON.stringify(alt), cond.pitch, cond.weather) !== 'true') continue;
      const r = pairedWin(plan.xi.map(n => by[n]), alt.map(n => by[n]), cond);
      if (!r) continue;
      rows.push({ squad: sq.name, cond: cond.pitch, cls: t.cls,
                  coach: r.a, alt: r.b, edge: r.a - r.b, n: r.n });
    }
  }
  process.stderr.write('  ' + sq.name + ' done\r');
}
process.stderr.write('\n');

function report(label, subset) {
  if (!subset.length) { console.log(label.padEnd(30) + '  (no cases)'); return; }
  const n = subset.length;
  const right = subset.filter(r => r.edge > 0).length;
  const ties = subset.filter(r => Math.abs(r.edge) < 1e-9).length;
  const meanEdge = subset.reduce((a, r) => a + r.edge, 0) / n;
  const wrong = subset.filter(r => r.edge < 0);
  const regret = wrong.length ? wrong.reduce((a, r) => a + (-r.edge), 0) / wrong.length : 0;
  const sd = Math.sqrt(subset.reduce((a, r) => a + Math.pow(r.edge - meanEdge, 2), 0) / n);
  const se = sd / Math.sqrt(n);
  console.log(label.padEnd(30) +
    String(n).padStart(5) +
    (100 * right / n).toFixed(1).padStart(9) + '%' +
    (100 * meanEdge).toFixed(2).padStart(10) +
    (100 * se).toFixed(2).padStart(8) +
    ((meanEdge / (se || 1e-9)).toFixed(2)).padStart(8) +
    (100 * regret).toFixed(2).padStart(10));
}

console.log('\n=== RANDOM-SQUAD SELECTOR ACCURACY ===');
console.log(squads.length + ' generated squads x ' + CONDS.length + ' conditions, ' +
  N + ' paired fixtures a comparison. "edge" = the coach XI\'s win rate minus the');
console.log('rejected alternative\'s, both against one fixed opponent from identical seeds.\n');
console.log('swap class                        n   coach won   edge%      SE       z    regret%');
report('ALL', rows);
console.log('');
for (const cls of ['specialist -> all-rounder', 'all-rounder -> batsman', 'all-rounder -> bowler']) {
  report(cls, rows.filter(r => r.cls === cls));
}
console.log('');
console.log('READ IT LIKE THIS. A positive edge means the coach\'s side really was the');
console.log('better one. The bias question is whether the three rows DISAGREE: if the');
console.log('coach over-values all-rounders, then "specialist -> all-rounder" (where it');
console.log('kept the specialist) would look good while the two "all-rounder -> ..." rows');
console.log('(where it kept the all-rounder) would look bad. Symmetric rows mean no');
console.log('systematic role bias, whatever the overall accuracy.');
