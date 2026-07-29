/* test/living-squad.test.mjs — the rules that make a squad a project.
 *
 * FO_LIVE (engine/src/league/70-living-squad.js) is the one place in the game
 * that decides how good a cricketer could become, what a year does to him,
 * when he stops, what kind of player he is and whether he stays. Every screen
 * and the close-season step read it, so if it were not deterministic two
 * devices would show two different careers for the same man - which is the
 * exact class of bug this whole architecture exists to prevent.
 *
 * The module is a browser IIFE that hangs itself off window. It touches
 * nothing else, so a bare object is a sufficient window here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(path.join(root, 'engine/src/league/70-living-squad.js'), 'utf8');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: '70-living-squad.js' });
const L = ctx.window.FO_LIVE;

/* a player as the engine actually holds one: rating is internal points, and
 * FO_LIVE divides by 1000 when window.foPkOvr is absent (as it is here) */
const man = (name, age, ovr, talent, extra) =>
  Object.assign({ name, age, rating: ovr * 1000, talent }, extra || {});

const SQUAD = [
  man('Aarav Kulkarni', 19, 52, 'gifted'),
  man('Ben Hollis', 23, 64, 'promising'),
  man('Cass Ndlovu', 27, 78, 'generational'),
  man('Dev Raina', 30, 71, 'steady'),
  man('Eddie Thorne', 34, 66, 'journeyman'),
  man('Fergus Bain', 39, 58, 'limited'),
];

test('FO_LIVE loads and exposes the rules the game reads', () => {
  assert.ok(L, 'window.FO_LIVE was not created');
  for (const k of ['ceiling', 'outlook', 'arcAt', 'seasonSwing', 'retireChance',
    'willRetire', 'traits', 'hasTrait', 'wageAsk', 'contract', 'willLeave',
    'rollSeason', 'clubReport']) {
    assert.equal(typeof L[k], 'function', `missing ${k}`);
  }
});

test('the file contains no randomness at all', () => {
  // prose is allowed to SAY "no Math.random"; code is not allowed to call it
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/Math\.random/.test(code), false, 'Math.random found in the rules module');
  assert.equal(/Date\.now|new Date/.test(code), false, 'a clock reading found in the rules module');
});

test('every answer is identical on a second reading', () => {
  // the offline-fairness guarantee: two devices, two runs, one career
  const ctx2 = { window: {} };
  vm.createContext(ctx2);
  vm.runInContext(src, ctx2, { filename: '70-living-squad.js' });
  const M = ctx2.window.FO_LIVE;
  for (const p of SQUAD) {
    assert.equal(M.ceiling(p), L.ceiling(p), `${p.name} ceiling drifted`);
    assert.equal(M.seasonSwing(p, 0.8), L.seasonSwing(p, 0.8), `${p.name} swing drifted`);
    assert.equal(M.willRetire(p, 3), L.willRetire(p, 3), `${p.name} retirement drifted`);
    // joined, not deep-equal: the two copies live in separate vm realms, so
    // their arrays have different prototypes even when the contents match
    assert.equal(M.traits(p).map(t => t.k).join('|'), L.traits(p).map(t => t.k).join('|'),
      `${p.name} character drifted`);
    assert.equal(M.willLeave(p, 3), L.willLeave(p, 3), `${p.name} loyalty drifted`);
  }
});

test('a ceiling is never below where a man already stands', () => {
  for (const p of SQUAD) {
    const o = L.outlook(p);
    assert.ok(o.ceiling >= o.ovr, `${p.name}: ceiling ${o.ceiling} < overall ${o.ovr}`);
    assert.ok(o.ceiling <= 96, `${p.name}: ceiling ${o.ceiling} above the game's maximum`);
    assert.ok(o.pct >= 0 && o.pct <= 100, `${p.name}: nonsense progress ${o.pct}`);
    assert.equal(o.room, o.ceiling - o.ovr);
  }
});

test('talent buys headroom: a gifted boy has more of himself left than a journeyman', () => {
  const gifted = L.outlook(man('Same Name A', 19, 55, 'gifted')).room;
  const limited = L.outlook(man('Same Name A', 19, 55, 'limited')).room;
  assert.ok(gifted > limited, `gifted ${gifted} should have more room than limited ${limited}`);
});

test('the age arc rises, flattens at thirty and turns down after it', () => {
  assert.ok(L.arcAt(18) > L.arcAt(22), 'a teenager should improve faster than a 22-year-old');
  assert.ok(L.arcAt(22) > L.arcAt(27), 'improvement should slow towards the peak');
  assert.equal(L.arcAt(30), 0, 'thirty is the flat year');
  for (const a of [31, 33, 35, 38]) assert.ok(L.arcAt(a) < 0, `${a} should be declining`);
  assert.ok(L.arcAt(38) < L.arcAt(33), 'decline should steepen with age');
});

test('a season played is worth more than a season on the sidelines', () => {
  const boy = man('Aarav Kulkarni', 19, 52, 'gifted');
  assert.ok(L.seasonSwing(boy, 1) > L.seasonSwing(boy, 0.2),
    'a boy who played every week should gain more than one who did not');
  const old = man('Eddie Thorne', 34, 66, 'journeyman');
  assert.ok(L.seasonSwing(old, 1) > L.seasonSwing(old, 0),
    'a veteran still playing should decline more slowly');
  assert.ok(L.seasonSwing(old, 1) < 0, 'a 34-year-old should still be going backwards');
});

test('a man cannot grow past his own ceiling', () => {
  const p = man('Cass Ndlovu', 27, 78, 'generational');
  const top = L.ceiling(p);
  let cur = { ...p };
  for (let s = 1; s <= 12; s++) {
    const r = L.rollSeason(cur, s, 1);
    if (r.retired) break;
    assert.ok(r.ovrAfter <= L.ceiling(cur), `season ${s}: ${r.ovrAfter} above ceiling ${L.ceiling(cur)}`);
    cur = { ...cur, age: r.ageAfter, rating: r.ovrAfter * 1000 };
  }
  assert.ok(top >= 78);
});

test('nobody retires before 32 and everybody has by 40', () => {
  for (const a of [18, 24, 29, 31]) {
    assert.equal(L.retireChance(man('Any Man', a, 65, 'steady')), 0, `${a} should not be retiring`);
    assert.equal(L.willRetire(man('Any Man', a, 65, 'steady'), 4), false);
  }
  assert.equal(L.willRetire(man('Any Man', 40, 80, 'generational'), 4), true, '40 is certain');
  assert.equal(L.willRetire(man('Any Man', 44, 90, 'generational'), 9), true);
  assert.ok(L.retireChance(man('Any Man', 36, 50, 'steady')) >
            L.retireChance(man('Any Man', 33, 50, 'steady')),
    'retirement should get likelier with age');
  assert.ok(L.retireChance(man('Any Man', 34, 84, 'steady')) <
            L.retireChance(man('Any Man', 34, 48, 'steady')),
    'a great player should hang on longer than a fringe one');
});

test('a squad ages out on its own — no artificial handicap needed', () => {
  // The answer to "what stops one club winning forever". Run a side forward
  // eight seasons untouched: men leave and cannot be replaced from within, and
  // every player who was already at his peak is worse or gone. (The AVERAGE
  // can rise as the old men retire out of it — which is exactly why the test
  // measures the roll, and the men in it, rather than the mean.)
  const peakAtStart = SQUAD.filter(p => p.age >= 27).map(p => p.name);
  const wasOvr = {}; SQUAD.forEach(p => { wasOvr[p.name] = L.ovr(p); });
  let side = SQUAD.map(p => ({ ...p }));
  for (let s = 1; s <= 8; s++) {
    side = side.map(p => {
      const r = L.rollSeason(p, s, 1);
      return r.retired ? null : { ...p, age: r.ageAfter, rating: r.ovrAfter * 1000 };
    }).filter(Boolean);
  }
  assert.ok(side.length < SQUAD.length, 'eight seasons on, somebody should have retired');
  const left = {}; side.forEach(p => { left[p.name] = L.ovr(p); });
  for (const nm of peakAtStart) {
    assert.ok(left[nm] == null || left[nm] < wasOvr[nm],
      `${nm} was at his peak and is somehow better eight seasons later`);
  }
});

test('character is a fact about a man, not a roll', () => {
  const a = L.traits(man('Ben Hollis', 23, 64, 'promising'));
  const b = L.traits(man('Ben Hollis', 31, 51, 'limited'));  // same man, later, worse
  assert.deepEqual(a.map(t => t.k), b.map(t => t.k), 'a man changed character with his age');
  for (const p of SQUAD) {
    const t = L.traits(p);
    assert.ok(t.length <= 2, `${p.name} has ${t.length} traits`);
    for (const x of t) assert.ok(x.k && x.nm && x.why, 'a trait must be nameable and explicable');
    const keys = t.map(x => x.k);
    assert.equal(new Set(keys).size, keys.length, `${p.name} has the same trait twice`);
  }
});

test('an explicit list on the record overrides the derived character', () => {
  const p = man('Ben Hollis', 23, 64, 'promising', { traits: ['oneClub', 'ironMan'] });
  assert.deepEqual(L.traits(p).map(t => t.k), ['oneClub', 'ironMan']);
  assert.equal(L.hasTrait(p, 'oneClub'), true);
  // a name the world does not know is dropped rather than crashing a page
  assert.deepEqual(L.traits(man('X', 20, 50, 'steady', { traits: ['nonsense'] })), []);
});

test('a one-club man never leaves, whatever the deal says', () => {
  const p = man('Loyal Servant', 29, 70, 'steady', { traits: ['oneClub'], contractUntil: 1, wage: 1 });
  const c = L.contract(p, 5);                       // years in arrears, paid nothing
  assert.equal(c.expiring, true);
  assert.equal(c.risk, 0);
  assert.equal(c.mood, 'settled');
  for (let s = 1; s <= 20; s++) assert.equal(L.willLeave(p, s), false, `he walked in season ${s}`);
});

test('a contract out of date and underpaid is a contract at risk', () => {
  // traits are pinned so the test measures the DEAL, not whichever character
  // this particular name happens to derive (a one-club man never wants away)
  const base = { name: 'Mark Vance', age: 27, rating: 80000, talent: 'steady', traits: ['ironMan'] };
  const safe = L.contract({ ...base, contractUntil: 9, wage: L.wageAsk(base) * 2 }, 3);
  const risky = L.contract({ ...base, contractUntil: 3, wage: 1 }, 3);
  assert.ok(risky.risk > safe.risk, 'the neglected deal should be the risky one');
  assert.equal(safe.mood, 'content');
  assert.ok(['unsettled', 'wants away'].includes(risky.mood), `mood was ${risky.mood}`);
  assert.equal(risky.expiring, true);
  assert.equal(safe.yearsLeft, 6);
  assert.equal(safe.word, '6 seasons left');
  assert.equal(L.contract({ ...base, contractUntil: 4 }, 3).word, 'final season');
});

test('a better player asks for more money', () => {
  const good = L.wageAsk(man('A', 27, 85, 'steady'));
  const poor = L.wageAsk(man('A', 27, 45, 'steady'));
  assert.ok(good > poor * 3, `${good} should dwarf ${poor}`);
  assert.ok(L.wageAsk(man('A', 20, 70, 'steady')) < L.wageAsk(man('A', 27, 70, 'steady')),
    'a 20-year-old should be cheaper than the same player at 27');
  assert.ok(L.wageAsk(man('A', 36, 70, 'steady')) < L.wageAsk(man('A', 27, 70, 'steady')),
    'a 36-year-old should be cheaper than the same player at 27');
});

test('rollSeason reports what happened without changing the man', () => {
  const p = man('Aarav Kulkarni', 19, 52, 'gifted');
  const snapshot = JSON.stringify(p);
  const r = L.rollSeason(p, 1, 1);
  assert.equal(JSON.stringify(p), snapshot, 'rollSeason mutated the player');
  assert.equal(r.ageBefore, 19);
  assert.equal(r.ageAfter, 20);
  assert.equal(r.ovrBefore, 52);
  assert.ok(r.ovrAfter >= 52, 'a gifted teenager playing every week should not go backwards');
  assert.ok(Array.isArray(r.events));
  assert.ok(r.events.every(e => e.kind && e.text));
});

test('a retirement ends the season report there', () => {
  const r = L.rollSeason(man('Old Hand', 41, 60, 'steady'), 2, 1);
  assert.equal(r.retired, true);
  assert.equal(r.ovrAfter, 60, 'a retiring man does not also get a rating change');
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].kind, 'retired');
});

test('the club report says who is coming, who is going and what it costs', () => {
  const rep = L.clubReport(SQUAD, 3, { 'Aarav Kulkarni': 1, 'Ben Hollis': 1 });
  assert.equal(rep.rows.length, SQUAD.length);
  for (const r of rep.rows) {
    assert.equal(r.ceiling, L.ceiling(r.p));
    assert.equal(r.room, r.ceiling - r.ovr);
    assert.ok(r.contract && r.contract.mood);
  }
  assert.ok(rep.rising.every(r => r.swing > 0.3), 'a riser must actually be rising');
  assert.ok(rep.falling.every(r => r.swing < -0.3), 'a faller must actually be falling');
  assert.ok(rep.rising.length >= 1, 'a squad with two teenagers should have somebody improving');
  assert.ok(rep.falling.length >= 1, 'a squad with a 39-year-old should have somebody declining');
  // rising is ordered best-first so the report can be read top-down
  for (let i = 1; i < rep.rising.length; i++) {
    assert.ok(rep.rising[i - 1].swing >= rep.rising[i].swing, 'risers out of order');
  }
  assert.equal(rep.wages, rep.rows.reduce((a, r) => a + r.contract.wage, 0));
  assert.equal(rep.asks, rep.rows.reduce((a, r) => a + r.contract.ask, 0));
  assert.ok(rep.finished.every(r => r.age >= 32), 'only the old are near the end');
});

test('an empty club does not throw', () => {
  const rep = L.clubReport([], 1, {});
  assert.deepEqual(rep.rows, []);
  assert.equal(rep.wages, 0);
  assert.deepEqual(rep.rising, []);
});
