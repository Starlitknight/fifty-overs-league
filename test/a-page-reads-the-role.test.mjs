/* A CRICKETER'S PAGE LEADS WITH WHAT HE IS.
 *
 * Technique was a presentation aggregate - (vsPace + vsSpin + temperament)/3 -
 * that the ball engine never reads, and it led every player's page whatever he
 * was. On a specialist bowler it said "limited technique" when it meant
 * "limited batting". It is gone from every headline surface, and in its place
 * each role leads with the readings a manager actually judges that role by:
 * eight for the bars, six independent ones for the radar, defined once in
 * 64-role-aware-skills and consumed by the page.
 *
 * Composure is the user-facing name of the engine's temperament facet - the
 * same number, not a new aggregate. The advanced engine view stays exhaustive
 * and is not under test here; these are the HEADLINES.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const get = name => vm.runInContext(name, eng.ctx);

const SK = { vsPace: 61, vsSpin: 56, rotation: 51, temperament: 47, power: 71,
  wicket: 66, economy: 62, discipline: 57, moveTurn: 52, variation: 46,
  stamina: 81, fielding: 63, catching: 58, keeping: 76, stumping: 72 };
const man = (role, extra) => Object.assign(
  { name: 'Probe', role, skills: Object.assign({}, SK) }, extra || {});

// read() answers out of the engine's VM realm; Array.from re-homes each list
// so strict deepEqual is comparing content, not which realm's Array it is
const READ0 = get('window.foRoleSkills').read;
const READ = p => { const r = READ0(p);
  return { cls: r.cls, all: Array.from(r.all, x => [x[0], x[1]]),
           radar: Array.from(r.radar, x => [x[0], x[1]]) }; };

const CASES = [
  ['batter', man('batter'),
    ['Batting', 'vs Pace', 'vs Spin', 'Rotation', 'Power', 'Composure', 'Endurance', 'Fielding'],
    ['vs Pace', 'vs Spin', 'Rotation', 'Power', 'Composure', 'Fielding']],
  ['bowler', man('bowler', { bowlType: 'fast' }),
    ['Bowling', 'Wicket threat', 'Economy', 'Discipline', 'Movement / turn', 'Variation', 'Endurance', 'Fielding'],
    ['Wicket', 'Economy', 'Discipline', 'Movement', 'Variation', 'Endurance']],
  ['keeper', man('wicketkeeper', { keeper: true }),
    ['Batting', 'Keeping', 'Catching', 'Stumping', 'vs Pace', 'vs Spin', 'Power', 'Endurance'],
    ['Keeping', 'Catching', 'Stumping', 'vs Pace', 'vs Spin', 'Power']],
  ['all-rounder', man('allRounder', { bowlType: 'fingerSpin' }),
    ['Batting', 'Bowling', 'Power', 'Rotation', 'Wicket threat', 'Economy', 'Endurance', 'Fielding'],
    ['Batting', 'Bowling', 'Power', 'Wicket', 'Economy', 'Fielding']],
];

for (const [nm, p, wantBars, wantRadar] of CASES) {
  test('a ' + nm + '\'s page leads with a ' + nm + '\'s readings', () => {
    const r = READ(p);
    assert.deepEqual(r.all.map(x => x[0]), wantBars, nm + ' bars');
    assert.deepEqual(r.radar.map(x => x[0]), wantRadar, nm + ' radar');
    // the radar never plots an aggregate beside its own ingredients: where
    // Batting is a dimension, vs Pace/vs Spin/Rotation are not, and vice versa
    const radarSet = new Set(r.radar.map(x => x[0]));
    if (radarSet.has('Batting'))
      for (const ing of ['vs Pace', 'vs Spin', 'Rotation', 'Composure'])
        assert.ok(!radarSet.has(ing), nm + ': Batting and its ingredient ' + ing + ' on one shape');
    if (radarSet.has('Bowling'))
      for (const ing of ['Discipline', 'Movement', 'Variation'])
        assert.ok(!radarSet.has(ing), nm + ': Bowling and its ingredient ' + ing + ' on one shape');
    // and no rung of it is the retired aggregate
    assert.ok(!r.all.concat(r.radar).some(x => /techn/i.test(x[0])), nm + ' never says Technique');
  });
}

test('Composure IS temperament - a renamed facet, not a new aggregate', () => {
  const r = READ(man('batter'));
  const comp = r.all.find(x => x[0] === 'Composure');
  assert.equal(comp[1], SK.temperament);
});

test('Endurance IS stamina, wherever it appears', () => {
  for (const [, p] of CASES.map(c => [c[0], c[1]])) {
    const r = READ(p);
    const end = r.all.find(x => x[0] === 'Endurance');
    assert.equal(end[1], SK.stamina);
  }
});

test('reading a role mutates nothing about the man', () => {
  const p = man('bowler', { bowlType: 'fast' });
  const before = JSON.stringify(p.skills);
  READ(p); READ(p);
  assert.equal(JSON.stringify(p.skills), before);
});

test('the headline grids carry End where Tech stood, and sort it numerically', () => {
  // the legacy overall grid: its key map is the sort - End present, Tech gone
  const keys = get('GRIDKEYS');
  assert.ok(!('Tech' in keys), 'Tech is out of the grid');
  assert.ok('End' in keys, 'End is in it');
  assert.equal(typeof keys.End(man('bowler', { bowlType: 'fast' })), 'number',
    'and it sorts on a number, never a word');
});
