// test/a-cricketer-is-not-his-name.test.mjs — IDENTITY, NOT SPELLING.
//
// The name banks are small and every squad in the world is drawn from them
// independently, so names repeat across clubs constantly - eighteen shared
// names in England on the live world, seventy-five in Nepal, and in the
// smallest banks one name held by six clubs at once. Everything that asked
// "is this the same cricketer?" by comparing names was therefore answering
// for whoever happened to share it, and the visible symptom was a red
// international star on a batsman who had never been picked.
//
// Every man now carries an id stamped on him when he is generated. These are
// the properties the rest of the game leans on:
//
//   it is UNIQUE - no two cricketers anywhere share one;
//   it is DERIVED - the same seed makes the same ids on every device and on
//     the server, so nobody has to store or send them; and
//   it is ADDITIVE - stamping it moved not one number of any man's, because
//     the world's bot squads are banked as the generator dealt them and each
//     phone re-derives them from the seed.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const W = eng.ctx.window || eng.ctx;

const CLUBS = [];
for (let s = 0; s < 16; s++) {
  CLUBS.push(W.__foGenArchetypeSquad('world1|eng|' + s, 'England', 'rock', null, 1));
}
const men = CLUBS.flatMap(g => (g && g.players) || []);

test('every generated cricketer is stamped with an id', () => {
  assert.ok(men.length >= 200, 'sixteen squads should be a few hundred men');
  assert.equal(men.filter(p => !p.pid).length, 0);
});

test('no two cricketers in the world share an id', () => {
  const seen = new Set(men.map(p => p.pid));
  assert.equal(seen.size, men.length);
});

test('the same seed deals the same ids, so every device agrees', () => {
  const again = W.__foGenArchetypeSquad('world1|eng|12', 'England', 'rock', null, 1);
  const a = (CLUBS[12].players || []).map(p => p.pid);
  const b = (again.players || []).map(p => p.pid);
  assert.deepEqual(b, a);
});

// THE POINT OF THE WHOLE EXERCISE. Names are not unique across a nation, and
// the world proves it without being asked: sixteen ordinary English squads
// hold names shared by two different counties.
test('names really are shared across clubs, which is why they cannot be identity', () => {
  const byName = {};
  CLUBS.forEach((g, s) => ((g && g.players) || []).forEach(p => {
    (byName[p.name] = byName[p.name] || []).push(s);
  }));
  const shared = Object.keys(byName).filter(n => new Set(byName[n]).size > 1);
  assert.ok(shared.length > 0,
    'expected at least one name held by two counties: ' + shared.join(', '));
});

// ---- the star itself ------------------------------------------------------
// A fifteen is served, and the star is asked about a man who is not in it but
// whose NAME is. That is exactly the report this fixes: a Gloucestershire
// batsman wearing a cap that belonged to a namesake at another county.
function servedWorld(squad) {
  W.__foWorldLg = {
    get: () => ({ results: [], nat: { round: 3, squad: squad } }),
    want: () => {},
    anchorNation: () => 'eng'
  };
}

test('a namesake at another club is not starred', () => {
  const glos = CLUBS[12].players[0];
  servedWorld([{ slot: 4, name: glos.name, pid: 'gsomebodyelse-0', age: 24 }]);
  assert.equal(W.foNatStar(glos.name, 12, { rid: 'eng', pid: glos.pid }), '');
  // and the club-and-name test alone reaches the same verdict, which is what
  // a fifteen banked before ids existed falls back to
  assert.equal(W.foNatStar(glos.name, 12, { rid: 'eng' }), '');
});

test('the man who was actually picked is starred, by his id', () => {
  const glos = CLUBS[12].players[0];
  servedWorld([{ slot: 12, name: glos.name, pid: glos.pid, age: 24 }]);
  assert.match(W.foNatStar(glos.name, 12, { rid: 'eng', pid: glos.pid }), /fo-nat/);
});

// A SQUAD BANKED BEFORE IDS EXISTED still has to work: the selectors' book is
// written once and never rewritten, so the rounds already played carry names
// and clubs and nothing else. A pid that finds nothing must fall through to
// them rather than declare an international dropped.
test('a fifteen with no ids still stars its own men', () => {
  const glos = CLUBS[12].players[0];
  servedWorld([{ slot: 12, name: glos.name, age: 24 }]);
  assert.match(W.foNatStar(glos.name, 12, { rid: 'eng', pid: glos.pid }), /fo-nat/);
});

test('an id that is in the fifteen beats a club that disagrees', () => {
  // the man was picked; the caller happens to know only his id and no slot,
  // which is the case on a broadcast XI
  const glos = CLUBS[12].players[3];
  servedWorld([{ slot: 12, name: glos.name, pid: glos.pid, age: 24 }]);
  assert.match(W.foNatStar(glos.name, null, { rid: 'eng', pid: glos.pid }), /fo-nat/);
});
