/* tools/matchday-goldens.mjs — WHY EVERY GOLDEN MASTER MOVED, ONE FIXTURE AT
 * A TIME.
 *
 * The match-day coach (engine/src/13-matchday-coach.js) changes which eleven
 * men take the field and the order they bat in. That is the entire point of
 * it. It also means every recorded golden master and the calibration
 * fingerprint necessarily change, and "necessarily" is exactly the word a
 * regression hides behind. This tool exists so that the re-blessing of those
 * goldens is an EVIDENCED act rather than a shrug.
 *
 * It asks two questions of each of the nine master fixtures:
 *
 *   1. WITH THE COACH OFF, does the current build still reproduce the recorded
 *      master bit-for-bit? If yes, nothing in the ball model, the toss RNG, the
 *      fatigue channel or the tuning constants has moved — the ONLY thing that
 *      can have changed the fixture is selection. If no, the change is NOT
 *      selection-only and no golden may be re-blessed.
 *
 *   2. WITH THE COACH ON, what precisely changed? Which men came in, which
 *      went out, how the batting order was rewritten, whether the toss call
 *      was the same, and what the scorecard did.
 *
 * __foCoachOff is the flag engine/src/00-core.js pickXI reads. It is set on
 * the VM context before a ball is bowled, so "off" is the founding selector
 * running in the same build, not an older build — which is the only comparison
 * that means anything.
 *
 *     node tools/matchday-goldens.mjs
 *     node tools/matchday-goldens.mjs --json     # machine-readable
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEngine } from '../test/engine-vm.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const masters = JSON.parse(readFileSync(path.join(root, 'test/golden/masters.json'), 'utf8'));
const asJson = process.argv.includes('--json');

// two engines, same build, one with the coach disabled — never two builds
const off = makeEngine(); off.ctx.__foCoachOff = true;
const on = makeEngine();

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cardOf = r => (r.innings || []).map(i => i.runs + '/' + i.wkts).join(' & ');

// THE ELEVEN, ASKED FOR SEPARATELY. runMatch's recorded innings carry only
// runs/wkts/legal - that shape is the golden file's own format and must not be
// widened for a diagnostic. So the selection is obtained by calling pickXI
// directly with the fixture's conditions staged on M, which is exactly what
// the resolver does a moment before the first ball. M is saved and restored so
// this cannot leak into a later run in the same context.
const selector = eng => vm.runInContext(`(function(ix, pitch, weather){
  var prev = (typeof M!=='undefined') ? M : null;
  M = { pitch: pitch, meta: { weather: weather } };
  var xi;
  try { xi = pickXI(GD.teams[ix]); } finally { M = prev; }
  return JSON.stringify((xi||[]).map(function(p){ return p.name; }));
})`, eng.ctx);
const selOff = selector(off), selOn = selector(on);
const squadSize = vm.runInContext('(function(ix){return (GD.teams[ix].players||[]).length})', on.ctx);

const rows = [];
let offMatch = 0, onMatch = 0, tossSame = 0;
for (const m of masters) {
  const rOff = off.runMatch(m.aIx, m.bIx, m.pitch, m.weather, m.seed);
  const rOn = on.runMatch(m.aIx, m.bIx, m.pitch, m.weather, m.seed);
  const offBits = same(rOff.balls, m.balls) && same(rOff.innings, m.innings) && rOff.batFirst === m.batFirst;
  const onBits = same(rOn.balls, m.balls) && same(rOn.innings, m.innings) && rOn.batFirst === m.batFirst;
  if (offBits) offMatch++;
  if (onBits) onMatch++;
  if (rOn.batFirst === m.batFirst) tossSame++;

  // per-innings selection diff: who is in the coach's side who was not in the
  // founding selector's, and vice versa. Batting position is reported too,
  // because an unchanged eleven batted in a different order is the OTHER half
  // of what this work does and it moves a scorecard just as far.
  const sides = [];
  for (const ix of [m.aIx, m.bIx]) {
    const nOff = JSON.parse(selOff(ix, m.pitch, m.weather));
    const nOn = JSON.parse(selOn(ix, m.pitch, m.weather));
    sides.push({
      team: ix, squad: squadSize(ix),
      in: nOn.filter(n => nOff.indexOf(n) < 0),
      out: nOff.filter(n => nOn.indexOf(n) < 0),
      reordered: nOn.filter(n => nOff.indexOf(n) >= 0 && nOff.indexOf(n) !== nOn.indexOf(n)).length,
      offOrder: nOff, onOrder: nOn
    });
  }
  rows.push({
    fixture: m.pitch + '/' + m.weather + '/seed ' + m.seed,
    coachOffReproducesMaster: offBits, coachOnReproducesMaster: onBits,
    tossUnchanged: rOn.batFirst === m.batFirst,
    batFirst: { master: m.batFirst, coachOn: rOn.batFirst },
    card: { master: cardOf(m), coachOff: cardOf(rOff), coachOn: cardOf(rOn) },
    sides
  });
}

if (asJson) { console.log(JSON.stringify({ offMatch, onMatch, tossSame, n: masters.length, rows }, null, 2)); process.exit(0); }

console.log('GOLDEN MASTERS vs THE MATCH-DAY COACH — ' + masters.length + ' fixtures\n');
console.log('  coach OFF reproduces the recorded master : ' + offMatch + '/' + masters.length +
  (offMatch === masters.length ? '   <- the ball model, the toss and the tuning are UNTOUCHED' : '   <- NOT selection-only; do not re-bless'));
console.log('  coach ON  reproduces the recorded master : ' + onMatch + '/' + masters.length);
console.log('  toss call unchanged with the coach on    : ' + tossSame + '/' + masters.length +
  (tossSame === masters.length ? '   <- the toss RNG draw is untouched' : ''));
console.log('');
for (const r of rows) {
  console.log('-- ' + r.fixture);
  console.log('   card  master ' + r.card.master + '   coachOFF ' + r.card.coachOff + '   coachON ' + r.card.coachOn);
  console.log('   bats first: master ' + r.batFirst.master + ', coach ' + r.batFirst.coachOn);
  for (const s of r.sides) {
    console.log('   team ' + s.team + ' (squad of ' + s.squad + '): in [' + s.in.join(', ') + ']  out [' + s.out.join(', ') +
      ']  ' + s.reordered + ' of the retained men bat in a different position');
    console.log('     off order: ' + s.offOrder.join(' > '));
    console.log('     on  order: ' + s.onOrder.join(' > '));
  }
  console.log('');
}
