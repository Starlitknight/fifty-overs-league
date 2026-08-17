/* tools/matchday-allrounder.mjs — IS THE COACH PAYING AN ALL-ROUNDER TWICE?
 *
 * foMdcScoreXI adds three flexibility premiums on top of a man's MEASURED
 * batting and bowling:
 *
 *     SIXTH_BOWLER    +6.0    once, if the side has a sixth frontline bowler
 *     SEVENTH_BOWLER  +1.5    once more, for a seventh
 *     ALLROUND        +4.0    per man who is both frontline AND a top-seven bat
 *
 * The comments claim these are different things - "somewhere for the captain
 * to turn when a plan is not working" and "the side can change shape
 * mid-match". They may well be the same thing said twice, and the man who
 * triggers both collects ten runs of premium for one piece of cricket.
 *
 * This tool refuses to settle that by reading. It does two things:
 *
 *   1. DECOMPOSES the coach's own score for controlled elevens that differ by
 *      exactly one man, so the premium attributable to all-round-ness is
 *      visible as a number rather than inferred.
 *
 *   2. PLAYS THEM. The competing elevens are put on the field against a common
 *      opponent, home and away, over enough fixtures to see a real difference,
 *      and the MEASURED win rate is compared against what the score claimed.
 *      A premium that the cricket does not pay back is a premium that should
 *      not exist.
 *
 * THE CONTROL. Every cricketer here is built from one template and differs
 * only in the skills under test, so "identical batting" means identical, not
 * similar. jsDerive is the engine's own mapping: bowlType comes from
 * bowlTypeFull through a token table and keeper comes from role, so both are
 * set the way the engine expects rather than assigned directly.
 *
 *   node tools/matchday-allrounder.mjs              # decomposition only (fast)
 *   node tools/matchday-allrounder.mjs --play       # ...and the simulations
 *   node tools/matchday-allrounder.mjs --play --n 400
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const argv = process.argv.slice(2);
const doPlay = argv.includes('--play');
const N = (() => { const i = argv.indexOf('--n'); return i >= 0 ? parseInt(argv[i + 1], 10) : 200; })();

const eng = makeEngine();
eng.setTuning(true);

vm.runInContext(`
var __ART = { fast: 'seamFast', fastMedium: 'seamFastMedium', medium: 'seamMedium',
              fingerSpin: 'fingerSpin', wristSpin: 'wristSpin', none: 'none' };
// ONE TEMPLATE, and every man in this file is it with named skills moved.
// bat/bowl are given as 0-99 skill levels; everything not named is held.
globalThis.__arMan = function (name, spec) {
  var t = JSON.parse(JSON.stringify(GD.teams[0].players[0]));
  t.name = name;
  t.age = spec.age == null ? 27 : spec.age;
  t.talents = [];
  t.role = spec.keeper ? 'wicketkeeper' : (spec.bowl ? 'bowler' : 'batsman');
  t.bowlTypeFull = __ART[spec.type || 'none'];
  var b = spec.bat == null ? 50 : spec.bat;
  var w = spec.bowl == null ? 0 : spec.bowl;
  t.skills = {
    vsPace: b, vsSpin: b, power: b, rotation: b, temperament: b,
    wicket: w, economy: w, discipline: w, moveTurn: w, variation: w,
    stamina: spec.stamina == null ? 60 : spec.stamina,
    fielding: 50, catching: 50,
    keeping: spec.keeper ? 70 : 10, stumping: spec.keeper ? 70 : 10
  };
  t.capt = spec.capt == null ? 50 : spec.capt;
  jsDerive(t);
  return t;
};
// the coach's own decomposition of a named eleven, straight out of the file
// under audit - not a copy of its arithmetic
// THE REFERENCE OPPONENT IS COMMON TO BOTH ELEVENS, and getting this wrong
// invented an eleven-run difference between two sides whose batting was
// character-for-character identical. foMdcRefs builds the yardstick - the
// median bat and the median pace and spin a measurement is taken against -
// out of whatever squad it is handed. Score two elevens separately and they
// are measured against two DIFFERENT yardsticks, so adding a sixth bowler
// silently moves every batsman's number on that side.
//
// planMatchDay does not do this: it computes refs ONCE from the squad and
// every candidate eleven inside the search is measured against that one
// yardstick. A contest between elevens has to do the same, so the pool is
// passed in separately from the eleven being scored.
globalThis.__arScore = function (playersJson, poolJson, pitch, weather) {
  var players = JSON.parse(playersJson);
  var refs = foMdcRefs(JSON.parse(poolJson));
  var ctx = foMdcCtx(weather, FO_KQ_PAR, 50, false);
  var cards = players.map(function (p) { return foMdcCard(p, refs, ctx, pitch, 0.62); });
  var s = foMdcScoreXI(cards, null);
  var front = cards.filter(function (c) { return c.front; }).length;
  // pull the two premiums back out of the bowl term so they can be reported
  // separately from the measured cost of the overs
  var flex = (front >= 6 ? FO_MDC.SIXTH_BOWLER : 0) + (front >= 7 ? FO_MDC.SEVENTH_BOWLER : 0);
  // how many of the top-seven seats are NOT held by a recognised batsman - the
  // quantity the depth charge is a function of, reported so a reader can see
  // which side of the curve a case sits on
  var byBat = cards.slice().sort(function (a, b) { return b.rpd - a.rpd; });
  var bestRpd = byBat.length ? byBat[0].rpd : 0, capable = 0;
  for (var i = 0; i < byBat.length && i < FO_MDC.DEPTH_SEATS; i++)
    if (byBat[i].rpd >= bestRpd * FO_MDC.DEPTH_CAPABLE) capable++;
  var gap = Math.max(0, FO_MDC.DEPTH_SEATS - capable);
  return JSON.stringify({
    // s.bowl ALREADY carries the flex premium (foMdcScoreXI adds it in), so
    // the overs-only cost is s.bowl MINUS flex. Adding it was the first way
    // this table was wrong, and it made a sixth bowler look as though his
    // overs were twelve runs cheaper when they are not bowled at all.
    total: s.total, bowl: s.bowl, bowlOvers: s.bowl - flex, bat: s.bat, flex: flex,
    keep: s.keep, field: s.field, capt: s.capt, allround: s.allround,
    front: front, gap: gap, legal: foMdcLegal(cards)
  });
};
// BOTH SIDES ARE GIVEN A SENSIBLE, IDENTICALLY-DERIVED SHEET. These men are
// all built from one template, so their mpos is the template's - and pickXI's
// pre-coach fallback sorts by mpos, which would have both sides opening with a
// bowler. Symmetric, so the contest would still be fair, but it would be a
// contest between two sides nobody would field. Filing an eleven and a batting
// order by measured batting makes it real cricket, and the SAME rule is
// applied to both sides so nothing is smuggled in.
globalThis.__arSheet = function (players) {
  var order = players.slice().sort(function (a, b) { return (b.bat || 0) - (a.bat || 0); });
  return { xi: players.map(function (p) { return p.name; }),
           batOrder: order.map(function (p) { return p.name; }) };
};
globalThis.__arPlay = function (aJson, bJson, pitch, weather, seed) {
  var A = { name: 'AAA', players: JSON.parse(aJson) };
  var B = { name: 'BBB', players: JSON.parse(bJson) };
  var om = {};
  om['AAA'] = __arSheet(A.players);
  om['BBB'] = __arSheet(B.players);
  var g = window.__foGame;
  var r = g.simWorld(A, B, pitch, weather, (seed >>> 0) || 1, om, true);
  if (!r || !r.result) return null;
  return r.result.winner === 'AAA' ? 1 : (r.result.winner === 'BBB' ? 0 : 0.5);
};
`, eng.ctx);

const man = vm.runInContext('__arMan', eng.ctx);
const score = vm.runInContext('__arScore', eng.ctx);
const play = vm.runInContext('__arPlay', eng.ctx);

const PITCH = 'balanced', WX = 'Sunny';

// --- the cast -------------------------------------------------------------
const keeper = man('Keeper', { bat: 55, keeper: true });
const spec = (i, w) => man('Bowler' + i, { bat: 22, bowl: w, type: ['fast', 'fastMedium', 'medium', 'fingerSpin', 'wristSpin'][i % 5] });
const bats = (i, b) => man('Bat' + i, { bat: b });

// five specialist bowlers of real quality, and five specialist batsmen
const FIVE_BOWL = [0, 1, 2, 3, 4].map(i => spec(i, 68));
const TOP_BATS = [70, 68, 66, 64, 62].map((b, i) => bats(i, b));

// the contested slot, filled four different ways. Batting is IDENTICAL in the
// first three so that anything the score does with them is about the ball.
const PURE_BAT   = man('X', { bat: 58 });
const AR_USELESS = man('X', { bat: 58, bowl: 30, type: 'medium' });   // bowls, but nobody would ask
const AR_USEFUL  = man('X', { bat: 58, bowl: 62, type: 'medium' });   // a genuine sixth option
const AR_STRONG  = man('X', { bat: 58, bowl: 70, type: 'medium' });   // as good as the specialists
const ELITE_BAT  = man('X', { bat: 74 });
const ELITE_BOWL = man('X', { bat: 22, bowl: 80, type: 'fast' });

function xi(contested, nBowl) {
  const out = [keeper].concat(FIVE_BOWL.slice(0, nBowl));
  let i = 0;
  while (out.length < 10) { out.push(TOP_BATS[i++]); }
  out.push(contested);
  return out;
}

// FOUR SPECIALISTS PLUS AN ALL-ROUNDER WHO MUST BOWL. This is the one shape
// where the sixth man's bowling is not decoration: with only four specialists
// the fifty overs cannot be covered without him, so his quality is spent
// rather than merely held. Both sides stay LEGAL - an illegal eleven scores
// -1e6 for the missing keeper or fifth bowler and compares against nothing.
// the extra cast the I-L shapes need
const ELITE_FIVE = [0, 1, 2, 3, 4].map(i => man('E' + i, { bat: 22, bowl: 80,
  type: ['fast', 'fastMedium', 'medium', 'fingerSpin', 'wristSpin'][i % 5] }));
const MED_FIVE = [0, 1, 2, 3, 4].map(i => man('M' + i, { bat: 22, bowl: 52,
  type: ['fast', 'fastMedium', 'medium', 'fingerSpin', 'wristSpin'][i % 5] }));
const AR_ELITE = man('X', { bat: 62, bowl: 78, type: 'fastMedium' });
// TWO MEN OF THE SAME CARD, SPENDING IT DIFFERENTLY. The rating jsDerive
// computes is the canonical card, so these are checked rather than asserted -
// the tool prints both ratings so a reader can see they really are close.
// CARD-EQUAL, CHECKED RATHER THAN CLAIMED: jsDerive gives both men a rating of
// exactly 71000. The first pair tried here was bat 74 against bat 56 / bowl 60,
// which reads balanced and is not - 71000 against 63000 - so the "same overall
// strength" case would have been a contest between a good player and a worse
// one, and would have proved nothing about how the card is SPENT.
const SHIFT_BAT = man('X', { bat: 74 });
const SHIFT_ALL = man('X', { bat: 62, bowl: 70, type: 'medium' });

const AR2 = man('Y', { bat: 56, bowl: 62, type: 'fingerSpin' });
const AR3 = man('Z', { bat: 54, bowl: 62, type: 'fastMedium' });
const fourSpecPlus = extra =>
  [keeper].concat(FIVE_BOWL.slice(0, 4), [extra], TOP_BATS.slice(0, 5));

const CASES = [
  ['A  pure bat vs all-rounder whose bowling is useless',   xi(PURE_BAT, 5),   xi(AR_USELESS, 5)],
  ['B  pure bat vs a genuinely useful sixth option',        xi(PURE_BAT, 5),   xi(AR_USEFUL, 5)],
  ['E  useless sixth option vs useful sixth option',        xi(AR_USELESS, 5), xi(AR_USEFUL, 5)],
  ['C  elite specialist bowler vs strong all-rounder',      xi(ELITE_BOWL, 5), xi(AR_STRONG, 5)],
  ['D  elite specialist batter vs strong all-rounder',      xi(ELITE_BAT, 5),  xi(AR_STRONG, 5)],
  // the LEFT side here is a legal five-specialist attack; the right drops a
  // specialist for the all-rounder, who must then genuinely bowl his ten
  ['F  5 specialists vs 4 specialists + all-rounder who must bowl',
    xi(PURE_BAT, 5), fourSpecPlus(AR_STRONG)],
  ['G  two all-rounders in one eleven',                     xi(PURE_BAT, 5),
    [keeper].concat(FIVE_BOWL.slice(0, 4), [AR_USEFUL, AR2], TOP_BATS.slice(0, 4))],
  ['H  three all-rounders in one eleven',                   xi(PURE_BAT, 5),
    [keeper].concat(FIVE_BOWL.slice(0, 3), [AR_USEFUL, AR2, AR3], TOP_BATS.slice(0, 4))],
  // I-L are the shapes the calibration pass added: a side with no all-rounder
  // at all, a weak all-rounder among elite bowlers, an elite all-rounder
  // against a merely competent specialist attack, and - the sharpest of them -
  // two men of the SAME overall card who spend it differently.
  ['I  no all-rounder anywhere vs one useful sixth option',
    [keeper].concat(FIVE_BOWL.slice(0, 5), TOP_BATS.slice(0, 5)),
    [keeper].concat(FIVE_BOWL.slice(0, 5), [AR_USEFUL], TOP_BATS.slice(0, 4))],
  ['J  four elite bowlers + weak all-rounder vs five elite bowlers',
    [keeper].concat(ELITE_FIVE.slice(0, 4), [AR_USELESS], TOP_BATS.slice(0, 5)),
    [keeper].concat(ELITE_FIVE.slice(0, 5), TOP_BATS.slice(0, 5))],
  ['K  five medium specialists vs four specialists + elite all-rounder',
    [keeper].concat(MED_FIVE.slice(0, 5), TOP_BATS.slice(0, 5)),
    [keeper].concat(MED_FIVE.slice(0, 4), [AR_ELITE], TOP_BATS.slice(0, 5))],
  ['L  same overall card, spent on batting vs spent on both',
    [keeper].concat(FIVE_BOWL.slice(0, 5), TOP_BATS.slice(0, 4), [SHIFT_BAT]),
    [keeper].concat(FIVE_BOWL.slice(0, 5), TOP_BATS.slice(0, 4), [SHIFT_ALL])],
  // WHAT A SEVENTH OPTION IS WORTH, with batting held EXACTLY: the man who
  // makes it seven has the same batting as the specialist batsman he replaces,
  // so the only difference between the sides is that he also bowls.
  ['M  six frontline vs seven frontline, batting identical',
    [keeper].concat(FIVE_BOWL.slice(0, 5), [AR_USEFUL], TOP_BATS.slice(0, 4)),
    [keeper].concat(FIVE_BOWL.slice(0, 5), [AR_USEFUL], TOP_BATS.slice(0, 3),
      [man('S7', { bat: 64, bowl: 62, type: 'wristSpin' })])]
];

const hdr = 'case                                                    total     bat    bowl    flex  allrnd    keep   field    capt  front  gap';
console.log('=== ALL-ROUNDER BIAS: the coach\'s own decomposition ===');
console.log('bowl = the measured cost of fifty overs (already net of flex); flex = SIXTH/SEVENTH;');
console.log('allrnd = the standalone ALLROUND premium.\n');
console.log(hdr);

const rows = [];
for (const [label, A, B] of CASES) {
  // the pool both sides are measured against: every man in either eleven
  const pool = []; const seenP = {};
  A.concat(B).forEach(p => { if (!seenP[p.name]) { seenP[p.name] = 1; pool.push(p); } });
  const poolJson = JSON.stringify(pool);
  const sa = JSON.parse(score(JSON.stringify(A), poolJson, PITCH, WX));
  const sb = JSON.parse(score(JSON.stringify(B), poolJson, PITCH, WX));
  const f = (s, tag) => (tag.padEnd(54) +
    s.total.toFixed(1).padStart(8) + s.bat.toFixed(1).padStart(8) + s.bowlOvers.toFixed(1).padStart(8) +
    s.flex.toFixed(1).padStart(8) + s.allround.toFixed(1).padStart(8) + s.keep.toFixed(1).padStart(8) +
    s.field.toFixed(1).padStart(8) + s.capt.toFixed(1).padStart(8) + String(s.front).padStart(7) +
    String(s.gap).padStart(5) +
    (s.legal ? '' : '  ILLEGAL'));
  console.log(f(sa, label + '  [left]'));
  console.log(f(sb, ' '.repeat(4) + '[right]'));
  console.log('    score prefers: ' + (sb.total > sa.total ? 'RIGHT' : 'LEFT') +
    ' by ' + Math.abs(sb.total - sa.total).toFixed(1) +
    '   (of which flex ' + (sb.flex - sa.flex).toFixed(1) +
    ' + allround ' + (sb.allround - sa.allround).toFixed(1) + ')');
  rows.push({ label, A, B, sa, sb });
  console.log('');
}

if (!doPlay) { console.log('(--play to put these elevens on the field)'); process.exit(0); }

// --- and now play them ------------------------------------------------------
// Each pair is played head to head, both orders, on a neutral ground, so that
// nothing but the contested man separates the two sides.
console.log('=== AND WHAT THE CRICKET SAYS ===');
console.log(N + ' pairs a case (each pair played both ways: ' + (2 * N) + ' matches).');
console.log('right-win% is the all-rounder side. SE is over pairs.\n');
console.log('case                                                    score says   right-win%      SE       z');
for (const r of rows) {
  let wins = 0; const per = [];
  for (let i = 0; i < N; i++) {
    const s = 90000 + i * 17;
    const w1 = play(JSON.stringify(r.B), JSON.stringify(r.A), PITCH, WX, s);       // B as home
    const w2 = play(JSON.stringify(r.A), JSON.stringify(r.B), PITCH, WX, s);       // B as away
    if (w1 == null || w2 == null) continue;
    const x = (w1 + (1 - w2)) / 2;      // B's share of the pair
    per.push(x); wins += x;
  }
  const n = per.length, p = wins / n;
  const mean = p, sd = Math.sqrt(per.reduce((a, v) => a + (v - mean) * (v - mean), 0) / n);
  const se = sd / Math.sqrt(n);
  const z = (p - 0.5) / se;
  console.log(r.label.padEnd(54) +
    ((r.sb.total > r.sa.total ? '+' : '') + (r.sb.total - r.sa.total).toFixed(1)).padStart(11) +
    (100 * p).toFixed(2).padStart(13) + se.toFixed(4).padStart(8) + z.toFixed(2).padStart(8));
}
