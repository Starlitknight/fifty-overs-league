/* A SAVE WRITTEN UNDER THE 99 CEILING, BROUGHT ACROSS.
 *
 * Every cricketer stored before the latent model was written by a generator
 * that clamped at 99, and the clamp deleted information: a man whose archetype
 * and level wanted power 112 was written as power 99 and the thirteen points do
 * not survive in the number that did. So a save cannot merely be read - the men
 * in it are damaged in a known way, and foMigrateSave repairs exactly that
 * damage.
 *
 * The brief names three properties and they are the three tests below:
 * DETERMINISTIC, IDEMPOTENT, IDENTITY-PRESERVING. The fourth is the one that
 * matters most in practice and is easiest to get wrong in the generous
 * direction - that the ordinary world is not touched AT ALL, not merely touched
 * gently.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const call = (name, ...args) => vm.runInContext(name, eng.ctx)(...args);

// A SAVE AS THE OLD WORLD WOULD HAVE WRITTEN ONE: real generated cricketers
// with every attribute clamped at 99, which is precisely what the old fit did.
function oldWorldSave(seed) {
  const gen = vm.runInContext('__foGenArchetypeSquad', eng.ctx);
  const teams = [];
  for (let i = 0; i < 6; i++) {
    const sq = gen(seed + i, 'England', 'balanced', null, 1, i < 2 ? 'flagship' : 'd1a');
    const men = (sq && sq.players) || sq || [];
    for (const p of men) {
      // the old ceiling, applied exactly where the old fit applied it
      for (const k of Object.keys(p.skills || {}))
        p.skills[k] = Math.min(99, p.skills[k]);
      delete p.arche;                     // old saves never carried one
    }
    teams.push({ name: 'C' + i, players: men, youth: [] });
  }
  return { teams };            // and no skillModel stamp, which is what makes it old
}

const skillsOf = d => d.teams.flatMap(t => t.players.map(p => ({ ...p.skills })));
const ovrsOf = d => d.teams.flatMap(t => t.players.map(p => call('foOvr', p)));

test('a save with no ceiling damage is not touched at all', () => {
  // every man dealt well below 99, so nothing was ever cut
  const d = oldWorldSave(31000);
  for (const t of d.teams) for (const p of t.players) {
    for (const k of Object.keys(p.skills)) p.skills[k] = Math.min(88, p.skills[k]);
  }
  const before = JSON.stringify(skillsOf(d));
  const r = call('foMigrateSave', d);
  assert.equal(r.moved, 0, 'no cricketer should have been moved');
  assert.equal(JSON.stringify(skillsOf(d)), before,
    'the ordinary world must be untouched exactly, not approximately');
});

test('only the men the ceiling actually reached are moved', () => {
  const d = oldWorldSave(31100);
  const pinnedBefore = d.teams.flatMap(t => t.players)
    .filter(p => Object.values(p.skills).some(v => v >= 99));
  const before = d.teams.flatMap(t => t.players).map(p => ({ ...p.skills }));
  const r = call('foMigrateSave', d);
  assert.ok(pinnedBefore.length > 0, 'the fixture must contain men the ceiling reached');
  assert.ok(r.moved <= pinnedBefore.length,
    'moved ' + r.moved + ' but only ' + pinnedBefore.length + ' were ever pinned');
  d.teams.flatMap(t => t.players).forEach((p, i) => {
    const was = before[i];
    if (Object.values(was).some(v => v >= 99)) return;
    // compared as VALUES, not as objects: p.skills is built inside the engine's
    // vm realm and a spread copy of it is not, so deepStrictEqual fails on the
    // prototypes while every number in it matches.
    for (const k of Object.keys(was))
      assert.equal(p.skills[k], was[k],
        p.name + ' was never pinned; ' + k + ' moved ' + was[k] + ' -> ' + p.skills[k]);
  });
});

test('a pinned cricketer gets back the card the old ladder gave him', () => {
  const d = oldWorldSave(31200);
  const men = d.teams.flatMap(t => t.players).filter(p => Object.values(p.skills).some(v => v >= 99));
  assert.ok(men.length >= 3, 'a sample of ceiling-damaged men (' + men.length + ')');
  const wanted = men.map(p => call('foOvrCurveV1', call('foPlayerValue', p).level));
  call('foMigrateSave', d);
  men.forEach((p, i) => {
    // INTRINSIC BOTH SIDES. `wanted` is a function of .level - raw ability -
    // and the card is not that any more: .ovr is CURRENT playing value, which
    // is ability plus the experience the man has actually accumulated (up to
    // two points either way). The migration's job is to preserve what a
    // cricketer can DO, not what his experience adds to it, so comparing the
    // old ladder's reading against .ovr would be asking whether a migration
    // changed a man's career, and it does not touch one.
    const now = call('foPlayerValue', p).intrinsicOvr;
    // the fit is exact to about a thousandth of a level and then rounds every
    // attribute to an integer, so a card can land a point either side. More
    // than that would mean the migration had changed what a man is worth.
    assert.ok(Math.abs(now - wanted[i]) <= 1.0,
      p.name + ': the save said ' + wanted[i].toFixed(2) + ', he now reads ' + now.toFixed(2));
    assert.ok(Object.values(p.skills).some(v => v > 99),
      p.name + ' was pinned and should now hold real headroom');
  });
});

test('migrating is deterministic - the same save twice gives the same men', () => {
  const a = oldWorldSave(31300), b = oldWorldSave(31300);
  call('foMigrateSave', a);
  call('foMigrateSave', b);
  assert.equal(JSON.stringify(skillsOf(a)), JSON.stringify(skillsOf(b)),
    'two migrations of the same save must agree attribute for attribute');
});

test('migrating is idempotent - a second pass changes nothing', () => {
  const d = oldWorldSave(31400);
  const r1 = call('foMigrateSave', d);
  assert.ok(r1.moved > 0, 'the first pass must have work to do (' + r1.moved + ')');
  const after1 = JSON.stringify(skillsOf(d));
  const ovr1 = JSON.stringify(ovrsOf(d));
  // the stamp alone would make this pass, so it is removed: the claim is that
  // the migration is a FIXED POINT, not merely that it refuses to run twice.
  delete d.skillModel;
  const r2 = call('foMigrateSave', d);
  assert.equal(r2.moved, 0, 'a second pass moved ' + r2.moved + ' cricketers');
  assert.equal(JSON.stringify(skillsOf(d)), after1, 'a second pass changed the skills');
  assert.equal(JSON.stringify(ovrsOf(d)), ovr1, 'a second pass changed the cards');
});

test('the stamp stops it running again on a save it has already crossed', () => {
  const d = oldWorldSave(31500);
  call('foMigrateSave', d);
  assert.equal(d.skillModel, call('foMigrateSave', { teams: [] }).to,
    'a migrated save carries the current skill model');
  const r = call('foMigrateSave', d);
  assert.equal(r.skipped, true, 'a stamped save is skipped');
});

test('a cricketer keeps his name, his age and his trade', () => {
  const d = oldWorldSave(31600);
  const before = d.teams.flatMap(t => t.players).map(p => ({
    name: p.name, age: p.age, role: p.role, nat: p.nat, hand: p.hand,
    bowlTypeFull: p.bowlTypeFull, exp: p.exp, talents: JSON.stringify(p.talents || [])
  }));
  call('foMigrateSave', d);
  d.teams.flatMap(t => t.players).forEach((p, i) => {
    const w = before[i];
    assert.equal(p.name, w.name);
    assert.equal(p.age, w.age);
    assert.equal(p.role, w.role);
    assert.equal(p.nat, w.nat);
    assert.equal(p.hand, w.hand);
    assert.equal(p.bowlTypeFull, w.bowlTypeFull);
    assert.equal(p.exp, w.exp);
    assert.equal(JSON.stringify(p.talents || []), w.talents, p.name + ' kept his talents');
  });
});

test('a repaired man is worth what he was worth, and stays inside the bound', () => {
  // The headroom is PAID FOR, not created: the pinned attributes come back out
  // and the fit scales the whole man down onto the card he already had. So some
  // attributes fall, and the thing that must not move is his value.
  const d = oldWorldSave(31700);
  const wasOvr = d.teams.flatMap(t => t.players).map(p => call('foOvr', p));
  call('foMigrateSave', d);
  const MAX = vm.runInContext('FO_LATENT_MAX', eng.ctx);
  d.teams.flatMap(t => t.players).forEach((p, i) => {
    assert.ok(Math.abs(call('foOvr', p) - wasOvr[i]) <= 1,
      p.name + ': card was ' + wasOvr[i] + ', now ' + call('foOvr', p));
    for (const k of Object.keys(p.skills))
      assert.ok(p.skills[k] <= MAX, p.name + ' ' + k + ' passed the corruption bound');
  });
});

test('a pinned power hitter gets his power back, not a flat lift', () => {
  // the archetype is inferred from the attributes the ceiling did NOT reach, so
  // a man whose surviving skills say "power hitter" must have his POWER lifted
  // furthest among the pinned ones - otherwise the migration hands every
  // damaged cricketer the same shape and re-flattens the elite it is repairing.
  const mk = () => ({
    name: 'PH', age: 27, nat: 'ENG', hand: 'R', role: 'middleOrderBat',
    bowlTypeFull: 'none', exp: 55, formIx: 3, fatigue: 'rested', capt: 50, talents: [],
    skills: {
      vsPace: 99, vsSpin: 99, power: 99, rotation: 70, temperament: 74,
      wicket: 10, economy: 11, discipline: 12, moveTurn: 9, variation: 8,
      stamina: 60, fielding: 80, catching: 78, keeping: 8, stumping: 6
    }
  });
  const p = mk();
  vm.runInContext('jsDerive', eng.ctx)(p);
  const moved = call('foMigratePlayer', p);
  assert.ok(moved, 'a pinned cricketer must be repaired');
  const gain = k => p.skills[k] - 99;
  assert.ok(gain('power') > 0, 'his power came back (' + p.skills.power + ')');
  assert.ok(gain('power') > gain('vsSpin'),
    'a power hitter must get more of his power back than his vsSpin: ' +
    'power ' + p.skills.power + ' vsSpin ' + p.skills.vsSpin);
  assert.equal(p.arche, 'powerHitter', 'and the archetype is recovered and recorded');
});
