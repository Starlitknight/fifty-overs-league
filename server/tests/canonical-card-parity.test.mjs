// tests/canonical-card-parity.test.mjs — ONE CARD, ON BOTH SIDES OF THE WIRE.
//
// A cricketer's overall is computed in two places that cannot share code: the
// canonical player model in engine/src/00-core.js, which every phone runs, and
// world_pk_num in Postgres, which serves the club pages and the rosters of
// clubs a manager does not own. Nothing but a test can hold those two together.
//
// Nothing did, and they came apart. B2 replaced the client's overall with the
// canonical model and left the SQL computing the formula it replaced - a
// FIFA-style blend with a different scale and shift per role and a 1.32 stretch
// on top. For the length of that commit a served card and a client card
// DISAGREED about the same man, and which number a manager saw depended on
// which page he happened to open.
//
// The guard that existed (world-star-mirror) only ever ran the two over ONE
// club's fifteen. That is a sample of a single tier of a single country: it
// would have caught a formula that was wrong everywhere and missed one that was
// wrong at the ends, which is precisely where a scale-and-shift goes wrong.
//
// So this walks the whole ladder. Four roles - specialist batsman, front-line
// bowler, all-rounder, wicketkeeper - at six overalls from a park cricketer to
// a generational one, with real generated men rather than invented skill rows,
// each moved onto his mark by the engine's own similarity transform so his
// archetype survives the journey. Twenty-four cells, EXACT agreement demanded,
// no tolerance: the card is an integer and there is no rounding to be generous
// about.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DBNAME = 'foworld_parity_test';
let pool, host;
// a deep pool of real cricketers to draw the four roles from
const WORLD = [];

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: EPOCH + 100 * DAY + 12 * 3600000, host });
  // the host hands back the fifteen as a bare array (the browser's own
  // genSquad wraps them in a club); either way it is a squad of real men
  for (let s = 1; s <= 24; s++) {
    const sq = host.genSquad(4100 + s, 'England',
      s % 3 === 0 ? 'express' : s % 3 === 1 ? 'wizard' : 'rock');
    for (const p of (Array.isArray(sq) ? sq : sq.players) || []) WORLD.push(p);
  }
});
after(async () => { await pool.end(); });

// the SQL side, for a list of men, in one round trip
const sqlOvr = async men => (await pool.query(
  `SELECT (world_pk_num(x)->>'ovr')::int AS o FROM jsonb_array_elements($1::jsonb) x`,
  [JSON.stringify(men)])).rows.map(r => r.o);

const isBowler = p => !!(p && p.bowlType && p.bowlType !== 'none');
const isKeeper = p => !!(p && (p.keeper || p.role === 'wicketkeeper'));
const ROLES = {
  batsman:    p => !isBowler(p) && !isKeeper(p) && p.role !== 'allRounder',
  bowler:     p => isBowler(p) && p.role !== 'allRounder' && !isKeeper(p),
  allrounder: p => p.role === 'allRounder',
  keeper:     p => isKeeper(p)
};
const BANDS = [20, 40, 50, 70, 85, 95];

// ---------------------------------------------------------------------------
// THE MAIN CLAIM. Four roles x six overalls, every man's card computed by the
// shipped engine and by Postgres, exactly equal.
// ---------------------------------------------------------------------------
for (const [roleName, pick] of Object.entries(ROLES)) {
  test('a ' + roleName + ' reads the same card in the browser and in the database', async () => {
    const pool10 = WORLD.filter(pick).slice(0, 10);
    assert.ok(pool10.length >= 6, 'a sample of ' + roleName + 's to walk (' + pool10.length + ')');
    for (const target of BANDS) {
      // fresh copies each time: the fit mutates, and a man walked 20 -> 95
      // through six clamps is not the same cricketer as one placed at 95
      const men = host.fitToOvr(JSON.parse(JSON.stringify(pool10)), target);
      const fromEngine = host.pkOvr(men);
      const fromSql = await sqlOvr(men);
      assert.deepEqual(fromSql, fromEngine,
        roleName + ' aimed at ' + target + ': sql ' + JSON.stringify(fromSql) +
        ' vs engine ' + JSON.stringify(fromEngine));
      // and the fit actually put them near the mark, or the cell proves nothing
      const mean = fromEngine.reduce((a, b) => a + b, 0) / fromEngine.length;
      assert.ok(Math.abs(mean - target) <= 8,
        roleName + ' aimed at ' + target + ' landed at ' + mean.toFixed(1) +
        ' - the cell is not testing the band it names');
    }
  });
}

// ---------------------------------------------------------------------------
// AND OVER THE WHOLE WORLD, not only over cricketers a test chose. A formula
// can agree on four clean archetypes and disagree on the man who keeps wicket
// AND bowls, or the one whose bowling is nought because he never had a type.
// ---------------------------------------------------------------------------
test('every cricketer in a founded world reads the same card on both sides', async () => {
  const clubs = (await pool.query('SELECT country_id, slot, squad FROM clubs ORDER BY country_id, slot')).rows;
  assert.ok(clubs.length >= 16, 'a world to walk (' + clubs.length + ' clubs)');
  let checked = 0, bad = [];
  for (const c of clubs) {
    const men = (c.squad || []).filter(p => p && p.name);
    if (!men.length) continue;
    const fromEngine = host.pkOvr(men);
    const fromSql = await sqlOvr(men);
    men.forEach((p, i) => {
      checked++;
      if (fromSql[i] !== fromEngine[i])
        bad.push(c.country_id + '/' + c.slot + ' ' + p.name + ': sql ' + fromSql[i] + ' engine ' + fromEngine[i]);
    });
  }
  assert.ok(checked > 1000, 'a real world was walked (' + checked + ' cricketers)');
  assert.deepEqual(bad.slice(0, 12), [], bad.length + ' of ' + checked + ' cards disagree');
});

// ---------------------------------------------------------------------------
// THE DEGENERATE MEN, written by hand because the world does not deal them:
// the empty player, the man with no skills object at all, the bowler with no
// bowling type, the keeper who also bowls. Each one is a branch in both
// implementations, and a branch nobody exercises is a branch that drifts.
// ---------------------------------------------------------------------------
test('the awkward cases agree too', async () => {
  const flat = v => ({
    vsPace: v, vsSpin: v, power: v, rotation: v, temperament: v,
    wicket: v, economy: v, discipline: v, moveTurn: v, variation: v, stamina: v,
    fielding: v, catching: v, keeping: v, stumping: v
  });
  const cases = [
    { name: 'no skills at all', role: 'topOrderBat' },
    { name: 'empty skills', role: 'topOrderBat', skills: {} },
    { name: 'a flat 50 batsman', role: 'topOrderBat', skills: flat(50) },
    { name: 'a flat 50 bowler', role: 'seamFast', bowlType: 'fast', skills: flat(50) },
    { name: 'a flat 50 keeper', role: 'wicketkeeper', keeper: true, skills: flat(50) },
    { name: 'a flat 50 all-rounder', role: 'allRounder', bowlType: 'medium', skills: flat(50) },
    { name: 'a keeper who bowls', role: 'wicketkeeper', keeper: true, bowlType: 'offSpin', skills: flat(60) },
    { name: 'bowlType none', role: 'topOrderBat', bowlType: 'none', skills: flat(60) },
    { name: 'a maxed cricketer', role: 'allRounder', bowlType: 'fast', skills: flat(99) },
    { name: 'a floor cricketer', role: 'topOrderBat', skills: flat(1) },
    // the one asymmetric case the model exists to get right: bats 90, bowls 30,
    // and is a good batsman rather than a poor all-rounder
    { name: 'a bowling all-rounder who cannot bowl', role: 'allRounder', bowlType: 'medium',
      skills: { ...flat(90), wicket: 30, economy: 30, discipline: 30, moveTurn: 30, variation: 30, stamina: 30 } }
  ];
  const fromEngine = host.pkOvr(cases);
  const fromSql = await sqlOvr(cases);
  cases.forEach((c, i) => assert.equal(fromSql[i], fromEngine[i],
    c.name + ': sql ' + fromSql[i] + ' vs engine ' + fromEngine[i]));
});

// ---------------------------------------------------------------------------
// THE SERVED PAGE, not only the function. world_squads is what a phone
// actually fetches, and a view can publish a stale column of its own.
// ---------------------------------------------------------------------------
test('the served roster shows the canonical card, and its stars come off it', async () => {
  const row = (await pool.query(
    `SELECT players FROM world_squads WHERE country_id='eng' AND slot=1`)).rows[0];
  const squad = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const byName = Object.fromEntries(squad.filter(p => p && p.name).map(p => [p.name, p]));
  assert.ok(row.players.length >= 11);
  for (const shown of row.players) {
    const real = byName[shown.name];
    assert.ok(real, shown.name + ' is a man in the squad');
    const engine = host.pkOvr([real])[0];
    assert.equal(shown.ovr, engine, shown.name + ': roster ' + shown.ovr + ' vs card ' + engine);
    // RATING IS THE CARD TIMES A THOUSAND, and the roster publishes both. If
    // they can disagree, the sort order of a page disagrees with its own numbers.
    assert.equal(shown.rating, engine * 1000,
      shown.name + ': rating ' + shown.rating + ' is not the card ' + engine + ' x 1000');
    // ONE STAR SYSTEM, and it is a pure function of the card
    assert.equal(host.stars(shown.ovr), Math.round((shown.ovr / 10) * 2) / 2,
      shown.name + ' wears the canonical stars');
  }
});

// ---------------------------------------------------------------------------
// THE DISPLAY AGGREGATES, which the same function publishes and which B2 did
// NOT change. They are a reading of one trade rather than an opinion about a
// cricketer, and they must survive a rewrite of the thing beside them - 082's
// first draft rebuilt this function from an old body and silently reverted four
// migrations, so a rewrite proving only its own new claim is not proof.
// ---------------------------------------------------------------------------
test('rewriting the overall did not disturb the aggregates beside it', async () => {
  const squad = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  const men = squad.squad.filter(p => p && p.name);
  const fromEngine = host.starComp(men);
  const fromSql = (await pool.query(
    `SELECT (world_pk_num(x)->>'batComp')::numeric AS b,
            (world_pk_num(x)->>'bowlComp')::numeric AS w
       FROM jsonb_array_elements($1::jsonb) x`, [JSON.stringify(men)])).rows;
  fromSql.forEach((r, i) => {
    assert.ok(Math.abs(Number(r.b) - fromEngine[i].bat) < 1e-6, 'batting composite ' + i);
    if (fromEngine[i].bowl == null) assert.equal(r.w, null, 'a non-bowler has no bowling composite');
    else assert.ok(Math.abs(Number(r.w) - fromEngine[i].bowl) < 1e-6, 'bowling composite ' + i);
  });
});
